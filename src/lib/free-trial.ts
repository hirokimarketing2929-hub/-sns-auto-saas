// フリーミアム「1日1回無料 → BYOK（自鍵）」の共通ロジック（決定 #033 / task 013）。
//
// 方針（2026-06-27 更新: 「累計3回」→「1日1回（毎日リセット）」）:
//   - 当社鍵（ANTHROPIC_API_KEY ＝ source:"env:anthropic"）で AI 生成に成功した「本日の」回数を上限化する。
//   - 上限は env FREE_DAILY_GENERATIONS（既定 1）。毎日リセット（暦日の境界で 0 に戻る）。
//   - 自分の鍵（BYOK / source:"user:*"）で生成した分は対象外＝無制限・無料カウント非加算。
//   - 本日の当社鍵生成 < 上限 → 当社鍵で許可。本日 ≥ 上限 → 402 byok_required（明日また1回無料）。
//
// カウント基準（新規スキーマを足さない設計）:
//   既存の ApiUsageLog（userId+createdAt インデックス済）を流用し、「本日（暦日）」の
//   provider in (anthropic, openai) の生成行数を数える。
//   ※ このゲートは自鍵未設定ユーザー（usingOwnKey=false）にのみ適用するため、
//     対象ユーザーの本日の生成は全て当社鍵生成とみなせる（自鍵ユーザーはゲートを通らない）。
//
// 既存の日次 $2/50req ガード（checkOwnerKeyUsageCap, 直近24h ローリング）は本上限の「内側」で
// 多層防御として温存する（本ファイルは「暦日1回」、あちらは「24hローリングの総量上限」と役割が別）。

import { prisma } from "@/lib/prisma";

/** 1日の無料生成回数の上限（当社鍵・暦日リセット）。env FREE_DAILY_GENERATIONS（既定 1）。 */
export function freeDailyLimit(): number {
    const raw = process.env.FREE_DAILY_GENERATIONS?.trim();
    if (!raw) return 1;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
}

/** 暦日の開始時刻（ローカルタイム = サーバ TZ）。本日の生成カウントの下限に使う。 */
function startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

export type FreeUsageStatus = {
    /** 自分の鍵（BYOK）を使っているか。true なら無料カウントの対象外（無制限）。 */
    usingOwnKey: boolean;
    /** 1日の無料上限。 */
    freeLimit: number;
    /** 本日の当社鍵での消費回数。 */
    freeUsed: number;
    /** 本日の残りの無料回数（usingOwnKey のときは freeLimit を返す＝表示側は非表示にする）。 */
    freeRemaining: number;
    /** 毎日リセットされる（UI 文言用）。常に true。 */
    resetsDaily: true;
};

/**
 * 本日の当社鍵での生成回数を数える（ApiUsageLog 流用・暦日基準）。
 * DB エラー時は安全側（0 回）に倒す（ガードの障害で生成全体を止めない）。
 */
async function countTodayOwnerKeyGenerations(userId: string): Promise<number> {
    try {
        return await prisma.apiUsageLog.count({
            where: {
                userId,
                provider: { in: ["anthropic", "openai"] },
                createdAt: { gte: startOfToday() },
            },
        });
    } catch (e) {
        console.warn("[free-trial] countTodayOwnerKeyGenerations failed (fail-open):", e);
        return 0;
    }
}

/**
 * ユーザーの本日の無料状況を取得する。
 *  - usingOwnKey=true: 残回数は気にしなくてよい（BYOK は無制限）。freeRemaining=freeLimit を返すが UI 側は非表示にする。
 *  - usingOwnKey=false: 当社鍵利用者。freeRemaining = max(0, freeLimit - 本日の生成数)。
 */
export async function getFreeUsageStatus(userId: string, usingOwnKey: boolean): Promise<FreeUsageStatus> {
    const freeLimit = freeDailyLimit();
    if (usingOwnKey) {
        return { usingOwnKey: true, freeLimit, freeUsed: 0, freeRemaining: freeLimit, resetsDaily: true };
    }
    const freeUsed = await countTodayOwnerKeyGenerations(userId);
    const freeRemaining = Math.max(0, freeLimit - freeUsed);
    return { usingOwnKey: false, freeLimit, freeUsed, freeRemaining, resetsDaily: true };
}

/**
 * 当社鍵での無料生成が「これから1回」可能かを判定する。
 *  - usingOwnKey=true: 常に許可（無制限・当社鍵を経由しない）。
 *  - usingOwnKey=false: 本日の生成数 < 上限のときだけ許可。
 *
 * 消費（カウント加算）は別途 ApiUsageLog への記録（logLlmUsage）で行われるため、
 * 本関数の呼び出しと生成後ログで「本日の回数」が自然に増える（明示的 increment は不要）。
 */
export type FreeGateResult =
    | { allowed: true; usingOwnKey: boolean; freeRemaining: number; freeLimit: number }
    | { allowed: false; freeRemaining: 0; freeLimit: number };

export async function checkFreeDailyGate(userId: string, usingOwnKey: boolean): Promise<FreeGateResult> {
    const status = await getFreeUsageStatus(userId, usingOwnKey);
    if (usingOwnKey) {
        return { allowed: true, usingOwnKey: true, freeRemaining: status.freeRemaining, freeLimit: status.freeLimit };
    }
    if (status.freeRemaining > 0) {
        return { allowed: true, usingOwnKey: false, freeRemaining: status.freeRemaining, freeLimit: status.freeLimit };
    }
    return { allowed: false, freeRemaining: 0, freeLimit: status.freeLimit };
}

/**
 * 当社鍵での生成に成功した後に返す「本日の残り回数」。
 * カウントは ApiUsageLog 側で増えるため、ゲート通過時点の freeRemaining から 1 引いた値を返す
 * （= 生成1回ぶんを反映した残り。負にはしない）。
 */
export function remainingAfterGeneration(gate: Extract<FreeGateResult, { allowed: true }>): number {
    if (gate.usingOwnKey) return gate.freeLimit; // 自鍵は無制限（UI 非表示）
    return Math.max(0, gate.freeRemaining - 1);
}

/** 402 byok_required の共通レスポンス（route 側で使う）。 */
export function byokRequiredResponse(freeLimit: number): Response {
    const message = "本日の無料分を使い切りました。続けて使うにはご自身のAPIキーを設定してください（明日また1回無料）。";
    return new Response(
        JSON.stringify({ error: "byok_required", freeRemaining: 0, freeLimit, message }),
        { status: 402, headers: { "Content-Type": "application/json" } }
    );
}

// =============================================================================
// RT-015 対策: フリーミアム「1日1回」ゲートの atomic 予約（TOCTOU 並列レース封鎖）
// =============================================================================
//
// 旧 checkFreeDailyGate は count-then-act（数える→生成→後でログ）。N 本同時並列だと
// 全リクエストが「本日0回 < 1」を読み、上限1なのに N 本通ってしまう（findings RT-015）。
//
// 対策（スキーマ追加なし）:
//   PostgreSQL の pg_advisory_xact_lock でユーザー単位に直列化し、トランザクション内で
//   「本日の当社鍵生成数を数える → 上限未満なら予約行（ApiUsageLog の success=false プレースホルダ）を
//    その場で INSERT」までを atomic に行う。これにより同時実行は1本だけが予約に成功する。
//
//   - 予約行は provider in (anthropic, openai) なので、後続の同時リクエストが数える本日カウントに
//     即座に反映される（＝レース封鎖）。
//   - 生成成功時は finalizeFreeReservation で実トークン/コストへ更新（success=true）。
//   - 生成が一切成功しなかった（本文ゼロ）場合は releaseFreeReservation で予約行を削除し、
//     その日の無料枠を無駄に焼かない。
//   - 当社鍵以外（自鍵/BYOK）は予約不要（無制限）。
//   - DB エラー時は安全側に倒す方針は踏襲するが、「予約 INSERT 自体が失敗」したら fail-closed
//     （予約できない＝生成させない）にする。count だけの fail-open と違い、予約は実コスト発生の
//     直前ガードなので、ここで開けるとレース対策が無意味になるため。

import type { Prisma } from "@prisma/client";

export type FreeReservation =
    | { reserved: true; reservationId: string; freeRemaining: number; freeLimit: number; usingOwnKey: boolean }
    | { reserved: false; freeRemaining: 0; freeLimit: number };

/**
 * 当社鍵での「本日1回」枠を atomic に1つ予約する。
 *  - usingOwnKey=true: 予約不要（無制限）。reservationId は空文字を返す（finalize/release は no-op）。
 *  - usingOwnKey=false: advisory lock で直列化し、本日カウント < 上限 のときだけ予約行を INSERT。
 *
 * 戻り値 reserved=false は「本日の無料分を使い切り」＝呼び出し側は byokRequiredResponse を返す。
 */
export async function reserveOwnerKeyDailySlot(
    userId: string,
    usingOwnKey: boolean,
    operation: string,
    model: string,
): Promise<FreeReservation> {
    const freeLimit = freeDailyLimit();
    if (usingOwnKey) {
        // 自鍵は無制限。予約しない（finalize/release が no-op になるよう reservationId="" を返す）。
        return { reserved: true, reservationId: "", freeRemaining: freeLimit, freeLimit, usingOwnKey: true };
    }

    const since = startOfToday();
    try {
        return await prisma.$transaction(async (tx) => {
            // ユーザー単位の advisory lock（トランザクション終了で自動解放）。
            // userId 文字列を 64bit ハッシュにして bigint キーにする。
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;

            const used = await tx.apiUsageLog.count({
                where: {
                    userId,
                    provider: { in: ["anthropic", "openai"] },
                    createdAt: { gte: since },
                },
            });
            if (used >= freeLimit) {
                return { reserved: false, freeRemaining: 0, freeLimit } as FreeReservation;
            }

            // 予約行（プレースホルダ）。success=false / 0 トークンで作り、finalize で確定する。
            // provider in (anthropic, openai) なので後続の本日カウントに即反映される（レース封鎖）。
            const row = await tx.apiUsageLog.create({
                data: {
                    userId,
                    provider: "anthropic",
                    operation: `${operation}:reserved`,
                    model,
                    inputTokens: 0,
                    outputTokens: 0,
                    costUsd: 0,
                    success: false,
                },
                select: { id: true },
            });
            const freeRemaining = Math.max(0, freeLimit - (used + 1));
            return { reserved: true, reservationId: row.id, freeRemaining, freeLimit, usingOwnKey: false } as FreeReservation;
        });
    } catch (e) {
        // 予約は実コスト発生の直前ガード。ここで開けるとレース対策が無意味になるため fail-closed。
        console.warn("[free-trial] reserveOwnerKeyDailySlot failed (fail-closed):", e);
        return { reserved: false, freeRemaining: 0, freeLimit };
    }
}

/**
 * 予約行を「実績」へ確定する（生成成功時）。トークン/コスト/operation を実値へ更新。
 * usingOwnKey（reservationId="")や予約なしのときは no-op。失敗は握りつぶす（業務は止めない）。
 */
export async function finalizeFreeReservation(args: {
    reservationId: string;
    provider: "anthropic" | "openai";
    operation: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
}): Promise<void> {
    if (!args.reservationId) return;
    try {
        const data: Prisma.ApiUsageLogUpdateInput = {
            provider: args.provider,
            operation: args.operation,
            model: args.model,
            inputTokens: args.inputTokens,
            outputTokens: args.outputTokens,
            costUsd: args.costUsd,
            success: true,
        };
        await prisma.apiUsageLog.update({ where: { id: args.reservationId }, data });
    } catch (e) {
        console.warn("[free-trial] finalizeFreeReservation failed:", e);
    }
}

/**
 * 予約行を削除する（生成が一切成功しなかった場合に無料枠を焼かないため）。
 * usingOwnKey（reservationId="")や予約なしのときは no-op。失敗は握りつぶす。
 */
export async function releaseFreeReservation(reservationId: string): Promise<void> {
    if (!reservationId) return;
    try {
        await prisma.apiUsageLog.delete({ where: { id: reservationId } });
    } catch (e) {
        console.warn("[free-trial] releaseFreeReservation failed:", e);
    }
}
