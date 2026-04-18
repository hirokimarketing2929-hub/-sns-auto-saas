"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type TwitterAccount = {
    id: string;
    provider: string;
    providerAccountId: string;
    accountName: string | null;
    scope: string | null;
};

export default function SettingsPage() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasTwitterOAuth, setHasTwitterOAuth] = useState(false);
    const [twitterAccounts, setTwitterAccounts] = useState<TwitterAccount[]>([]);
    const [message, setMessage] = useState({ text: "", type: "" });
    const router = useRouter();
    const searchParams = useSearchParams();

    const [formData, setFormData] = useState({
        targetAudience: "",
        targetPain: "",
        ctaUrl: "",
        competitor1: "",
        competitor2: "",
        accountConcept: "",
        profile: "",
        policy: "",
        xApiKey: "",
        xApiSecret: "",
        xAccessToken: "",
        xAccessSecret: "",
        xAccountName: "",
        xProfileImageUrl: "",
        spreadsheetUrl: "",
    });

    const focusedAccountId = searchParams.get("accountId");

    useEffect(() => {
        fetchSettings();
    }, []);

    // OAuth リダイレクト後のクエリメッセージ
    useEffect(() => {
        if (searchParams.get("linked") === "1") {
            setMessage({ text: "X アカウントを連携しました。", type: "success" });
        } else if (searchParams.get("error") === "account_in_use") {
            setMessage({ text: "この X アカウントは既に別のユーザーに連携されています。", type: "error" });
        }
    }, [searchParams]);

    // サイドバーから ?accountId=... で来た場合、該当アカウント行までスクロール
    useEffect(() => {
        if (!focusedAccountId || loading) return;
        const el = document.getElementById(`x-account-${focusedAccountId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [focusedAccountId, loading, twitterAccounts.length]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                setFormData({
                    targetAudience: data.targetAudience || "",
                    targetPain: data.targetPain || "",
                    ctaUrl: data.ctaUrl || "",
                    competitor1: data.competitor1 || "",
                    competitor2: data.competitor2 || "",
                    accountConcept: data.accountConcept || "",
                    profile: data.profile || "",
                    policy: data.policy || "",
                    xApiKey: data.xApiKey || "",
                    xApiSecret: data.xApiSecret || "",
                    xAccessToken: data.xAccessToken || "",
                    xAccessSecret: data.xAccessSecret || "",
                    xAccountName: data.xAccountName || "",
                    xProfileImageUrl: data.xProfileImageUrl || "",
                    spreadsheetUrl: data.spreadsheetUrl || "",
                });
                setHasTwitterOAuth(!!data.hasTwitterOAuth);
                setTwitterAccounts(Array.isArray(data.twitterAccounts) ? data.twitterAccounts : []);
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: "", type: "" });

        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                const updatedSettings = await res.json();
                setFormData(prev => ({
                    ...prev,
                    xAccountName: updatedSettings.xAccountName || "",
                    xProfileImageUrl: updatedSettings.xProfileImageUrl || ""
                }));
                setMessage({ text: "設定を保存しました。アカウント名とアイコンが反映されました。", type: "success" });
                router.refresh(); // サイドバーなどのサーバーコンポーネントを再取得して表示を更新
            } else {
                setMessage({ text: "保存に失敗しました。", type: "error" });
            }
        } catch (error) {
            setMessage({ text: "エラーが発生しました。", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnectTwitter = async (accountId?: string) => {
        const msg = accountId
            ? "このX アカウントの連携を解除しますか？"
            : "本当にX (Twitter) の連携を全て解除しますか？ 自動投稿ができなくなります。";
        if (!confirm(msg)) return;

        try {
            const url = accountId
                ? `/api/auth/disconnect/twitter?accountId=${encodeURIComponent(accountId)}`
                : "/api/auth/disconnect/twitter";
            const res = await fetch(url, { method: "DELETE" });
            if (res.ok) {
                setMessage({ text: "X (Twitter) アカウントの連携を解除しました。", type: "success" });
                await fetchSettings();
                router.refresh();
            } else {
                setMessage({ text: "解除に失敗しました。", type: "error" });
            }
        } catch (error) {
            setMessage({ text: "エラーが発生しました。", type: "error" });
        }
    };

    const handleLinkNewTwitter = () => {
        // 既存セッションを維持したまま 2 つ目以降の X アカウントを連携する。
        // auth.ts の signIn コールバックが現セッションのユーザーに Account を upsert し、
        // callbackUrl へリダイレクトする。
        signIn("twitter", { callbackUrl: "/dashboard/settings?linked=1" });
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">設定・ペルソナ登録</h2>
                <p className="text-muted-foreground mt-2">
                    AIが投稿を生成する際の「あなたのアカウント専用のルールやペルソナ」を設定します。
                </p>
            </div>

            {/* アカウント基本情報（最上部に独立） */}
            <Card className="border-indigo-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <CardHeader>
                    <CardTitle className="text-xl flex justify-between items-center">
                        アカウント管理情報
                        {formData.xProfileImageUrl && (
                            <img src={formData.xProfileImageUrl} alt="icon" className="w-10 h-10 rounded-full border border-gray-200" />
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 max-w-md">
                        <Label htmlFor="xAccountNameTop" className="text-gray-700 font-semibold">管理名 (任意)</Label>
                        <Input
                            id="xAccountNameTop"
                            name="xAccountName"
                            placeholder="例: メイン告知アカウント (空欄で自動取得)"
                            value={formData.xAccountName}
                            onChange={handleChange}
                            className="bg-white"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            空欄のまま下の「システム連携設定」でAPIキーを保存すると、Xの表示名(@ユーザー名)とアイコン画像が自動で取得・表示されます。
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* X (Twitter) アカウント連携 */}
            <Card id="x-accounts" className="border-sky-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-xl">X (Twitter) アカウント連携</CardTitle>
                    <CardDescription>
                        複数のXアカウントを連携できます。ログイン中のままOAuthで追加してください。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {twitterAccounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">連携済みのXアカウントはありません。</p>
                    ) : (
                        <ul className="space-y-2">
                            {twitterAccounts.map((acc) => {
                                const isFocused = focusedAccountId === acc.id;
                                return (
                                    <li
                                        key={acc.id}
                                        id={`x-account-${acc.id}`}
                                        className={
                                            "flex items-center justify-between border rounded-md px-4 py-2 transition-all " +
                                            (isFocused
                                                ? "bg-sky-50 border-sky-400 ring-2 ring-sky-300"
                                                : "bg-white")
                                        }
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium flex items-center gap-2">
                                                {acc.accountName || `𝕏 (${acc.providerAccountId})`}
                                                {isFocused && (
                                                    <span className="text-[10px] font-bold text-sky-700 bg-sky-100 border border-sky-300 rounded-full px-2 py-0.5">
                                                        選択中
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-xs text-muted-foreground truncate max-w-[480px]">scope: {acc.scope || "-"}</span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleDisconnectTwitter(acc.id)}
                                        >
                                            解除
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <Button type="button" onClick={handleLinkNewTwitter} className="w-full md:w-auto">
                        + Xアカウントを連携する
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>AI生成設定</CardTitle>
                    <CardDescription>
                        ここで設定した内容が、自動的に投稿生成AIへ引き継がれます。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-8 text-center text-gray-500">データを読み込み中...</div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="targetAudience">ターゲットペルソナ（誰に向けて発信するか）</Label>
                                <Input
                                    id="targetAudience"
                                    name="targetAudience"
                                    placeholder="例: SNS運用代行会社、個人事業主"
                                    value={formData.targetAudience}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="targetPain">ターゲットの主な悩み</Label>
                                <Textarea
                                    id="targetPain"
                                    name="targetPain"
                                    placeholder="例: フォロワーが伸びない、集客から販売につながらない"
                                    value={formData.targetPain}
                                    onChange={handleChange}
                                    className="min-h-[100px]"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="ctaUrl">誘導先（リードマグネット/プロラインのURL）</Label>
                                <Input
                                    id="ctaUrl"
                                    name="ctaUrl"
                                    type="url"
                                    placeholder="https://proline.example.com/..."
                                    value={formData.ctaUrl}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="competitor1">競合アカウント1（X ID名など）</Label>
                                    <Input
                                        id="competitor1"
                                        name="competitor1"
                                        placeholder="@example1"
                                        value={formData.competitor1}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="competitor2">競合アカウント2</Label>
                                    <Input
                                        id="competitor2"
                                        name="competitor2"
                                        placeholder="@example2"
                                        value={formData.competitor2}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t mt-6">
                                <h3 className="text-lg font-semibold">アカウント運用設定</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="accountConcept">アカウントのコンセプト（全体像）</Label>
                                    <Input
                                        id="accountConcept"
                                        name="accountConcept"
                                        placeholder="例: 売上目標達成を支援する実践的なノウハウ発信"
                                        value={formData.accountConcept}
                                        onChange={handleChange}
                                    />
                                    <p className="text-xs text-muted-foreground">AIがブレない発信軸を持つための基準になります。</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="profile">発信者のプロフィール・立ち位置</Label>
                                    <Input
                                        id="profile"
                                        name="profile"
                                        placeholder="例: SNS集客のプロフェッショナル"
                                        value={formData.profile}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="policy">全般的な運用方針 (マニュアル)</Label>
                                    <Textarea
                                        id="policy"
                                        name="policy"
                                        placeholder="例: 1日3投稿。図解を活用する。専門用語を避ける。"
                                        value={formData.policy}
                                        onChange={handleChange}
                                        className="min-h-[80px]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t mt-6">
                                <h3 className="text-lg font-semibold">システム連携設定 (X/Twitter 自動投稿用)</h3>


                                <div className="bg-gray-50 p-4 rounded-md border mt-6">
                                    <h4 className="font-medium text-gray-900 mb-2">【テスト用】個別APIキー設定 (BYOK)</h4>
                                    <p className="text-sm text-gray-600 mb-4">
                                        各ユーザーが自身のDeveloper API通信費用を負担するテスト用の方法です。<br />
                                        ※こちらの入力がある場合は優先して使用されます。
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="xApiKey">API Key</Label>
                                            <Input
                                                id="xApiKey"
                                                name="xApiKey"
                                                type="password"
                                                value={formData.xApiKey}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="xApiSecret">API Secret</Label>
                                            <Input
                                                id="xApiSecret"
                                                name="xApiSecret"
                                                type="password"
                                                value={formData.xApiSecret}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="xAccessToken">Access Token</Label>
                                            <Input
                                                id="xAccessToken"
                                                name="xAccessToken"
                                                type="password"
                                                value={formData.xAccessToken}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="xAccessSecret">Access Token Secret</Label>
                                            <Input
                                                id="xAccessSecret"
                                                name="xAccessSecret"
                                                type="password"
                                                value={formData.xAccessSecret}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 外部ツール（スプレッドシート連携） */}
                            <div className="space-y-4 pt-4 border-t mt-6">
                                <h3 className="text-lg font-semibold">外部連携 (スプレッドシート・GAS)</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="spreadsheetUrl">スプレッドシートWebアプリ(GAS)のURL</Label>
                                    <Input
                                        id="spreadsheetUrl"
                                        name="spreadsheetUrl"
                                        type="url"
                                        placeholder="https://script.google.com/macros/s/.../exec"
                                        value={formData.spreadsheetUrl}
                                        onChange={handleChange}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        過去のポストやインプレッション数、営業KPIなどを連携するためのエンドポイントURLです。
                                    </p>
                                </div>
                            </div>

                            {message.text && (
                                <div className={`p-4 rounded-md mt-6 ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                    {message.text}
                                </div>
                            )}

                            <Button type="submit" disabled={saving} className="mt-4 w-full md:w-auto">
                                {saving ? "保存中..." : "設定を保存する"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
