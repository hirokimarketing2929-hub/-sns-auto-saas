import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAutoReplyForCampaigns } from "@/lib/autoreply-runner";
import { getActiveXAccountId } from "@/lib/active-x-account";

// 冒頭バリエーション（最大100通り）を payload から取り出して JSON 文字列化する。
// 受け取り形式は string[]（推奨）/ 改行区切りの単一 string / それ以外（null扱い）に対応。
const MAX_OPENING_VARIANTS = 100;
function normalizeOpeningVariants(raw: unknown): string | null {
    let arr: string[] = [];
    if (Array.isArray(raw)) {
        arr = raw.filter((s): s is string => typeof s === "string");
    } else if (typeof raw === "string") {
        // 改行区切りの textarea からの入力を許容
        arr = raw.split(/\r?\n/);
    } else {
        return null;
    }
    const cleaned = arr
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .slice(0, MAX_OPENING_VARIANTS);
    if (cleaned.length === 0) return null;
    return JSON.stringify(cleaned);
}

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

        // アカウント別分離: アクティブな XAccount を取得
        const xAccountId = await getActiveXAccountId(user.id);

        // レガシー救済: xAccountId 未設定（旧仕様で作られた）キャンペーンを、現在アクティブな
        // アカウントへ一括移管する（冪等。一度移管すれば以後 null は残らない）。
        if (xAccountId) {
            await db.autoReplyCampaign.updateMany({
                where: { userId: user.id, xAccountId: null },
                data: { xAccountId },
            });
        }

        // GET 時にも期限切れを同期的に反映：endsAt を過ぎた稼働中キャンペーンを isActive=false に倒す
        // （cron は 5 分ごとだが、UI を開いた瞬間にも同期されるようにする）
        const now = new Date();
        await db.autoReplyCampaign.updateMany({
            where: {
                userId: user.id,
                xAccountId,
                isActive: true,
                endsAt: { not: null, lte: now },
            },
            data: { isActive: false },
        });

        // アクティブアカウントのキャンペーンだけを返す（アカウント別に完全分離）
        const campaigns = await db.autoReplyCampaign.findMany({
            where: { userId: user.id, xAccountId },
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

        // アカウント別分離: アクティブな XAccount（作成時の紐付け・手動実行の絞り込みに使用）
        const xAccountId = await getActiveXAccountId(user.id);

        const { action, payload } = await req.json();

        if (action === "create") {
            const { name, targetUrl, isTriggerRt, isTriggerLike, isTriggerReply, keyword, replyContent, replyType, endsAt, checkIntervalMinutes, triggerMode, openingVariants } = payload;
            const safeTriggerMode = triggerMode === "AND" ? "AND" : "OR";
            const normalizedOpenings = normalizeOpeningVariants(openingVariants);

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
                    xAccountId, // 作成したアカウントに紐付け（アカウント別分離）
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
                    openingVariants: normalizedOpenings,
                    openingsSentCount: 0,
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

        } else if (action === "update_opening_variants") {
            // 冒頭バリエーションの差し替え。リストが変わったら循環インデックスは 0 にリセットする
            // （別のリストに同じ index を使うと意図しない先頭文を再利用してしまうため）。
            const { id, openingVariants } = payload;
            const normalized = normalizeOpeningVariants(openingVariants);
            const updated = await db.autoReplyCampaign.update({
                where: { id, userId: user.id },
                data: { openingVariants: normalized, openingsSentCount: 0 }
            });
            return NextResponse.json({ campaign: updated });

        } else if (action === "run_now") {
            // 手動実行: 本人の稼働中キャンペーンを interval 無視で即実行し、実行ログを返す。
            // 二重送信は AutoReplyLog で防止（＝実際にリプライも送信される本番動作）。
            // payload.id があればその1件のみ、無ければ本人の全稼働中キャンペーンを対象。
            const { id } = payload || {};

            // 期限切れを同期的に反映してから対象を取得
            const now = new Date();
            await db.autoReplyCampaign.updateMany({
                where: { userId: user.id, xAccountId, isActive: true, endsAt: { not: null, lte: now } },
                data: { isActive: false },
            });

            // アクティブアカウントの稼働中キャンペーンのみ即実行（アカウント別分離）
            const campaigns = await db.autoReplyCampaign.findMany({
                where: { userId: user.id, xAccountId, isActive: true, ...(id ? { id } : {}) },
            });

            if (!campaigns || campaigns.length === 0) {
                return NextResponse.json({
                    details: ["稼働中のキャンペーンが見つかりませんでした（期限切れ・停止中・対象外の可能性）。"],
                    processedCampaigns: 0,
                });
            }

            const details = await runAutoReplyForCampaigns(campaigns, db);
            return NextResponse.json({ details, processedCampaigns: campaigns.length });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("POST AutoReply campaign error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
