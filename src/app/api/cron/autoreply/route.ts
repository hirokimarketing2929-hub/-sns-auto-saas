import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";
import { TwitterApi } from "twitter-api-v2";
import { logXApiUsage } from "@/lib/api-usage";

export async function GET(req: Request) {
    // Vercel Cron / 手動トリガーのみ許可
    const authHeader = req.headers.get("authorization");
    if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        // Prisma Client の型定義不整合を回避するため、anyキャストで強行突破 (マイグレーションは完了している前提)
        const db = prisma as any;

        // (1) 終了日時を過ぎた稼働中キャンペーンを一括で isActive=false に倒す
        const now = new Date();
        const expiredResult = await db.autoReplyCampaign.updateMany({
            where: {
                isActive: true,
                endsAt: { not: null, lte: now }
            },
            data: { isActive: false }
        });

        // (2) 稼働中 + チェック間隔が経過したキャンペーンだけを取得
        //     各キャンペーンの lastCheckedAt + checkIntervalMinutes <= now なら処理対象
        //     （cron 自体は毎分回るが、interval=5 のキャンペーンは 5 分毎にしか処理されない）
        const allActive = await db.autoReplyCampaign.findMany({
            where: { isActive: true },
            include: {
                user: { select: { id: true, settings: true } }
            }
        });
        const activeCampaigns = allActive.filter((c: { lastCheckedAt: Date | null; checkIntervalMinutes: number }) => {
            if (!c.lastCheckedAt) return true; // 一度もチェックしていなければ処理
            const next = new Date(c.lastCheckedAt.getTime() + c.checkIntervalMinutes * 60 * 1000);
            return next <= now;
        });

        const runLogs: string[] = [];
        if (expiredResult?.count > 0) {
            runLogs.push(`Auto-deactivated ${expiredResult.count} campaign(s) past their end date.`);
        }

        if (!activeCampaigns || activeCampaigns.length === 0) {
            return NextResponse.json({
                message: "No active campaigns found.",
                expiredDeactivated: expiredResult?.count ?? 0,
                details: runLogs
            });
        }

        // キャンペーンごとに処理を実行
        for (const campaign of activeCampaigns) {
            const { targetUrl, isTriggerRt, isTriggerLike, isTriggerReply, keyword, replyContent } = campaign;

            // URLからポストIDを抽出
            const postIdMatch = targetUrl.match(/status\/(\d+)/);
            const targetPostId = postIdMatch ? postIdMatch[1] : targetUrl;

            // ユーザー設定からTwitter APIクライアントを取得 (OAuthリフレッシュ対応)
            let twitterClient: TwitterApi | null = null;
            try {
                twitterClient = await getTwitterClient(campaign.userId);
            } catch (err: any) {
                console.warn(`Campaign ${campaign.id}: API keys not configured or invalid. Skipping. (${err.message})`);
                runLogs.push(`Skipped campaign ${campaign.name}: ${err.message}`);
                continue;
            }

            // DM キャンペーンの場合、送信者自身の X user_id を取得しておく
            //   → 対象ユーザー == 自分 の場合、自己DM を事前に弾く（X API では不可で 403 になる）
            let selfUserId: string | null = null;
            if (campaign.replyType === "DM") {
                try {
                    const me = await twitterClient.v2.me();
                    selfUserId = me.data?.id || null;
                } catch (meErr: any) {
                    runLogs.push(`Could not fetch sender identity (v2.me) for campaign ${campaign.name}: ${meErr.message || meErr}`);
                }
            }

            // 各トリガーに該当したユーザー集合を個別に収集
            type UserHit = { userId: string; username: string };
            const likeUsers: UserHit[] = [];
            const rtUsers: UserHit[] = [];
            const replyUsers: UserHit[] = [];
            const pickRateLimit = (r: unknown) => (r as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit;

            try {
                // 1. いいね(LIKE)のユーザー抽出（user.fields で username を必ず取得）
                if (isTriggerLike) {
                    const likedUsers = await twitterClient.v2.tweetLikedBy(targetPostId, {
                        max_results: 100,
                        "user.fields": ["username", "name"],
                    });
                    await logXApiUsage({ userId: campaign.userId, operation: "x-tweet-liked-by", rateLimit: pickRateLimit(likedUsers) });
                    const liked = (likedUsers as unknown as { data?: Array<{ id: string; username?: string }> }).data || [];
                    runLogs.push(`Liked users found: ${liked.length}`);
                    for (const u of liked) {
                        if (u.id && u.username) likeUsers.push({ userId: u.id, username: u.username });
                    }
                }

                // 2. リポスト(RT)のユーザー抽出
                if (isTriggerRt) {
                    const retweetedUsers = await twitterClient.v2.tweetRetweetedBy(targetPostId, {
                        max_results: 100,
                        "user.fields": ["username", "name"],
                    });
                    await logXApiUsage({ userId: campaign.userId, operation: "x-tweet-retweeted-by", rateLimit: pickRateLimit(retweetedUsers) });
                    const rters = (retweetedUsers as unknown as { data?: Array<{ id: string; username?: string }> }).data || [];
                    runLogs.push(`Retweeted users found: ${rters.length}`);
                    for (const u of rters) {
                        if (u.id && u.username) rtUsers.push({ userId: u.id, username: u.username });
                    }
                }

                // 3. 指定キーワードリプライのユーザー抽出
                if (isTriggerReply && keyword) {
                    const replies = await twitterClient.v2.search(`conversation_id:${targetPostId} ${keyword}`, {
                        max_results: 100,
                        expansions: ["author_id"],
                        "user.fields": ["username", "name"],
                    });
                    await logXApiUsage({ userId: campaign.userId, operation: "x-search", rateLimit: pickRateLimit(replies) });

                    const rawData = (replies as unknown as {
                        data?: { data?: Array<{ author_id?: string }> };
                    });
                    const tweets = rawData.data?.data || [];
                    const users =
                        ((replies as unknown as { includes?: { users?: Array<{ id: string; username?: string }> } }).includes?.users)
                        ?? ((replies as unknown as { data?: { includes?: { users?: Array<{ id: string; username?: string }> } } }).data?.includes?.users)
                        ?? [];
                    const usernameMap = new Map<string, string>();
                    for (const u of users) {
                        if (u.id && u.username) usernameMap.set(u.id, u.username);
                    }

                    runLogs.push(`Replies matching keyword found: ${tweets.length}`);
                    for (const tweet of tweets) {
                        if (tweet.author_id) {
                            const un = usernameMap.get(tweet.author_id);
                            if (un) replyUsers.push({ userId: tweet.author_id, username: un });
                        }
                    }
                }
            } catch (apiError: unknown) {
                const msg = (apiError as { message?: string })?.message || JSON.stringify(apiError);
                console.error(`X API Error for campaign ${campaign.id}:`, apiError);
                runLogs.push(`API Error on campaign ${campaign.name}: ${msg}`);
                await logXApiUsage({ userId: campaign.userId, operation: "x-autoreply-fetch", success: false, errorMessage: msg });
                continue;
            }

            // === トリガー合成（OR / AND） ===
            const triggerMode = (campaign as { triggerMode?: string }).triggerMode === "AND" ? "AND" : "OR";
            const enabledTriggers: { name: string; hits: UserHit[] }[] = [];
            if (isTriggerLike) enabledTriggers.push({ name: "LIKE", hits: likeUsers });
            if (isTriggerRt) enabledTriggers.push({ name: "RT", hits: rtUsers });
            if (isTriggerReply && keyword) enabledTriggers.push({ name: "REPLY", hits: replyUsers });

            let finalUsers: { userId: string; username: string; event: string }[] = [];
            if (triggerMode === "AND" && enabledTriggers.length > 1) {
                // すべてのトリガーを満たす（積集合）ユーザーのみ対象
                const sets = enabledTriggers.map(t => new Set(t.hits.map(h => h.userId)));
                const intersection = [...sets[0]].filter(id => sets.slice(1).every(s => s.has(id)));
                const unameMap = new Map<string, string>();
                for (const t of enabledTriggers) {
                    for (const h of t.hits) if (!unameMap.has(h.userId)) unameMap.set(h.userId, h.username);
                }
                const eventTag = enabledTriggers.map(t => t.name).join("+");
                finalUsers = intersection.map(id => ({ userId: id, username: unameMap.get(id) || "", event: eventTag }));
                runLogs.push(`AND mode: ${intersection.length} user(s) satisfy all ${enabledTriggers.length} triggers (${eventTag})`);
            } else {
                // OR モード or トリガー1つだけ: 合算
                for (const t of enabledTriggers) {
                    for (const h of t.hits) finalUsers.push({ userId: h.userId, username: h.username, event: t.name });
                }
                if (enabledTriggers.length > 1) {
                    runLogs.push(`OR mode: combining ${enabledTriggers.length} triggers (duplicates will be deduped)`);
                }
            }
            const usersToReply = finalUsers;

            /* ==========================================================
             * 抽出したユーザーに対してまだ送信していないか(AutoReplyLog)を確認し、送信処理を行う
             * ========================================================== */
            // 同一ユーザーが複数トリガー（LIKE+RT など）に該当したときの重複を先に落とす
            const dedupedUsers = Array.from(
                new Map(usersToReply.map(u => [u.userId, u])).values()
            );

            runLogs.push(`Campaign "${campaign.name}" — ${dedupedUsers.length} candidate(s) after dedup`);
            let skippedCount = 0;

            for (const targetUser of dedupedUsers) {
                const existingLog = await db.autoReplyLog.findUnique({
                    where: {
                        campaignId_targetUserId: {
                            campaignId: campaign.id,
                            targetUserId: targetUser.userId
                        }
                    }
                });

                if (existingLog) {
                    skippedCount++;
                    continue;
                }

                {
                    try {
                        // 送信方式に応じて投稿方法を分岐
                        if (campaign.replyType === "DM") {
                            // 自己DM を事前にガード（X API は自分から自分への DM 送信を禁止）
                            if (selfUserId && targetUser.userId === selfUserId) {
                                runLogs.push(`⏭️ Skip self-DM for ${targetUser.userId} (@${targetUser.username}): X does not allow sending DM to yourself. 別アカウントでお試しください。`);
                                continue;
                            }
                            // DM送信（※要 dm.write 権限・相手が DM 受信可能である必要あり）
                            const dmResp = await twitterClient.v2.sendDmToParticipant(targetUser.userId, { text: replyContent });
                            await logXApiUsage({ userId: campaign.userId, operation: "x-send-dm", rateLimit: pickRateLimit(dmResp) });
                        } else if (campaign.replyType === "MENTION") {
                            // 対象ツリーから独立した新規メンションとして送信（username 必須）
                            if (!targetUser.username || targetUser.username === "unknown") {
                                runLogs.push(`Skip MENTION for ${targetUser.userId}: username unresolved`);
                                continue;
                            }
                            const tweetResp = await twitterClient.v2.tweet(`@${targetUser.username} ${replyContent}`);
                            await logXApiUsage({ userId: campaign.userId, operation: "x-tweet-mention", rateLimit: pickRateLimit(tweetResp) });
                        } else {
                            // 通常リプライ（対象ツリーにぶら下げる）
                            const replyResp = await twitterClient.v2.reply(replyContent, targetPostId);
                            await logXApiUsage({ userId: campaign.userId, operation: "x-reply", rateLimit: pickRateLimit(replyResp) });
                        }

                        // 送信成功としてログに記録する（二重送信防止）
                        await db.autoReplyLog.create({
                            data: {
                                campaignId: campaign.id,
                                targetUserId: targetUser.userId,
                                triggerEvent: targetUser.event
                            }
                        });

                        runLogs.push(`✅ Replied to ${targetUser.userId} (@${targetUser.username}) via ${campaign.replyType} (Event: ${targetUser.event})`);

                        // APIのRate Limit・凍結対策のため、1回の送信ごとに2秒待機する
                        await new Promise(resolve => setTimeout(resolve, 2000));

                    } catch (replyError: unknown) {
                        const err = replyError as { message?: string; data?: { detail?: string; title?: string } };
                        const detail = err?.data?.detail || err?.data?.title || err?.message || "Unknown error";
                        console.error(`Failed to send reply to ${targetUser.userId}:`, replyError);
                        runLogs.push(`❌ Failed reply to ${targetUser.userId} (@${targetUser.username}) via ${campaign.replyType}: ${detail}`);
                        await logXApiUsage({ userId: campaign.userId, operation: `x-send-${campaign.replyType.toLowerCase()}`, success: false, errorMessage: detail });
                    }
                }
            }

            if (skippedCount > 0) {
                runLogs.push(`  ⏭️  ${skippedCount} 件は既に送信済みのためスキップしました`);
            }

            // このキャンペーンの lastCheckedAt を更新（成功・失敗に関わらず、次回 interval 判定のため）
            try {
                await db.autoReplyCampaign.update({
                    where: { id: campaign.id },
                    data: { lastCheckedAt: new Date() },
                });
            } catch (e) {
                console.warn(`Failed to update lastCheckedAt for ${campaign.id}`, e);
            }
        }

        return NextResponse.json({
            message: "Auto-reply cron job executed successfully.",
            processedCampaigns: activeCampaigns.length,
            totalActive: allActive.length,
            expiredDeactivated: expiredResult?.count ?? 0,
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
