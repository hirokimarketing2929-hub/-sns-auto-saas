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
        // 本部共有用ナレッジを全取得（ユーザー情報も含める）
        const sharedKnowledges = await prisma.knowledge.findMany({
            where: { isSharedToHQ: true },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        image: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(sharedKnowledges);
    } catch (error) {
        console.error("HQ Knowledge GET error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
