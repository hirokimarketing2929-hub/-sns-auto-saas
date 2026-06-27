// 当社鍵で LLM を呼ぶ全 route 共通のコストガード（findings §205 恒久対策）。
//
// 背景（RT-013 / RT-016 の真因）:
//   「当社鍵フォールバックで LLM を呼ぶ route は gate + cap + rate-limit を必ず通す」という
//   ポリシーが各 route の個別実装に依存していたため、reply-engagement/check POST（gate/cap/rate-limit 皆無）
//   や structure-rewrite（rate-limit 皆無）のように取りこぼしが発生した。
//   本ラッパに集約し、1 関数を呼べば 3 つ全てが必ず適用されるようにして再発を構造的に防ぐ。
//
// 提供する 2 段 API:
//   1) enforceLlmRateLimit(req, route)         — IP 単位レート制限（全 route 共通の連打抑止）。
//   2) acquireOwnerKeyGuard({...})             — atomic 予約（RT-015 TOCTOU 封鎖）+ 24h キャップ（cap）を一括適用。
//                                                返り値の guard.finalize / guard.release で予約行を確定/解放する。
//
// 当社鍵以外（自鍵 BYOK）の場合:
//   - gate（予約）も cap も不要（自費・無制限）。guard は no-op（finalize/release は何もしない）。
//   - ただしレート制限は自鍵でも適用する（連打による基盤負荷・スパム抑止は鍵種別に依らないため）。

import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
    reserveOwnerKeyDailySlot,
    finalizeFreeReservation,
    releaseFreeReservation,
    byokRequiredResponse,
    type FreeReservation,
} from "@/lib/free-trial";
import { checkOwnerKeyUsageCap, ownerKeyCapResponse } from "@/lib/ai-provider";

/**
 * 当社鍵で LLM を呼ぶ route 冒頭で使うレート制限（IP 単位・連打抑止）。
 * ok なら null、超過なら 429 Response（呼び出し側はそのまま return）。
 *
 * @param route  バケットキーの接頭辞（例: "generate", "structure-rewrite", "reply-engage"）。
 * @param limit  ウィンドウ内許容回数（既定 30）。
 * @param windowMs ウィンドウ長（既定 60s）。
 */
export function enforceLlmRateLimit(req: Request, route: string, limit = 30, windowMs = 60_000): Response | null {
    return enforceRateLimit(`${route}:${getClientIp(req)}`, limit, windowMs);
}

export type OwnerKeyGuard = {
    /** ゲート通過後にレスポンスへ載せる「本日の残り無料回数」。 */
    freeRemaining: number;
    /** 1 日の無料上限（UI 表示用）。 */
    freeLimit: number;
    /** 自鍵（BYOK）利用か。true なら無制限（予約なし）。 */
    usingOwnKey: boolean;
    /** 生成成功時に予約行を実績へ確定する（usingOwnKey / 予約なしのときは no-op）。 */
    finalize: (args: {
        provider: "anthropic" | "openai";
        operation: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
    }) => Promise<void>;
    /** 生成が一切成功しなかった場合に予約行を解放する（無料枠を焼かない）。 */
    release: () => Promise<void>;
};

export type AcquireGuardResult =
    | { ok: true; guard: OwnerKeyGuard }
    | { ok: false; response: Response };

/**
 * 当社鍵 LLM 呼び出しの atomic ガードを取得する。
 *
 * 手順（当社鍵時 usingOwnKey=false のみ）:
 *   1. reserveOwnerKeyDailySlot で「本日1枠」を atomic に予約（pg_advisory_xact_lock で直列化）。
 *      取れなければ 402 byok_required（並列レースでも 1 本しか取れない＝RT-015 封鎖）。
 *   2. 24h ローリングの当社鍵キャップ（checkOwnerKeyUsageCap）を判定。超過なら予約を解放して 429。
 *
 * 自鍵時（usingOwnKey=true）は予約・キャップとも不要 ＝ 即 ok（finalize/release は no-op）。
 *
 * 呼び出し側は:
 *   - 生成成功 → guard.finalize({...実トークン/コスト...}) を呼ぶ（予約行を実績へ確定）。
 *   - 生成が一切成功しなかった → guard.release() を呼ぶ（予約行を削除して無料枠を温存）。
 *   なお finalize/release は当社鍵以外では no-op なので無条件に呼んでよい。
 */
export async function acquireOwnerKeyGuard(opts: {
    userId: string;
    usingOwnKey: boolean;
    operation: string;
    model: string;
}): Promise<AcquireGuardResult> {
    const { userId, usingOwnKey, operation, model } = opts;

    // 1) atomic 予約（gate）。当社鍵以外は no-op で reserved:true / reservationId:"" が返る。
    const reservation: FreeReservation = await reserveOwnerKeyDailySlot(userId, usingOwnKey, operation, model);
    if (!reservation.reserved) {
        return { ok: false, response: byokRequiredResponse(reservation.freeLimit) };
    }
    const reservationId = reservation.reservationId;

    // 2) 24h キャップ（当社鍵フォールバック時だけ）。超過なら予約を解放してから 429。
    if (!usingOwnKey) {
        const cap = await checkOwnerKeyUsageCap(userId);
        if (!cap.ok) {
            await releaseFreeReservation(reservationId);
            return { ok: false, response: ownerKeyCapResponse(cap) };
        }
    }

    const guard: OwnerKeyGuard = {
        freeRemaining: reservation.freeRemaining,
        freeLimit: reservation.freeLimit,
        usingOwnKey,
        finalize: (args) =>
            finalizeFreeReservation({
                reservationId,
                provider: args.provider,
                operation: args.operation,
                model: args.model,
                inputTokens: args.inputTokens,
                outputTokens: args.outputTokens,
                costUsd: args.costUsd,
            }),
        release: () => releaseFreeReservation(reservationId),
    };
    return { ok: true, guard };
}
