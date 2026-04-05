import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ message: "ユーザーが見つかりません" }, { status: 404 });
        }

        // Twitterアカウントの連携情報を削除
        await prisma.account.deleteMany({
            where: {
                userId: user.id,
                provider: "twitter"
            }
        });

        return NextResponse.json({ message: "X (Twitter) アカウントの連携を解除しました。" });
    } catch (error) {
        console.error("Disconnect Twitter error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
