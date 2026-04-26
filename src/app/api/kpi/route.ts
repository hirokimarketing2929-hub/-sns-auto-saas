import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";
import { logXApiUsage } from "@/lib/api-usage";

// 自動メトリクスを計算して返す
async function computeMetricValue(
    userId: string,
    source: string,
    periodDays: number | null
): Promise<{ value: number; note?: string } | null> {
    if (!source || source === "manual") return null;

    const days = periodDays && periodDays > 0 ? periodDays : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // --- X 系 ---
    if (source === "x_followers") {
        try {
            const client = await getTwitterClient(userId);
            const me = await client.v2.me({ "user.fields": ["public_metrics"] });
            await logXApiUsage({
                userId,
                operation: "x-me",
                rateLimit: (me as unknown as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit,
            });
            const count = (me.data as unknown as { public_metrics?: { followers_count?: number } })?.public_metrics?.followers_count ?? 0;
            return { value: count, note: "X 現在のフォロワー数" };
        } catch (e) {
            return { value: 0, note: (e as { message?: string })?.message || "X API エラー" };
        }
    }
    if (source === "x_posts_count") {
        const count = await prisma.pastPost.count({
            where: { userId, postedAt: { gte: since } },
        });
        return { value: count, note: `直近 ${days} 日の投稿数（同期済み）` };
    }
    if (source === "x_impressions_total") {
        const rows = await prisma.pastPost.findMany({
            where: { userId, postedAt: { gte: since } },
            select: { impressions: true },
        });
        const total = rows.reduce((s, r) => s + (r.impressions || 0), 0);
        return { value: total, note: `直近 ${days} 日の合計インプ` };
    }
    if (source === "x_impressions_avg") {
        const rows = await prisma.pastPost.findMany({
            where: { userId, postedAt: { gte: since } },
            select: { impressions: true },
        });
        if (rows.length === 0) return { value: 0, note: "データなし" };
        const avg = Math.round(rows.reduce((s, r) => s + (r.impressions || 0), 0) / rows.length);
        return { value: avg, note: `直近 ${days} 日の平均インプ` };
    }

    // X プロフィールクリック系（non_public_metrics は自分の投稿・過去30日のみ）
    if (source === "x_profile_clicks_total" || source === "x_profile_click_rate") {
        try {
            const client = await getTwitterClient(userId);
            const me = await client.v2.me();
            const myId = me.data?.id;
            if (!myId) return { value: 0, note: "自分の userId 取得失敗" };

            // X 仕様: non_public_metrics は過去30日限定。days が30超なら30にクランプ
            const windowDays = Math.min(30, days);
            const startTime = new Date();
            startTime.setDate(startTime.getDate() - windowDays);

            const timeline = await client.v2.userTimeline(myId, {
                max_results: 100,
                exclude: ["retweets", "replies"],
                "tweet.fields": ["public_metrics", "non_public_metrics"],
                start_time: startTime.toISOString(),
            });
            await logXApiUsage({
                userId,
                operation: "x-user-timeline-nonpublic",
                rateLimit: (timeline as unknown as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit,
            });

            type TweetWithMetrics = {
                public_metrics?: { impression_count?: number };
                non_public_metrics?: { user_profile_clicks?: number; impression_count?: number };
            };
            const tweets = (timeline as unknown as { data?: { data?: TweetWithMetrics[] } }).data?.data || [];

            let totalClicks = 0;
            let totalImps = 0;
            for (const t of tweets) {
                totalClicks += t.non_public_metrics?.user_profile_clicks ?? 0;
                totalImps += t.non_public_metrics?.impression_count ?? t.public_metrics?.impression_count ?? 0;
            }

            if (source === "x_profile_clicks_total") {
                return { value: totalClicks, note: `直近 ${windowDays} 日のプロフィールクリック合計（X API 30日制限）` };
            } else {
                // プロフィール遷移率 (%): 小数点以下1桁を保持するため ×10 して整数で保存
                if (totalImps === 0) return { value: 0, note: "インプ0のため算出不可" };
                const ratePercent = Math.round((totalClicks / totalImps) * 1000); // 1.5% → 15
                return {
                    value: ratePercent,
                    note: `プロフ遷移率: ${(ratePercent / 10).toFixed(1)}% (${totalClicks} / ${totalImps.toLocaleString()} imp, 直近 ${windowDays} 日)`,
                };
            }
        } catch (e) {
            return { value: 0, note: (e as { message?: string })?.message || "X API エラー（dm.read / metrics.read 権限をご確認）" };
        }
    }

    // --- プロライン系 ---
    if (source === "proline_registrations_total") {
        const count = await prisma.funnelEvent.count({
            where: { userId, occurredAt: { gte: since } },
        });
        return { value: count, note: `直近 ${days} 日のプロライン登録総数` };
    }
    if (source === "proline_registrations_today") {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const count = await prisma.funnelEvent.count({
            where: { userId, occurredAt: { gte: startOfToday } },
        });
        return { value: count, note: "今日のプロライン登録" };
    }
    if (source === "proline_registrations_month") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const count = await prisma.funnelEvent.count({
            where: { userId, occurredAt: { gte: startOfMonth } },
        });
        return { value: count, note: "今月のプロライン登録" };
    }
    if (source.startsWith("proline_form:")) {
        const formName = source.substring("proline_form:".length);
        const count = await prisma.funnelEvent.count({
            where: {
                userId,
                formName,
                source: { in: ["proline", "proline_form"] },
                occurredAt: { gte: since },
            },
        });
        return { value: count, note: `フォーム「${formName}」直近 ${days} 日` };
    }
    if (source === "proline_scenario_total") {
        const count = await prisma.funnelEvent.count({
            where: { userId, source: "proline_scenario", occurredAt: { gte: since } },
        });
        return { value: count, note: `シナリオ登録 直近 ${days} 日の合計` };
    }
    if (source.startsWith("proline_scenario:")) {
        const scenarioName = source.substring("proline_scenario:".length);
        const count = await prisma.funnelEvent.count({
            where: {
                userId,
                source: "proline_scenario",
                formName: scenarioName,  // スキーマ互換のため formName にシナリオ名も格納
                occurredAt: { gte: since },
            },
        });
        return { value: count, note: `シナリオ「${scenarioName}」直近 ${days} 日` };
    }

    return null;
}

// KPIシナリオの取得
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { kpiScenarios: { orderBy: { order: "asc" } } }
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ scenarios: user.kpiScenarios });
    } catch (error) {
        console.error("GET KPI scenarios error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

// KPIシナリオの作成・更新
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const { action, payload } = await req.json();

        if (action === "create") {
            // 新規シナリオ追加
            const { name, targetValue, currentValue, metricSource, metricPeriodDays } = payload;

            // 現在の最大のorderを取得
            const maxOrderScenario = await prisma.kpiScenario.findFirst({
                where: { userId: user.id },
                orderBy: { order: "desc" }
            });
            const nextOrder = maxOrderScenario ? maxOrderScenario.order + 1 : 0;
            const source = typeof metricSource === "string" && metricSource.length > 0 ? metricSource : "manual";

            // 自動ソース指定時は初期値を自動取得する
            let initialValue = Number(currentValue) || 0;
            const metric = await computeMetricValue(user.id, source, Number(metricPeriodDays) || null);
            if (metric) initialValue = metric.value;

            const newScenario = await prisma.kpiScenario.create({
                data: {
                    userId: user.id,
                    name,
                    order: nextOrder,
                    targetValue: Number(targetValue) || 0,
                    currentValue: initialValue,
                    metricSource: source,
                    metricPeriodDays: Number(metricPeriodDays) || null,
                }
            });
            return NextResponse.json({ scenario: newScenario });

        } else if (action === "update_metric") {
            // 既存シナリオのメトリクスソース変更（+ 即反映）
            const { id, metricSource, metricPeriodDays } = payload;
            const source = typeof metricSource === "string" && metricSource.length > 0 ? metricSource : "manual";

            const existing = await prisma.kpiScenario.findUnique({ where: { id, userId: user.id } });
            if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

            const metric = await computeMetricValue(user.id, source, Number(metricPeriodDays) || null);
            const updated = await prisma.kpiScenario.update({
                where: { id, userId: user.id },
                data: {
                    metricSource: source,
                    metricPeriodDays: Number(metricPeriodDays) || null,
                    ...(metric ? { currentValue: metric.value } : {}),
                },
            });
            return NextResponse.json({ scenario: updated, note: metric?.note });

        } else if (action === "sync") {
            // 1件のシナリオの currentValue を自動ソースから取り直す（タップ時に呼ぶ）
            const { id } = payload;
            const s = await prisma.kpiScenario.findUnique({ where: { id, userId: user.id } });
            if (!s) return NextResponse.json({ message: "Not found" }, { status: 404 });
            if (s.metricSource === "manual") {
                return NextResponse.json({ scenario: s, note: "手動入力のシナリオです" });
            }
            const metric = await computeMetricValue(user.id, s.metricSource, s.metricPeriodDays);
            if (!metric) return NextResponse.json({ scenario: s, note: "メトリクス計算に失敗" });
            const updated = await prisma.kpiScenario.update({
                where: { id, userId: user.id },
                data: { currentValue: metric.value },
            });
            return NextResponse.json({ scenario: updated, note: metric.note });

        } else if (action === "sync_all") {
            // 全自動ソースのシナリオを一括で再取得
            const scenarios = await prisma.kpiScenario.findMany({
                where: { userId: user.id, NOT: { metricSource: "manual" } },
            });
            const results: Array<{ id: string; value: number; note?: string }> = [];
            for (const s of scenarios) {
                const metric = await computeMetricValue(user.id, s.metricSource, s.metricPeriodDays);
                if (metric) {
                    await prisma.kpiScenario.update({ where: { id: s.id }, data: { currentValue: metric.value } });
                    results.push({ id: s.id, value: metric.value, note: metric.note });
                }
            }
            return NextResponse.json({ synced: results.length, results });

        } else if (action === "update_manual_value") {
            // 手動入力シナリオの currentValue 更新
            const { id, currentValue } = payload;
            const s = await prisma.kpiScenario.findUnique({ where: { id, userId: user.id } });
            if (!s) return NextResponse.json({ message: "Not found" }, { status: 404 });
            if (s.metricSource !== "manual") {
                return NextResponse.json({ message: "自動ソース設定中です。先にメトリクス設定を「手動」に変更してください" }, { status: 400 });
            }
            const updated = await prisma.kpiScenario.update({
                where: { id, userId: user.id },
                data: { currentValue: Number(currentValue) || 0 },
            });
            return NextResponse.json({ scenario: updated });

        } else if (action === "delete") {
            // シナリオ削除
            const { id } = payload;
            await prisma.kpiScenario.delete({
                where: { id, userId: user.id }
            });
            return NextResponse.json({ success: true });

        } else if (action === "reorder") {
            // 並び替え (一括更新)
            const { scenarios } = payload; // [{ id: "cuid", order: 0 }, ...]

            const updatePromises = scenarios.map((s: any) =>
                prisma.kpiScenario.update({
                    where: { id: s.id, userId: user.id },
                    data: { order: s.order }
                })
            );
            await Promise.all(updatePromises);
            return NextResponse.json({ success: true });

        } else if (action === "sync_gas") {
            // GASからのデータ同期 (モック機能)
            // 実際はGAS側からこのエンドポイントを叩く想定
            return NextResponse.json({ message: "GAS sync functional stub" });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("POST KPI scenario error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
