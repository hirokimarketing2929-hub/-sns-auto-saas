import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const data = await req.json();
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const resolvedParams = await params;
        const postId = resolvedParams.id;

        const post = await prisma.post.findUnique({
            where: { id: postId }
        });

        if (!post || post.userId !== user.id) {
            return NextResponse.json({ message: "Post not found or unauthorized" }, { status: 404 });
        }

        const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;

        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: {
                status: scheduledAt ? "SCHEDULED" : "DRAFT",
                scheduledAt: scheduledAt
            }
        });

        return NextResponse.json(updatedPost);
    } catch (error) {
        console.error("Posts PUT error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
