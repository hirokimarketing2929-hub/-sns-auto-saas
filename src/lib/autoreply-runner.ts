import { getTwitterClient } from "@/lib/twitter";
import { TwitterApi } from "twitter-api-v2";
import { logXApiUsage } from "@/lib/api-usage";

// 1 回の実行・1 キャンペーンあたりの最大送信件数。
// 短時間の大量送信によるスパム判定/凍結を避けるためのキャップ。
// 上限に達した残りは次回実行で順次処理される（AutoReplyLog で再送防止）。
const MAX_SENDS_PER_CAMPAIGN_PER_RUN = 15;

// ポストバン回避用のランダムジッター（ミリ秒）。固定間隔の機械的送信を避ける。
const JITTER_MIN_MS = 2000;
const JITTER_MAX_MS = 8000;
function randomJitterMs(): number {
    return JITTER_MIN_MS + Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1));
}

/**
 * ポストバン回避用: 冒頭バリエーション（最大100通り）を JSON 配列から安全にパース。
 * 不正JSON・空文字・非string要素はフィルタする。
 */
function parseOpeningVariants(raw: unknown): string[] {
    if (typeof raw !== "string" || !raw.trim()) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    } catch {
        return [];
    }
}

/**
 * 冒頭バリエーションが設定されていれば「冒頭 + 改行 + 共通CTA」を組み立て、
 * 未設定なら共通CTA（replyContent）のみを返す（後方互換）。
 * index は openingsSentCount を基準に循環（100通り使い切ったら再利用）。
 */
function buildReplyText(variants: string[], index: number, replyContent: string): string {
    if (variants.length === 0) return replyContent;
    const opening = variants[index % variants.length];
    return `${opening}\n\n${replyContent}`;
}

/**
 * tweetLikedBy / tweetRetweetedBy のユーザー配列を取り出す。
 * twitter-api-v2 では asPaginator 無し呼び出しは素オブジェクト {data: UserV2[], meta} を返すため
 * 配列は result.data。一方ページネータ形だと {data: {data: [...]}} になる。両方に耐えるよう取り出す。
 */
function extractUserArray(result: unknown): Array<{ id: string; username?: string }> {
    const r = result as { data?: unknown };
    if (Array.isArray(r?.data)) {
        return r.data as Array<{ id: string; username?: string }>;
    }
    const nested = (r?.data as { data?: unknown })?.data;
    if (Array.isArray(nested)) {
        return nested as Array<{ id: string; username?: string }>;
    }
    return [];
}

/**
 * 渡された稼働中キャンペーン群を順に処理し、各種トリガー（いいね/RT/キーワードリプ）に
 * 該当した未送信ユーザーへ自動リプライ（REPLY/MENTION/DM）を送る。
 * 実行ログ（人が読める文字列の配列）を返す。cron / 手動実行(run_now) の両方から呼ぶ。
 *
 * 注意: 呼び出し側で「どのキャンペーンを渡すか」（interval 判定など）を決める。
 * 本関数は渡されたものを全て処理する。二重送信は AutoReplyLog の unique で防止。
 */
export async function runAutoReplyForCampaigns(campaigns: any[], db: any): Promise<string[]> {
    const runLogs: string[] = [];

    for (const campaign of campaigns) {
        const { targetUrl, isTriggerRt, isTriggerLike, isTriggerReply, keyword, replyContent } = campaign;

        // ポストバン回避: 冒頭バリエーション（最大100通り）と循環インデックスを準備。
        const openingVariants = parseOpeningVariants((campaign as any).openingVariants);
        const startingOpeningIndex = (campaign as any).openingsSentCount ?? 0;
        let localOpeningsSent = 0;

        // URLからポストIDを抽出
        const postIdMatch = targetUrl.match(/status\/(\d+)/);
        const targetPostId = postIdMatch ? postIdMatch[1] : targetUrl;

        // キャンペーンが属する XAccount のクレデンシャルで送信する
        let twitterClient: TwitterApi | null = null;
        try {
            twitterClient = await getTwitterClient(campaign.userId, campaign.xAccountId || undefined);
        } catch (err: any) {
            console.warn(`Campaign ${campaign.id}: API keys not configured or invalid. Skipping. (${err.message})`);
            runLogs.push(`Skipped campaign ${campaign.name}: ${err.message}`);
            continue;
        }

        // 送信者自身の X user_id を取得（全 replyType 共通）。自分宛の送信を弾く。
        // 併せて username をログに出し「どのアカウントとして実行しているか」を可視化する。
        let selfUserId: string | null = null;
        try {
            const me = await twitterClient.v2.me({ "user.fields": ["username"] });
            selfUserId = me.data?.id || null;
            const uname = (me.data as { username?: string })?.username;
            runLogs.push(`🔑 連携アカウント: @${uname || "?"} (id ${selfUserId || "?"})`);
        } catch (meErr: any) {
            runLogs.push(`⚠️ 連携アカウントの確認(v2.me)に失敗: ${meErr.message || meErr}`);
        }

        // いいねトリガー時の前提チェック（X 2024 のいいね非公開化対応）。
        // liking_users は「認証アカウント自身の投稿」のいいねしか返さない。対象ポストの所有者が
        // 連携アカウントと違うと、いいねが何件あっても 0 件で返るため、ここで明示警告する。
        if (isTriggerLike && selfUserId) {
            try {
                const tw = await twitterClient.v2.singleTweet(targetPostId, { "tweet.fields": ["author_id"] });
                const authorId = (tw.data as { author_id?: string })?.author_id;
                if (authorId && authorId !== selfUserId) {
                    runLogs.push(
                        `⚠️ いいね検出はX仕様(2024〜いいね非公開)により『連携アカウント自身の投稿』しか取得できません。` +
                        `対象ポストの所有者(id ${authorId})と連携アカウント(id ${selfUserId})が一致していません。` +
                        `→ 対象投稿の本人アカウントでProXに連携してください。`
                    );
                }
            } catch (twErr: any) {
                runLogs.push(`（対象ポストの所有者確認に失敗: ${twErr.message || twErr}）`);
            }
        }

        // 各トリガーに該当したユーザー集合を個別に収集
        type UserHit = { userId: string; username: string };
        const likeUsers: UserHit[] = [];
        const rtUsers: UserHit[] = [];
        const replyUsers: UserHit[] = [];
        const pickRateLimit = (r: unknown) => (r as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit;

        try {
            // 1. いいね(LIKE)のユーザー抽出
            if (isTriggerLike) {
                const likedUsers = await twitterClient.v2.tweetLikedBy(targetPostId, {
                    max_results: 100,
                    "user.fields": ["username", "name"],
                });
                await logXApiUsage({ userId: campaign.userId, operation: "x-tweet-liked-by", rateLimit: pickRateLimit(likedUsers) });
                // tweetLikedBy(asPaginator無し) は素オブジェクト {data:UserV2[], meta} を返すので配列は .data。
                // 念のためページネータ形({data:{data:[...]}})にも耐えるよう両対応で取り出す。
                const liked = extractUserArray(likedUsers);
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
                // tweetRetweetedBy も同様に素オブジェクト {data:UserV2[], meta} を返すので .data が配列。
                const rters = extractUserArray(retweetedUsers);
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

        // 同一ユーザーが複数トリガーに該当したときの重複を先に落とす
        const dedupedUsers = Array.from(
            new Map(usersToReply.map(u => [u.userId, u])).values()
        );

        runLogs.push(`Campaign "${campaign.name}" — ${dedupedUsers.length} candidate(s) after dedup`);
        let skippedCount = 0;
        let sentThisRun = 0;

        for (const targetUser of dedupedUsers) {
            // 1 実行あたりの送信上限に達したら打ち切り（残りは次回実行で処理）
            if (sentThisRun >= MAX_SENDS_PER_CAMPAIGN_PER_RUN) {
                runLogs.push(`⏸️ Campaign "${campaign.name}": reached per-run cap (${MAX_SENDS_PER_CAMPAIGN_PER_RUN}). Remaining will be processed on the next run.`);
                break;
            }

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

            // 自己宛をガード（全 replyType 共通）。
            if (selfUserId && targetUser.userId === selfUserId) {
                runLogs.push(`⏭️ Skip self-target for ${targetUser.userId} (@${targetUser.username}): 自分自身宛の送信はスキップしました。`);
                continue;
            }

            try {
                // 送信方式に応じて投稿方法を分岐。
                // 「通常リプ(REPLY)」は廃止: いいね/RT した人は自分でツイートしていないため返信対象が存在せず、
                // 元投稿にぶら下げても相手に届かず・同一本文で duplicate content 拒否になるだけ。
                // よって配信は DM か メンション の2択。非DMは全てメンション（レガシーREPLYもここに落ちる）。
                if (campaign.replyType === "DM") {
                    const replyText = buildReplyText(openingVariants, startingOpeningIndex + localOpeningsSent, replyContent);
                    const dmResp = await twitterClient.v2.sendDmToParticipant(targetUser.userId, { text: replyText });
                    await logXApiUsage({ userId: campaign.userId, operation: "x-send-dm", rateLimit: pickRateLimit(dmResp) });
                } else {
                    if (!targetUser.username || targetUser.username === "unknown") {
                        runLogs.push(`Skip MENTION for ${targetUser.userId}: username unresolved`);
                        continue;
                    }
                    const replyText = buildReplyText(openingVariants, startingOpeningIndex + localOpeningsSent, replyContent);
                    const tweetResp = await twitterClient.v2.tweet(`@${targetUser.username} ${replyText}`);
                    await logXApiUsage({ userId: campaign.userId, operation: "x-tweet-mention", rateLimit: pickRateLimit(tweetResp) });
                }

                // 送信成功としてログに記録する（二重送信防止）
                await db.autoReplyLog.create({
                    data: {
                        campaignId: campaign.id,
                        targetUserId: targetUser.userId,
                        triggerEvent: targetUser.event
                    }
                });

                if (openingVariants.length > 0) localOpeningsSent++;
                sentThisRun++;

                // 実際の配信方式（DM 以外は全てメンション）を表示する。
                const delivery = campaign.replyType === "DM" ? "DM" : "MENTION";
                runLogs.push(`✅ Replied to ${targetUser.userId} (@${targetUser.username}) via ${delivery} (Event: ${targetUser.event})`);

                // Rate Limit・凍結対策のため、送信ごとにランダムなジッター待機を挟む
                await new Promise(resolve => setTimeout(resolve, randomJitterMs()));

            } catch (replyError: unknown) {
                const err = replyError as { message?: string; data?: { detail?: string; title?: string } };
                let detail = err?.data?.detail || err?.data?.title || err?.message || "Unknown error";
                const delivery = campaign.replyType === "DM" ? "DM" : "MENTION";
                // DM が権限エラーで落ちた場合の原因ヒント。
                // 既存の連携トークンに dm.write が無い場合は再連携で解消する。
                if (delivery === "DM" && /403|permission|not allowed|oauth|scope|dm\.write/i.test(detail)) {
                    detail += "（DM権限が不足しています。アカウントを再連携(/relink)してDM権限(dm.write)を許可してください。または DM権限付きのBYOK(自前APIキー)をご利用ください）";
                } else if (delivery === "DM" && /forbidden/i.test(detail)) {
                    // dm.write はあるが X 側が拒否＝多くは送信先のDM受信設定。
                    detail += "（送信先がDMを開放していない／フォロー外の可能性があります。相手のDM受信設定をご確認ください）";
                }
                console.error(`Failed to send reply to ${targetUser.userId}:`, replyError);
                runLogs.push(`❌ Failed reply to ${targetUser.userId} (@${targetUser.username}) via ${delivery}: ${detail}`);
                await logXApiUsage({ userId: campaign.userId, operation: `x-send-${campaign.replyType.toLowerCase()}`, success: false, errorMessage: detail });
            }
        }

        if (skippedCount > 0) {
            runLogs.push(`  ⏭️  ${skippedCount} 件は既に送信済みのためスキップしました`);
        }

        // 冒頭バリエーション分を永続カウンタに反映（循環インデックスの基準）
        if (localOpeningsSent > 0) {
            try {
                await db.autoReplyCampaign.update({
                    where: { id: campaign.id },
                    data: { openingsSentCount: { increment: localOpeningsSent } }
                });
            } catch (e) {
                console.warn(`Failed to increment openingsSentCount for ${campaign.id}`, e);
            }
        }

        // lastCheckedAt を更新（成功・失敗に関わらず、次回 interval 判定のため）
        try {
            await db.autoReplyCampaign.update({
                where: { id: campaign.id },
                data: { lastCheckedAt: new Date() },
            });
        } catch (e) {
            console.warn(`Failed to update lastCheckedAt for ${campaign.id}`, e);
        }
    }

    return runLogs;
}
