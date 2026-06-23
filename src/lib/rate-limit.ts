/**
 * 最小レート制限（CTO決定 003 §G4）。
 *
 * 方針: 7日で確実に入る最小十分解。外部依存（upstash等）を足さず、
 *       プロセス内メモリの固定ウィンドウカウンタで実装する。
 *
 * 注意（運用上の前提）:
 *   - インスタンス毎に独立したカウンタ。単一インスタンス運用（現状の Render/Vercel 単機）では十分。
 *     将来マルチインスタンス化したら共有ストア（Redis/Upstash）へ差し替える（公開後タスク）。
 *   - これは「濫用の急所を塞ぐ最小ガード」であり、厳密な分散レート制限ではない。
 *
 * 対象（CTO §G4）: 認証系 / AIコスト系(research・generate) / funnel webhook 受信。
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// メモリリーク防止: 期限切れバケットを間引く（10分毎・最初のアクセス契機）。
let lastSweep = 0;
function sweep(now: number) {
    if (now - lastSweep < 10 * 60 * 1000) return;
    lastSweep = now;
    for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
    }
}

export interface RateLimitResult {
    ok: boolean;
    remaining: number;
    resetAt: number;
}

/**
 * 固定ウィンドウのレート判定。
 * @param key      識別子（"<route>:<ip or userId>" を推奨）
 * @param limit    ウィンドウ内の許容回数
 * @param windowMs ウィンドウ長（ミリ秒）
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    sweep(now);

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { ok: true, remaining: limit - 1, resetAt };
    }

    if (existing.count >= limit) {
        return { ok: false, remaining: 0, resetAt: existing.resetAt };
    }

    existing.count += 1;
    return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/**
 * リクエストからクライアント識別子（IP）を推定する。
 * プロキシ(Vercel/Render)経由のため x-forwarded-for を優先。
 */
export function getClientIp(req: Request): string {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return req.headers.get("x-real-ip") || "unknown";
}

/**
 * レート超過時の共通 429 レスポンス。route 側で result.ok=false の時に返す。
 */
export function rateLimitResponse(result: RateLimitResult) {
    const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return new Response(
        JSON.stringify({ message: "リクエストが多すぎます。しばらく待って再試行してください。" }),
        {
            status: 429,
            headers: {
                "Content-Type": "application/json",
                "Retry-After": String(retryAfterSec),
            },
        }
    );
}

/**
 * route 冒頭で1行で使える糖衣。ok なら null、超過なら 429 Response を返す。
 *
 *   const limited = enforceRateLimit(`generate:${ip}`, 20, 60_000);
 *   if (limited) return limited;
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number): Response | null {
    const result = rateLimit(key, limit, windowMs);
    return result.ok ? null : rateLimitResponse(result);
}
