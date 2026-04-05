import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, type, data } = body;

        // 簡単な検証
        if (!userId || !type || !data) {
            return NextResponse.json({ message: "Invalid payload: userId, type, and data are required." }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return NextResponse.json({ message: "User not found." }, { status: 404 });
        }

        if (type === "PAST_POSTS") {
            // data は過去投稿の配列の想定: { content, impressions, postedAt, etc... }
            const posts = Array.isArray(data) ? data : [data];
            let addedCount = 0;

            for (const post of posts) {
                // 簡易的に同一テキストがあればスキップするなどの重複チェックを行う
                const existing = await prisma.pastPost.findFirst({
                    where: { userId: user.id, content: post.content }
                });

                if (!existing) {
                    await prisma.pastPost.create({
                        data: {
                            userId: user.id,
                            content: post.content || "",
                            platform: post.platform || "X",
                            postedAt: post.postedAt ? new Date(post.postedAt) : new Date(),
                            impressions: Number(post.impressions) || 0,
                            conversions: Number(post.conversions) || 0,
                            analysisStatus: "UNANALYZED"
                        }
                    });
                    addedCount++;
                }
            }
            return NextResponse.json({ message: `Successfully synced ${addedCount} past posts.` });
        }

        if (type === "KPI") {
            // data は { name, targetValue, currentValue } の配列または単一オブジェクト
            const kpis = Array.isArray(data) ? data : [data];
            let updatedCount = 0;

            for (const kpi of kpis) {
                if (!kpi.name) continue;

                // 既存のKPIシナリオがあれば更新、なければ作成
                const existingKpi = await prisma.kpiScenario.findFirst({
                    where: { userId: user.id, name: kpi.name }
                });

                if (existingKpi) {
                    await prisma.kpiScenario.update({
                        where: { id: existingKpi.id },
                        data: {
                            targetValue: Number(kpi.targetValue) || existingKpi.targetValue,
                            currentValue: Number(kpi.currentValue) || existingKpi.currentValue
                        }
                    });
                } else {
                    // オーダー番号の計算
                    const count = await prisma.kpiScenario.count({ where: { userId: user.id } });
                    await prisma.kpiScenario.create({
                        data: {
                            userId: user.id,
                            name: kpi.name,
                            order: count + 1,
                            targetValue: Number(kpi.targetValue) || 0,
                            currentValue: Number(kpi.currentValue) || 0
                        }
                    });
                }
                updatedCount++;
            }
            return NextResponse.json({ message: `Successfully synced ${updatedCount} KPIs.` });
        }

        return NextResponse.json({ message: "Unsupported data type." }, { status: 400 });

    } catch (error) {
        console.error("Sync API Error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
