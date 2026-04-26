import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// キャンペーン一覧の取得
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = prisma as any;
        const user = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
        });

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        // GET 時にも期限切れを同期的に反映：endsAt を過ぎた稼働中キャンペーンを isActive=false に倒す
        // （cron は 5 分ごとだが、UI を開いた瞬間にも同期されるようにする）
        const now = new Date();
        await db.autoReplyCampaign.updateMany({
            where: {
                userId: user.id,
                isActive: true,
                endsAt: { not: null, lte: now },
            },
            data: { isActive: false },
        });

        const campaigns = await db.autoReplyCampaign.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ campaigns });
    } catch (error) {
        console.error("GET AutoReply campaigns error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

// キャンペーンの作成・削除・状態変更
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const db = prisma as any;
        const user = await db.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const { action, payload } = await req.json();

        if (action === "create") {
            const { name, targetUrl, isTriggerRt, isTriggerLike, isTriggerReply, keyword, replyContent, replyType, endsAt, checkIntervalMinutes, triggerMode } = payload;
            const safeTriggerMode = triggerMode === "AND" ? "AND" : "OR";

            // チェック間隔のバリデーション（1, 5, 15, 30, 60 のみ許可）
            const allowedIntervals = [1, 5, 15, 30, 60];
            const intervalNum = Number(checkIntervalMinutes);
            const safeInterval = allowedIntervals.includes(intervalNum) ? intervalNum : 5;

            // endsAt は必須。ISO 文字列で受け取り、未来日時のみ受付
            if (!endsAt) {
                return NextResponse.json({ message: "キャンペーン終了日時は必須です" }, { status: 400 });
            }
            const endsAtDate = new Date(endsAt);
            if (Number.isNaN(endsAtDate.getTime())) {
                return NextResponse.json({ message: "終了日時の形式が不正です" }, { status: 400 });
            }
            if (endsAtDate.getTime() <= Date.now()) {
                return NextResponse.json({ message: "終了日時は未来の時刻を指定してください" }, { status: 400 });
            }

            const newCampaign = await db.autoReplyCampaign.create({
                data: {
                    userId: user.id,
                    name,
                    targetUrl,
                    isTriggerRt: !!isTriggerRt,
                    isTriggerLike: !!isTriggerLike,
                    isTriggerReply: !!isTriggerReply,
                    keyword: isTriggerReply ? keyword : null, // 特定リプ判定がONのときだけ保存
                    replyContent,
                    isActive: true,
                    replyType: replyType || "REPLY",
                    endsAt: endsAtDate,
                    checkIntervalMinutes: safeInterval,
                    triggerMode: safeTriggerMode,
                }
            });
            return NextResponse.json({ campaign: newCampaign });

        } else if (action === "delete") {
            const { id } = payload;
            await db.autoReplyCampaign.delete({
                where: { id, userId: user.id }
            });
            return NextResponse.json({ success: true });

        } else if (action === "toggle_active") {
            const { id, isActive } = payload;
            const updated = await db.autoReplyCampaign.update({
                where: { id, userId: user.id },
                data: { isActive }
            });
            return NextResponse.json({ campaign: updated });

        } else if (action === "update_end_date") {
            const { id, endsAt } = payload;
            if (!endsAt) {
                return NextResponse.json({ message: "終了日時は必須です" }, { status: 400 });
            }
            const d = new Date(endsAt);
            if (Number.isNaN(d.getTime())) {
                return NextResponse.json({ message: "終了日時の形式が不正です" }, { status: 400 });
            }
            const updated = await db.autoReplyCampaign.update({
                where: { id, userId: user.id },
                data: { endsAt: d }
            });
            return NextResponse.json({ campaign: updated });

        } else if (action === "update_interval") {
            const { id, checkIntervalMinutes } = payload;
            const allowedIntervals = [1, 5, 15, 30, 60];
            const intervalNum = Number(checkIntervalMinutes);
            if (!allowedIntervals.includes(intervalNum)) {
                return NextResponse.json({ message: "チェック間隔は 1, 5, 15, 30, 60 分のいずれかを指定してください" }, { status: 400 });
            }
            const updated = await db.autoReplyCampaign.update({
                where: { id, userId: user.id },
                data: { checkIntervalMinutes: intervalNum }
            });
            return NextResponse.json({ campaign: updated });

        } else if (action === "update_trigger_mode") {
            const { id, triggerMode } = payload;
            const safe = triggerMode === "AND" ? "AND" : "OR";
            const updated = await db.autoReplyCampaign.update({
                where: { id, userId: user.id },
                data: { triggerMode: safe }
            });
            return NextResponse.json({ campaign: updated });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("POST AutoReply campaign error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
