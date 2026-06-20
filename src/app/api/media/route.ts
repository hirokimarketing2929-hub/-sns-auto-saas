import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveXAccountId } from "@/lib/active-x-account";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const db = prisma as any;
        const user = await db.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ message: "ユーザーが見つかりません" }, { status: 404 });
        }

        // アカウント別分離: アクティブな XAccount のメディアだけを返す
        const xAccountId = await getActiveXAccountId(user.id);

        // レガシー救済: xAccountId 未設定のメディアを現在アクティブなアカウントへ一括移管（冪等）
        if (xAccountId) {
            await db.media.updateMany({
                where: { userId: user.id, xAccountId: null },
                data: { xAccountId },
            });
        }

        const media = await db.media.findMany({
            where: { userId: user.id, xAccountId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
            success: true,
            media,
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
