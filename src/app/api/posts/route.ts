import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const posts = await prisma.post.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(posts);
    } catch (error) {
        console.error("Posts GET error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}

export async function POST(req: Request) {
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

        const post = await prisma.post.create({
            data: {
                userId: user.id,
                content: data.content,
                platform: data.platform || "X",
                status: data.status || "DRAFT",
                scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null
            }
        });

        return NextResponse.json(post);
    } catch (error) {
        console.error("Posts POST error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
