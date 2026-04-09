import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";

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

        let client;
        try {
            client = await getTwitterClient(user.id);
        } catch (twitterErr) {
            return NextResponse.json({
                message: twitterErr.message || "X(Twitter)アカウントが連携されていません。設定画面またはアカウント情報管理からXアカウントを連携してください。"
            }, { status: 400 });
        }

        const me = await client.v2.me();
        const twitterUserId = me.data.id;

        const tweets = await client.v2.userTimeline(twitterUserId, {
            max_results: 100,
            "tweet.fields": ["created_at", "public_metrics"],
            exclude: ["retweets", "replies"]
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

        for (const tweet of tweets.data.data) {
            const impressions = tweet.public_metrics?.impression_count ?? 0;
            const likes = tweet.public_metrics?.like_count ?? 0;
            const retweets = tweet.public_metrics?.retweet_count ?? 0;
            const replies = tweet.public_metrics?.reply_count ?? 0;
            const engagements = likes + retweets + replies;

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
                    impressions: impressions,
                    conversions: engagements,
                    analysisStatus: analysisStatus,
                },
                create: {
                    userId: user.id,
                    content: tweet.text,
                    platform: "X",
                    postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
                    externalId: tweet.id,
                    impressions: impressions,
                    conversions: engagements,
                    analysisStatus: analysisStatus,
                }
            });
            syncedCount++;
        }

        return NextResponse.json({
            message: syncedCount + "件のポストを同期し、ポジネガ判定を完了しました。",
            synced: syncedCount,
            classified: { positive: positiveCount, negative: negativeCount }
        });

    } catch (error) {
        console.error("Past posts sync error:", error);

        if (error?.code === 429) {
            return NextResponse.json({
                message: "X APIのレート制限に達しました。しばらく待ってから再試行してください。"
            }, { status: 429 });
        }

        return NextResponse.json({
            message: error.message || "同期中にエラーが発生しました"
        }, { status: 500 });
    }
}
