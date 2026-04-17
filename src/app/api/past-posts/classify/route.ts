import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST: 閾値に基づいてPastPostのanalysisStatusを自動分類する。
 * Body: { thresholdImpression: number, thresholdConversion: number }
 *
 * ロジック:
 *   - impressions >= thresholdImpression AND conversions >= thresholdConversion → POSITIVE
 *   - それ以外 → NEGATIVE
 *   - 既にPOSITIVE/NEGATIVEの投稿も再分類する（閾値変更に対応）
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { settings: true }
        });

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const body = await req.json();
        const thresholdImpression = body.thresholdImpression ?? user.settings?.thresholdImpression ?? 1000;
        const thresholdConversion = body.thresholdConversion ?? user.settings?.thresholdConversion ?? 1;

        // 閾値をSettingsに保存
        if (user.settings) {
            await prisma.settings.update({
                where: { userId: user.id },
                data: { thresholdImpression, thresholdConversion }
            });
        }

        // 全投稿を取得して分類
        const allPosts = await prisma.pastPost.findMany({
            where: { userId: user.id }
        });

        let positiveCount = 0;
        let negativeCount = 0;

        for (const post of allPosts) {
            const isPositive = post.impressions >= thresholdImpression && post.conversions >= thresholdConversion;
            const newStatus = isPositive ? "POSITIVE" : "NEGATIVE";

            if (post.analysisStatus !== newStatus) {
                await prisma.pastPost.update({
                    where: { id: post.id },
                    data: { analysisStatus: newStatus }
                });
            }

            if (isPositive) positiveCount++;
            else negativeCount++;
        }

        return NextResponse.json({
            message: "分類が完了しました",
            total: allPosts.length,
            positive: positiveCount,
            negative: negativeCount,
            thresholdImpression,
            thresholdConversion,
        });
    } catch (error) {
        console.error("Classify error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
