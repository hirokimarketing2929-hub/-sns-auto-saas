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
        const engineUrl = process.env.AI_ENGINE_URL || (process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:8000") + "";
        const response = await fetch(`${engineUrl}/api/repurpose_post`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                source_post_text: sourcePostText,
                target_audience: settings.targetAudience || "",
                target_pain: settings.targetPain || "",
                account_concept: settings.accountConcept || "",
                profile: settings.profile || "",
                policy: settings.policy || ""
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("FastAPI Error:", errorText);
            return NextResponse.json({ error: "AIエンジンの解析に失敗しました。" }, { status: response.status });
        }

        const aiData = await response.json();
        return NextResponse.json(aiData);

    } catch (error) {
        console.error("Repurpose API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
