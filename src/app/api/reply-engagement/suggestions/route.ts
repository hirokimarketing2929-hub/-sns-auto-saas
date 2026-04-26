import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const cursor = url.searchParams.get("cursor") || undefined;

    const items = await prisma.replyEngagementSuggestion.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    const mapped = data.map((s) => ({
        id: s.id,
        targetUsername: s.targetUsername,
        tweetId: s.tweetId,
        tweetUrl: s.tweetUrl,
        tweetText: s.tweetText,
        impressions: s.impressions,
        variants: (() => {
            try { return JSON.parse(s.variants) as string[]; } catch { return [] as string[]; }
        })(),
        status: s.status,
        notifiedAt: s.notifiedAt,
        createdAt: s.createdAt,
    }));

    return NextResponse.json({ items: mapped, nextCursor });
}
