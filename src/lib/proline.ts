/**
 * ProLine（プロラインフリー）アフィリエイト導線のリンク管理。
 *
 * マネタイズの本体: このアプリから ProLine への登録が成立するとアフィリエイト報酬が発生する。
 * オーナー固有のアフィリエイトURLを環境変数で差し込めるようにし、未設定時は通常の登録URLにフォールバックする。
 *
 * 設定方法（.env / Vercel の環境変数）:
 *   NEXT_PUBLIC_PROLINE_URL="https://...（あなたのProLineアフィリエイトリンク）"
 *
 * クライアントコンポーネントから参照するため NEXT_PUBLIC_ プレフィックス必須。
 */

// 未設定時のフォールバック（非アフィリエイトの通常登録URL）
const DEFAULT_PROLINE_URL = "https://proline.app/";

/**
 * 表示・CTA に使う ProLine リンク。
 * 環境変数が設定されていればそれを優先し、なければ通常URLを返す。
 */
export const PROLINE_URL: string =
    process.env.NEXT_PUBLIC_PROLINE_URL && process.env.NEXT_PUBLIC_PROLINE_URL.length > 0
        ? process.env.NEXT_PUBLIC_PROLINE_URL
        : DEFAULT_PROLINE_URL;
