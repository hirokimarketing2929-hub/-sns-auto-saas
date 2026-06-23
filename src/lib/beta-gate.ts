// クローズドβ 招待制ゲート（ロードマップ B-4）。
//
// 背景（CTO 監査 観点8 / B-4）:
//   6/30 はクローズドβ＝招待者のみ。誰でも登録できる状態は不可。
//   認証堅牢化（PW要件・メール認証・2FA）はフル公開まで保留するため、
//   その間の入口を「招待コード必須」で絞る。
//
// 設計（マイグレーション不要・最小実装）:
//   - 環境変数 BETA_INVITE_CODES にカンマ区切りで有効な招待コードを列挙。
//   - RELEASE_MODE=mvp（β/本番）では登録時に有効コードを必須化。
//   - RELEASE_MODE=full（dev-full）では従来どおりコード不要（開発の妨げにしない）。
//   - コードは「許可リスト」方式。使い切り(消費)管理はβ規模では過剰なので行わない
//     （必要になればコードを差し替え/失効させる運用で対応）。

import { getReleaseMode } from "@/lib/features";

/** β招待制ゲートを有効化すべき環境か（mvp のみ）。 */
export function isInviteGateEnabled(): boolean {
    return getReleaseMode() === "mvp";
}

/** 設定済みの有効な招待コード一覧（trim 済み・空要素除去）。 */
export function getValidInviteCodes(): string[] {
    return (process.env.BETA_INVITE_CODES || "")
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
}

/**
 * 登録リクエストの招待コードを検証する。
 * - ゲート無効(full): 常に許可。
 * - ゲート有効(mvp)だが有効コードが1つも設定されていない: 登録を全面停止（fail-closed）。
 * - ゲート有効(mvp): 提示コードが許可リストに含まれていれば許可。
 */
export function checkInviteCode(code: string | undefined | null): { ok: true } | { ok: false; message: string } {
    if (!isInviteGateEnabled()) return { ok: true };

    const valid = getValidInviteCodes();
    if (valid.length === 0) {
        // mvp なのに招待コードが未設定 ＝ 誤って誰でも登録できる事故を防ぐため閉じる。
        return { ok: false, message: "現在、新規登録は招待制です。招待コードの発行についてはお問い合わせください。" };
    }

    const provided = (code || "").trim();
    if (!provided || !valid.includes(provided)) {
        return { ok: false, message: "招待コードが正しくありません。クローズドβは招待制です。" };
    }
    return { ok: true };
}
