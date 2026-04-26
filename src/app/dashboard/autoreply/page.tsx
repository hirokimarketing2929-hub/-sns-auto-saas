"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AutoReplyCampaign {
    id: string;
    name: string;
    targetUrl: string;
    isTriggerRt: boolean;
    isTriggerLike: boolean;
    isTriggerReply: boolean;
    keyword: string | null;
    replyContent: string;
    isActive: boolean;
    replyType: string;
    endsAt: string | null;
    checkIntervalMinutes: number;
    lastCheckedAt: string | null;
    triggerMode: "OR" | "AND" | string;
    createdAt: string;
}

const INTERVAL_OPTIONS: { value: number; label: string; note: string; warn?: boolean }[] = [
    { value: 1, label: "1分ごと", note: "即応性◎ / X API 消費大", warn: true },
    { value: 5, label: "5分ごと（推奨）", note: "バランス型" },
    { value: 15, label: "15分ごと", note: "節約モード" },
    { value: 30, label: "30分ごと", note: "軽量" },
    { value: 60, label: "1時間ごと", note: "最省エネ" },
];

export default function AutoReplyPage() {
    const [campaigns, setCampaigns] = useState<AutoReplyCampaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [newName, setNewName] = useState("");
    const [newTargetUrl, setNewTargetUrl] = useState("");
    const [newIsTriggerRt, setNewIsTriggerRt] = useState(false);
    const [newIsTriggerLike, setNewIsTriggerLike] = useState(false);
    const [newIsTriggerReply, setNewIsTriggerReply] = useState(false);
    const [newKeyword, setNewKeyword] = useState("");
    const [newReplyContent, setNewReplyContent] = useState("");
    const [newReplyType, setNewReplyType] = useState("MENTION");
    const [newEndsAt, setNewEndsAt] = useState(""); // datetime-local 形式 or 空文字
    const [newCheckInterval, setNewCheckInterval] = useState<number>(5);
    const [newTriggerMode, setNewTriggerMode] = useState<"OR" | "AND">("OR");

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        try {
            const res = await fetch("/api/autoreply");
            const data = await res.json();
            if (res.ok) {
                setCampaigns(data.campaigns || []);
            }
        } catch (error) {
            console.error("Failed to fetch campaigns", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();

        // 最低1つはトリガーを選択しているかバリデーション
        if (!newIsTriggerRt && !newIsTriggerLike && !newIsTriggerReply) {
            alert("発動トリガーは少なくとも1つ（RT、いいね、リプライのいずれか）を選択してください。");
            return;
        }

        if (!newName || !newTargetUrl || !newReplyContent) return;

        // 終了日時は必須
        if (!newEndsAt) {
            alert("キャンペーン終了日時は必須です。");
            return;
        }
        if (new Date(newEndsAt).getTime() <= Date.now()) {
            alert("キャンペーン終了日時は未来の時刻を指定してください。");
            return;
        }
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    payload: {
                        name: newName,
                        targetUrl: newTargetUrl,
                        isTriggerRt: newIsTriggerRt,
                        isTriggerLike: newIsTriggerLike,
                        isTriggerReply: newIsTriggerReply,
                        keyword: newKeyword,
                        replyContent: newReplyContent,
                        replyType: newReplyType,
                        endsAt: newEndsAt ? new Date(newEndsAt).toISOString() : null,
                        checkIntervalMinutes: newCheckInterval,
                        triggerMode: newTriggerMode,
                    }
                })
            });
            if (res.ok) {
                // フォームリセット
                setNewName("");
                setNewTargetUrl("");
                setNewIsTriggerRt(false);
                setNewIsTriggerLike(false);
                setNewIsTriggerReply(false);
                setNewKeyword("");
                setNewReplyContent("");
                setNewReplyType("MENTION");
                setNewEndsAt("");
                setNewCheckInterval(5);
                setNewTriggerMode("OR");
                fetchCampaigns();
            }
        } catch (error) {
            console.error("Failed to create campaign", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("このキャンペーンを削除しますか？")) return;
        try {
            const res = await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "delete",
                    payload: { id }
                })
            });
            if (res.ok) fetchCampaigns();
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            // UIを楽観的更新
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, isActive: !currentStatus } : c));
            await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "toggle_active",
                    payload: { id, isActive: !currentStatus }
                })
            });
        } catch (error) {
            console.error("Failed to toggle", error);
            fetchCampaigns(); // 失敗したら元に戻す
        }
    };

    const handleUpdateTriggerMode = async (id: string, mode: "OR" | "AND") => {
        try {
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, triggerMode: mode } : c));
            await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_trigger_mode",
                    payload: { id, triggerMode: mode }
                })
            });
        } catch (error) {
            console.error("Failed to update trigger mode", error);
            fetchCampaigns();
        }
    };

    const handleUpdateInterval = async (id: string, minutes: number) => {
        try {
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, checkIntervalMinutes: minutes } : c));
            await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_interval",
                    payload: { id, checkIntervalMinutes: minutes }
                })
            });
        } catch (error) {
            console.error("Failed to update interval", error);
            fetchCampaigns();
        }
    };

    const handleUpdateEndDate = async (id: string, datetimeLocalValue: string) => {
        const iso = datetimeLocalValue ? new Date(datetimeLocalValue).toISOString() : null;
        try {
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, endsAt: iso } : c));
            await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_end_date",
                    payload: { id, endsAt: iso }
                })
            });
        } catch (error) {
            console.error("Failed to update end date", error);
            fetchCampaigns();
        }
    };

    const renderTriggerLabels = (c: AutoReplyCampaign) => {
        const labels = [];
        if (c.isTriggerRt) labels.push("🔄 RT");
        if (c.isTriggerLike) labels.push("❤️ いいね");
        if (c.isTriggerReply) labels.push(`💬 リプ(「${c.keyword}」)`);

        if (labels.length === 0) return "条件未設定";
        return labels.join(" / ");
    };

    if (isLoading) return <div className="p-8">読み込み中...</div>;

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight mb-2">🤖 自動リプライ（キャンペーン）設定</h2>
                    <p className="text-muted-foreground">
                        特定の投稿に対して「いいね」や「リポスト」をしてくれたユーザーなどを自動検知し、指定した内容を自動でリプライ（返信）します。<br />
                        ※X APIの利用制限や凍結リスクを避けるため、実際の返信処理には数分〜数十分の遅延（揺らぎ）が設けられます。
                    </p>
                </div>
            </div>

            {/* 新規キャンペーン作成フォーム */}
            <Card className="bg-white/5 border-blue-500/30 shadow-sm border-t-4 border-t-blue-500">
                <CardHeader>
                    <CardTitle className="text-lg">＋ 新しい自動リプライキャンペーンを作成</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateCampaign} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-foreground/80 block mb-1">キャンペーン管理名</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="例: 春のプレゼント企画自動配布"
                                    className="w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground/80 block mb-1">対象のポストURL（またはポストID）</label>
                                <input
                                    type="text"
                                    value={newTargetUrl}
                                    onChange={(e) => setNewTargetUrl(e.target.value)}
                                    placeholder="https://x.com/username/status/123456789..."
                                    className="w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-sm font-medium text-foreground/80 block mb-2">発動トリガー（複数選択可）</label>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={newIsTriggerRt} onChange={(e) => setNewIsTriggerRt(e.target.checked)} className="rounded text-blue-600 w-4 h-4" />
                                        <span className="text-sm">🔄 リポスト (RT)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={newIsTriggerLike} onChange={(e) => setNewIsTriggerLike(e.target.checked)} className="rounded text-blue-600 w-4 h-4" />
                                        <span className="text-sm">❤️ いいね</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={newIsTriggerReply} onChange={(e) => setNewIsTriggerReply(e.target.checked)} className="rounded text-blue-600 w-4 h-4" />
                                        <span className="text-sm">💬 特定キーワードのリプライ</span>
                                    </label>
                                </div>
                            </div>

                            {newIsTriggerReply && (
                                <div>
                                    <label className="text-sm font-medium text-foreground/80 block mb-1">反応するキーワード (リプライ指定時)</label>
                                    <input
                                        type="text"
                                        value={newKeyword}
                                        onChange={(e) => setNewKeyword(e.target.value)}
                                        placeholder="例: プレゼント希望"
                                        className="w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md"
                                        required={newIsTriggerReply}
                                    />
                                </div>
                            )}

                            {/* トリガー合成モード（複数選択時のみ意味がある） */}
                            {[newIsTriggerRt, newIsTriggerLike, newIsTriggerReply].filter(Boolean).length > 1 && (
                                <div>
                                    <label className="text-sm font-medium text-foreground/80 block mb-2">複数トリガーの判定方式</label>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => setNewTriggerMode("OR")}
                                            className={`text-xs px-3 py-2 rounded-md border-2 transition-all ${newTriggerMode === "OR"
                                                ? "bg-blue-600 border-blue-600 text-white font-semibold shadow-md"
                                                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                                        >
                                            <span className="font-bold">OR（または）</span>
                                            <span className="block text-[10px] mt-0.5 opacity-90">いずれか1つでも満たす人に送る</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewTriggerMode("AND")}
                                            className={`text-xs px-3 py-2 rounded-md border-2 transition-all ${newTriggerMode === "AND"
                                                ? "bg-purple-600 border-purple-600 text-white font-semibold shadow-md"
                                                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                                        >
                                            <span className="font-bold">AND（かつ）</span>
                                            <span className="block text-[10px] mt-0.5 opacity-90">すべてを満たす人にだけ送る</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-medium text-foreground/80 block mb-2">送信方式の選択</label>
                            <div className="space-y-2">
                                <label className={`flex items-center gap-3 cursor-pointer p-3 border rounded-md transition-colors ${newReplyType === 'REPLY' ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                                    <input type="radio" value="REPLY" checked={newReplyType === 'REPLY'} onChange={(e) => setNewReplyType(e.target.value)} className="w-5 h-5 focus:ring-blue-500" />
                                    <div>
                                        <span className="text-sm font-bold block text-foreground">💬 通常リプライ</span>
                                        <span className="text-xs text-muted-foreground block">対象のポストのツリー上にそのまま公開リプライとしてぶら下げます。</span>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-3 cursor-pointer p-3 border rounded-md transition-colors ${newReplyType === 'MENTION' ? 'border-purple-500/50 bg-purple-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                                    <input type="radio" value="MENTION" checked={newReplyType === 'MENTION'} onChange={(e) => setNewReplyType(e.target.value)} className="w-5 h-5 focus:ring-purple-500" />
                                    <div>
                                        <span className="text-sm font-bold block text-foreground">🤫 シークレット（メンション）</span>
                                        <span className="text-xs text-muted-foreground block">対象のツリーには表示させず、相手の通知欄に直接届く独立ポストとして送信します。</span>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-3 cursor-pointer p-3 border rounded-md transition-colors ${newReplyType === 'DM' ? 'border-pink-500/50 bg-pink-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                                    <input type="radio" value="DM" checked={newReplyType === 'DM'} onChange={(e) => setNewReplyType(e.target.value)} className="w-5 h-5 focus:ring-pink-500" />
                                    <div>
                                        <span className="text-sm font-bold block text-foreground">✉️ シークレット（DM送信）</span>
                                        <span className="text-xs text-muted-foreground block">相手にDMとして送信します。※相手のDMが受信可能に設定されている必要があります。</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-foreground/80 block mb-1">自動送信するリプライ（返信）内容</label>
                            <textarea
                                value={newReplyContent}
                                onChange={(e) => setNewReplyContent(e.target.value)}
                                placeholder={`ご参加ありがとうございます！\nこちらのURLからプレゼントをお受け取りください🎁\nhttps://...`}
                                rows={4}
                                className="w-full min-h-[5rem] border border-input bg-background px-3 py-2 text-sm rounded-md resize-y"
                                required
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                ※ 入力した内容がそのまま送信されます。同一ユーザーには二重送信されません。
                            </p>
                        </div>

                        {/* チェック間隔 */}
                        <div>
                            <label className="text-sm font-medium text-foreground/80 block mb-2">
                                ⏱ チェック間隔
                                <span className="text-xs text-rose-500 ml-2 font-bold">*必須</span>
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                {INTERVAL_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setNewCheckInterval(opt.value)}
                                        className={`text-xs p-3 rounded-lg border-2 transition-all text-left ${newCheckInterval === opt.value
                                            ? (opt.warn
                                                ? "bg-amber-600 border-amber-600 text-white shadow-md"
                                                : "bg-emerald-600 border-emerald-600 text-white shadow-md")
                                            : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                                    >
                                        <div className="font-bold text-[13px]">{opt.label}</div>
                                        <div className="text-[10px] opacity-80 mt-0.5">{opt.note}</div>
                                    </button>
                                ))}
                            </div>
                            {newCheckInterval === 1 && (
                                <div className="mt-2 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-500">
                                    <span className="font-bold shrink-0">⚠️</span>
                                    <div>
                                        <span className="font-bold">1分ごとは X API の消費が 5倍になります</span>
                                        。Basic プラン（月10K読取）では 1 キャンペーンだけで月枠を使い切る可能性があります。Premium Pro 以上推奨。
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* キャンペーン終了日時（必須） */}
                        <div>
                            <label htmlFor="campaignEndsAt" className="text-sm font-medium text-foreground/80 block mb-1">
                                ⏰ キャンペーン終了日時
                                <span className="text-xs text-rose-500 ml-2 font-bold">*必須</span>
                            </label>
                            <input
                                id="campaignEndsAt"
                                type="datetime-local"
                                value={newEndsAt}
                                onChange={(e) => setNewEndsAt(e.target.value)}
                                onClick={(e) => {
                                    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                                    if (typeof el.showPicker === "function") el.showPicker();
                                }}
                                onFocus={(e) => {
                                    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                                    if (typeof el.showPicker === "function") el.showPicker();
                                }}
                                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                className="w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md cursor-pointer"
                                required
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                指定した時刻を過ぎた最初の cron 実行（5分ごと）で、このキャンペーンは自動的に停止します。入力欄のどこをタップしてもカレンダーが開きます。
                            </p>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                type="submit"
                                disabled={
                                    isSubmitting ||
                                    !newName ||
                                    !newTargetUrl ||
                                    !newReplyContent ||
                                    !newEndsAt ||
                                    (!newIsTriggerRt && !newIsTriggerLike && !newIsTriggerReply)
                                }
                            >
                                {isSubmitting ? "保存中..." : "キャンペーンを作成・稼働開始"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* キャンペーン一覧 */}
            <div className="space-y-4 pt-4">
                <h3 className="text-xl font-bold">稼働中・過去のキャンペーン一覧</h3>

                {campaigns.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border border-white/10 rounded-lg bg-white/5">
                        設定されている自動リプライキャンペーンはありません。
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {campaigns.map((campaign) => {
                            // 期限切れ判定（endsAt が過去 → 「終了済み」扱い）
                            const isExpired = !!campaign.endsAt && new Date(campaign.endsAt) <= new Date();
                            // UI 上の実効稼働状態（DB 側 isActive が true でも期限切れなら停止扱い）
                            const effectiveActive = campaign.isActive && !isExpired;
                            // ボーダー色
                            const borderClass = effectiveActive
                                ? 'border-l-4 border-l-green-500'
                                : isExpired
                                    ? 'opacity-70 border-l-4 border-l-red-500'
                                    : 'opacity-70 border-l-4 border-l-gray-300';
                            // バッジ表示
                            const statusBadge = effectiveActive
                                ? { label: '🟢 稼働中', cls: 'bg-emerald-500/20 text-emerald-300' }
                                : isExpired
                                    ? { label: '⛔️ 終了済み（期限超過）', cls: 'bg-red-500/20 text-red-300' }
                                    : { label: '⚫️ 停止中', cls: 'bg-white/10 text-muted-foreground' };
                            return (
                            <Card key={campaign.id} className={`transition-all ${borderClass}`}>
                                <CardContent className="p-5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-lg text-foreground">{campaign.name}</h4>
                                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${statusBadge.cls}`}>
                                                {statusBadge.label}
                                            </span>
                                        </div>
                                        <div className="text-sm text-foreground/80 bg-white/5 p-2 rounded max-w-xl truncate border border-white/10">
                                            <span className="font-semibold">対象:</span> <a href={campaign.targetUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{campaign.targetUrl}</a>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm flex-wrap">
                                            <span className="font-semibold text-foreground/80">条件:</span>
                                            <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/30">
                                                {renderTriggerLabels(campaign)}
                                            </span>
                                            {[campaign.isTriggerRt, campaign.isTriggerLike, campaign.isTriggerReply].filter(Boolean).length > 1 && (
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${campaign.triggerMode === "AND"
                                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"}`}>
                                                    判定: {campaign.triggerMode === "AND" ? "AND（すべて）" : "OR（いずれか）"}
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${campaign.replyType === 'DM' ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' : campaign.replyType === 'MENTION' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-white/10 text-muted-foreground border-white/20'}`}>
                                                {campaign.replyType === 'DM' ? '✉️ DM' : campaign.replyType === 'MENTION' ? '🤫 メンション' : '💬 通常リプライ'}
                                            </span>
                                            {campaign.endsAt && (
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${new Date(campaign.endsAt) <= new Date()
                                                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                                                    ⏰ {new Date(campaign.endsAt) <= new Date() ? "終了済み" : "終了予定"}: {new Date(campaign.endsAt).toLocaleString()}
                                                </span>
                                            )}
                                        </div>

                                        {/* 終了日時の編集 */}
                                        <div className="flex items-center gap-2 text-xs pt-1">
                                            <span className="text-muted-foreground shrink-0">⏰ 終了日時:</span>
                                            <input
                                                type="datetime-local"
                                                defaultValue={campaign.endsAt ? new Date(new Date(campaign.endsAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                                                onChange={(e) => handleUpdateEndDate(campaign.id, e.target.value)}
                                                onClick={(e) => {
                                                    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                                                    if (typeof el.showPicker === "function") el.showPicker();
                                                }}
                                                onFocus={(e) => {
                                                    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                                                    if (typeof el.showPicker === "function") el.showPicker();
                                                }}
                                                className="h-8 border border-input bg-background px-2 py-1 text-xs rounded-md cursor-pointer"
                                            />
                                        </div>

                                        {/* チェック間隔の編集 */}
                                        <div className="flex items-center gap-2 text-xs pt-1 flex-wrap">
                                            <span className="text-muted-foreground shrink-0">⏱ チェック間隔:</span>
                                            <select
                                                value={campaign.checkIntervalMinutes}
                                                onChange={(e) => handleUpdateInterval(campaign.id, Number(e.target.value))}
                                                className="h-8 border border-input bg-background px-2 py-1 text-xs rounded-md cursor-pointer"
                                            >
                                                {INTERVAL_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            {campaign.lastCheckedAt && (
                                                <span className="text-muted-foreground/60 text-[10px]">
                                                    前回チェック: {new Date(campaign.lastCheckedAt).toLocaleString()}
                                                </span>
                                            )}
                                        </div>

                                        {/* トリガー判定方式（複数トリガー時のみ編集可） */}
                                        {[campaign.isTriggerRt, campaign.isTriggerLike, campaign.isTriggerReply].filter(Boolean).length > 1 && (
                                            <div className="flex items-center gap-2 text-xs pt-1 flex-wrap">
                                                <span className="text-muted-foreground shrink-0">🧮 判定方式:</span>
                                                <select
                                                    value={campaign.triggerMode === "AND" ? "AND" : "OR"}
                                                    onChange={(e) => handleUpdateTriggerMode(campaign.id, e.target.value === "AND" ? "AND" : "OR")}
                                                    className="h-8 border border-input bg-background px-2 py-1 text-xs rounded-md cursor-pointer"
                                                >
                                                    <option value="OR">OR（いずれかで発動）</option>
                                                    <option value="AND">AND（すべて満たす人のみ）</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-full md:w-1/3 bg-white/5 p-3 rounded-md border border-white/10 text-sm text-foreground/80 max-h-24 overflow-y-auto">
                                        <div className="font-semibold text-xs text-muted-foreground mb-1 border-b border-white/10 pb-1">送信内容プレビュー</div>
                                        <p className="whitespace-pre-wrap">{campaign.replyContent}</p>
                                    </div>

                                    <div className="flex md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0 justify-end">
                                        <Button
                                            variant={effectiveActive ? "outline" : "default"}
                                            onClick={() => {
                                                if (isExpired && !campaign.isActive) {
                                                    alert("このキャンペーンは終了日時を過ぎています。再開するには終了日時を未来の時刻に更新してください。");
                                                    return;
                                                }
                                                handleToggleActive(campaign.id, campaign.isActive);
                                            }}
                                            disabled={isExpired && !campaign.isActive}
                                            className={effectiveActive ? "border-red-500/50 hover:bg-red-500/10 hover:text-red-400" : ""}
                                        >
                                            {effectiveActive ? "停止する" : isExpired ? "期限切れ（再開不可）" : "再開する"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="text-muted-foreground/60 hover:text-red-400 transition-colors"
                                            onClick={() => handleDelete(campaign.id)}
                                        >
                                            🗑 削除
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
