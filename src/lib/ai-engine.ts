/**
 * Python AI エンジン (api/ の FastAPI, Render デプロイ) への共通呼び出し。
 *
 * - ベースURLを一元化（AI_ENGINE_URL → NEXT_PUBLIC_API_URL → localhost:8000 の順）。
 * - タイムアウトとネットワーク例外を統一処理し、各 route が 500 でクラッシュしないようにする。
 * - 障害は「握り潰さず」呼び出し側へ明示的に伝える（EngineUnavailableError）。
 */

export class EngineUnavailableError extends Error {
    constructor(message: string, readonly cause?: unknown) {
        super(message);
        this.name = "EngineUnavailableError";
    }
}

/** エンジンのベースURLを解決する。 */
export function getEngineBaseUrl(): string {
    return (
        process.env.AI_ENGINE_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:8000"
    ).replace(/\/+$/, "");
}

/**
 * AI エンジンへの fetch。タイムアウト付き。
 * - 接続不可/タイムアウトは EngineUnavailableError を throw。
 * - HTTP エラー(4xx/5xx)はそのまま Response を返す（呼び出し側で res.ok を確認）。
 */
export async function callEngine(
    path: string,
    init: RequestInit = {},
    opts: { timeoutMs?: number } = {}
): Promise<Response> {
    const url = `${getEngineBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
    const timeoutMs = opts.timeoutMs ?? 90000;
    try {
        return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
        // ネットワーク不達・DNS失敗・タイムアウト等
        throw new EngineUnavailableError(
            "AIエンジン(FastAPI)に接続できませんでした。エンジンが起動しているか、AI_ENGINE_URL の設定を確認してください。",
            e
        );
    }
}
