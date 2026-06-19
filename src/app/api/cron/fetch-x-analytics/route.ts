import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";

export async function GET(req: Request) {
    // 簡易的な認証（実運用では VERCEL_CRON_SECRET などを検証）
    const authHeader = req.headers.get("authorization");
    const isCron = req.headers.get("user-agent")?.includes("cron") || 
                   (authHeader === `Bearer ${process.env.CRON_SECRET}`);

    if (process.env.NODE_ENV === "production" && !isCron) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        // multi-account 対応: BYOK または OAuth 連携を持つ全 XAccount を対象に同期する
        const xAccounts = await prisma.xAccount.findMany({
            where: {
                OR: [
                    {
                        AND: [
                            { xApiKey: { not: null } },
                            { xApiSecret: { not: null } },
                            { xAccessToken: { not: null } },
                            { xAccessSecret: { not: null } },
                        ],
                    },
                    { oauthAccountId: { not: null } },
                ],
            },
        });

        let updatedCount = 0;

        for (const xa of xAccounts) {
            try {
                // xAccountId 固定で認証クライアントを取得（BYOK/OAuth 判定・トークンリフレッシュは内部処理）
                const client = await getTwitterClient(xa.userId, xa.id);
                const xAccountId = xa.id;

                // Read Only (V2) クライアント
                const roClient = client.readOnly;
                
                // 認証ユーザー自身の情報を取得
                const me = await roClient.v2.me();
                const userId = me.data.id;

                // 直近のツイート（最大10件程度）を取得し、non_public_metrics を指定
                const tweets = await roClient.v2.userTimeline(userId, {
                    max_results: 10,
                    "tweet.fields": ["created_at", "public_metrics", "non_public_metrics"]
                });

                for (const tweet of tweets.data.data ?? []) {
                    // オーガニックインプレッション（取得できない場合はパブリックからフォールバック）
                    const nonPublic = tweet.non_public_metrics;
                    const publicMetrics = tweet.public_metrics;
                    
                    const impressions = nonPublic?.impression_count ?? publicMetrics?.impression_count ?? 0;

                    // エンゲージメント指標（public_metrics）と非公開指標（non_public_metrics）も保存。
                    // non_public_metrics は投稿から約30日間のみ取得可能。取れない場合は既存値維持のため undefined にする。
                    const likes = publicMetrics?.like_count ?? 0;
                    const retweets = publicMetrics?.retweet_count ?? 0;
                    const replies = publicMetrics?.reply_count ?? 0;
                    const quotes = publicMetrics?.quote_count ?? 0;
                    const urlClicks = (nonPublic as { url_link_clicks?: number })?.url_link_clicks;
                    const profileClicks = (nonPublic as { user_profile_clicks?: number })?.user_profile_clicks;

                    // DBへUPSERT（externalIdが一致すれば更新、なければ新規作成）
                    await prisma.pastPost.upsert({
                        where: { externalId: tweet.id },
                        update: {
                            impressions: impressions,
                            likes,
                            retweets,
                            replies,
                            quotes,
                            ...(typeof urlClicks === "number" ? { urlClicks } : {}),
                            ...(typeof profileClicks === "number" ? { profileClicks } : {}),
                            // conversions: 将来的に連携先のクリック数を入れることも可能
                        },
                        create: {
                            userId: xa.userId,
                            xAccountId,
                            content: tweet.text,
                            platform: "X",
                            postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
                            externalId: tweet.id,
                            impressions: impressions,
                            likes,
                            retweets,
                            replies,
                            quotes,
                            ...(typeof urlClicks === "number" ? { urlClicks } : {}),
                            ...(typeof profileClicks === "number" ? { profileClicks } : {}),
                            analysisStatus: "UNANALYZED"
                        }
                    });
                    updatedCount++;
                }
            } catch (userErr) {
                console.error(`Failed to fetch for xAccount ${xa.id} (user ${xa.userId}):`, userErr);
            }
        }

        return NextResponse.json({
            message: "X Analytics sync complete",
            processedAccounts: xAccounts.length,
            updatedPosts: updatedCount
        });

    } catch (error) {
        console.error("X Analytics Cron error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
