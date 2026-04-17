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

        // accountId が指定されていれば単一アカウントのみ解除、未指定なら全 X 連携を解除
        const { searchParams } = new URL(req.url);
        const accountId = searchParams.get("accountId");

        if (accountId) {
            const acc = await prisma.account.findFirst({
                where: { id: accountId, userId: user.id, provider: "twitter" }
            });
            if (!acc) {
                return NextResponse.json({ message: "対象アカウントが見つかりません" }, { status: 404 });
            }
            await prisma.account.delete({ where: { id: acc.id } });
        } else {
            await prisma.account.deleteMany({
                where: { userId: user.id, provider: "twitter" }
            });
        }

        return NextResponse.json({ message: "X (Twitter) アカウントの連携を解除しました。" });
    } catch (error) {
        console.error("Disconnect Twitter error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
