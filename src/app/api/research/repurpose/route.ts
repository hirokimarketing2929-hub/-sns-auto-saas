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

        const data = await req.json();
              const { sourcePostText } = data;

        if (!sourcePostText) {
                  return NextResponse.json({ error: "投稿テキストが必要です。" }, { status: 400 });
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
            const response = await fetch(`${engineUrl}/api/repurpose_post`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_post_text: sourcePostText,
                    target_audience: settings.targetAudience || "",
                    target_pain: settings.targetPain || "",
                    account_concept: settings.accountConcept || "",
                    profile: settings.profile || "",
                    policy: settings.policy || ""
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
            return NextResponse.json({
                extracted_format: "【オフライン分析】冒頭のフック → 理由の展開 → 行動を促すCTA の三段構成",
                extracted_emotion: "知的好奇心 × 危機感",
                generated_posts: [
                    `${settings.targetPain || "集客"}に悩む${settings.targetAudience || "あなた"}へ。\n実はこの構造を真似するだけでインプレッションは3倍になります。\n\n具体的には...\n1. 冒頭で常識を否定する\n2. データで裏付ける\n3. 明確なアクションを示す\n\n保存して今日から実践してください。`,
                    `「まだその方法で消耗してるの？」\n\n${settings.targetAudience || "多くの人"}が見落としている事実があります。\nAI×${settings.accountConcept || "ビジネス"}の掛け合わせで\n成果が出る人と出ない人の差はたった1つ。\n\nそれは...（続きはプロフへ）`,
                    `【警告】${settings.targetPain || "SNS集客"}で最もやってはいけないこと\n\nそれは「毎日投稿すること」です。\n\nえ？と思った方、正解です。\n大事なのは頻度ではなく"構造"。\n\n${settings.profile || "プロ"}が使う具体的な構造を公開します👇`,
                ],
                _fallback: true,
                _message: "AIエンジン(FastAPI)に接続できなかったため、テンプレートベースで生成しました。本番環境ではFastAPIサーバーを起動してください。"
            });
        }

    } catch (error) {
        console.error("Repurpose API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
