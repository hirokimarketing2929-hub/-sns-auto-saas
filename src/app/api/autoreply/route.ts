import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// キャンペーン一覧の取得
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = prisma as any;
        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: { autoReplyCampaigns: { orderBy: { createdAt: "desc" } } }
        });

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        return NextResponse.json({ campaigns: user.autoReplyCampaigns });
    } catch (error) {
        console.error("GET AutoReply campaigns error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

// キャンペーンの作成・削除・状態変更
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = prisma as any;
        const user = await db.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const { action, payload } = await req.json();

        if (action === "create") {
            const { name, targetUrl, isTriggerRt, isTriggerLike, isTriggerReply, keyword, replyContent } = payload;

            const newCampaign = await db.autoReplyCampaign.create({
                data: {
                    userId: user.id,
                    name,
                    targetUrl,
                    isTriggerRt: !!isTriggerRt,
                    isTriggerLike: !!isTriggerLike,
                    isTriggerReply: !!isTriggerReply,
                    keyword: isTriggerReply ? keyword : null, // 特定リプ判定がONのときだけ保存
                    replyContent,
                    isActive: true
                }
            });
            return NextResponse.json({ campaign: newCampaign });

        } else if (action === "delete") {
            const { id } = payload;
            await db.autoReplyCampaign.delete({
                where: { id, userId: user.id }
            });
            return NextResponse.json({ success: true });

        } else if (action === "toggle_active") {
            const { id, isActive } = payload;
            const updated = await db.autoReplyCampaign.update({
                where: { id, userId: user.id },
                data: { isActive }
            });
            return NextResponse.json({ campaign: updated });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("POST AutoReply campaign error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
