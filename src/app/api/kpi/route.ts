import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// KPIシナリオの取得
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { kpiScenarios: { orderBy: { order: "asc" } } }
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ scenarios: user.kpiScenarios });
    } catch (error) {
        console.error("GET KPI scenarios error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

// KPIシナリオの作成・更新
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const { action, payload } = await req.json();

        if (action === "create") {
            // 新規シナリオ追加
            const { name, targetValue, currentValue } = payload;

            // 現在の最大のorderを取得
            const maxOrderScenario = await prisma.kpiScenario.findFirst({
                where: { userId: user.id },
                orderBy: { order: "desc" }
            });
            const nextOrder = maxOrderScenario ? maxOrderScenario.order + 1 : 0;

            const newScenario = await prisma.kpiScenario.create({
                data: {
                    userId: user.id,
                    name,
                    order: nextOrder,
                    targetValue: Number(targetValue) || 0,
                    currentValue: Number(currentValue) || 0
                }
            });
            return NextResponse.json({ scenario: newScenario });

        } else if (action === "delete") {
            // シナリオ削除
            const { id } = payload;
            await prisma.kpiScenario.delete({
                where: { id, userId: user.id }
            });
            return NextResponse.json({ success: true });

        } else if (action === "reorder") {
            // 並び替え (一括更新)
            const { scenarios } = payload; // [{ id: "cuid", order: 0 }, ...]

            const updatePromises = scenarios.map((s: any) =>
                prisma.kpiScenario.update({
                    where: { id: s.id, userId: user.id },
                    data: { order: s.order }
                })
            );
            await Promise.all(updatePromises);
            return NextResponse.json({ success: true });

        } else if (action === "sync_gas") {
            // GASからのデータ同期 (モック機能)
            // 実際はGAS側からこのエンドポイントを叩く想定
            return NextResponse.json({ message: "GAS sync functional stub" });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("POST KPI scenario error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
