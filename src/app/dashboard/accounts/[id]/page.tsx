"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, KeyRound, Save, CheckCircle2, Bot, MessageSquare } from "lucide-react";
import CredentialField from "@/components/CredentialField";

type AccountData = {
    id: string;
    displayName: string;
    xUsername: string | null;
    xProfileImageUrl: string | null;
    hasOAuth: boolean;
    hasManualKeys: boolean;
    xApiKey?: string;
    xApiSecret?: string;
    xAccessToken?: string;
    xAccessSecret?: string;
    accountConcept: string | null;
    profile: string | null;
    policy: string | null;
    thresholdImpression: number | null;
    thresholdConversion: number | null;
    replyEngagementMinImp: number | null;
    targetAudience: string | null;
    targetPain: string | null;
    ctaUrl: string | null;
    competitor1: string | null;
    competitor2: string | null;
    applyPersonaToGeneration: boolean;
};

const EMPTY_KEYS = { xApiKey: "", xApiSecret: "", xAccessToken: "", xAccessSecret: "" };

export default function AccountSettingsPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);

    const [acc, setAcc] = useState<AccountData | null>(null);
    // 編集対象（テキスト/数値/真偽）
    const [form, setForm] = useState({
        displayName: "",
        accountConcept: "",
        profile: "",
        policy: "",
        targetAudience: "",
        targetPain: "",
        ctaUrl: "",
        competitor1: "",
        competitor2: "",
        thresholdImpression: "",
        thresholdConversion: "",
        replyEngagementMinImp: "",
        applyPersonaToGeneration: false,
    });
    // X APIキー（BYOK）— 保存済みの値を表示し、「編集」を押すまで読み取り専用。
    const [keys, setKeys] = useState({ ...EMPTY_KEYS });
    // 全アカウント共通の設定（AI / ChatWork）。/api/settings に読み書きする。
    const [common, setCommon] = useState({ anthropicApiKey: "", openaiApiKey: "", chatworkApiToken: "", chatworkRoomId: "" });
    // 記入済みフィールドの編集ロック解除状態
    const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
    const unlock = (k: string) => setUnlocked(prev => ({ ...prev, [k]: true }));
    // 全ての認証情報フィールドをまとめて編集可能にする（上部「編集」ボタン用）
    const ALL_CRED_KEYS = ["anthropicApiKey", "openaiApiKey", "chatworkApiToken", "chatworkRoomId", "xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret"];
    const unlockAll = () => setUnlocked(Object.fromEntries(ALL_CRED_KEYS.map(k => [k, true])));
    const anyLocked = ALL_CRED_KEYS.some(k => {
        const v = (["anthropicApiKey", "openaiApiKey", "chatworkApiToken", "chatworkRoomId"].includes(k)
            ? (common as Record<string, string>)[k]
            : (keys as Record<string, string>)[k]);
        return !!v && !unlocked[k];
    });

    useEffect(() => {
        if (!id) return;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/x-accounts/${id}`);
                if (res.status === 404) {
                    setNotFound(true);
                    return;
                }
                if (!res.ok) throw new Error("読み込みに失敗しました");
                const data = await res.json();
                const a: AccountData = data.xAccount;
                setAcc(a);
                setForm({
                    displayName: a.displayName ?? "",
                    accountConcept: a.accountConcept ?? "",
                    profile: a.profile ?? "",
                    policy: a.policy ?? "",
                    targetAudience: a.targetAudience ?? "",
                    targetPain: a.targetPain ?? "",
                    ctaUrl: a.ctaUrl ?? "",
                    competitor1: a.competitor1 ?? "",
                    competitor2: a.competitor2 ?? "",
                    thresholdImpression: a.thresholdImpression != null ? String(a.thresholdImpression) : "",
                    thresholdConversion: a.thresholdConversion != null ? String(a.thresholdConversion) : "",
                    replyEngagementMinImp: a.replyEngagementMinImp != null ? String(a.replyEngagementMinImp) : "",
                    applyPersonaToGeneration: !!a.applyPersonaToGeneration,
                });
                // 保存済み X APIキーを表示用にセット（このアカウント専用）
                setKeys({
                    xApiKey: a.xApiKey ?? "",
                    xApiSecret: a.xApiSecret ?? "",
                    xAccessToken: a.xAccessToken ?? "",
                    xAccessSecret: a.xAccessSecret ?? "",
                });
                // 全アカウント共通の AI / ChatWork 設定を取得
                try {
                    const sres = await fetch("/api/settings");
                    if (sres.ok) {
                        const s = await sres.json();
                        setCommon({
                            anthropicApiKey: s.anthropicApiKey ?? "",
                            openaiApiKey: s.openaiApiKey ?? "",
                            chatworkApiToken: s.chatworkApiToken ?? "",
                            chatworkRoomId: s.chatworkRoomId ?? "",
                        });
                    }
                } catch { /* 共通設定の取得失敗は致命的でないため無視 */ }
            } catch (e) {
                setNotice({ type: "error", text: e instanceof Error ? e.message : "読み込みエラー" });
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const setField = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

    async function handleSave() {
        if (!id) return;
        if (!form.displayName.trim()) {
            setNotice({ type: "error", text: "管理名は必須です" });
            return;
        }
        // X APIキーは「編集」で解除された時のみ更新対象にする。解除時は4つすべて必須。
        const keysUnlocked = (["xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret"] as const).some(k => unlocked[k]);
        const keysFilled = keys.xApiKey && keys.xApiSecret && keys.xAccessToken && keys.xAccessSecret;
        if (keysUnlocked && !keysFilled) {
            setNotice({ type: "error", text: "X API キーは4つすべて入力してください（一部だけは保存できません）" });
            return;
        }

        const toIntOrNull = (s: string) => {
            const n = parseInt(s, 10);
            return Number.isFinite(n) ? n : null;
        };

        const body: Record<string, unknown> = {
            displayName: form.displayName.trim(),
            accountConcept: form.accountConcept,
            profile: form.profile,
            policy: form.policy,
            targetAudience: form.targetAudience,
            targetPain: form.targetPain,
            ctaUrl: form.ctaUrl,
            competitor1: form.competitor1,
            competitor2: form.competitor2,
            thresholdImpression: toIntOrNull(form.thresholdImpression),
            thresholdConversion: toIntOrNull(form.thresholdConversion),
            replyEngagementMinImp: toIntOrNull(form.replyEngagementMinImp) ?? 500,
            applyPersonaToGeneration: form.applyPersonaToGeneration,
        };
        if (keysUnlocked) Object.assign(body, keys);

        setSaving(true);
        setNotice(null);
        try {
            // 全アカウント共通の AI / ChatWork 設定を保存（部分更新）
            await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    anthropicApiKey: common.anthropicApiKey,
                    openaiApiKey: common.openaiApiKey,
                    chatworkApiToken: common.chatworkApiToken,
                    chatworkRoomId: common.chatworkRoomId,
                }),
            });

            const res = await fetch(`/api/x-accounts/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
                setNotice({ type: "error", text: d?.message || "保存に失敗しました" });
                return;
            }
            setAcc(d.xAccount);
            setUnlocked({}); // 保存後は再びロック
            setNotice({ type: "success", text: keysUnlocked ? "保存しました（X接続を確認済み）" : "保存しました" });
            router.refresh();
        } catch {
            setNotice({ type: "error", text: "通信エラーが発生しました" });
        } finally {
            setSaving(false);
            setTimeout(() => setNotice(null), 3000);
        }
    }

    if (loading) {
        return (
            <div className="h-[60vh] flex items-center justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> 読み込み中…
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="max-w-2xl mx-auto py-10 text-center space-y-4">
                <p className="text-slate-600">アカウントが見つかりませんでした。</p>
                <Link href="/dashboard" className="text-indigo-600 hover:underline">← ダッシュボードへ戻る</Link>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> ダッシュボードへ戻る
                </Link>
                <div className="flex items-center gap-3 mt-2">
                    {acc?.xProfileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={acc.xProfileImageUrl} alt="icon" className="w-12 h-12 rounded-full ring-1 ring-slate-200" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xl">𝕏</div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{form.displayName || "アカウント設定"}</h1>
                        <p className="text-sm text-slate-500">{acc?.xUsername || "未連携"}</p>
                    </div>
                </div>
            </div>

            {/* 上部の操作バー（スクロールしても追従） */}
            <div className="sticky top-0 z-20 flex items-center justify-end gap-2 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200">
                <Button
                    type="button"
                    variant="outline"
                    onClick={unlockAll}
                    disabled={!anyLocked}
                    className="border-slate-300 text-slate-700"
                    title="設定済みの全てのキーを編集できるようにします"
                >
                    ✏️ 編集
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 保存中...</> : <><Save className="w-4 h-4 mr-2" /> 保存する</>}
                </Button>
            </div>

            {notice && (
                <div className={`text-sm rounded-lg p-3 border ${notice.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                    {notice.type === "success" ? "✅" : "⚠️"} {notice.text}
                </div>
            )}

            {/* ① 生成AI APIキー（全アカウント共通・最上部） */}
            <Card className="bg-white border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                        <Bot className="w-5 h-5 text-indigo-500" /> 生成AI APIキー
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-700">🌐 全アカウント共通</span>
                    </CardTitle>
                    <CardDescription>
                        投稿生成・リプ案生成・リサーチで使う LLM のキー。どちらか一方でOK（両方ある場合は Claude 優先）。すべてのアカウントで共通利用されます。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <CredentialField
                        name="anthropicApiKey"
                        label="Anthropic Claude API Key"
                        labelExtra={<span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 border border-indigo-300 rounded-full px-2 py-0.5">推奨</span>}
                        placeholder="sk-ant-api03-..."
                        value={common.anthropicApiKey}
                        onChange={e => setCommon(p => ({ ...p, anthropicApiKey: e.target.value }))}
                        locked={!!common.anthropicApiKey && !unlocked.anthropicApiKey}
                        onUnlock={() => unlock("anthropicApiKey")}
                    />
                    <CredentialField
                        name="openaiApiKey"
                        label="OpenAI API Key"
                        placeholder="sk-proj-..."
                        value={common.openaiApiKey}
                        onChange={e => setCommon(p => ({ ...p, openaiApiKey: e.target.value }))}
                        locked={!!common.openaiApiKey && !unlocked.openaiApiKey}
                        onUnlock={() => unlock("openaiApiKey")}
                    />
                </CardContent>
            </Card>

            {/* ② X API キー（このアカウント専用） */}
            <Card className="bg-white border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                        <KeyRound className="w-5 h-5 text-amber-500" /> X(Twitter) API キー
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 border border-purple-300 text-purple-700">👤 このアカウント専用</span>
                    </CardTitle>
                    <CardDescription>
                        このアカウント専用の X 連携キー。保存済みの値はそのまま表示されます。変更する場合のみ「編集」を押し、4つすべて入力して保存すると X 接続を確認します。
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(["xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret"] as const).map(k => (
                        <CredentialField
                            key={k}
                            name={k}
                            label={k}
                            placeholder="未設定"
                            value={keys[k]}
                            onChange={e => setKeys(p => ({ ...p, [k]: e.target.value }))}
                            locked={!!keys[k] && !unlocked[k]}
                            onUnlock={() => unlock(k)}
                        />
                    ))}
                </CardContent>
            </Card>

            {/* ③ ChatWork 連携（全アカウント共通） */}
            <Card className="bg-white border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                        <MessageSquare className="w-5 h-5 text-sky-500" /> ChatWork 連携
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 border border-sky-300 text-sky-700">🌐 全アカウント共通</span>
                    </CardTitle>
                    <CardDescription>
                        リプ周り半自動化の通知先です。API トークンとルーム ID を設定します。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <CredentialField
                        name="chatworkApiToken"
                        label="ChatWork API トークン"
                        placeholder="ChatWork 設定 → API から取得"
                        value={common.chatworkApiToken}
                        onChange={e => setCommon(p => ({ ...p, chatworkApiToken: e.target.value }))}
                        locked={!!common.chatworkApiToken && !unlocked.chatworkApiToken}
                        onUnlock={() => unlock("chatworkApiToken")}
                    />
                    <CredentialField
                        name="chatworkRoomId"
                        label="送信先ルーム ID"
                        placeholder="例: 123456789"
                        value={common.chatworkRoomId}
                        onChange={e => setCommon(p => ({ ...p, chatworkRoomId: e.target.value }))}
                        locked={!!common.chatworkRoomId && !unlocked.chatworkRoomId}
                        onUnlock={() => unlock("chatworkRoomId")}
                    />
                </CardContent>
            </Card>

            {/* アカウント基本設定 */}
            <Card className="bg-white border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg text-slate-900">アカウント設定</CardTitle>
                    <CardDescription>このアカウントの管理名・コンセプト・運用方針。投稿生成の文脈に使われます。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="displayName">管理名 <span className="text-red-500">*</span></Label>
                        <Input id="displayName" value={form.displayName} onChange={e => setField("displayName", e.target.value)} className="bg-white" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="accountConcept">アカウントのコンセプト</Label>
                        <Textarea id="accountConcept" value={form.accountConcept} onChange={e => setField("accountConcept", e.target.value)} className="bg-white min-h-[70px]" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="profile">発信者プロフィール</Label>
                        <Textarea id="profile" value={form.profile} onChange={e => setField("profile", e.target.value)} className="bg-white min-h-[70px]" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="policy">運用ポリシー</Label>
                        <Textarea id="policy" value={form.policy} onChange={e => setField("policy", e.target.value)} className="bg-white min-h-[70px]" />
                    </div>
                </CardContent>
            </Card>

            {/* ペルソナ / ターゲット */}
            <Card className="bg-white border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg text-slate-900">ターゲット / ペルソナ</CardTitle>
                    <CardDescription>誘導先 URL やターゲット像。投稿生成への反映は下のトグルで制御します。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.applyPersonaToGeneration}
                            onChange={e => setField("applyPersonaToGeneration", e.target.checked)}
                            className="w-4 h-4 accent-indigo-600"
                        />
                        <span>投稿生成にこのペルソナ（ターゲット/悩み/コンセプト等）を反映する</span>
                    </label>
                    <div className="space-y-1">
                        <Label htmlFor="targetAudience">ターゲット層</Label>
                        <Input id="targetAudience" value={form.targetAudience} onChange={e => setField("targetAudience", e.target.value)} className="bg-white" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="targetPain">ターゲットの悩み</Label>
                        <Input id="targetPain" value={form.targetPain} onChange={e => setField("targetPain", e.target.value)} className="bg-white" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="ctaUrl">誘導先 URL（CTA）</Label>
                        <Input id="ctaUrl" type="url" value={form.ctaUrl} onChange={e => setField("ctaUrl", e.target.value)} className="bg-white" placeholder="https://..." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="competitor1">競合アカウント1</Label>
                            <Input id="competitor1" value={form.competitor1} onChange={e => setField("competitor1", e.target.value)} className="bg-white" placeholder="@..." />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="competitor2">競合アカウント2</Label>
                            <Input id="competitor2" value={form.competitor2} onChange={e => setField("competitor2", e.target.value)} className="bg-white" placeholder="@..." />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 閾値 */}
            <Card className="bg-white border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg text-slate-900">閾値設定</CardTitle>
                    <CardDescription>インプレッション/CV のしきい値、リプライ対象の最小インプ。</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="thresholdImpression">目標インプ</Label>
                        <Input id="thresholdImpression" type="number" value={form.thresholdImpression} onChange={e => setField("thresholdImpression", e.target.value)} className="bg-white" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="thresholdConversion">目標CV</Label>
                        <Input id="thresholdConversion" type="number" value={form.thresholdConversion} onChange={e => setField("thresholdConversion", e.target.value)} className="bg-white" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="replyEngagementMinImp">リプ対象 最小インプ</Label>
                        <Input id="replyEngagementMinImp" type="number" value={form.replyEngagementMinImp} onChange={e => setField("replyEngagementMinImp", e.target.value)} className="bg-white" />
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center gap-3 pb-10">
                <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 保存中...</> : <><Save className="w-4 h-4 mr-2" /> 保存する</>}
                </Button>
                <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> AI / ChatWork キーは全アカウント共通、X API キーはこのアカウント専用として保存されます
                </span>
            </div>
        </div>
    );
}
