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

        const knowledges = await prisma.knowledge.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(knowledges);
    } catch (error) {
        console.error("Knowledge GET error:", error);
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

        // シードデータ用
        if (data.action === "seed") {
            const seedData = [
                {
                    userId: user.id,
                    type: "WINNING",
                    content: "最初の一文で結論かフック（『実は…』等）を提示する",
                    source: "AI分析（2026-03-01）"
                },
                {
                    userId: user.id,
                    type: "WINNING",
                    content: "箇条書きで3点にまとめるフォーマットは保存予測率が高い",
                    source: "AI分析（2026-03-01）"
                },
                {
                    userId: user.id,
                    type: "BASE",
                    category: "基礎ナレッジ",
                    content: "【前提原理】\n投稿 ＝ 「投稿の型」 × 「テーマ」 の式で構成されることを常に念頭に置くこと。型に沿ってテーマを掛け合わせることで再現性のある成果が出る。",
                    source: "システム初期設定"
                },
                {
                    userId: user.id,
                    type: "BASE",
                    category: "基礎ナレッジ",
                    content: "【感情の16ベクトル】\n人は論理ではなく「熱量（感情）」で動く。投稿を作成する際は、「FUN、WOW、尊い、癒し、感動、知識、あるある、納得、主張、物申す、応援」など、読者のどの熱量ベクトルを刺激するのかを意図的に設定すること。",
                    source: "システム初期設定"
                }
            ];

            for (const item of seedData) {
                await prisma.knowledge.create({ data: item });
            }

            return NextResponse.json({ message: "データをシードしました" });
        }

        // 共有条件判定: インプレッション10000以上のPastPostがあれば優良アカウントとしてHQ共有を許可する
        const highPerformingPost = await prisma.pastPost.findFirst({
            where: {
                userId: user.id,
                impressions: { gte: 10000 }
            }
        });
        const isSharedToHQ = !!highPerformingPost;

        const knowledge = await prisma.knowledge.create({
            data: {
                userId: user.id,
                content: data.content,
                type: data.type,
                category: data.category || null,
                source: data.source || "Manual Entry",
                isSharedToHQ: isSharedToHQ
            }
        });

        return NextResponse.json(knowledge);
    } catch (error) {
        console.error("Knowledge POST error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
