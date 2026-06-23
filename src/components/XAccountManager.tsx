"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

type XAccount = {
    id: string;
    displayName: string;
    xUsername: string | null;
    xProfileImageUrl: string | null;
    hasOAuth: boolean;
    hasManualKeys: boolean;
    oauthAccountId: string | null;
    createdAt: string;
    updatedAt: string;
};

export default function XAccountManager() {
    const router = useRouter();
    const [list, setList] = useState<XAccount[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);

    // 新規作成フォーム state
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newKeys, setNewKeys] = useState({ xApiKey: "", xApiSecret: "", xAccessToken: "", xAccessSecret: "" });
    const [showKeys, setShowKeys] = useState(false);

    // 既存アカウントへの後付けキー編集 state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editKeys, setEditKeys] = useState({ xApiKey: "", xApiSecret: "", xAccessToken: "", xAccessSecret: "" });

    useEffect(() => {
        load();
    }, []);

    // OAuth 連携から戻ってきたとき（auth.ts が ?linked=1 / ?error=... を付けて settings に戻す）
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("linked") === "1") {
            setNotice({ type: "success", text: "X アカウントを連携しました（このアカウントに切替済み）" });
            setTimeout(() => setNotice(null), 4000);
        } else if (params.get("error") === "account_in_use") {
            setNotice({ type: "error", text: "この X アカウントは既に別のユーザーに連携されています" });
            setTimeout(() => setNotice(null), 4000);
        }
    }, []);

    // X OAuth でワンクリック連携。完了後、auth.ts 側で XAccount を自動作成して active に切替え、
    // /dashboard/settings?linked=1#x-accounts に戻る。APIキーの手入力が不要になる。
    function connectOAuth() {
        setConnecting(true);
        signIn("twitter", { callbackUrl: "/dashboard/settings?linked=1#x-accounts" });
    }

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/x-accounts");
            if (res.ok) {
                const data = await res.json();
                setList(data.xAccounts);
                setActiveId(data.activeXAccountId);
            }
        } finally {
            setLoading(false);
        }
    }

    async function setActive(id: string) {
        setBusy(true);
        try {
            const res = await fetch("/api/x-accounts/active", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ xAccountId: id }),
            });
            if (res.ok) {
                setActiveId(id);
                setNotice({ type: "success", text: "アクティブアカウントを切替えました" });
                // フルリロードで全ページ（クライアントfetchの自動リプライ/メディア等含む）を
                // 新アカウントで読み直す。router.refresh() はサーバーコンポーネントしか更新しないため。
                window.location.reload();
            } else {
                const d = await res.json().catch(() => ({}));
                setNotice({ type: "error", text: d?.message || "切替に失敗しました" });
            }
        } finally {
            setBusy(false);
            setTimeout(() => setNotice(null), 2500);
        }
    }

    async function createAccount() {
        if (!newName.trim()) {
            setNotice({ type: "error", text: "管理名は必須です" });
            return;
        }
        setBusy(true);
        try {
            const body: any = { displayName: newName.trim() };
            if (showKeys && newKeys.xApiKey) {
                body.xApiKey = newKeys.xApiKey;
                body.xApiSecret = newKeys.xApiSecret;
                body.xAccessToken = newKeys.xAccessToken;
                body.xAccessSecret = newKeys.xAccessSecret;
            }
            const res = await fetch("/api/x-accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
                setNotice({ type: "error", text: d?.message || "作成に失敗しました" });
                return;
            }
            setNewName("");
            setNewKeys({ xApiKey: "", xApiSecret: "", xAccessToken: "", xAccessSecret: "" });
            setShowKeys(false);
            setCreating(false);
            await load();
            setNotice({ type: "success", text: "サブアカウントを追加しました" });
            router.refresh();
        } finally {
            setBusy(false);
            setTimeout(() => setNotice(null), 2500);
        }
    }

    function startEditKeys(id: string) {
        setEditingId(prev => (prev === id ? null : id));
        setEditKeys({ xApiKey: "", xApiSecret: "", xAccessToken: "", xAccessSecret: "" });
    }

    async function saveKeys(id: string) {
        if (!editKeys.xApiKey || !editKeys.xApiSecret || !editKeys.xAccessToken || !editKeys.xAccessSecret) {
            setNotice({ type: "error", text: "4つのキーすべてを入力してください" });
            setTimeout(() => setNotice(null), 2500);
            return;
        }
        setBusy(true);
        try {
            const res = await fetch(`/api/x-accounts/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editKeys),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
                setNotice({ type: "error", text: d?.message || "APIキーの保存に失敗しました" });
                return;
            }
            setEditingId(null);
            setEditKeys({ xApiKey: "", xApiSecret: "", xAccessToken: "", xAccessSecret: "" });
            await load();
            setNotice({ type: "success", text: "APIキーを紐付けました（X接続を確認済み）" });
            router.refresh();
        } finally {
            setBusy(false);
            setTimeout(() => setNotice(null), 2500);
        }
    }

    async function deleteAccount(id: string, name: string) {
        if (!confirm(`「${name}」を削除します。\nこのアカウントに紐づく全データ（投稿/ナレッジ/KPI 等）も一緒に削除されます。本当に削除しますか？`)) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/x-accounts/${id}`, { method: "DELETE" });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
                setNotice({ type: "error", text: d?.message || "削除に失敗しました" });
                return;
            }
            await load();
            setNotice({ type: "success", text: "削除しました" });
            router.refresh();
        } finally {
            setBusy(false);
            setTimeout(() => setNotice(null), 2500);
        }
    }

    return (
        <section id="x-accounts" className="space-y-4 scroll-mt-20">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h3 className="text-lg font-semibold">🪪 サブアカウント管理</h3>
                    <p className="text-xs text-muted-foreground">
                        X(Twitter) 連携情報・ナレッジ・投稿などはアカウントごとに完全に分離されます。AI APIキーは全アカウントで共通です。
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        onClick={connectOAuth}
                        disabled={busy || connecting}
                        className="bg-black text-white hover:bg-gray-800 gap-2"
                    >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        {connecting ? "連携画面へ移動中…" : "X でワンクリック連携"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setCreating(v => !v)} disabled={busy || connecting}>
                        {creating ? "キャンセル" : "+ 手動で追加"}
                    </Button>
                </div>
            </div>

            {notice && (
                <div className={`text-sm rounded p-2 border ${notice.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                    {notice.type === "success" ? "✅" : "⚠️"} {notice.text}
                </div>
            )}

            {creating && (
                <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
                    <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded p-2 flex items-center justify-between gap-3 flex-wrap">
                        <span>💡 API キーの取得が不要な「<strong>X でワンクリック連携</strong>」が簡単です。手動で API キーを入れたい場合のみ下のフォームを使ってください。</span>
                        <Button type="button" size="sm" onClick={connectOAuth} disabled={busy || connecting} className="bg-black text-white hover:bg-gray-800">
                            {connecting ? "移動中…" : "ワンクリック連携"}
                        </Button>
                    </div>
                    <div>
                        <Label htmlFor="newName">管理名 <span className="text-red-500">*</span></Label>
                        <Input
                            id="newName"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="例: 副業告知用"
                            className="bg-white"
                        />
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <input
                            id="showKeys"
                            type="checkbox"
                            checked={showKeys}
                            onChange={e => setShowKeys(e.target.checked)}
                        />
                        <label htmlFor="showKeys" className="cursor-pointer">手動 API キーで紐付け（BYOK）</label>
                    </div>

                    {showKeys && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded border">
                            {(["xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret"] as const).map(k => (
                                <div key={k} className="space-y-1">
                                    <Label htmlFor={`new_${k}`} className="text-xs">{k}</Label>
                                    <Input
                                        id={`new_${k}`}
                                        type="password"
                                        value={newKeys[k]}
                                        onChange={e => setNewKeys(p => ({ ...p, [k]: e.target.value }))}
                                    />
                                </div>
                            ))}
                            <p className="md:col-span-2 text-[11px] text-muted-foreground">
                                ※ チェックOFF で作成すると枠だけ作られます。後から API キーを編集して紐付けてください。
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button type="button" onClick={createAccount} disabled={busy || !newName.trim()}>
                            作成
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                            キャンセル
                        </Button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {loading ? (
                    <div className="py-6 text-center text-sm text-gray-500">読み込み中…</div>
                ) : list.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-500 border rounded-lg bg-slate-50">
                        サブアカウントがありません。上のボタンから追加してください。
                    </div>
                ) : (
                    list.map(a => {
                        const isActive = a.id === activeId;
                        const isEditing = a.id === editingId;
                        return (
                            <div
                                key={a.id}
                                className={`rounded-lg border transition-colors ${isActive ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                            >
                                <div className="flex items-center gap-3 p-3">
                                    {a.xProfileImageUrl ? (
                                        <img src={a.xProfileImageUrl} alt="icon" className="w-10 h-10 rounded-full ring-1 ring-gray-200" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">𝕏</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold truncate">{a.displayName}</span>
                                            {isActive && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">ACTIVE</span>}
                                            {a.hasOAuth && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">OAuth</span>}
                                            {a.hasManualKeys && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">BYOK</span>}
                                            {!a.hasOAuth && !a.hasManualKeys && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">未連携</span>}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {a.xUsername || "—"}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isActive && (
                                            <Button type="button" size="sm" variant="outline" onClick={() => setActive(a.id)} disabled={busy}>
                                                切替
                                            </Button>
                                        )}
                                        <Button type="button" size="sm" variant="outline" onClick={() => startEditKeys(a.id)} disabled={busy}>
                                            {isEditing ? "閉じる" : (a.hasManualKeys ? "キー再設定" : "キー設定")}
                                        </Button>
                                        <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => deleteAccount(a.id, a.displayName)} disabled={busy || list.length <= 1}>
                                            削除
                                        </Button>
                                    </div>
                                </div>

                                {isEditing && (
                                    <div className="border-t border-gray-200 p-3 bg-slate-50 space-y-3">
                                        <p className="text-xs text-muted-foreground">
                                            このアカウントに X(Twitter) の API キー（BYOK）を紐付けます。4つすべて入力して保存すると、X に接続して @ユーザー名 とアイコンを自動取得します。
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {(["xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret"] as const).map(k => (
                                                <div key={k} className="space-y-1">
                                                    <Label htmlFor={`edit_${a.id}_${k}`} className="text-xs">{k}</Label>
                                                    <Input
                                                        id={`edit_${a.id}_${k}`}
                                                        type="password"
                                                        value={editKeys[k]}
                                                        onChange={e => setEditKeys(p => ({ ...p, [k]: e.target.value }))}
                                                        className="bg-white"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button type="button" size="sm" onClick={() => saveKeys(a.id)} disabled={busy}>
                                                {busy ? "保存中..." : "キーを保存して接続確認"}
                                            </Button>
                                            <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={busy}>
                                                キャンセル
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
}
