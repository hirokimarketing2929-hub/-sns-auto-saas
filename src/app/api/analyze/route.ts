import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        // ユーザーの過去データを全て取得
        const pastPosts = await prisma.pastPost.findMany({
            where: { userId: user.id }
        });

        const positivePosts = pastPosts.filter(p => p.analysisStatus === "POSITIVE").map(p => p.content);
        const negativePosts = pastPosts.filter(p => p.analysisStatus === "NEGATIVE").map(p => p.content);

        if (positivePosts.length === 0 && negativePosts.length === 0) {
            return NextResponse.json({ message: "分析するデータがありません" }, { status: 400 });
        }

        // FastAPIサーバーへ分析リクエスト
        const aiResponse = await fetch((process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:8000") + "/api/analyze_knowledge", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                positive_posts: positivePosts,
                negative_posts: negativePosts
            }),
        });

        if (!aiResponse.ok) {
            throw new Error(`AIサーバーからの応答エラー: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const extractedKnowledges = aiData.knowledges || [];

        // 抽出されたナレッジをDBに保存
        if (extractedKnowledges.length > 0) {
            await prisma.knowledge.createMany({
                data: extractedKnowledges.map((k: any) => ({
                    userId: user.id,
                    content: k.content,
                    type: k.type,
                    source: k.source
                }))
            });
        }

        return NextResponse.json({
            message: "分析とナレッジ化が完了しました",
            count: extractedKnowledges.length
        });

    } catch (error: any) {
        console.error("Analyze POST error:", error);
        return NextResponse.json({ message: error.message || "サーバーエラー" }, { status: 500 });
    }
}
