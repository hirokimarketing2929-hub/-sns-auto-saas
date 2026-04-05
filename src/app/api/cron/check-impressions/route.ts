import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";
import { TwitterApi } from "twitter-api-v2";

export async function GET(req: Request) {
    try {
        const db = prisma as any;

        // 対象となるポスト（投稿済み、監視条件あり、未返信、投稿ID保持）を取得
        const trackingPosts = await db.post.findMany({
            where: {
                status: "PUBLISHED",
                postedTweetId: { not: null },
                impressionTarget: { not: null },
                impressionReplyContent: { not: null },
                isImpressionReplySent: false
            },
            include: {
                user: { select: { settings: true, accounts: true } }
            }
        });

        if (!trackingPosts || trackingPosts.length === 0) {
            return NextResponse.json({ message: "No posts to track for impressions." });
        }

        const runLogs: string[] = [];

        // ユーザー毎にAPIリクエストをまとめるためのグループ化
        const postsByUser: Record<string, any[]> = {};
        for (const post of trackingPosts) {
            const userId = post.userId;
            if (!postsByUser[userId]) {
                postsByUser[userId] = [];
            }
            postsByUser[userId].push(post);
        }

        // ユーザーごとに処理（APIクライアントの初期化をユーザー単位で行うため）
        for (const userId in postsByUser) {
            const userPosts = postsByUser[userId];
            const firstPostUser = userPosts[0].user;

            // X API のクライアントを初期化（BYOK または OAuthリフレッシュ対応）
            let client: TwitterApi | null = null;
            try {
                client = await getTwitterClient(userId);
            } catch (err: any) {
                runLogs.push(`User ${userId}: Missing or Invalid X API credentials. Skipping. (${err.message})`);
                continue;
            }

            // このユーザーの監視対象ツイートIDの一覧
            const tweetIds = userPosts.map(p => p.postedTweetId);

            // 複数ツイートの場合、API Limitを考慮してチャンク分けなどの検討が必要ですが、ここでは100件未満の想定
            try {
                // public_metrics (インプレッション数等) を取得する
                const tweetsData = await client.v2.tweets(tweetIds, {
                    "tweet.fields": ["public_metrics"]
                });

                if (tweetsData.data && tweetsData.data.length > 0) {
                    for (const tweet of tweetsData.data) {
                        const metrics = tweet.public_metrics;
                        const impressions = metrics?.impression_count || 0;

                        // このツイートに対応するDBのPostレコードを探す
                        const targetPost = userPosts.find(p => p.postedTweetId === tweet.id);

                        if (targetPost && impressions >= targetPost.impressionTarget) {
                            // 閾値に達したのでリプライを送信
                            runLogs.push(`Post ${targetPost.id} Reached Target (${impressions}/${targetPost.impressionTarget}). Replying...`);

                            try {
                                const rwClient = client.readWrite;
                                await rwClient.v2.reply(targetPost.impressionReplyContent, tweet.id);

                                // 送信済みフラグを立てる
                                await db.post.update({
                                    where: { id: targetPost.id },
                                    data: { isImpressionReplySent: true }
                                });

                                runLogs.push(`-> Successfully replied to ${tweet.id}`);

                                // RateLimit対策のウェイト
                                await new Promise(resolve => setTimeout(resolve, 1500));
                            } catch (replyError: any) {
                                console.error(`Failed to execute impression reply for ${tweet.id}`, replyError);
                                runLogs.push(`-> Failed reply to ${tweet.id}: ${replyError.message || ""}`);
                            }
                        } else if (targetPost) {
                            runLogs.push(`Post ${targetPost.id} Not Reached (${impressions}/${targetPost.impressionTarget})`);
                        }
                    }
                }
            } catch (apiError: any) {
                console.error(`X API Error for user ${userId}:`, apiError);
                runLogs.push(`Error fetching tweets API for user ${userId}: ${apiError.message}`);
            }
        }

        return NextResponse.json({
            message: "Impression check cron job executed successfully.",
            trackedUsers: Object.keys(postsByUser).length,
            details: runLogs
        });

    } catch (error: any) {
        console.error("Cron Impression check error:", error);
        return NextResponse.json({
            message: "Server error during impression check cron execution",
            error: error.message
        }, { status: 500 });
    }
}
