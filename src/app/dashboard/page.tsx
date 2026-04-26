import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
    Brain,
    Sparkles,
    Link2,
    ArrowRight,
    Settings,
    MessageCircle,
    BarChart3,
    Zap,
    Activity,
    Coins,
    Target,
} from "lucide-react";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            _count: {
                select: {
                    knowledges: true,
                    posts: true,
                    accounts: true
                }
            },
            settings: true
        }
    });

    if (!user) {
        redirect("/login");
    }

    const settings = user.settings as any;
    const hasManualX = !!(settings?.xApiKey && settings?.xAccessToken);
    const totalAccountsConnected = user._count.accounts + (hasManualX ? 1 : 0);

    // 使用量サマリー（今日 / 今月）
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const aggregate = async (since: Date) => {
        const rows = await prisma.apiUsageLog.groupBy({
            by: ["provider"],
            where: { userId: user.id, createdAt: { gte: since } },
            _sum: { inputTokens: true, outputTokens: true, costUsd: true },
            _count: { _all: true },
        });
        let llmIn = 0, llmOut = 0, llmCost = 0, llmCalls = 0, xCalls = 0;
        for (const r of rows) {
            if (r.provider === "x") {
                xCalls += r._count._all;
            } else {
                llmIn += r._sum.inputTokens ?? 0;
                llmOut += r._sum.outputTokens ?? 0;
                llmCost += r._sum.costUsd ?? 0;
                llmCalls += r._count._all;
            }
        }
        return { llmIn, llmOut, llmCost, llmCalls, xCalls, rows };
    };

    const [todayUsage, monthUsage] = await Promise.all([
        aggregate(startOfToday),
        aggregate(startOfMonth),
    ]);

    // プロラインフリー 導線集計（今日 / 今月 / 直近7日分）
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 6); // 今日含め7日分
    last7Days.setHours(0, 0, 0, 0);

    const [funnelToday, funnelMonth, funnelLast7Days] = await Promise.all([
        prisma.funnelEvent.count({ where: { userId: user.id, occurredAt: { gte: startOfToday } } }),
        prisma.funnelEvent.count({ where: { userId: user.id, occurredAt: { gte: startOfMonth } } }),
        prisma.funnelEvent.findMany({
            where: { userId: user.id, occurredAt: { gte: last7Days } },
            select: { occurredAt: true },
        }),
    ]);

    // 日別集計（過去7日）
    const dailyFunnel: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = `${d.getMonth() + 1}/${d.getDate()}`;
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const end = start + 86400000;
        const count = funnelLast7Days.filter(ev => {
            const t = ev.occurredAt.getTime();
            return t >= start && t < end;
        }).length;
        dailyFunnel.push({ date: key, count });
    }
    const max7d = Math.max(1, ...dailyFunnel.map(d => d.count));

    const totalTokens = (v: typeof todayUsage) => (v.llmIn + v.llmOut).toLocaleString();
    const costLabel = (v: typeof todayUsage) => `$${v.llmCost.toFixed(4)}`;

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-10 animate-fade-up">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold tracking-tight">
                    ようこそ、<span className="text-gradient-prox">{session.user.name || "ゲスト"}</span>さん
                </h2>
                <p className="text-muted-foreground mt-2">
                    ProXはあなたのノウハウを学習し、自動で成果を最大化するAIエンジンです。
                </p>
            </div>

            {/* Metrics Panel */}
            <div className="grid gap-4 md:grid-cols-3 animate-fade-up-delay-1">
                <div className="glass rounded-2xl p-5 transition-all hover:bg-white/8">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">AIナレッジ</span>
                        <Brain className="size-4 text-purple-400" />
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                        {user._count.knowledges}
                        <span className="text-base font-normal text-muted-foreground ml-1">件</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        {user._count.knowledges === 0 ? "ナレッジを追加してAIを育成しましょう" : "ナレッジが増えるほどAIが賢くなります"}
                    </p>
                </div>

                <div className="glass rounded-2xl p-5 transition-all hover:bg-white/8">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">生成投稿数</span>
                        <Sparkles className="size-4 text-emerald-400" />
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                        {user._count.posts}
                        <span className="text-base font-normal text-muted-foreground ml-1">件</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        AIが代わりにSNSを運用した実績数です
                    </p>
                </div>

                <div className="glass rounded-2xl p-5 transition-all hover:bg-white/8">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">連携アカウント</span>
                        <Link2 className="size-4 text-blue-400" />
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                        {totalAccountsConnected}
                        <span className="text-base font-normal text-muted-foreground ml-1">件</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        {totalAccountsConnected > 0 ? "システムは正常に連携されています" : "設定からSNSを連携してください"}
                    </p>
                </div>
            </div>

            {/* プロラインフリー 導線（ファネル） */}
            <div className="animate-fade-up-delay-1">
                <div className="flex items-center gap-2 mb-4">
                    <Target className="size-4 text-emerald-400" />
                    <h3 className="text-lg font-semibold text-foreground/80">プロラインフリー 導線</h3>
                    <span className="text-xs text-muted-foreground">（X投稿→LP→LINE登録）</span>
                    <Link href="/dashboard/settings" className="ml-auto text-xs text-purple-400 hover:text-purple-300">
                        🛠 連携設定
                    </Link>
                </div>
                <div className="grid gap-4 md:grid-cols-3 mb-4">
                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">今日の登録</span>
                            <Target className="size-3.5 text-emerald-400" />
                        </div>
                        <div className="text-2xl font-bold text-emerald-300">{funnelToday}<span className="text-base font-normal text-muted-foreground ml-1">件</span></div>
                    </div>
                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">今月の登録</span>
                            <Target className="size-3.5 text-emerald-400" />
                        </div>
                        <div className="text-2xl font-bold text-emerald-300">{funnelMonth}<span className="text-base font-normal text-muted-foreground ml-1">件</span></div>
                    </div>
                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">直近7日の登録</span>
                            <Target className="size-3.5 text-emerald-400" />
                        </div>
                        <div className="text-2xl font-bold text-emerald-300">{dailyFunnel.reduce((s, d) => s + d.count, 0)}<span className="text-base font-normal text-muted-foreground ml-1">件</span></div>
                    </div>
                </div>
                {/* 簡易棒グラフ */}
                <div className="glass rounded-2xl p-5">
                    <div className="text-xs font-semibold text-muted-foreground mb-3">過去7日の登録推移</div>
                    <div className="flex items-end justify-between gap-2 h-24">
                        {dailyFunnel.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                    className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t transition-all"
                                    style={{ height: `${(d.count / max7d) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
                                    title={`${d.date}: ${d.count}件`}
                                />
                                <span className="text-[10px] text-muted-foreground">{d.date}</span>
                                <span className="text-[10px] font-bold text-emerald-300">{d.count}</span>
                            </div>
                        ))}
                    </div>
                    {funnelMonth === 0 && (
                        <p className="text-xs text-muted-foreground mt-3">
                            まだ登録データが届いていません。<Link href="/dashboard/settings" className="text-purple-400 hover:underline">設定画面</Link>から webhook を設定してください。
                        </p>
                    )}
                </div>
            </div>

            {/* API 使用量 */}
            <div className="animate-fade-up-delay-1">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="size-4 text-blue-400" />
                    <h3 className="text-lg font-semibold text-foreground/80">API 使用量</h3>
                    <span className="text-xs text-muted-foreground">（AI生成・リサーチ・X API）</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* 今日のトークン */}
                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">今日の AI トークン</span>
                            <Sparkles className="size-3.5 text-purple-400" />
                        </div>
                        <div className="text-2xl font-bold text-foreground">{totalTokens(todayUsage)}</div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                            入力 {todayUsage.llmIn.toLocaleString()} / 出力 {todayUsage.llmOut.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            呼び出し {todayUsage.llmCalls.toLocaleString()} 回
                        </p>
                    </div>

                    {/* 今日のコスト */}
                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">今日の推定コスト</span>
                            <Coins className="size-3.5 text-amber-400" />
                        </div>
                        <div className="text-2xl font-bold text-amber-300">{costLabel(todayUsage)}</div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                            X API 呼び出し: {todayUsage.xCalls} 回
                        </p>
                    </div>

                    {/* 今月のトークン */}
                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">今月の AI トークン</span>
                            <Sparkles className="size-3.5 text-purple-400" />
                        </div>
                        <div className="text-2xl font-bold text-foreground">{totalTokens(monthUsage)}</div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                            入力 {monthUsage.llmIn.toLocaleString()} / 出力 {monthUsage.llmOut.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            呼び出し {monthUsage.llmCalls.toLocaleString()} 回
                        </p>
                    </div>

                    {/* 今月のコスト */}
                    <div className="glass rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">今月の推定コスト</span>
                            <Coins className="size-3.5 text-amber-400" />
                        </div>
                        <div className="text-2xl font-bold text-amber-300">{costLabel(monthUsage)}</div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                            X API 呼び出し: {monthUsage.xCalls} 回
                        </p>
                    </div>
                </div>

                {/* プロバイダ内訳（今月） */}
                {monthUsage.rows.length > 0 && (
                    <div className="mt-4 glass rounded-2xl p-5">
                        <div className="text-xs font-semibold text-muted-foreground mb-3">今月のプロバイダ別内訳</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            {monthUsage.rows.map((r) => (
                                <div key={r.provider} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
                                    <div>
                                        <div className="font-bold text-foreground/90 capitalize">{r.provider === "x" ? "X API" : r.provider === "anthropic" ? "Claude (Anthropic)" : r.provider === "openai" ? "GPT (OpenAI)" : r.provider}</div>
                                        <div className="text-[11px] text-muted-foreground mt-0.5">
                                            {r.provider === "x"
                                                ? `${r._count._all} 回の呼び出し`
                                                : `${((r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0)).toLocaleString()} tokens / ${r._count._all} 回`}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-amber-300 font-bold">
                                            {r.provider === "x" ? "—" : `$${(r._sum.costUsd ?? 0).toFixed(4)}`}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Action Steps */}
            <div className="pt-4 animate-fade-up-delay-2">
                <h3 className="text-lg font-semibold text-foreground/80 mb-6 flex items-center gap-2">
                    <Zap className="size-4 text-purple-400" />
                    自動化完了までの4ステップ
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                    {/* Step 1 */}
                    <Link href="/dashboard/knowledge" className="group glass rounded-2xl p-6 transition-all duration-300 hover:bg-white/8 hover:glow-prox">
                        <div className="flex items-center justify-between mb-3">
                            <span className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full bg-white/5 text-muted-foreground">
                                Step 1
                            </span>
                            <Settings className="size-5 text-muted-foreground/30 group-hover:text-purple-400 transition-colors" />
                        </div>
                        <h4 className="text-base font-semibold text-foreground mb-1.5">基礎設定・AI育成</h4>
                        <p className="text-sm text-muted-foreground mb-4">アカウントを連携し、専用のナレッジをAIに教え込みます。</p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-400 group-hover:text-purple-300 transition-colors">
                            ナレッジベースへ <ArrowRight className="size-3" />
                        </span>
                    </Link>

                    {/* Step 2 */}
                    <Link href="/dashboard/generate" className="group glass-strong rounded-2xl p-6 transition-all duration-300 hover:bg-white/10 glow-prox">
                        <div className="flex items-center justify-between mb-3">
                            <span className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full gradient-prox text-white">
                                Step 2
                            </span>
                            <Sparkles className="size-5 text-muted-foreground/30 group-hover:text-purple-400 transition-colors" />
                        </div>
                        <h4 className="text-base font-semibold text-foreground mb-1.5">投稿の自動生成</h4>
                        <p className="text-sm text-muted-foreground mb-4">トレンドをリサーチし、学習済みナレッジで最高品質の投稿を生成。</p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-400 group-hover:text-purple-300 transition-colors">
                            投稿作成へ <ArrowRight className="size-3" />
                        </span>
                    </Link>

                    {/* Step 3 */}
                    <Link href="/dashboard/autoreply" className="group glass rounded-2xl p-6 transition-all duration-300 hover:bg-white/8">
                        <div className="flex items-center justify-between mb-3">
                            <span className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full bg-white/5 text-muted-foreground">
                                Step 3
                            </span>
                            <MessageCircle className="size-5 text-muted-foreground/30 group-hover:text-emerald-400 transition-colors" />
                        </div>
                        <h4 className="text-base font-semibold text-foreground mb-1.5">自動化設定</h4>
                        <p className="text-sm text-muted-foreground mb-4">Xポストに対する自動リプライ設定を構成します。</p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 group-hover:text-emerald-300 transition-colors">
                            自動リプライ設定へ <ArrowRight className="size-3" />
                        </span>
                    </Link>

                    {/* Step 4 */}
                    <Link href="/dashboard/kpi" className="group glass rounded-2xl p-6 transition-all duration-300 hover:bg-white/8">
                        <div className="flex items-center justify-between mb-3">
                            <span className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full bg-white/5 text-muted-foreground">
                                Step 4
                            </span>
                            <BarChart3 className="size-5 text-muted-foreground/30 group-hover:text-amber-400 transition-colors" />
                        </div>
                        <h4 className="text-base font-semibold text-foreground mb-1.5">データ分析と改善</h4>
                        <p className="text-sm text-muted-foreground mb-4">過去データから成否を判定し、新ルールの発見へ循環させます。</p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 group-hover:text-amber-300 transition-colors">
                            データ分析画面へ <ArrowRight className="size-3" />
                        </span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
