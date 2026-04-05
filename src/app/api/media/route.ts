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
        const db = prisma as any;
        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: {
                media: {
                    orderBy: { createdAt: "desc" } // 最新順
                }
            }
        });

        if (!user) {
            return NextResponse.json({ message: "ユーザーが見つかりません" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            media: user.media,
            storage: {
                used: user.usedStorage,
                max: user.maxStorage,
                plan: user.plan
            }
        });
    } catch (error) {
        console.error("Media fetch error:", error);
        return NextResponse.json({ message: "メディア情報の取得中にエラーが発生しました" }, { status: 500 });
    }
}
