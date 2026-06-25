// リリース機能ゲーティング。
//
// 環境変数 RELEASE_MODE で本番(MVP)の絞り込みを制御する:
//   - "mvp"  … 本番リリース。MVP_HIDDEN_FEATURES の機能だけ隠す。
//   - "full" … 既定(開発)。全機能を表示する。
//
// 重要: ここで制御するのは「表示(サイドバー)」と「ページへの到達(ルートガード)」だけ。
// DB のデータや API・cron は削除せず温存する。よって開発(full)では従来どおり全機能が見える。
//
// 方針: 「隠す対象」だけを列挙するブロックリスト方式。新しいページが増えても既定で表示されるので、
// 絞り込み対象(4つ)だけメンテナンスすればよい。
//
// サーバーコンポーネント(layout.tsx / page.tsx)から参照する想定。

export type FeatureKey =
    | "dashboard"
    | "accounts"
    | "knowledge"
    | "research"
    | "generate"
    | "schedule"
    | "autoreply"
    | "settings"
    | "help"
    | "contact"
    | "proline"
    | "replyEngagement"
    | "analysis"
    | "kpi"
    | "media"
    // Python(FastAPI) AIエンジン依存機能。mvp(外部公開)では縮退して隠す（CTO決定003 §3）。
    // 対象: リサーチ横展開(repurpose/account)・ナレッジ自動解析(analyze/knowledge-upload)。
    | "pythonAI";

// 本番(MVP)で隠す機能。吉留さんの確定スコープ(2026-06-22)。
// これ以外（アカウント連携/ナレッジ/リサーチ/投稿作成/スケジューラー/自動リプライ/設定/
// ダッシュボード/ヘルプ/問い合わせ/ProLine 等）は本番でも表示する。
const MVP_HIDDEN_FEATURES: ReadonlyArray<FeatureKey> = [
    "replyEngagement",
    "analysis",
    "kpi",
    "media",
    // Python AIエンジン依存。外部公開(mvp)では単一障害点を晒さないため縮退（CTO決定003 §3）。
    "pythonAI",
];

// RT-001 対策（fail-safe）: 安全装置を環境変数1個の「正常系」に賭けない。
// 既定を最も安全な側（mvp = 招待ゲートON・BYOK必須・機能縮退）に倒す。
//   - 値が厳密に "full" のときだけ full（＝開発者が明示した場合のみ全開放）。
//   - 未設定・スペルミス・前後空白・"MVP"/"prod" 等の誤設定はすべて mvp に縮退する。
// これにより「設定漏れで全βセーフガードが同時失効」する単一障害点を構造的に解消する。
export function getReleaseMode(): "mvp" | "full" {
    return process.env.RELEASE_MODE?.trim() === "full" ? "full" : "mvp";
}

export function isFeatureEnabled(key: FeatureKey): boolean {
    if (getReleaseMode() === "full") return true;
    return !MVP_HIDDEN_FEATURES.includes(key);
}

/**
 * ルートガード用ヘルパー。無効な機能なら true を返す（呼び出し側で redirect する）。
 */
export function isFeatureDisabled(key: FeatureKey): boolean {
    return !isFeatureEnabled(key);
}

/**
 * API route 用の縮退ガード。対象機能が mvp で無効なら 503 Response を返す（route 冒頭で使う）。
 * 有効なら null を返す。
 *
 *   const gated = featureGateResponse("pythonAI");
 *   if (gated) return gated;
 */
export function featureGateResponse(key: FeatureKey): Response | null {
    if (isFeatureEnabled(key)) return null;
    return new Response(
        JSON.stringify({ message: "この機能は現在ご利用いただけません。" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
    );
}
