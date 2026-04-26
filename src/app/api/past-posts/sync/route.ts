import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";
import { logXApiUsage } from "@/lib/api-usage";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { settings: true }
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // Twitter APIクライアントを取得（OAuth連携 or 手動APIキー）
        let client;
        try {
            client = await getTwitterClient(user.id);
        } catch (twitterErr: unknown) {
            const errMsg = twitterErr instanceof Error ? twitterErr.message : "X(Twitter)アカウントが連携されていません。設定画面またはアカウント情報管理からXアカウントを連携してください。";
            return NextResponse.json({ message: errMsg }, { status: 400 });
        }

        const me = await client.v2.me();
        const twitterUserId = me.data.id;

        // non_public_metrics (url_link_clicks / user_profile_clicks) は 30 日以内のみ取得可
        const startTime30 = new Date();
        startTime30.setDate(startTime30.getDate() - 30);

        const tweets = await client.v2.userTimeline(twitterUserId, {
            max_results: 100,
            "tweet.fields": ["created_at", "public_metrics", "non_public_metrics"],
            exclude: ["retweets", "replies"],
            start_time: startTime30.toISOString(),
        });
        await logXApiUsage({
            userId: user.id,
            operation: "x-user-timeline-sync",
            rateLimit: (tweets as unknown as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit,
        });

        if (!tweets.data?.data || tweets.data.data.length === 0) {
            return NextResponse.json({
                message: "取得できるポストがありませんでした。",
                synced: 0,
                classified: { positive: 0, negative: 0 }
            });
        }

        const thresholdImp = user.settings?.thresholdImpression ?? 1000;

        let syncedCount = 0;
        let positiveCount = 0;
        let negativeCount = 0;

        type TweetFromApi = {
            id: string;
            text: string;
            created_at?: string;
            public_metrics?: { impression_count?: number; like_count?: number; retweet_count?: number; reply_count?: number; quote_count?: number };
            non_public_metrics?: { url_link_clicks?: number; user_profile_clicks?: number; impression_count?: number };
        };

        for (const rawTweet of tweets.data.data) {
            const tweet = rawTweet as unknown as TweetFromApi;
            const impressions = tweet.non_public_metrics?.impression_count ?? tweet.public_metrics?.impression_count ?? 0;
            const likes = tweet.public_metrics?.like_count ?? 0;
            const retweets = tweet.public_metrics?.retweet_count ?? 0;
            const replies = tweet.public_metrics?.reply_count ?? 0;
            const quotes = tweet.public_metrics?.quote_count ?? 0;
            const urlClicks = tweet.non_public_metrics?.url_link_clicks ?? 0;
            const profileClicks = tweet.non_public_metrics?.user_profile_clicks ?? 0;
            const engagements = likes + retweets + replies + quotes;

            let analysisStatus = "NEGATIVE";
            if (impressions >= thresholdImp) {
                analysisStatus = "POSITIVE";
                positiveCount++;
            } else {
                negativeCount++;
            }

            await prisma.pastPost.upsert({
                where: { externalId: tweet.id },
                update: {
                    impressions,
                    conversions: engagements,
                    replies,
                    retweets,
                    likes,
                    quotes,
                    urlClicks,
                    profileClicks,
                    analysisStatus,
                },
                create: {
                    userId: user.id,
                    content: tweet.text,
                    platform: "X",
                    postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
                    externalId: tweet.id,
                    impressions,
                    conversions: engagements,
                    replies,
                    retweets,
                    likes,
                    quotes,
                    urlClicks,
                    profileClicks,
                    analysisStatus,
                }
            });
            syncedCount++;
        }

        return NextResponse.json({
            message: syncedCount + "件のポストを同期し、ポジネガ判定を完了しました。",
            synced: syncedCount,
            classified: { positive: positiveCount, negative: negativeCount }
        });

    } catch (error: unknown) {
        console.error("Past posts sync error:", error);

        const err = error as Record<string, unknown>;
        if (err?.code === 429) {
            return NextResponse.json({
                message: "X APIのレート制限に達しました。しばらく待ってから再試行してください。"
            }, { status: 429 });
        }

        const errMessage = error instanceof Error ? error.message : "同期中にエラーが発生しました";
        return NextResponse.json({ message: errMessage }, { status: 500 });
    }
}
