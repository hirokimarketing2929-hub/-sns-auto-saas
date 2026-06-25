import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { runAutoReplyForCampaigns } from "@/lib/autoreply-runner";
import { assertCronAuthorized } from "@/lib/cron-auth";

// 送信ループは対象ユーザーごとにジッター待機を挟むため、関数の最大実行時間を引き上げる。
// （Vercel の既定タイムアウトだとバッチが途中で打ち切られ、取りこぼしが発生し得る）
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    // cron 認証: 全環境で CRON_SECRET 必須（fail-closed・RT-002）。
    const denied = assertCronAuthorized(req);
    if (denied) return denied;

    try {
        // Prisma Client の型定義不整合を回避するため、anyキャストで強行突破 (マイグレーションは完了している前提)
        const db = prisma as any;

        // (1) 終了日時を過ぎた稼働中キャンペーンを一括で isActive=false に倒す
        const now = new Date();
        const expiredResult = await db.autoReplyCampaign.updateMany({
            where: {
                isActive: true,
                endsAt: { not: null, lte: now }
            },
            data: { isActive: false }
        });

        // (2) 稼働中 + チェック間隔が経過したキャンペーンだけを取得
        //     各キャンペーンの lastCheckedAt + checkIntervalMinutes <= now なら処理対象
        //     （cron 自体は毎分回るが、interval=5 のキャンペーンは 5 分毎にしか処理されない）
        const allActive = await db.autoReplyCampaign.findMany({
            where: { isActive: true },
            include: {
                user: { select: { id: true, settings: true } }
            }
        });
        const activeCampaigns = allActive.filter((c: { lastCheckedAt: Date | null; checkIntervalMinutes: number }) => {
            if (!c.lastCheckedAt) return true; // 一度もチェックしていなければ処理
            const next = new Date(c.lastCheckedAt.getTime() + c.checkIntervalMinutes * 60 * 1000);
            return next <= now;
        });

        const runLogs: string[] = [];
        if (expiredResult?.count > 0) {
            runLogs.push(`Auto-deactivated ${expiredResult.count} campaign(s) past their end date.`);
        }

        if (!activeCampaigns || activeCampaigns.length === 0) {
            return NextResponse.json({
                message: "No active campaigns found.",
                expiredDeactivated: expiredResult?.count ?? 0,
                details: runLogs
            });
        }

        // キャンペーン処理は共通ランナーへ委譲（手動実行 run_now と同一ロジック）
        const processLogs = await runAutoReplyForCampaigns(activeCampaigns, db);
        runLogs.push(...processLogs);

        return NextResponse.json({
            message: "Auto-reply cron job executed successfully.",
            processedCampaigns: activeCampaigns.length,
            totalActive: allActive.length,
            expiredDeactivated: expiredResult?.count ?? 0,
            details: runLogs
        });

    } catch (error: any) {
        return errorResponse(error, "サーバーエラーが発生しました", 500, "cron.autoreply");
    }
}
