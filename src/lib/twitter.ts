import { TwitterApi } from "twitter-api-v2";
import { prisma } from "@/lib/prisma";

/**
 * ユーザーIDに紐づくTwitterApiクライアントを取得する
 * 1. Settingsに手動入力(BYOK)のAPIキーがあればそれを優先して返す（テスト用）
 * 2. なければAccountテーブルのOAuth 2.0トークンを取得
 * 3. トークンが期限切れ（または近い）場合はリフレッシュしてDBを更新する
 */
export async function getTwitterClient(userId: string): Promise<TwitterApi> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { settings: true, accounts: true }
    });

    if (!user) {
        throw new Error("ユーザー情報の取得に失敗しました");
    }

    const settings = user.settings;
    
    // 1. 手動のAPIキー設定があるかチェック (BYOK優先)
    const hasManualKeys = settings && 
                          settings.xApiKey && 
                          settings.xApiSecret && 
                          settings.xAccessToken && 
                          settings.xAccessSecret;

    if (hasManualKeys) {
        return new TwitterApi({
            appKey: settings.xApiKey as string,
            appSecret: settings.xApiSecret as string,
            accessToken: settings.xAccessToken as string,
            accessSecret: settings.xAccessSecret as string,
        });
    }

    // 2. OAuthコンシューマートークンがあるかチェック
    const twitterAccount = user.accounts.find((acc) => acc.provider === "twitter");
    if (!twitterAccount || !twitterAccount.access_token) {
        throw new Error("X(Twitter)アカウントが連携されていません。設定画面から連携してください。");
    }

    // 3. トークンの有効期限チェックとリフレッシュ処理
    const now = Math.floor(Date.now() / 1000);
    // 期限まで5分(300秒)を切っていたらリフレッシュする
    const isExpired = !twitterAccount.expires_at || twitterAccount.expires_at < (now + 300);

    if (isExpired && twitterAccount.refresh_token) {
        try {
            console.log(`[Twitter OAuth] Refreshing token for user ${userId}...`);
            const clientForRefresh = new TwitterApi({
                clientId: process.env.TWITTER_CLIENT_ID as string,
                clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
            });

            // refreshOAuth2Token(refreshToken) は新しい accessToken 等を返す
            const { client: refreshedClient, accessToken, refreshToken: newRefreshToken, expiresIn } = 
                await clientForRefresh.refreshOAuth2Token(twitterAccount.refresh_token);

            // DBを新しいトークンで更新
            await prisma.account.update({
                where: { id: twitterAccount.id },
                data: {
                    access_token: accessToken,
                    refresh_token: newRefreshToken,
                    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
                }
            });

            console.log(`[Twitter OAuth] Token refreshed successfully.`);
            return refreshedClient;
        } catch (error) {
            console.error("[Twitter OAuth] Failed to refresh token:", error);
            throw new Error("Xの連携トークンの更新に失敗しました。再度連携し直してください。");
        }
    }

    // 有効期限内なら既存のアクセストークンでクライアント作成
    return new TwitterApi(twitterAccount.access_token);
}
