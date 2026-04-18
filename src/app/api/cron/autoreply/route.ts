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
        // Prisma Client の型定義不整合を回避するため、anyキャストで強行突破 (マイグレーションは完了している前提)
        const db = prisma as any;

        // 稼働中(isActive === true)のすべてのキャンペーンを取得
        const activeCampaigns = await db.autoReplyCampaign.findMany({
            where: { isActive: true },
            include: {
                user: { select: { settings: true } }
            }
        });

        if (!activeCampaigns || activeCampaigns.length === 0) {
            return NextResponse.json({ message: "No active campaigns found." });
        }

        const runLogs: string[] = [];

        // キャンペーンごとに処理を実行
        for (const campaign of activeCampaigns) {
            const { targetUrl, isTriggerRt, isTriggerLike, isTriggerReply, keyword, replyContent, user } = campaign;

            // URLからポストIDを抽出
            const postIdMatch = targetUrl.match(/status\/(\d+)/);
            const targetPostId = postIdMatch ? postIdMatch[1] : targetUrl;

            // ユーザー設定からTwitter APIクライアントを取得 (OAuthリフレッシュ対応)
            let twitterClient: TwitterApi | null = null;
            try {
                twitterClient = await getTwitterClient(user.id);
            } catch (err: any) {
                console.warn(`Campaign ${campaign.id}: API keys not configured or invalid. Skipping. (${err.message})`);
                runLogs.push(`Skipped campaign ${campaign.name}: ${err.message}`);
                continue;
            }

            const mockUsersToReply: { userId: string, event: string, username: string }[] = [];

            try {
                // 1. いいね(LIKE)のユーザー抽出
                if (isTriggerLike) {
                    const likedUsers = await twitterClient.v2.tweetLikedBy(targetPostId, { max_results: 100 });
                    runLogs.push(`Liked users found: ${likedUsers.data?.length || 0}`);
                    for (const u of likedUsers.data || []) {
                        mockUsersToReply.push({ userId: u.id, username: u.username, event: "LIKE" });
                    }
                }

                // 2. リポスト(RT)のユーザー抽出
                if (isTriggerRt) {
                    const retweetedUsers = await twitterClient.v2.tweetRetweetedBy(targetPostId, { max_results: 100 });
                    runLogs.push(`Retweeted users found: ${retweetedUsers.data?.length || 0}`);
                    for (const u of retweetedUsers.data || []) {
                        mockUsersToReply.push({ userId: u.id, username: u.username, event: "RT" });
                    }
                }

                // 3. 指定キーワードリプライのユーザー抽出 (Basicではsearch制限に注意)
                if (isTriggerReply && keyword) {
                    const replies = await twitterClient.v2.search(`conversation_id:${targetPostId} ${keyword}`, { max_results: 100, expansions: ['author_id'] });
                    runLogs.push(`Replies matching keyword found: ${replies.data?.data?.length || 0}`);
                    for (const tweet of replies.data?.data || []) {
                        if (tweet.author_id) {
                            mockUsersToReply.push({ userId: tweet.author_id, username: "unknown", event: "REPLY" });
                        }
                    }
                }
            } catch (apiError: any) {
                console.error(`X API Error for campaign ${campaign.id}:`, apiError);
                runLogs.push(`API Error on campaign ${campaign.name}: ${apiError.message || JSON.stringify(apiError)}`);
                continue; // XのAPIでエラーが出た場合はこのキャンペーンの送信処理自体をスキップ
            }

            /* ==========================================================
             * 抽出したユーザーに対してまだ送信していないか(AutoReplyLog)を確認し、送信処理を行う
             * ========================================================== */
            for (const targetUser of mockUsersToReply) {
                const existingLog = await db.autoReplyLog.findUnique({
                    where: {
                        campaignId_targetUserId: {
                            campaignId: campaign.id,
                            targetUserId: targetUser.userId
                        }
                    }
                });

                if (!existingLog) {
                    // スパム対策としてのランダム付与
                    const randomizedReply = `${replyContent} \n[Ref:${Math.random().toString(36).substring(2, 8)}]`;

                    try {
                        // 送信方式に応じて投稿方法を分岐
                        if (campaign.replyType === "DM") {
                            // DM送信（※要 dm.write 権限）
                            await twitterClient.v2.sendDmToParticipant(targetUser.userId, { text: randomizedReply });
                        } else if (campaign.replyType === "MENTION") {
                            // 対象ツリーから独立した新規メンションとして送信
                            await twitterClient.v2.tweet(`@${targetUser.username} ${randomizedReply}`);
                        } else {
                            // 通常リプライ（対象ツリーにぶら下げる）
                            await twitterClient.v2.reply(randomizedReply, targetPostId);
                        }

                        // 送信成功としてログに記録する（二重送信防止）
                        await db.autoReplyLog.create({
                            data: {
                                campaignId: campaign.id,
                                targetUserId: targetUser.userId,
                                triggerEvent: targetUser.event
                            }
                        });

                        runLogs.push(`Replied to ${targetUser.userId} (Event: ${targetUser.event})`);

                        // APIのRate Limit・凍結対策のため、1回の送信ごとに2秒待機する
                        await new Promise(resolve => setTimeout(resolve, 2000));

                    } catch (replyError) {
                        console.error(`Failed to send reply to ${targetUser.userId}:`, replyError);
                        runLogs.push(`Failed reply to ${targetUser.userId}`);
                    }
                }
            }
        }

        return NextResponse.json({
            message: "Auto-reply cron job executed successfully.",
            processedCampaigns: activeCampaigns.length,
            details: runLogs
        });

    } catch (error: any) {
        console.error("Cron AutoReply error:", error);
        return NextResponse.json({
            message: "Server error during cron execution",
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
