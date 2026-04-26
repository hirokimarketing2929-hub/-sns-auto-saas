import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";
import { TwitterApi } from "twitter-api-v2";

export async function GET(req: Request) {
    // Vercel Cron / 手動トリガーのみ許可
    const authHeader = req.headers.get("authorization");
    if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = prisma as any;

        // 対象となるポストを取得:
        //   - 投稿済み (status=PUBLISHED)
        //   - postedTweetId 保持
        //   - impressionTarget が設定されている
        //   - かつ「未配信の遅延ツリー投稿を持つ」か「未送信の impression リプがある」
        //   - isImpressionReplySent=false（既に送信完了なら除外）
        const trackingPosts = await db.post.findMany({
            where: {
                status: "PUBLISHED",
                postedTweetId: { not: null },
                impressionTarget: { not: null },
                isImpressionReplySent: false,
                OR: [
                    { impressionReplyContent: { not: null } },
                    { AND: [{ threadStyle: "impression_triggered" }, { threadContents: { not: null } }] }
                ]
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
                            // 閾値に達したので、遅延ツリー投稿 → インプ連動リプの順でぶら下げる
                            runLogs.push(`Post ${targetPost.id} Reached Target (${impressions}/${targetPost.impressionTarget}).`);

                            const rwClient = client.readWrite;
                            let lastTweetId: string = tweet.id;
                            let anySuccess = false;
                            let anyFailure = false;

                            // (a) 遅延ツリー投稿（threadStyle=impression_triggered の時のみ）
                            if (targetPost.threadStyle === "impression_triggered" && targetPost.threadContents) {
                                try {
                                    const threads: unknown = JSON.parse(targetPost.threadContents);
                                    if (Array.isArray(threads) && threads.length > 0) {
                                        runLogs.push(`-> Sending ${threads.length} deferred thread posts...`);
                                        for (const text of threads) {
                                            if (typeof text !== "string" || !text.trim()) continue;
                                            try {
                                                const r = await rwClient.v2.reply(text, lastTweetId);
                                                lastTweetId = r.data.id;
                                                anySuccess = true;
                                                await new Promise(resolve => setTimeout(resolve, 1500));
                                            } catch (tErr: any) {
                                                anyFailure = true;
                                                runLogs.push(`-> Failed thread reply: ${tErr.message || ""}`);
                                            }
                                        }
                                    }
                                } catch (parseErr) {
                                    runLogs.push(`-> Failed to parse threadContents for ${targetPost.id}`);
                                }
                            }

                            // (b) インプ連動リプ（impressionReplyContent が設定されていれば）
                            if (targetPost.impressionReplyContent) {
                                try {
                                    await rwClient.v2.reply(targetPost.impressionReplyContent, lastTweetId);
                                    anySuccess = true;
                                    await new Promise(resolve => setTimeout(resolve, 1500));
                                    runLogs.push(`-> Successfully replied impression content to ${tweet.id}`);
                                } catch (replyError: any) {
                                    anyFailure = true;
                                    console.error(`Failed to execute impression reply for ${tweet.id}`, replyError);
                                    runLogs.push(`-> Failed impression reply to ${tweet.id}: ${replyError.message || ""}`);
                                }
                            }

                            // 全体のうち少なくとも1件でも成功していればフラグを立てる（冪等性）
                            if (anySuccess) {
                                await db.post.update({
                                    where: { id: targetPost.id },
                                    data: { isImpressionReplySent: true }
                                });
                                runLogs.push(`-> Marked ${targetPost.id} as isImpressionReplySent=true${anyFailure ? " (partial)" : ""}`);
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
