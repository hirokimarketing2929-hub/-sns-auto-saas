import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const params = await context.params;
        const knowledgeId = params.id;

        const { isSharedToHQ } = await req.json();

        // 自分が作成したナレッジのみ更新可能
        const existingKnowledge = await prisma.knowledge.findUnique({
            where: { id: knowledgeId }
        });

        if (!existingKnowledge || existingKnowledge.userId !== user.id) {
            return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
        }

        const updatedKnowledge = await prisma.knowledge.update({
            where: { id: knowledgeId },
            data: { isSharedToHQ: Boolean(isSharedToHQ) }
        });

        return NextResponse.json(updatedKnowledge);
    } catch (error: any) {
        console.error("Knowledge Share API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
