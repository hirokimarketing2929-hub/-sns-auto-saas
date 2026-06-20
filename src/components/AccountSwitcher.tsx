"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, ChevronRight } from "lucide-react";

type Item = {
    id: string;
    displayName: string;
    xUsername: string | null;
    xProfileImageUrl: string | null;
    hasOAuth: boolean;
    hasManualKeys: boolean;
};

export default function AccountSwitcher({ accounts, activeId }: { accounts: Item[]; activeId: string | null }) {
    const [pending, setPending] = useState<string | null>(null);

    const active = accounts.find(a => a.id === activeId) || accounts[0] || null;

    async function switchTo(id: string) {
        // 既にアクティブなら何もしない
        if (id === activeId) return;
        setPending(id);
        try {
            // クリックした時点でアクティブに切替（POSTのSet-Cookieで新activeが確定）
            await fetch("/api/x-accounts/active", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ xAccountId: id }),
            });
            // フルリロードで全ページ（クライアントfetchの自動リプライ/メディア等も含む）を
            // 新アカウントで再取得する。router.refresh() はサーバーコンポーネントしか更新せず、
            // useEffect で fetch するクライアントページが切替に追従しないため。
            window.location.reload();
        } finally {
            setPending(null);
        }
    }

    return (
        <div className="relative group">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-foreground/70 bg-white/[0.02] hover:text-foreground hover:bg-white/10 transition-all cursor-default">
                <Settings className="size-4" />
                <span className="flex-1 truncate">
                    {active ? active.displayName : "アカウント管理"}
                </span>
                <ChevronRight className="size-3 opacity-50 group-hover:rotate-90 transition-transform" />
            </div>
            <div className="hidden group-hover:block mt-1 ml-3 transition-all">
                <div className="glass rounded-xl py-2 w-full shadow-xl overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider border-b border-white/5 pb-2 mb-1">
                        サブアカウント切替
                    </div>
                    {accounts.length === 0 && (
                        <div className="px-4 py-2 text-sm text-muted-foreground">アカウント未作成</div>
                    )}
                    {accounts.map((a) => {
                        const isActive = a.id === activeId;
                        const isPending = pending === a.id;
                        return (
                            <div
                                key={a.id}
                                className={`w-full flex items-center gap-1 pr-2 transition-colors ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => switchTo(a.id)}
                                    disabled={isPending}
                                    className={`flex-1 min-w-0 flex items-center gap-2 px-4 py-2 text-sm text-left ${isActive ? "text-foreground" : "text-foreground/80"}`}
                                >
                                    {a.xProfileImageUrl ? (
                                        <img src={a.xProfileImageUrl} alt="icon" className="w-5 h-5 rounded-full ring-1 ring-white/10" />
                                    ) : (
                                        <span className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-[10px] font-bold">𝕏</span>
                                    )}
                                    <span className="truncate flex-1">{a.displayName}</span>
                                    {isActive && <span className="text-[9px] text-emerald-300 font-bold">●</span>}
                                    {isPending && <span className="text-[9px] text-muted-foreground">…</span>}
                                </button>
                                <Link
                                    href={`/dashboard/accounts/${a.id}`}
                                    title="このアカウントの設定を開く"
                                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10"
                                >
                                    <Settings className="size-3.5" />
                                </Link>
                            </div>
                        );
                    })}
                    <div className="px-3 mt-2 border-t border-white/5 pt-2">
                        <Link href="/dashboard/settings#x-accounts" className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-300 hover:text-purple-200 glass rounded-lg transition-colors">
                            + 新規アカウント追加 / 管理
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
