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
 * 初回オンボーディング・ポップアップの誘導先 = オーナーの「公式LINE」友だち追加URL（決定 #027）。
 *
 * 連携ファネルの正しい受け皿:
 *   ProX登録 → ポップアップ → ★公式LINE友だち追加（このURL）→ 公式LINE1通目 → プロライン登録
 * 直プロライン誘導（#024旧設計）ではなく、いったん公式LINEで owned list を資産化してから
 * 1通目でプロラインへ誘導する。公式LINEの「あいさつメッセージ（1通目）」はプロライン側に設定済み。
 *
 * 環境変数 NEXT_PUBLIC_ONBOARDING_LINE_URL があれば優先。
 *
 * 注意: かつてここには「オーナー個人LINE」が入っていたが、現在は autosns 管理の
 *   「公式LINE」友だち追加URLが正。個人LINEとは混同しないこと。
 */
const DEFAULT_ONBOARDING_OFFICIAL_LINE_URL = "https://q169hcpg.autosns.app/addfriend/s/cJb9d1rWoB/@303wiftq";

export const ONBOARDING_OFFICIAL_LINE_URL: string =
    process.env.NEXT_PUBLIC_ONBOARDING_LINE_URL && process.env.NEXT_PUBLIC_ONBOARDING_LINE_URL.length > 0
        ? process.env.NEXT_PUBLIC_ONBOARDING_LINE_URL
        : DEFAULT_ONBOARDING_OFFICIAL_LINE_URL;

/**
 * 後方互換エイリアス（旧名 ONBOARDING_LINE_URL を参照する既存コードのため）。
 * 値は公式LINE友だち追加URL（= ONBOARDING_OFFICIAL_LINE_URL）と同一。
 * @deprecated 新規コードは ONBOARDING_OFFICIAL_LINE_URL を使うこと。
 */
export const ONBOARDING_LINE_URL: string = ONBOARDING_OFFICIAL_LINE_URL;


