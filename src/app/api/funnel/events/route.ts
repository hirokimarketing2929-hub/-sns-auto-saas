import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveXAccountId } from "@/lib/active-x-account";

// ファンネルイベント（プロライン登録等）の一覧 + 集計
// Query:
//   ?days=7|30|90 (default 30) — 期間
//   ?limit=N (default 50) — 最近のイベント件数
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
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 50)));

    const since = new Date();
    since.setDate(since.getDate() - days);

    // 「連携数」(totalCount/daily) は真の連携イベントのみを数える。
    // prox_onboarding（オンボーディング・ポップアップのクリック＝連携ファネルへの入口）は
    // 登録ではないため登録系カウントから除外し、入口は byUtmCampaign で別途可視化する。
    const registrationOnly = { source: { not: "prox_onboarding" } } as const;

    const [recent, totalCount, byForm, byScenario, byUtmCampaign] = await Promise.all([
        prisma.funnelEvent.findMany({
            where: { userId: user.id, xAccountId, occurredAt: { gte: since } },
            orderBy: { occurredAt: "desc" },
            take: limit,
            select: {
                id: true,
                source: true,
                formName: true,
                externalUid: true,
                displayName: true,
                utmSource: true,
                utmMedium: true,
                utmCampaign: true,
                utmContent: true,
                occurredAt: true,
            },
        }),
        prisma.funnelEvent.count({
            where: { userId: user.id, xAccountId, occurredAt: { gte: since }, ...registrationOnly },
        }),
        // フォーム送信のフォーム名別（source が proline_form もしくは従来の proline）
        prisma.funnelEvent.groupBy({
            by: ["formName"],
            where: {
                userId: user.id,
                xAccountId,
                occurredAt: { gte: since },
                source: { in: ["proline_form", "proline"] },
            },
            _count: { _all: true },
        }),
        // シナリオ登録のシナリオ名別
        prisma.funnelEvent.groupBy({
            by: ["formName"],
            where: {
                userId: user.id,
                xAccountId,
                occurredAt: { gte: since },
                source: "proline_scenario",
            },
            _count: { _all: true },
        }),
        prisma.funnelEvent.groupBy({
            by: ["utmCampaign"],
            where: { userId: user.id, xAccountId, occurredAt: { gte: since }, utmCampaign: { not: null } },
            _count: { _all: true },
        }),
    ]);

    // 日別集計（タイムゾーンは JST 相当で日付境界を処理 — クライアント側でも微調整）
    const daily: Record<string, number> = {};
    const allInRange = await prisma.funnelEvent.findMany({
        where: { userId: user.id, xAccountId, occurredAt: { gte: since }, ...registrationOnly },
        select: { occurredAt: true },
    });
    for (const ev of allInRange) {
        const d = ev.occurredAt;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        daily[key] = (daily[key] || 0) + 1;
    }

    return NextResponse.json({
        days,
        totalCount,
        recent,
        byForm: byForm.map(b => ({ formName: b.formName, count: b._count._all })),
        byScenario: byScenario.map(b => ({ scenarioName: b.formName, count: b._count._all })),
        byUtmCampaign: byUtmCampaign.map(b => ({ utmCampaign: b.utmCampaign, count: b._count._all })),
        daily,
    });
}
