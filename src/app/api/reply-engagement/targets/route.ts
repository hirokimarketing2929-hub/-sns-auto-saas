import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TARGETS = 10;

function errJson(message: string, status = 500) {
    return NextResponse.json({ error: message }, { status });
}

// 一覧取得
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return errJson("Unauthorized", 401);

        const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
        if (!user) return errJson("User not found", 404);

        const targets = await prisma.replyEngagementTarget.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "asc" },
        });
        return NextResponse.json({ targets, max: MAX_TARGETS });
    } catch (e) {
        const err = e as { message?: string };
        console.error("[reply-engagement/targets] GET fatal:", err?.message, e);
        return errJson(err?.message || "一覧の取得に失敗しました", 500);
    }
}

// 追加 / 更新 / 削除 / active toggle
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return errJson("Unauthorized", 401);

        const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
        if (!user) return errJson("User not found", 404);

        let body: { action?: string; payload?: Record<string, unknown> };
        try {
            body = await req.json();
        } catch {
            return errJson("リクエストの JSON を解析できませんでした", 400);
        }
        const { action, payload } = body || {};

        if (action === "create") {
            const count = await prisma.replyEngagementTarget.count({ where: { userId: user.id } });
            if (count >= MAX_TARGETS) {
                return errJson(`ターゲットは最大 ${MAX_TARGETS} 件までです`, 400);
            }

            // 入力を柔軟に受け付ける: URL / @付き / 前後空白 / 末尾スラッシュ を許容
            let raw = String(payload?.username || "").trim();
            const urlMatch = raw.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i);
            if (urlMatch) {
                raw = urlMatch[1];
            } else {
                raw = raw.replace(/^@/, "").replace(/\/+$/, "").trim();
            }

            if (!/^[A-Za-z0-9_]{1,15}$/.test(raw)) {
                return errJson(
                    `ユーザー名の形式が不正です（受信値: "${String(payload?.username || "")}" → 抽出結果: "${raw}"）。英数字と _ のみ、最大15文字で入力してください。`,
                    400,
                );
            }

            try {
                const created = await prisma.replyEngagementTarget.create({
                    data: {
                        userId: user.id,
                        username: raw,
                        displayName: (payload?.displayName as string) || null,
                        isActive: true,
                    },
                });
                return NextResponse.json({ target: created });
            } catch (e) {
                const err = e as { code?: string; message?: string };
                console.error("[reply-engagement/targets] create error:", err?.code, err?.message);
                if (err?.code === "P2002") return errJson("既に登録済みのターゲットです", 400);
                return errJson(err?.message || "保存に失敗しました", 500);
            }
        }

        if (action === "toggle") {
            const id = String(payload?.id || "");
            const isActive = !!payload?.isActive;
            // 所有権チェック → update は id のみで
            const owned = await prisma.replyEngagementTarget.findFirst({
                where: { id, userId: user.id },
                select: { id: true },
            });
            if (!owned) return errJson("対象が見つかりません", 404);

            const updated = await prisma.replyEngagementTarget.update({
                where: { id },
                data: { isActive },
            });
            return NextResponse.json({ target: updated });
        }

        if (action === "delete") {
            const id = String(payload?.id || "");
            const owned = await prisma.replyEngagementTarget.findFirst({
                where: { id, userId: user.id },
                select: { id: true },
            });
            if (!owned) return errJson("対象が見つかりません", 404);
            await prisma.replyEngagementTarget.delete({ where: { id } });
            return NextResponse.json({ ok: true });
        }

        return errJson(`未対応の action です: ${action}`, 400);
    } catch (e) {
        const err = e as { message?: string };
        console.error("[reply-engagement/targets] POST fatal:", err?.message, e);
        return errJson(err?.message || "サーバー内部エラー", 500);
    }
}
