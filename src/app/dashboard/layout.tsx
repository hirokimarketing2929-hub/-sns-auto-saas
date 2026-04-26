import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LogoutButton from "./LogoutButton";
import Link from "next/link";
import {
    LayoutDashboard,
    Settings,
    Brain,
    Search,
    Sparkles,
    CalendarDays,
    MessageCircle,
    BarChart3,
    Scale,
    ImageIcon,
    Zap,
    ExternalLink,
    ChevronRight,
} from "lucide-react";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { accounts: true, settings: true }
    });

    if (!user) {
        redirect("/login");
    }

    const linkedAccounts = user.accounts || [];
    const settings = user.settings as any;
    const hasManualX = !!(settings?.xApiKey && settings?.xAccessToken);

    const twitterAccount = linkedAccounts.find((acc: any) => acc.provider === "twitter");
    if (twitterAccount && twitterAccount.scope) {
        // 旧ユーザー互換のため dm.* は必須にしない（新規 OAuth では auth.ts で要求される）
        const requiredScopes = ["tweet.write", "offline.access"];
        const grantedScopes = twitterAccount.scope.split(" ");
        const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));
        if (missingScopes.length > 0) {
            redirect("/relink");
        }
    }

    return (
        <div className="min-h-screen flex bg-background">
            {/* Sidebar（暗めに固定） */}
            <aside className="w-64 fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-neutral-950">
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b border-white/[0.06] flex-shrink-0">
                    <Link href="/dashboard" className="flex items-center gap-2.5 group">
                        <div className="flex items-center justify-center size-8 rounded-lg gradient-prox shadow-lg group-hover:shadow-xl transition-shadow">
                            <Zap className="size-4 text-white" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-gradient-prox">
                            ProX
                        </span>
                    </Link>
                </div>

                <nav className="flex-1 p-3 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Dashboard */}
                    <div>
                        <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium glass-strong text-foreground transition-all hover:bg-white/10">
                            <LayoutDashboard className="size-4 text-purple-400" />
                            <span>ダッシュボード</span>
                        </Link>
                    </div>

                    {/* Step 1 */}
                    <div>
                        <p className="text-xs font-bold text-white/90 uppercase tracking-wider mb-2 px-3 py-2 bg-white/[0.06] rounded-md">
                            STEP 1: 連携 & ナレッジ
                        </p>
                        <div className="space-y-0.5">
                            <div className="relative group">
                                <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all cursor-default">
                                    <Settings className="size-4" />
                                    <span>アカウント管理</span>
                                    <ChevronRight className="size-3 ml-auto opacity-50 group-hover:rotate-90 transition-transform" />
                                </div>
                                <div className="hidden group-hover:block mt-1 ml-3 transition-all">
                                    <div className="glass rounded-xl py-2 w-full shadow-xl overflow-hidden">
                                        <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider border-b border-white/5 pb-2 mb-1">
                                            連携済みアカウント
                                        </div>
                                        {linkedAccounts.length === 0 && !hasManualX && (
                                            <div className="px-4 py-2 text-sm text-muted-foreground">連携アカウントなし</div>
                                        )}
                                        {hasManualX && (
                                            <Link href="/dashboard/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-foreground/80 hover:bg-white/5 transition-colors">
                                                {settings?.xProfileImageUrl ? (
                                                    <img src={settings.xProfileImageUrl} alt="icon" className="w-5 h-5 rounded-full ring-1 ring-white/10" />
                                                ) : (
                                                    <span className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-[10px] font-bold">𝕏</span>
                                                )}
                                                <span className="truncate">{settings?.xAccountName ? `${settings.xAccountName} (𝕏)` : "𝕏 (設定済み)"}</span>
                                            </Link>
                                        )}
                                        {linkedAccounts.map((acc: any) => (
                                            <Link key={acc.id} href={`/dashboard/settings?accountId=${acc.id}#x-accounts`} className="block px-4 py-2 text-sm text-foreground/80 hover:bg-white/5 transition-colors">
                                                {acc.accountName ? `${acc.accountName} (${acc.provider})` : `${acc.provider === "twitter" ? "𝕏" : acc.provider}`}
                                            </Link>
                                        ))}
                                        <div className="px-3 mt-2 border-t border-white/5 pt-2">
                                            <Link href="/dashboard/settings#x-accounts" className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-300 hover:text-purple-200 glass rounded-lg transition-colors">
                                                + 新規アカウント追加
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Link href="/dashboard/knowledge" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all">
                                <Brain className="size-4" />
                                <span>ナレッジベース</span>
                            </Link>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div>
                        <p className="text-xs font-bold text-white/90 uppercase tracking-wider mb-2 px-3 py-2 bg-white/[0.06] rounded-md">
                            STEP 2: コンテンツ制作
                        </p>
                        <div className="space-y-0.5">
                            <Link href="/dashboard/research" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all">
                                <Search className="size-4" />
                                <span>リサーチ・横展開</span>
                            </Link>
                            <Link href="/dashboard/generate" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all">
                                <Sparkles className="size-4" />
                                <span>投稿作成</span>
                            </Link>
                            <Link href="/dashboard/schedule" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all">
                                <CalendarDays className="size-4" />
                                <span>投稿スケジューラー</span>
                            </Link>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div>
                        <p className="text-xs font-bold text-white/90 uppercase tracking-wider mb-2 px-3 py-2 bg-white/[0.06] rounded-md">
                            STEP 3: エンゲージメント
                        </p>
                        <div className="space-y-0.5">
                            <Link href="/dashboard/autoreply" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all">
                                <MessageCircle className="size-4" />
                                <span>自動リプライ設定</span>
                            </Link>
                            <Link href="/dashboard/reply-engagement" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all">
                                <Sparkles className="size-4" />
                                <span>リプ周り半自動化</span>
                            </Link>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div>
                        <p className="text-xs font-bold text-white/90 uppercase tracking-wider mb-2 px-3 py-2 bg-white/[0.06] rounded-md">
                            STEP 4: 分析 & 改善
                        </p>
                        <div className="space-y-0.5">
                            <Link href="/dashboard/analysis" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all">
                                <BarChart3 className="size-4" />
                                <span>データ分析</span>
                            </Link>
                            <Link href="/dashboard/kpi" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all">
                                <Scale className="size-4" />
                                <span>KPI 目標</span>
                            </Link>
                        </div>
                    </div>

                    {/* Other */}
                    <div>
                        <p className="text-xs font-bold text-white/90 uppercase tracking-wider mb-2 px-3 py-2 bg-white/[0.06] rounded-md">
                            その他
                        </p>
                        <div className="space-y-0.5">
                            <Link href="/dashboard/media" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all">
                                <ImageIcon className="size-4" />
                                <span>メディアライブラリ</span>
                            </Link>
                        </div>
                    </div>

                    {/* ProLine Banner - Modernized */}
                    <div className="pt-2 pb-6">
                        <a
                            href="https://proline.jp"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600/80 to-green-700/80 p-4 transition-all hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5"
                        >
                            <div className="relative z-10 flex flex-col space-y-2">
                                <span className="text-white/90 font-semibold text-xs leading-snug">
                                    X運用の売上を最大化
                                </span>
                                <div className="text-white/70 text-[10px] leading-relaxed space-y-1">
                                    <p>LINE公式拡張ツール「プロラインフリー」</p>
                                    <p>集客から販売まで完全自動化</p>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-200 font-medium mt-1">
                                    詳しく見る <ExternalLink className="size-2.5" />
                                </span>
                            </div>
                        </a>
                    </div>
                </nav>
            </aside>

            {/* Main Content（作業画面は白系の明るいテーマ） */}
            <main className="flex-1 ml-64 light-scope bg-white min-h-screen text-foreground">
                <header className="sticky top-0 z-30 h-16 flex items-center justify-between border-b border-neutral-200 bg-white/80 backdrop-blur-xl px-8 gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-muted-foreground shrink-0">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            エンジン稼働中
                        </div>
                        <a
                            href="https://x.com/hiroki_proline"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/30 text-xs font-medium text-rose-600 transition-colors truncate"
                            title="エラーがあった場合は X で引用リツイートして公開フィードバックをお願いします！"
                        >
                            <span className="text-[13px]">🐞</span>
                            <span className="truncate">エラーがあった場合は X で引用リツイートで公開フィードバックをお待ちしてます！</span>
                            <ExternalLink className="size-3 shrink-0 opacity-70" />
                        </a>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <span className="text-sm font-medium text-foreground/70 hidden sm:inline">
                            {session.user?.name || session.user?.email}
                        </span>
                        <LogoutButton />
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
