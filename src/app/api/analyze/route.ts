import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveXAccountId } from "@/lib/active-x-account";
import { callEngine, EngineUnavailableError } from "@/lib/ai-engine";
import { errorResponse } from "@/lib/api-error";
import { featureGateResponse } from "@/lib/features";

export async function POST(req: Request) {
    // Python AIエンジン依存機能。mvp(外部公開)では縮退して提供しない（CTO決定003 §3）。
    const gated = featureGateResponse("pythonAI");
    if (gated) return gated;

    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const xAccountId = await getActiveXAccountId(user.id);

        // ユーザーの過去データを全て取得
        const pastPosts = await prisma.pastPost.findMany({
            where: { userId: user.id, xAccountId }
        });

        const positivePosts = pastPosts.filter((p: { analysisStatus: string }) => p.analysisStatus === "POSITIVE").map((p: { content: string }) => p.content);
        const negativePosts = pastPosts.filter((p: { analysisStatus: string }) => p.analysisStatus === "NEGATIVE").map((p: { content: string }) => p.content);

        if (positivePosts.length === 0 && negativePosts.length === 0) {
            return NextResponse.json({ message: "分析するデータがありません" }, { status: 400 });
        }

        // AI エンジンへ分析リクエスト（接続不可・タイムアウトは EngineUnavailableError で捕捉）
        const aiResponse = await callEngine("/api/analyze_knowledge", {
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
            return NextResponse.json(
                { message: `AIエンジンの解析に失敗しました（${aiResponse.status}）。しばらくして再度お試しください。` },
                { status: 502 }
            );
        }

        const aiData = await aiResponse.json();
        const extractedKnowledges = aiData.knowledges || [];

        // 抽出されたナレッジをDBに保存
        if (extractedKnowledges.length > 0) {
            await prisma.knowledge.createMany({
                data: extractedKnowledges.map((k: any) => ({
                    userId: user.id,
                    xAccountId,
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
        if (error instanceof EngineUnavailableError) {
            // EngineUnavailableError は内部情報を含まない縮退メッセージなのでそのまま返してよい。
            console.warn("Analyze: AI engine unavailable:", error.message);
            return NextResponse.json({ message: "この機能は現在利用できません。しばらくしてから再試行してください。" }, { status: 503 });
        }
        return errorResponse(error, "サーバーエラーが発生しました", 500, "analyze.post");
    }
}
