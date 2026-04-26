import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";
import { logXApiUsage } from "@/lib/api-usage";

// データ分析画面用の統合サマリー。
//   - X: 自分のプロフィール(follower数等) + 直近投稿のメトリクス
//   - 投稿テーブル: PastPost DB（これまでに同期したもの）を使う
//   - Funnel: プロラインの FunnelEvent（今日/今月/7日/30日推移、UTM 別、フォーム別）
//
// X API 呼び出しは軽量に抑え、DB 側（PastPost）を主のソースにする。
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 30)));
    const groupByRaw = url.searchParams.get("groupBy") || "day";
    const groupBy: "day" | "week" | "month" =
        groupByRaw === "week" ? "week" : groupByRaw === "month" ? "month" : "day";

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now = new Date();
    const since = new Date(now);
    since.setDate(now.getDate() - days);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // --- X プロフィール（follower数等） ---
    type XProfile = {
        username?: string;
        name?: string;
        followersCount?: number;
        followingCount?: number;
        tweetCount?: number;
        profileImageUrl?: string;
        fetchedAt?: string;
        error?: string;
    };
    let xProfile: XProfile = {};
    try {
        const client = await getTwitterClient(user.id);
        const meResp = await client.v2.me({
            "user.fields": ["public_metrics", "name", "username", "profile_image_url"],
        });
        await logXApiUsage({
            userId: user.id,
            operation: "x-me",
            rateLimit: (meResp as unknown as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit,
        });
        const me = meResp.data as unknown as {
            username?: string;
            name?: string;
            profile_image_url?: string;
            public_metrics?: { followers_count?: number; following_count?: number; tweet_count?: number };
        };
        xProfile = {
            username: me.username,
            name: me.name,
            profileImageUrl: me.profile_image_url,
            followersCount: me.public_metrics?.followers_count,
            followingCount: me.public_metrics?.following_count,
            tweetCount: me.public_metrics?.tweet_count,
            fetchedAt: new Date().toISOString(),
        };
    } catch (e: unknown) {
        xProfile = { error: (e as { message?: string })?.message || "X API でプロフィール取得に失敗しました" };
    }

    // --- PastPost から投稿メトリクスを集計 ---
    const pastPosts = await prisma.pastPost.findMany({
        where: { userId: user.id, postedAt: { gte: since } },
        orderBy: { postedAt: "desc" },
    });

    const totalImpressions = pastPosts.reduce((s, p) => s + (p.impressions || 0), 0);
    const totalConversions = pastPosts.reduce((s, p) => s + (p.conversions || 0), 0);
    const totalReplies = pastPosts.reduce((s, p) => s + ((p as { replies?: number }).replies || 0), 0);
    const totalUrlClicks = pastPosts.reduce((s, p) => s + ((p as { urlClicks?: number }).urlClicks || 0), 0);
    const avgImpressions = pastPosts.length > 0 ? Math.round(totalImpressions / pastPosts.length) : 0;
    const topPosts = [...pastPosts].sort((a, b) => (b.impressions || 0) - (a.impressions || 0)).slice(0, 5);

    // 日付キーを集計粒度に応じて生成（day/week/month）
    const bucketKey = (d: Date): string => {
        if (groupBy === "day") {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
        if (groupBy === "week") {
            // ISO 週: 月曜始まりで週頭の日付をキーにする
            const copy = new Date(d);
            const day = copy.getDay() === 0 ? 7 : copy.getDay(); // 日=7, 月=1
            copy.setDate(copy.getDate() - (day - 1));
            return `${copy.getFullYear()}-W${String(copy.getMonth() + 1).padStart(2, "0")}-${String(copy.getDate()).padStart(2, "0")}`;
        }
        // month
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    // 粒度別集計
    type Bucket = { posts: number; impressions: number; replies: number; urlClicks: number; likes: number; retweets: number };
    const postBuckets: Record<string, Bucket> = {};
    for (const p of pastPosts) {
        const key = bucketKey(p.postedAt);
        if (!postBuckets[key]) postBuckets[key] = { posts: 0, impressions: 0, replies: 0, urlClicks: 0, likes: 0, retweets: 0 };
        postBuckets[key].posts += 1;
        postBuckets[key].impressions += p.impressions || 0;
        const ex = p as unknown as { replies?: number; urlClicks?: number; likes?: number; retweets?: number };
        postBuckets[key].replies += ex.replies || 0;
        postBuckets[key].urlClicks += ex.urlClicks || 0;
        postBuckets[key].likes += ex.likes || 0;
        postBuckets[key].retweets += ex.retweets || 0;
    }
    const dailyPosts = Object.entries(postBuckets)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, v]) => ({ date, ...v }));

    // --- Funnel（プロライン） ---
    const [funnelToday, funnelMonth, funnelInRange, funnelByForm, funnelByUtm] = await Promise.all([
        prisma.funnelEvent.count({ where: { userId: user.id, occurredAt: { gte: startOfToday } } }),
        prisma.funnelEvent.count({ where: { userId: user.id, occurredAt: { gte: startOfMonth } } }),
        prisma.funnelEvent.findMany({
            where: { userId: user.id, occurredAt: { gte: since } },
            select: { occurredAt: true, utmCampaign: true, utmContent: true, formName: true },
        }),
        prisma.funnelEvent.groupBy({
            by: ["formName"],
            where: { userId: user.id, occurredAt: { gte: since } },
            _count: { _all: true },
        }),
        prisma.funnelEvent.groupBy({
            by: ["utmCampaign"],
            where: { userId: user.id, occurredAt: { gte: since }, utmCampaign: { not: null } },
            _count: { _all: true },
        }),
    ]);

    // ファネルの粒度別集計
    const funnelBuckets: Record<string, number> = {};
    for (const ev of funnelInRange) {
        const key = bucketKey(ev.occurredAt);
        funnelBuckets[key] = (funnelBuckets[key] || 0) + 1;
    }
    const funnelDailyArr = Object.entries(funnelBuckets)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, count]) => ({ date, count }));

    // UTM content（関連ポスト推定）ベースで CVR 算出可能な候補
    const utmContentCounts: Record<string, number> = {};
    for (const ev of funnelInRange) {
        if (ev.utmContent) utmContentCounts[ev.utmContent] = (utmContentCounts[ev.utmContent] || 0) + 1;
    }

    return NextResponse.json({
        range: { days, since: since.toISOString(), until: now.toISOString() },
        groupBy,
        xProfile,
        posts: {
            count: pastPosts.length,
            totalImpressions,
            totalConversions,
            totalReplies,
            totalUrlClicks,
            avgImpressions,
            top: topPosts.map(p => {
                const ex = p as unknown as { replies?: number; urlClicks?: number; likes?: number; retweets?: number };
                return {
                    id: p.id,
                    content: p.content,
                    impressions: p.impressions,
                    conversions: p.conversions,
                    replies: ex.replies || 0,
                    urlClicks: ex.urlClicks || 0,
                    likes: ex.likes || 0,
                    retweets: ex.retweets || 0,
                    postedAt: p.postedAt,
                    externalId: p.externalId,
                };
            }),
            daily: dailyPosts,
            recent: pastPosts.slice(0, 50).map(p => {
                const ex = p as unknown as { replies?: number; urlClicks?: number; likes?: number; retweets?: number };
                return {
                    id: p.id,
                    content: p.content,
                    impressions: p.impressions,
                    conversions: p.conversions,
                    replies: ex.replies || 0,
                    urlClicks: ex.urlClicks || 0,
                    likes: ex.likes || 0,
                    retweets: ex.retweets || 0,
                    postedAt: p.postedAt,
                    externalId: p.externalId,
                    analysisStatus: p.analysisStatus,
                };
            }),
        },
        funnel: {
            today: funnelToday,
            month: funnelMonth,
            inRangeTotal: funnelInRange.length,
            daily: funnelDailyArr,
            byForm: funnelByForm.map(b => ({ formName: b.formName || "(未指定)", count: b._count._all })),
            byUtmCampaign: funnelByUtm.map(b => ({ utmCampaign: b.utmCampaign, count: b._count._all })),
            byUtmContent: Object.entries(utmContentCounts).map(([k, v]) => ({ utmContent: k, count: v })),
        },
    });
}
