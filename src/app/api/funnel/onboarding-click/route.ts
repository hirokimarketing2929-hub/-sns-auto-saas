import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveXAccountId } from "@/lib/active-x-account";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

// 初回オンボーディング・ポップアップ（プロライン アフィリエイト連携誘導）のクリックを
// FunnelEvent として記録する内部エンドポイント。
//
// 位置づけ（決定 #024）:
//   連携エンジン = ProX オンボーディング自体。
//   登録ユーザーがポップアップから ProLine アフィリエイトLPへ遷移した瞬間（＝連携ファネルへの入口）を
//   計測可能にする。最終的な「連携 1カウント」は ProLine 側 GAS → /api/funnel/webhook/[token] で
//   別途到達するが、本イベントは「どれだけのユーザーがオンボーディングから連携導線に入ったか」を
//   FunnelEvent と同じテーブルで可視化するための入口計測。
//
//   source       = "prox_onboarding"
//   utmCampaign  = "prox_onboarding_popup"（既存 byUtmCampaign 集計で拾える）
//
// 同一ユーザーが連打しても 1 件に収束させる（端末側でも1回だが、サーバ側でも冪等化）。
export async function POST(req: Request) {
    try {
        const limited = enforceRateLimit(`onboarding-click:${getClientIp(req)}`, 20, 60_000);
        if (limited) return limited;

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const xAccountId = await getActiveXAccountId(user.id);

        // 冪等化: 同一ユーザー × 同一キャンペーンの既存イベントがあれば二重登録しない。
        const existing = await prisma.funnelEvent.findFirst({
            where: {
                userId: user.id,
                source: "prox_onboarding",
                utmCampaign: "prox_onboarding_popup",
            },
            select: { id: true },
        });
        if (existing) {
            return NextResponse.json({ ok: true, deduped: true });
        }

        await prisma.funnelEvent.create({
            data: {
                userId: user.id,
                xAccountId,
                source: "prox_onboarding",
                formName: "オンボーディングポップアップ",
                utmSource: "prox",
                utmMedium: "onboarding_popup",
                utmCampaign: "prox_onboarding_popup",
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("onboarding-click error:", error);
        // 計測失敗はユーザー体験を妨げない（CTA遷移自体は別途行われる）。
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
