import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TwitterApi } from "twitter-api-v2";

export async function GET(req: Request) {
    // 簡易的な認証（実運用では VERCEL_CRON_SECRET などを検証）
    const authHeader = req.headers.get("authorization");
    const isCron = req.headers.get("user-agent")?.includes("cron") || 
                   (authHeader === `Bearer ${process.env.CRON_SECRET}`);

    if (process.env.NODE_ENV === "production" && !isCron) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        // XのAPIキー設定を持つユーザーのSettingsを取得
        const settingsWithTwitter = await prisma.settings.findMany({
            where: {
                xApiKey: { not: null },
                xApiSecret: { not: null },
                xAccessToken: { not: null },
                xAccessSecret: { not: null }
            },
            include: { user: true }
        });

        let updatedCount = 0;

        for (const settings of settingsWithTwitter) {
            try {
                // Twitter API クライアント初期化 (OAuth 1.0a User Context)
                const client = new TwitterApi({
                    appKey: settings.xApiKey!,
                    appSecret: settings.xApiSecret!,
                    accessToken: settings.xAccessToken!,
                    accessSecret: settings.xAccessSecret!,
                });

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

                for (const tweet of tweets.data.data) {
                    // オーガニックインプレッション（取得できない場合はパブリックからフォールバック）
                    const nonPublic = tweet.non_public_metrics;
                    const publicMetrics = tweet.public_metrics;
                    
                    const impressions = nonPublic?.impression_count ?? publicMetrics?.impression_count ?? 0;
                    
                    // DBへUPSERT（externalIdが一致すれば更新、なければ新規作成）
                    await prisma.pastPost.upsert({
                        where: { externalId: tweet.id },
                        update: {
                            impressions: impressions,
                            // conversions: 将来的に連携先のクリック数を入れることも可能
                        },
                        create: {
                            userId: settings.userId,
                            content: tweet.text,
                            platform: "X",
                            postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
                            externalId: tweet.id,
                            impressions: impressions,
                            analysisStatus: "UNANALYZED"
                        }
                    });
                    updatedCount++;
                }
            } catch (userErr) {
                console.error(`Failed to fetch for user ${settings.userId}:`, userErr);
            }
        }

        return NextResponse.json({ 
            message: "X Analytics sync complete", 
            processedUsers: settingsWithTwitter.length,
            updatedPosts: updatedCount
        });

    } catch (error) {
        console.error("X Analytics Cron error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
