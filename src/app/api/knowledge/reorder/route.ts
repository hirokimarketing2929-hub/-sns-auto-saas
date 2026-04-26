import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 同一 type 内での並び替え。クライアントから並び替え後の id 配列を受け取り、
// 0 から順に order を振り直す。他ユーザーのナレッジは絶対に触らない。
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const data = await req.json();
        const ids: unknown = data?.ids;
        if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) {
            return NextResponse.json({ message: "ids は文字列配列で指定してください" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });
        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // 自分のナレッジだけに限定して一括更新
        const owned = await prisma.knowledge.findMany({
            where: { id: { in: ids as string[] }, userId: user.id },
            select: { id: true }
        });
        const ownedSet = new Set(owned.map(k => k.id));

        await prisma.$transaction(
            (ids as string[])
                .filter(id => ownedSet.has(id))
                .map((id, index) =>
                    prisma.knowledge.update({
                        where: { id },
                        data: { order: index }
                    })
                )
        );

        return NextResponse.json({ ok: true, updated: ownedSet.size });
    } catch (error) {
        console.error("Knowledge reorder error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
