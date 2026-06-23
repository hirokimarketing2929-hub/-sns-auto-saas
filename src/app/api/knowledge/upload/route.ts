import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveXAccountId } from "@/lib/active-x-account";
import { callEngine, EngineUnavailableError } from "@/lib/ai-engine";
import { featureGateResponse } from "@/lib/features";

export async function POST(req: Request) {
    try {
        // Python AIエンジン依存機能。mvp(外部公開)では縮退して提供しない（CTO決定003 §3）。
        const gated = featureGateResponse("pythonAI");
        if (gated) return gated;

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const xAccountId = await getActiveXAccountId(user.id);

        // フロント側から送信されたFormDataの取得
        const formData = await req.formData();
        const uploadCategory = formData.get("category") as string || "AUTO";
        const files = formData.getAll("files") as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ message: "No files provided" }, { status: 400 });
        }

        // FastAPIへ転送するための新しいFormDataを作成
        const pythonFormData = new FormData();
        files.forEach(file => {
            pythonFormData.append("files", file);
        });

        // AIエンジンの /api/parse_knowledge エンドポイントへそのまま転送する（接続不可・タイムアウトを捕捉）
        const response = await callEngine("/api/parse_knowledge", {
            method: "POST",
            body: pythonFormData,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            console.error("AI engine parse_knowledge error:", response.status, errorText);
            return NextResponse.json({ message: "AIエンジンの解析に失敗しました" }, { status: 502 });
        }

        const data = await response.json();
        const extractedKnowledges = data.knowledges || [];
        const savedKnowledges = [];

        // 抽出されたナレッジをDB(Prisma)に保存
        for (const item of extractedKnowledges) {
            // フロントで特定の格納先（AUTO以外）が指定された場合は上書き
            let finalType = item.type;
            if (uploadCategory !== "AUTO" && ["BASE", "TEMPLATE", "WINNING", "LOSING"].includes(uploadCategory)) {
                finalType = uploadCategory;
            } else if (!["BASE", "TEMPLATE", "WINNING", "LOSING"].includes(finalType)) {
                // 不明なタイプが返ってきたらBASEにフォールバック
                finalType = "BASE";
            }

            const k = await prisma.knowledge.create({
                data: {
                    userId: user.id,
                    xAccountId,
                    content: item.content,
                    type: finalType,
                    category: item.category || "",
                    source: item.source || "ファイル解析",
                    isSharedToHQ: false
                }
            });
            savedKnowledges.push(k);
        }

        return NextResponse.json({ 
            message: "Success", 
            count: savedKnowledges.length, 
            knowledges: savedKnowledges 
        });

    } catch (error) {
        if (error instanceof EngineUnavailableError) {
            console.warn("Knowledge upload: AI engine unavailable:", error.message);
            return NextResponse.json({ message: error.message }, { status: 503 });
        }
        console.error("Upload Route API Error:", error);
        return NextResponse.json({ message: "サーバー内部エラーが発生しました" }, { status: 500 });
    }
}
