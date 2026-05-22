import { TwitterApi } from "twitter-api-v2";
import { prisma } from "@/lib/prisma";
import { getActiveXAccount } from "@/lib/active-x-account";

/**
 * 指定ユーザーの「アクティブな」サブアカウントに紐づく TwitterApi クライアントを返す。
 * 第 2 引数 xAccountId を渡すとそのアカウント固定で取得（cron / バッチ用）。
 *
 * 1. XAccount に手動 BYOK キーが揃っていればそれを優先（テスト用）
 * 2. なければ XAccount.oauthAccount（NextAuth Account の twitter）の access_token を使用
 * 3. 期限切れ間近なら refresh して NextAuth Account を更新
 */
export async function getTwitterClient(userId: string, xAccountId?: string): Promise<TwitterApi> {
    const xAccount = xAccountId
        ? await prisma.xAccount.findFirst({
            where: { id: xAccountId, userId },
            include: { oauthAccount: true },
        })
        : await getActiveXAccount(userId);

    if (!xAccount) {
        throw new Error("X(Twitter)アカウントが連携されていません。設定画面からアカウントを追加してください。");
    }

    // 1. 手動BYOKキー優先
    if (
        xAccount.xApiKey &&
        xAccount.xApiSecret &&
        xAccount.xAccessToken &&
        xAccount.xAccessSecret
    ) {
        return new TwitterApi({
            appKey: xAccount.xApiKey,
            appSecret: xAccount.xApiSecret,
            accessToken: xAccount.xAccessToken,
            accessSecret: xAccount.xAccessSecret,
        });
    }

    // 2. OAuth トークン
    const oauth = (xAccount as any).oauthAccount;
    if (!oauth || !oauth.access_token) {
        throw new Error(`「${xAccount.displayName}」に X 連携が設定されていません。設定画面で OAuth 連携または手動 API キーを登録してください。`);
    }

    // 3. リフレッシュ判定（期限の 5 分前）
    const now = Math.floor(Date.now() / 1000);
    const isExpired = !oauth.expires_at || oauth.expires_at < (now + 300);

    if (isExpired && oauth.refresh_token) {
        try {
            console.log(`[Twitter OAuth] Refreshing token for user ${userId} / xAccount ${xAccount.id}...`);
            const clientForRefresh = new TwitterApi({
                clientId: process.env.TWITTER_CLIENT_ID as string,
                clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
            });

            const { client: refreshedClient, accessToken, refreshToken: newRefreshToken, expiresIn } =
                await clientForRefresh.refreshOAuth2Token(oauth.refresh_token);

            await prisma.account.update({
                where: { id: oauth.id },
                data: {
                    access_token: accessToken,
                    refresh_token: newRefreshToken,
                    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
                },
            });

            console.log(`[Twitter OAuth] Token refreshed successfully.`);
            return refreshedClient;
        } catch (error) {
            console.error("[Twitter OAuth] Failed to refresh token:", error);
            throw new Error("Xの連携トークンの更新に失敗しました。再度連携し直してください。");
        }
    }

    return new TwitterApi(oauth.access_token);
}
