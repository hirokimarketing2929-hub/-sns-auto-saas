// AI プロバイダ解決の共通ロジック（BYOK ゲート＋当社鍵提供を一元管理）。
//
// 背景（CTO リリース監査 観点5b / ロードマップ B-1）:
//   公開ユーザーが自分の API キーを設定していない場合に、
//   サーバ環境変数 ANTHROPIC_API_KEY（＝オーナー鍵）へフォールバックすると、
//   公開ユーザーの全生成がオーナーの請求に乗る「コスト爆弾」になる。
//
// 方針（決定 #032 / task 011 — フラグでの ON/OFF 切替）:
//   - ユーザー自身のキー（BYOK）が常に最優先（入っていればそれを使う）。
//   - オーナー鍵フォールバックの可否は **BYOK_ENABLED フラグ**で切り替える:
//       * BYOK OFF（β既定 / BYOK_ENABLED!="true"）: オーナー鍵フォールバックを
//         **mvp でも許可** ＝ ユーザーは鍵未登録でも当社鍵で AI 生成できる。
//         代わりに濫用ガード（checkOwnerKeyUsageCap）で 1ユーザー当たりの利用量を頭打ちにする。
//       * BYOK ON（緊急再有効化 / BYOK_ENABLED="true"）: 従来挙動に復帰し、
//         オーナー鍵フォールバックは RELEASE_MODE=full のみ許可（mvp は BYOK 必須）。
//   - フラグは isByokEnabled() に一元化。本ファイルはコード経路を温存（dormant）し、
//     env 1個（BYOK_ENABLED）で挙動が切り替わる。
//
// 各 route はモデル名を env から個別に解決しているため、モデルは引数で受け取る。

import { getReleaseMode, isByokEnabled } from "@/lib/features";
import { decryptSecret } from "@/lib/crypto";

export type ResolvedProvider = {
    name: "anthropic" | "openai";
    apiKey: string;
    model: string;
    source: "user:anthropic" | "user:openai" | "env:anthropic";
};

export type ResolveProviderInput = {
    anthropicApiKey?: string | null;
    openaiApiKey?: string | null;
    anthropicModel: string;
    openaiModel: string;
};

/**
 * オーナー鍵フォールバックが許可される環境か。
 *
 *  - BYOK OFF（β既定）: 常に true。mvp/本番でもユーザーは鍵未登録で当社鍵を使える
 *    （濫用は checkOwnerKeyUsageCap で別途頭打ち）。
 *  - BYOK ON（緊急再有効化）: 従来挙動に復帰。RELEASE_MODE=full のみ true、
 *    mvp（β/本番）では false ＝ BYOK 必須。
 */
export function isOwnerKeyFallbackAllowed(): boolean {
    if (!isByokEnabled()) return true; // BYOK OFF: 当社鍵で常時提供
    return getReleaseMode() === "full"; // BYOK ON: 従来どおり dev-full のみ
}

/**
 * BYOK 鍵（Settings.anthropicApiKey / openaiApiKey）は at-rest で AES-256-GCM 暗号化されて
 * いるため、resolveAIProvider に渡す前に必ずこの関数で復号する。
 *
 * 【重大バグ修正 / task 013-5】これまで各 route は暗号化済み（"enc:v1:..."）の文字列を
 * そのまま resolveAIProvider に渡しており、自鍵（BYOK）利用時に暗号文を API キーとして
 * 送ってしまい必ず認証失敗していた。本関数を通すことで自鍵生成が正しく機能する。
 *
 * decryptSecret は平文（enc:v1: 以外）はそのまま返す（移行期グレース）ため、平文保存・
 * 暗号化保存のどちらでも安全に通せる。復号失敗（改ざん・鍵不一致）は throw されるので、
 * 呼び出し側は「自鍵が壊れている」とみなして当社鍵フォールバックに倒すことを推奨する。
 */
export function resolveAIProviderFromSettings(input: ResolveProviderInput): ResolvedProvider | null {
    let anthropic: string | null | undefined = input.anthropicApiKey;
    let openai: string | null | undefined = input.openaiApiKey;
    try {
        anthropic = decryptSecret(input.anthropicApiKey) ?? null;
    } catch (e) {
        // 自鍵の復号に失敗（鍵不一致・改ざん等）。その鍵は無効として無視し、当社鍵フォールバックに委ねる。
        console.warn("[ai-provider] anthropicApiKey decrypt failed; ignoring user key:", e instanceof Error ? e.message : e);
        anthropic = null;
    }
    try {
        openai = decryptSecret(input.openaiApiKey) ?? null;
    } catch (e) {
        console.warn("[ai-provider] openaiApiKey decrypt failed; ignoring user key:", e instanceof Error ? e.message : e);
        openai = null;
    }
    return resolveAIProvider({
        anthropicApiKey: anthropic,
        openaiApiKey: openai,
        anthropicModel: input.anthropicModel,
        openaiModel: input.openaiModel,
    });
}

/**
 * AI プロバイダを解決する。BYOK を優先し、mvp ではオーナー鍵フォールバックを停止する。
 * 解決できなければ null（＝呼び出し側で「キー未設定」エラーを返す想定）。
 *
 * 注意: 入力の anthropicApiKey/openaiApiKey は「復号済みの平文」であること。
 *   暗号化された Settings の値を直接渡してはいけない（resolveAIProviderFromSettings を使う）。
 */
export function resolveAIProvider(input: ResolveProviderInput): ResolvedProvider | null {
    const userAnthropic = input.anthropicApiKey?.trim();
    if (userAnthropic) {
        return { name: "anthropic", apiKey: userAnthropic, model: input.anthropicModel, source: "user:anthropic" };
    }
    const userOpenai = input.openaiApiKey?.trim();
    if (userOpenai) {
        return { name: "openai", apiKey: userOpenai, model: input.openaiModel, source: "user:openai" };
    }
    // BYOK 未設定。フラグに応じてオーナー鍵フォールバックを許可（許可条件は isOwnerKeyFallbackAllowed）。
    if (isOwnerKeyFallbackAllowed() && process.env.ANTHROPIC_API_KEY) {
        return { name: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: input.anthropicModel, source: "env:anthropic" };
    }
    return null;
}

// =============================================================================
// 濫用ガード（決定 #029 既知5b の恒久解消 / task 011 スコープ3）
// =============================================================================
//
// BYOK OFF 時はオーナー鍵で AI を提供するため、1ユーザーの過剰利用がそのまま
// 当社の Anthropic 請求に乗る。ApiUsageLog（userId+createdAt インデックス済）を
// 集計し、1ユーザー当たり「直近24時間の生成回数」と「直近24時間の概算コスト($)」を
// 上限化する。上限超過時は呼び出し側が 429 を返す。
//
// 注意:
//   - BYOK ON（ユーザーが自分の鍵を使う）時はこのガードは無効（自費のため頭打ち不要）。
//   - 上限値は env で運用調整可能（未設定時は安全側の保守的デフォルト）。
//   - rate-limit.ts の IP 単位ガード（短期バースト抑止）とは別レイヤ。
//     こちらは「ユーザー単位の累積（コスト総量）」を塞ぐ。

import { prisma } from "@/lib/prisma";

function intFromEnv(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 1ユーザー当たり 直近24h の AI 生成回数上限（オーナー鍵提供時）。 */
export function ownerKeyDailyRequestCap(): number {
    return intFromEnv("OWNER_KEY_DAILY_REQUEST_CAP", 50);
}

/** 1ユーザー当たり 直近24h の AI 概算コスト上限（USD, オーナー鍵提供時）。 */
export function ownerKeyDailyCostCapUsd(): number {
    return intFromEnv("OWNER_KEY_DAILY_COST_CAP_USD", 2);
}

export type OwnerKeyUsageCheck =
    | { ok: true }
    | { ok: false; reason: "request" | "cost"; limit: number; used: number };

/**
 * オーナー鍵フォールバックで生成しようとしているユーザーが日次上限内かを判定。
 * BYOK OFF かつ source が当社鍵のときだけ呼ぶ想定（BYOK 利用者は対象外）。
 *
 * 失敗（DB エラー等）は「許可（ok:true）」に倒す ＝ ガードの障害で生成全体を止めない
 *   （DoS 化を避ける）。あくまで濫用の急所を塞ぐ最小ガード。
 */
export async function checkOwnerKeyUsageCap(userId: string): Promise<OwnerKeyUsageCheck> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const rows = await prisma.apiUsageLog.findMany({
            where: {
                userId,
                provider: { in: ["anthropic", "openai"] },
                createdAt: { gte: since },
            },
            select: { costUsd: true },
        });
        const requestCount = rows.length;
        const reqCap = ownerKeyDailyRequestCap();
        if (requestCount >= reqCap) {
            return { ok: false, reason: "request", limit: reqCap, used: requestCount };
        }
        const costUsd = rows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
        const costCap = ownerKeyDailyCostCapUsd();
        if (costUsd >= costCap) {
            return { ok: false, reason: "cost", limit: costCap, used: Number(costUsd.toFixed(4)) };
        }
        return { ok: true };
    } catch (e) {
        console.warn("[ai-provider] checkOwnerKeyUsageCap failed (fail-open):", e);
        return { ok: true };
    }
}

/** 濫用ガード超過時の共通 429 レスポンス（route 側で使う）。 */
export function ownerKeyCapResponse(check: Extract<OwnerKeyUsageCheck, { ok: false }>): Response {
    const msg = check.reason === "cost"
        ? "本日の AI 生成のご利用上限に達しました。明日また再開できます。"
        : "本日の AI 生成回数の上限に達しました。明日また再開できます。";
    return new Response(
        JSON.stringify({ error: msg, message: msg, cap: check.limit, used: check.used, reason: check.reason }),
        { status: 429, headers: { "Content-Type": "application/json" } }
    );
}
