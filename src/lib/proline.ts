/**
 * ProLine（プロラインフリー）アフィリエイト導線のリンク管理。
 *
 * マネタイズの本体: このアプリから ProLine への登録が成立するとアフィリエイト報酬が発生する。
 * オーナー固有のアフィリエイトURLをデフォルトとして焼き込み、必要なら環境変数で上書きできる。
 *
 * 上書き方法（任意・.env / Vercel の環境変数）:
 *   NEXT_PUBLIC_PROLINE_URL="https://...（ベースLP）"
 *   NEXT_PUBLIC_PROLINE_DIRECT_URL="https://.../direct（LINE友だち追加に直行）"
 *
 * クライアントコンポーネントから参照するため NEXT_PUBLIC_ プレフィックス必須。
 */

// オーナーの ProLine アフィリエイトリンク（ベースLP / ブログ型）。
const DEFAULT_PROLINE_URL = "https://q169hcpg.proline.blog";

/**
 * ベースの ProLine アフィリエイトリンク（ウォームなLP導線）。
 * 環境変数があれば優先、なければオーナーの確定URL。
 */
export const PROLINE_URL: string =
    process.env.NEXT_PUBLIC_PROLINE_URL && process.env.NEXT_PUBLIC_PROLINE_URL.length > 0
        ? process.env.NEXT_PUBLIC_PROLINE_URL
        : DEFAULT_PROLINE_URL;

/**
 * 直接LINE友だち追加に飛ばすリンク（コンバージョン確定動作）。
 * 最終CTAボタンで使用し、成約までの摩擦を最小化する。
 * 環境変数があれば優先、なければベースURLに `/direct` を付与（末尾スラッシュは正規化）。
 */
export const PROLINE_DIRECT_URL: string =
    process.env.NEXT_PUBLIC_PROLINE_DIRECT_URL && process.env.NEXT_PUBLIC_PROLINE_DIRECT_URL.length > 0
        ? process.env.NEXT_PUBLIC_PROLINE_DIRECT_URL
        : `${PROLINE_URL.replace(/\/+$/, "")}/direct`;

/**
 * 初回ログインポップアップの誘導先（オーナー本人の LINE 友だち追加URL）。
 * ProLine アフィリではなく、オーナーのアカウントに直接つなぐ。
 * 環境変数 NEXT_PUBLIC_ONBOARDING_LINE_URL があれば優先。
 */
const DEFAULT_ONBOARDING_LINE_URL = "https://q169hcpg.autosns.app/addfriend/s/cJb9d1rWoB/@303wiftq";

export const ONBOARDING_LINE_URL: string =
    process.env.NEXT_PUBLIC_ONBOARDING_LINE_URL && process.env.NEXT_PUBLIC_ONBOARDING_LINE_URL.length > 0
        ? process.env.NEXT_PUBLIC_ONBOARDING_LINE_URL
        : DEFAULT_ONBOARDING_LINE_URL;


