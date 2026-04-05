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

        const pastPosts = await prisma.pastPost.findMany({
            where: { userId: user.id },
            orderBy: { postedAt: 'desc' }
        });

        return NextResponse.json(pastPosts);
    } catch (error) {
        console.error("PastPosts GET error:", error);
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

        // 一括でモックデータを登録する処理 (検証用)
        if (data.action === "seed") {
            const seedData = [
                {
                    userId: user.id,
                    content: "SNS集客の極意：実は「ターゲット」を決めるだけじゃダメ。そのターゲットが夜寝る前に何に悩んでいるか？まで解像度を上げないと反応は取れません。詳しいやり方はプロフリンクへ👇",
                    impressions: 1500,
                    conversions: 3,
                    analysisStatus: "POSITIVE",
                    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) // 2日前
                },
                {
                    userId: user.id,
                    content: "今日はランチにお寿司を食べました！たまには息抜きも必要ですね。午後も頑張りましょう！",
                    impressions: 120,
                    conversions: 0,
                    analysisStatus: "NEGATIVE",
                    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) // 3日前
                },
                {
                    userId: user.id,
                    content: "【月商100万を超えるアカウントの共通点】\n1. 毎日決まった時間に発信\n2. 専門用語を使わない\n3. 結論から書く\n\nこれだけでインプレッションは倍増します。保存して明日から実践してくださいね✨",
                    impressions: 3200,
                    conversions: 5,
                    analysisStatus: "POSITIVE",
                    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5) // 5日前
                }
            ];

            for (const item of seedData) {
                await prisma.pastPost.create({ data: item });
            }

            return NextResponse.json({ message: "データをシードしました" });
        }

        const post = await prisma.pastPost.create({
            data: {
                userId: user.id,
                content: data.content,
                impressions: data.impressions || 0,
                conversions: data.conversions || 0,
                analysisStatus: data.analysisStatus || "UNANALYZED",
                postedAt: data.postedAt ? new Date(data.postedAt) : new Date()
            }
        });

        return NextResponse.json(post);
    } catch (error) {
        console.error("PastPosts POST error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
