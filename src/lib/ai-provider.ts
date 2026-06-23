// AI プロバイダ解決の共通ロジック（BYOK 必須化のゲートを一元管理）。
//
// 背景（CTO リリース監査 観点5b / ロードマップ B-1）:
//   公開ユーザーが自分の API キーを設定していない場合に、
//   サーバ環境変数 ANTHROPIC_API_KEY（＝オーナー鍵）へフォールバックすると、
//   公開ユーザーの全生成がオーナーの請求に乗る「コスト爆弾」になる。
//
// 方針:
//   - ユーザー自身のキー（BYOK）が最優先。
//   - オーナー鍵フォールバックは RELEASE_MODE=full（dev-full）でのみ許可する開発者用途に限定。
//     RELEASE_MODE=mvp（クローズドβ / 本番）では **オーナー鍵フォールバックを完全停止** ＝ BYOK 必須。
//   - 結果として mvp で BYOK 未設定なら provider=null となり、
//     呼び出し側の既存 null ガードが「キーを設定してください」エラーを返す（挙動は据え置き）。
//
// 各 route はモデル名を env から個別に解決しているため、モデルは引数で受け取る。

import { getReleaseMode } from "@/lib/features";

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
 * dev-full（RELEASE_MODE!=mvp）でのみ true。mvp（β/本番）では false ＝ BYOK 必須。
 */
export function isOwnerKeyFallbackAllowed(): boolean {
    return getReleaseMode() === "full";
}

/**
 * AI プロバイダを解決する。BYOK を優先し、mvp ではオーナー鍵フォールバックを停止する。
 * 解決できなければ null（＝呼び出し側で「キー未設定」エラーを返す想定）。
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
    // BYOK 未設定。dev-full に限りオーナー鍵フォールバックを許可（コスト爆弾回避のため mvp では停止）。
    if (isOwnerKeyFallbackAllowed() && process.env.ANTHROPIC_API_KEY) {
        return { name: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: input.anthropicModel, source: "env:anthropic" };
    }
    return null;
}
