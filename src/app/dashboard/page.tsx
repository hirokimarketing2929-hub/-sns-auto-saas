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
