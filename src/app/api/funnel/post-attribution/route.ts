import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveXAccountId } from "@/lib/active-x-account";
import { postCampaignTag } from "@/lib/utm";

// 投稿経由の連携貢献（Post → FunnelEvent.utmCampaign="post_<id>"）を逆引き集計する。
//
// 動作モード:
//   1. ?postIds=a,b,c  → 指定された Post.id それぞれの件数を返す（バッチ取得）
//   2. （指定なし）    → 過去 days 日のアクティブ XAccount でTOP N 投稿を返す（連携件数の降順）
//
// 共通クエリ:
//   ?days=30 (default 30, max 365) — 集計対象期間（FunnelEvent.occurredAt）
//   ?limit=10 (default 10, max 100) — TOP モード時の最大件数
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const xAccountId = await getActiveXAccountId(user.id);

    const url = new URL(req.url);
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 30)));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 10)));
    const postIdsParam = url.searchParams.get("postIds");

    const since = new Date();
    since.setDate(since.getDate() - days);

    // --- バッチモード: 指定 postIds の件数を一括で返す ---
    if (postIdsParam) {
        const ids = postIdsParam.split(",").map(s => s.trim()).filter(s => s.length > 0).slice(0, 200);
        if (ids.length === 0) {
            return NextResponse.json({ days, byPostId: {} });
        }
        const tags = ids.map(postCampaignTag);
        // utm_content にも post_id を入れている GAS 連携を想定し、utm_campaign / utm_content の OR で拾う
        const grouped = await prisma.funnelEvent.groupBy({
            by: ["utmCampaign"],
            where: {
                userId: user.id,
                xAccountId,
                occurredAt: { gte: since },
                utmCampaign: { in: tags },
            },
            _count: { _all: true },
        });
        const byPostId: Record<string, number> = {};
        for (const id of ids) byPostId[id] = 0;
        for (const g of grouped) {
            if (!g.utmCampaign) continue;
            const id = g.utmCampaign.startsWith("post_") ? g.utmCampaign.slice("post_".length) : null;
            if (id && id in byPostId) byPostId[id] = g._count._all;
        }
        return NextResponse.json({ days, byPostId });
    }

    // --- TOP モード: 連携件数の多い投稿 TOP N を返す ---
    // FunnelEvent.utmCampaign="post_*" を集計 → Post 情報をくっつける
    const grouped = await prisma.funnelEvent.groupBy({
        by: ["utmCampaign"],
        where: {
            userId: user.id,
            xAccountId,
            occurredAt: { gte: since },
            utmCampaign: { startsWith: "post_" },
        },
        _count: { _all: true },
        orderBy: { _count: { utmCampaign: "desc" } },
        take: limit,
    });

    const postIds = grouped
        .map(g => g.utmCampaign ? g.utmCampaign.slice("post_".length) : null)
        .filter((v): v is string => !!v && v.length > 0);

    const posts = postIds.length > 0
        ? await prisma.post.findMany({
            where: { id: { in: postIds }, userId: user.id },
            select: {
                id: true,
                content: true,
                status: true,
                scheduledAt: true,
                postedTweetId: true,
                createdAt: true,
            },
        })
        : [];
    const postMap = new Map(posts.map(p => [p.id, p]));

    const items = grouped.map(g => {
        const id = g.utmCampaign ? g.utmCampaign.slice("post_".length) : "";
        const p = postMap.get(id);
        return {
            postId: id,
            count: g._count._all,
            content: p?.content ?? null,           // 投稿が削除されていれば null
            status: p?.status ?? null,
            postedTweetId: p?.postedTweetId ?? null,
            scheduledAt: p?.scheduledAt ?? null,
            createdAt: p?.createdAt ?? null,
        };
    });

    return NextResponse.json({ days, items });
}
