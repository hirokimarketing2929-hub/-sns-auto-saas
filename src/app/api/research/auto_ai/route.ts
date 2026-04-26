import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const settings = await prisma.settings.findUnique({
            where: { userId: user.id }
        });

        if (!settings) {
            return NextResponse.json({ error: "設定情報が見つかりません。設定画面からターゲットやコンセプトを登録してください。" }, { status: 400 });
        }

        // FastAPIへリクエスト
        const engineUrl = process.env.AI_ENGINE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

        try {
            const response = await fetch(`${engineUrl}/api/auto_research_ai`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target_audience: settings.targetAudience || "",
                    target_pain: settings.targetPain || "",
                    account_concept: settings.accountConcept || "",
                    profile: settings.profile || ""
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("FastAPI Error:", errorText);
                throw new Error(`AIエンジン応答エラー (${response.status})`);
            }

            const aiData = await response.json();
            return NextResponse.json(aiData);
        } catch (fetchError: unknown) {
            // FastAPI接続失敗時のフォールバック
            console.warn("FastAPI unreachable, returning fallback response:", fetchError);

            const audience = settings.targetAudience || "個人事業主";
            const pain = settings.targetPain || "集客が伸びない";
            const concept = settings.accountConcept || "AI×ビジネス";

            return NextResponse.json({
                extracted_format: "【AI提案】逆張りフック → 実体験ベースの証拠 → 行動喚起 の三段構成",
                extracted_emotion: "「反常識・逆張り」 × 「知的好奇心」",
                generated_posts: [
                    `「AIは使えない」と言ってる人ほど\n実は一番損してます。\n\n${pain}に悩む${audience}が\n知らないだけで、すでに月商100万超えの人は\n全員これを使ってます。\n\n具体的な方法はプロフから👇`,
                    `${audience}の9割が間違えている\n${concept}の本質。\n\nそれは「効率化」ではなく\n「意思決定の自動化」です。\n\nこの違いが分かる人だけ\n次のステージに行けます。\n\n詳しく解説します↓`,
                    `【保存推奨】\n${pain}を一撃で解決する\n3ステップを公開します。\n\n① まず○○を捨てる\n② 次に○○だけに集中する\n③ 最後に○○で仕組み化する\n\nこれだけで結果が変わります。\n実践した人はリプで教えてください🔥`,
                ],
                _fallback: true,
                _message: "AIエンジン(FastAPI)に接続できなかったため、テンプレートベースで生成しました。"
            });
        }

    } catch (error) {
        console.error("Auto AI Research API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
