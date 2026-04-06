import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LogoutButton from "./LogoutButton";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // セッションを取得し、未ログインなら /login へリダイレクト
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
        redirect("/login");
    }

    // ユーザー情報の取得（Prisma連携）
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

    // X連携が済んでいるが、権限（スコープ）が古くて不足している場合は再連携画面へ
    const twitterAccount = linkedAccounts.find((acc: any) => acc.provider === "twitter");
    if (twitterAccount && twitterAccount.scope) {
        const requiredScopes = ["dm.write", "tweet.write", "offline.access"];
        const grantedScopes = twitterAccount.scope.split(" ");
        const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));
        
        if (missingScopes.length > 0) {
            redirect("/relink");
        }
    }

    return (
        <div className="min-h-screen flex bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r flex flex-col z-50 relative">
                <div className="h-16 flex items-center px-6 border-b flex-shrink-0">
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        ProX Agent
                    </h1>
                </div>
                <nav className="p-4 space-y-2 relative flex-1">
                    <a href="/dashboard" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        ダッシュボード
                    </a>

                    <a href="/dashboard/kpi" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        データ分析
                    </a>

                    {/* アカウント情報管理 (ホバーメニュー) */}
                    <div className="relative group">
                        <a href="#" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md flex justify-between items-center cursor-default">
                            <span>アカウント情報管理</span>
                            <span className="text-gray-400">▶</span>
                        </a>
                        {/* ポップアウトメニュー (右側に表示) */}
                        <div className="absolute left-full top-0 w-60 z-50 pl-2 hidden group-hover:block">
                            <div className="bg-white border border-gray-200 shadow-xl rounded-md py-2 w-full">
                                <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b pb-2 mb-2">連携済みアカウント</div>
                                {linkedAccounts.length === 0 && !hasManualX && (
                                    <div className="px-4 py-2 text-sm text-gray-400">連携アカウントなし</div>
                                )}
                                {hasManualX && (
                                    <a href="/dashboard/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                                        {settings?.xProfileImageUrl ? (
                                            <img src={settings.xProfileImageUrl} alt="icon" className="w-5 h-5 rounded-full" />
                                        ) : (
                                            <span className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-[10px] text-gray-500">𝕏</span>
                                        )}
                                        <span className="truncate">{settings?.xAccountName ? `${settings.xAccountName} (𝕏)` : "𝕏 (APIキー手動連携)"}</span>
                                    </a>
                                )}
                                {linkedAccounts.map((acc: any) => (
                                    <a key={acc.id} href={`/dashboard/settings?accountId=${acc.id}`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">
                                        {acc.accountName ? `${acc.accountName} (${acc.provider})` : `${acc.provider === "twitter" ? "𝕏" : acc.provider} (OAuth連携)`}
                                    </a>
                                ))}
                                <div className="px-3 mt-2 border-t pt-2">
                                    <a href="/dashboard/settings" className="block text-center px-4 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded">
                                        + 新規アカウント追加
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <a href="/dashboard/knowledge" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        ナレッジベース
                    </a>
                    <a href="https://docs.google.com/spreadsheets/" target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md flex justify-between items-center">
                        <span>🌟 本部共有ナレッジ</span>
                        <span className="text-[10px] text-purple-400">🔗</span>
                    </a>
                    <a href="/dashboard/research" className="block px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md">
                        🔍 リサーチ・横展開
                    </a>
                    <a href="/dashboard/analysis" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        ポジティブ/ネガティブ判定
                    </a>
                    <a href="/dashboard/generate" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        投稿作成
                    </a>
                    <a href="/dashboard/schedule" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        投稿スケジューラー
                    </a>
                    <a href="/dashboard/media" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        メディアライブラリ
                    </a>
                    <a href="/dashboard/autoreply" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        自動リプライ設定
                    </a>

                    {/* --- 今後メニューが増える場合、この上にメニューを追加してください --- */}

                    {/* プロラインフリー紹介バナー (メニューの最後尾) */}
                    <div className="pt-6 pb-2">
                        <a
                            href="/dashboard/proline"
                            className="block w-full group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
                        >
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors"></div>
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <span className="text-2xl mb-1 drop-shadow-md">🎁</span>
                                <span className="text-white font-bold text-sm leading-tight drop-shadow-md">
                                    ProX Agentを<br />120%活用する！
                                </span>
                                <span className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] font-medium text-white backdrop-blur-sm border border-white/30">
                                    プロライン連携
                                </span>
                            </div>
                        </a>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1">
                <header className="h-16 bg-white border-b flex items-center px-6 justify-end gap-4">
                    <span className="text-sm font-medium text-gray-700">{session.user?.name || session.user?.email}</span>
                    <LogoutButton />
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

