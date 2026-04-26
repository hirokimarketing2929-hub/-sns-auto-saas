import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ダッシュボード向けの使用量サマリー。
//   - 今日 / 今月 の LLM トークン総数・コスト
//   - 今日 / 今月 の X API 呼び出し回数
//   - プロバイダ別内訳
//   - 最近の呼び出し20件
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // プロバイダごとの集計
        const groupByProvider = async (since: Date) => {
            const rows = await prisma.apiUsageLog.groupBy({
                by: ["provider"],
                where: { userId: user.id, createdAt: { gte: since } },
                _sum: { inputTokens: true, outputTokens: true, costUsd: true },
                _count: { _all: true },
            });
            return rows.map(r => ({
                provider: r.provider,
                count: r._count._all,
                inputTokens: r._sum.inputTokens ?? 0,
                outputTokens: r._sum.outputTokens ?? 0,
                costUsd: r._sum.costUsd ?? 0,
            }));
        };

        const [todayByProvider, monthByProvider, recent] = await Promise.all([
            groupByProvider(startOfToday),
            groupByProvider(startOfMonth),
            prisma.apiUsageLog.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                    id: true,
                    provider: true,
                    operation: true,
                    model: true,
                    inputTokens: true,
                    outputTokens: true,
                    costUsd: true,
                    xRateLimitRemaining: true,
                    xRateLimitMax: true,
                    xRateLimitReset: true,
                    success: true,
                    createdAt: true,
                },
            }),
        ]);

        const sumTotals = (arr: Array<{ inputTokens: number; outputTokens: number; costUsd: number; count: number; provider: string }>) => {
            const llmArr = arr.filter(a => a.provider !== "x");
            const xArr = arr.filter(a => a.provider === "x");
            return {
                llmInputTokens: llmArr.reduce((s, a) => s + a.inputTokens, 0),
                llmOutputTokens: llmArr.reduce((s, a) => s + a.outputTokens, 0),
                llmCostUsd: llmArr.reduce((s, a) => s + a.costUsd, 0),
                llmCalls: llmArr.reduce((s, a) => s + a.count, 0),
                xCalls: xArr.reduce((s, a) => s + a.count, 0),
            };
        };

        return NextResponse.json({
            today: {
                byProvider: todayByProvider,
                totals: sumTotals(todayByProvider),
            },
            thisMonth: {
                byProvider: monthByProvider,
                totals: sumTotals(monthByProvider),
            },
            recent,
            asOf: now.toISOString(),
        });
    } catch (error) {
        console.error("Usage summary error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
