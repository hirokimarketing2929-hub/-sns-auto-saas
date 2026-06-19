"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    const router = useRouter();
    const [pending, setPending] = useState<string | null>(null);

    const active = accounts.find(a => a.id === activeId) || accounts[0] || null;

    async function switchTo(id: string) {
        setPending(id);
        try {
            // クリックしたアカウントをアクティブに切替（既にアクティブならスキップ）
            if (id !== activeId) {
                await fetch("/api/x-accounts/active", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ xAccountId: id }),
                });
            }
            // そのアカウントの設定（APIキー等）ページへ遷移
            router.push(`/dashboard/accounts/${id}`);
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
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => switchTo(a.id)}
                                disabled={isPending}
                                className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${isActive ? "bg-white/10 text-foreground" : "text-foreground/80 hover:bg-white/5"}`}
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
