import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getActiveXAccount } from "@/lib/active-x-account";
import { callEngine, EngineUnavailableError } from "@/lib/ai-engine";

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

        const xAccount = await getActiveXAccount(user.id);
        if (!xAccount) {
            return NextResponse.json({ error: "サブアカウントが未設定です。" }, { status: 400 });
        }

        // AI エンジンへリクエスト。
        // 障害時は「偽の投稿案を本物として返す」のをやめ、空配列＋警告メッセージで正直に伝える。
        try {
            const response = await callEngine("/api/repurpose_post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_post_text: sourcePostText,
                    target_audience: xAccount.targetAudience || "",
                    target_pain: xAccount.targetPain || "",
                    account_concept: xAccount.accountConcept || "",
                    profile: xAccount.profile || ""
                }),
            }, { timeoutMs: 30000 });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                console.error("AI engine repurpose error:", response.status, errorText);
                // 200 で返し、フロントの _fallback 警告UIで「生成できなかった」ことを明示する（偽コンテンツは返さない）
                return NextResponse.json({
                    extracted_format: "",
                    extracted_emotion: "",
                    generated_posts: [],
                    _fallback: true,
                    _message: `AIエンジンの応答エラー (${response.status}) のため横展開を生成できませんでした。しばらくして再度お試しください。`,
                });
            }

            const aiData = await response.json();
            return NextResponse.json(aiData);
        } catch (fetchError: unknown) {
            const msg = fetchError instanceof EngineUnavailableError
                ? fetchError.message
                : "AIエンジンへの接続に失敗しました。";
            console.warn("Repurpose: AI engine unavailable:", msg);
            return NextResponse.json({
                extracted_format: "",
                extracted_emotion: "",
                generated_posts: [],
                _fallback: true,
                _message: `${msg} 横展開は生成できませんでした（AIエンジンが起動しているか確認してください）。`,
            });
        }

    } catch (error) {
        console.error("Repurpose API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
