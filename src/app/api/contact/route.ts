import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendToOwnerSheet } from "@/lib/owner-sheets";

const ALLOWED_CATEGORIES = ["エラー報告", "新機能依頼", "その他"];

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const { category, message } = await req.json();

        if (typeof category !== "string" || !ALLOWED_CATEGORIES.includes(category)) {
            return NextResponse.json({ message: "お問い合わせ種別を選択してください" }, { status: 400 });
        }
        if (typeof message !== "string" || message.trim().length === 0) {
            return NextResponse.json({ message: "お問い合わせ内容を入力してください" }, { status: 400 });
        }
        if (message.length > 5000) {
            return NextResponse.json({ message: "内容が長すぎます（5000文字以内）" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { name: true, email: true },
        });

        const sent = await sendToOwnerSheet({
            type: "contact",
            name: user?.name || session.user.name || "",
            email: user?.email || session.user.email,
            category,
            message: message.trim(),
        });

        // 宛先(GAS)未設定でもユーザー側はエラーにしない（送信受付として扱い、ログに残す）。
        if (!sent) {
            console.warn("[contact] 送信先(OWNER_LEADS_WEBHOOK_URL)未設定または送信失敗:", {
                from: session.user.email, category,
            });
        }

        return NextResponse.json({ ok: true, delivered: sent });
    } catch (error) {
        console.error("Contact API error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
