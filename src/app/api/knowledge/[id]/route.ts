import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });
        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const params = await context.params;
        const knowledgeId = params.id;

        const existing = await prisma.knowledge.findUnique({
            where: { id: knowledgeId }
        });
        if (!existing || existing.userId !== user.id) {
            return NextResponse.json({ message: "Not found or forbidden" }, { status: 404 });
        }

        await prisma.knowledge.delete({ where: { id: knowledgeId } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Knowledge DELETE error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
