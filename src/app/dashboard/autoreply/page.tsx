"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
    openingVariants: string | null;   // JSON string[] (最大100通り)。null/空なら冒頭バリエーション未使用。
    openingsSentCount: number;        // 循環インデックス（送信ごとに +1。バリエーション数で剰余を取って利用）
    createdAt: string;
}

// openingVariants（DB上はJSON文字列）を UI 表示用の string[] に変換する。
function parseOpeningVariants(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
    } catch {
        return [];
    }
}

// textarea の各行を 1 バリエーションとして扱う。
function linesToVariants(text: string): string[] {
    return text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
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

    // 冒頭バリエーション（任意・最大100通り）。1行＝1バリエーション。
    const [newOpeningsText, setNewOpeningsText] = useState("");
    const [newOpeningsCount, setNewOpeningsCount] = useState<number>(30);
    const [isGeneratingOpenings, setIsGeneratingOpenings] = useState(false);
    const [openingsGenError, setOpeningsGenError] = useState<string | null>(null);

    // 既存キャンペーンの編集パネル展開状態（id → boolean）と編集中テキスト・ローディング
    const [openingsPanelOpen, setOpeningsPanelOpen] = useState<Record<string, boolean>>({});
    const [openingsEditText, setOpeningsEditText] = useState<Record<string, string>>({});
    const [openingsEditCount, setOpeningsEditCount] = useState<Record<string, number>>({});
    const [openingsEditLoading, setOpeningsEditLoading] = useState<Record<string, boolean>>({});
    const [openingsEditError, setOpeningsEditError] = useState<Record<string, string | null>>({});

    // 手動実行（今すぐ実行）の状態：ローディングと実行ログ（id → 文字列配列）
    const [runNowLoading, setRunNowLoading] = useState<Record<string, boolean>>({});
    const [runNowLogs, setRunNowLogs] = useState<Record<string, string[] | null>>({});

    // キャンペーンを今すぐ実行してログを取得（interval を無視。実際にリプライも送信される）
    const handleRunNow = async (id: string) => {
        setRunNowLoading(prev => ({ ...prev, [id]: true }));
        setRunNowLogs(prev => ({ ...prev, [id]: null }));
        try {
            const res = await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "run_now", payload: { id } }),
            });
            const data = await res.json();
            if (!res.ok) {
                setRunNowLogs(prev => ({ ...prev, [id]: [data?.message || "実行に失敗しました。"] }));
                return;
            }
            const logs: string[] = Array.isArray(data?.details) ? data.details : ["（ログがありません）"];
            setRunNowLogs(prev => ({ ...prev, [id]: logs }));
        } catch (err) {
            setRunNowLogs(prev => ({ ...prev, [id]: [err instanceof Error ? err.message : String(err)] }));
        } finally {
            setRunNowLoading(prev => ({ ...prev, [id]: false }));
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        try {
            const res = await fetch("/api/autoreply", { cache: "no-store" });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                toast.error(data?.error || data?.message || "キャンペーン一覧の取得に失敗しました");
                return;
            }
            setCampaigns(data?.campaigns || []);
        } catch (error) {
            console.error("Failed to fetch campaigns", error);
            toast.error(`通信エラー: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();

        // 最低1つはトリガーを選択しているかバリデーション
        if (!newIsTriggerRt && !newIsTriggerLike && !newIsTriggerReply) {
            toast.error("発動トリガーは少なくとも1つ（RT、いいね、リプライのいずれか）を選択してください。");
            return;
        }

        if (!newName || !newTargetUrl || !newReplyContent) return;

        // 終了日時は必須
        if (!newEndsAt) {
            toast.error("キャンペーン終了日時は必須です。");
            return;
        }
        if (new Date(newEndsAt).getTime() <= Date.now()) {
            toast.error("キャンペーン終了日時は未来の時刻を指定してください。");
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
                        openingVariants: linesToVariants(newOpeningsText),
                    }
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                toast.error(data?.error || data?.message || "キャンペーンの作成に失敗しました");
                return;
            }
            toast.success("キャンペーンを作成しました");
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
            setNewOpeningsText("");
            setNewOpeningsCount(30);
            setOpeningsGenError(null);
            fetchCampaigns();
        } catch (error) {
            console.error("Failed to create campaign", error);
            toast.error(`通信エラー: ${error instanceof Error ? error.message : String(error)}`);
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
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                toast.error(data?.error || data?.message || "削除に失敗しました");
                return;
            }
            toast.success("キャンペーンを削除しました");
            fetchCampaigns();
        } catch (error) {
            console.error("Failed to delete", error);
            toast.error(`通信エラー: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        // UIを楽観的更新
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, isActive: !currentStatus } : c));
        try {
            const res = await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "toggle_active",
                    payload: { id, isActive: !currentStatus }
                })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || data?.message || "稼働状態の更新に失敗しました");
                // ロールバック
                setCampaigns(prev => prev.map(c => c.id === id ? { ...c, isActive: currentStatus } : c));
            }
        } catch (error) {
            console.error("Failed to toggle", error);
            toast.error(`通信エラー: ${error instanceof Error ? error.message : String(error)}`);
            // ロールバック
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, isActive: currentStatus } : c));
        }
    };

    const handleUpdateTriggerMode = async (id: string, mode: "OR" | "AND") => {
        const prevCampaigns = campaigns;
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, triggerMode: mode } : c));
        try {
            const res = await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_trigger_mode",
                    payload: { id, triggerMode: mode }
                })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || data?.message || "判定方式の更新に失敗しました");
                setCampaigns(prevCampaigns);
            }
        } catch (error) {
            console.error("Failed to update trigger mode", error);
            toast.error(`通信エラー: ${error instanceof Error ? error.message : String(error)}`);
            setCampaigns(prevCampaigns);
        }
    };

    const handleUpdateInterval = async (id: string, minutes: number) => {
        const prevCampaigns = campaigns;
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, checkIntervalMinutes: minutes } : c));
        try {
            const res = await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_interval",
                    payload: { id, checkIntervalMinutes: minutes }
                })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || data?.message || "チェック間隔の更新に失敗しました");
                setCampaigns(prevCampaigns);
            }
        } catch (error) {
            console.error("Failed to update interval", error);
            toast.error(`通信エラー: ${error instanceof Error ? error.message : String(error)}`);
            setCampaigns(prevCampaigns);
        }
    };

    const handleUpdateEndDate = async (id: string, datetimeLocalValue: string) => {
        const iso = datetimeLocalValue ? new Date(datetimeLocalValue).toISOString() : null;
        const prevCampaigns = campaigns;
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, endsAt: iso } : c));
        try {
            const res = await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_end_date",
                    payload: { id, endsAt: iso }
                })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || data?.message || "終了日時の更新に失敗しました");
                setCampaigns(prevCampaigns);
            }
        } catch (error) {
            console.error("Failed to update end date", error);
            toast.error(`通信エラー: ${error instanceof Error ? error.message : String(error)}`);
            setCampaigns(prevCampaigns);
        }
    };

    // 新規作成フォームの「冒頭バリエーション」を AI で量産する
    const handleGenerateOpeningsForNew = async () => {
        if (!newReplyContent.trim()) {
            setOpeningsGenError("先に共通CTA本文を入力してください。");
            return;
        }
        setIsGeneratingOpenings(true);
        setOpeningsGenError(null);
        try {
            const res = await fetch("/api/autoreply/generate-openings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ replyContent: newReplyContent, count: newOpeningsCount }),
            });
            const data = await res.json();
            if (!res.ok) {
                setOpeningsGenError(data?.error || "AI 生成に失敗しました。");
                return;
            }
            const generated: string[] = Array.isArray(data?.openings) ? data.openings : [];
            // 既存の入力を残しつつ末尾に追記（重複は除く）
            const existing = linesToVariants(newOpeningsText);
            const merged = Array.from(new Set([...existing, ...generated])).slice(0, 100);
            setNewOpeningsText(merged.join("\n"));
        } catch (err) {
            setOpeningsGenError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsGeneratingOpenings(false);
        }
    };

    // 既存キャンペーンの編集パネルを開く（初回時は DB のバリエーションをテキストに展開）
    const toggleOpeningsPanel = (campaign: AutoReplyCampaign) => {
        const next = !openingsPanelOpen[campaign.id];
        setOpeningsPanelOpen(prev => ({ ...prev, [campaign.id]: next }));
        if (next && openingsEditText[campaign.id] === undefined) {
            const list = parseOpeningVariants(campaign.openingVariants);
            setOpeningsEditText(prev => ({ ...prev, [campaign.id]: list.join("\n") }));
            setOpeningsEditCount(prev => ({ ...prev, [campaign.id]: 30 }));
        }
    };

    // 既存キャンペーン用の AI 量産
    const handleGenerateOpeningsForExisting = async (campaign: AutoReplyCampaign) => {
        setOpeningsEditLoading(prev => ({ ...prev, [campaign.id]: true }));
        setOpeningsEditError(prev => ({ ...prev, [campaign.id]: null }));
        try {
            const res = await fetch("/api/autoreply/generate-openings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ replyContent: campaign.replyContent, count: openingsEditCount[campaign.id] ?? 30 }),
            });
            const data = await res.json();
            if (!res.ok) {
                setOpeningsEditError(prev => ({ ...prev, [campaign.id]: data?.error || "AI 生成に失敗しました。" }));
                return;
            }
            const generated: string[] = Array.isArray(data?.openings) ? data.openings : [];
            const existing = linesToVariants(openingsEditText[campaign.id] || "");
            const merged = Array.from(new Set([...existing, ...generated])).slice(0, 100);
            setOpeningsEditText(prev => ({ ...prev, [campaign.id]: merged.join("\n") }));
        } catch (err) {
            setOpeningsEditError(prev => ({ ...prev, [campaign.id]: err instanceof Error ? err.message : String(err) }));
        } finally {
            setOpeningsEditLoading(prev => ({ ...prev, [campaign.id]: false }));
        }
    };

    // 既存キャンペーンの冒頭バリエーションを保存（リスト変更時は cron 側で循環カウンタが 0 リセットされる）
    const handleSaveOpenings = async (campaign: AutoReplyCampaign) => {
        const variants = linesToVariants(openingsEditText[campaign.id] || "");
        setOpeningsEditLoading(prev => ({ ...prev, [campaign.id]: true }));
        setOpeningsEditError(prev => ({ ...prev, [campaign.id]: null }));
        try {
            const res = await fetch("/api/autoreply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_opening_variants",
                    payload: { id: campaign.id, openingVariants: variants },
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setOpeningsEditError(prev => ({ ...prev, [campaign.id]: data?.message || "保存に失敗しました。" }));
                return;
            }
            // ローカル state を反映
            setCampaigns(prev => prev.map(c => c.id === campaign.id
                ? { ...c, openingVariants: variants.length > 0 ? JSON.stringify(variants) : null, openingsSentCount: 0 }
                : c));
            setOpeningsPanelOpen(prev => ({ ...prev, [campaign.id]: false }));
            toast.success(variants.length > 0 ? `冒頭バリエーション ${variants.length} 通りを保存しました` : "冒頭バリエーションをクリアしました");
        } catch (err) {
            setOpeningsEditError(prev => ({ ...prev, [campaign.id]: err instanceof Error ? err.message : String(err) }));
        } finally {
            setOpeningsEditLoading(prev => ({ ...prev, [campaign.id]: false }));
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
                        ※X APIの利用制限や凍結リスクを避けるため、送信は「チェック間隔」ごとにまとめて行い、1回あたりの送信件数を制限しつつ、各送信の間にランダムな待機（数秒の揺らぎ）を挟みます。上限を超えた分は次回のチェックで順次送信されます。
                    </p>
                </div>
            </div>

            {/* ★ X API プラン要件の注意（最重要・目立たせる） */}
            <div className="rounded-xl border-4 border-amber-500 bg-amber-50 p-5 space-y-2 shadow-md">
                <p className="text-lg md:text-xl font-extrabold text-amber-900 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    この機能には X API の「Basic」プラン以上が必須です
                </p>
                <p className="text-sm md:text-base font-bold text-amber-900 leading-relaxed">
                    自動リプライは「いいね／リポスト／キーワードリプ」をした人を X API で検出して送信します。
                    これらの検出には <span className="underline decoration-2">X API の有料プラン（Basic 以上）</span> が必要です。
                    無料（Free）プランでは検出が行えず、キャンペーンを作成しても返信は送信されません。
                </p>
                <ul className="text-xs md:text-sm text-amber-900 space-y-1 list-disc list-inside leading-relaxed">
                    <li>特に「💬 特定キーワードのリプライ」検出は検索APIを使うため、Basic 以上が必須です。</li>
                    <li>ご利用前に <a href="https://developer.x.com/en/portal/products" target="_blank" rel="noreferrer" className="underline font-bold">X Developer Portal</a> でプランをご確認ください。</li>
                </ul>
            </div>

            {/* シークレットリプライ（メンション/DM）に関する注意 */}
            <div className="rounded-lg border-2 border-red-400 bg-red-100 p-4 space-y-2">
                <p className="text-sm font-bold text-red-900">⚠️ シークレットリプライ機能のご利用にあたって</p>
                <ul className="text-xs text-neutral-900 space-y-1 list-disc list-inside leading-relaxed">
                    <li>
                        <span className="font-bold text-black">シークレットリプライ機能はシャドウバンのリスクがあるため、使用は自己責任でお願いします。</span>
                        短時間に大量のメンション送信はスパム判定・凍結の原因になり得ます（遅延・件数の調整を推奨）。
                    </li>
                    <li>
                        <span className="font-bold text-black">できるだけ「✉️ シークレット（DM送信）」のご利用を推奨します。</span>
                        メンションより通知が自然で、相手にも届きやすいためです。
                    </li>
                    <li>
                        ただし <span className="font-bold text-black">DMには送信数の制限（レートリミット）があり、相手がDMを受信可能に設定している必要があります。</span>
                        制限に達した場合は送信されないことがあります。
                    </li>
                </ul>
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

                        {/* 冒頭バリエーション（任意・最大100通り） */}
                        <div className="border border-amber-500/20 bg-amber-500/5 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-foreground/80">🎭 冒頭バリエーション（任意・最大100通り）</span>
                                <span className="text-[10px] text-muted-foreground">— 1行＝1バリエーション</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                                同じ文面を大量送信するとスパム判定されやすくなります。受信者ごとに少しずつ違う冒頭文（例:「いいねありがとうございます！」「気になっていただけて嬉しいです🙌」）を用意すると、自然なやりとりに見えて凍結リスクを下げられます。<br />
                                冒頭文の後ろに上の共通CTA本文が連結されて送信されます。空欄なら従来通り共通CTA本文だけが送信されます。
                            </p>
                            <textarea
                                value={newOpeningsText}
                                onChange={(e) => setNewOpeningsText(e.target.value)}
                                placeholder={`いいねありがとうございます！\n気になっていただけて嬉しいです🙌\nリポストありがとうございます〜`}
                                rows={4}
                                className="w-full min-h-[5rem] border border-input bg-background px-3 py-2 text-sm rounded-md resize-y"
                            />
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                                <label className="text-xs text-muted-foreground">AI で量産:</label>
                                <select
                                    value={newOpeningsCount}
                                    onChange={(e) => setNewOpeningsCount(Number(e.target.value))}
                                    className="h-8 border border-input bg-background px-2 py-1 text-xs rounded-md cursor-pointer"
                                >
                                    {[10, 20, 30, 50, 80, 100].map(n => <option key={n} value={n}>{n}通り</option>)}
                                </select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleGenerateOpeningsForNew}
                                    disabled={isGeneratingOpenings || !newReplyContent.trim()}
                                    className="h-8 text-xs"
                                >
                                    {isGeneratingOpenings ? "生成中..." : "✨ AI で量産"}
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    現在: {linesToVariants(newOpeningsText).length} 通り
                                </span>
                            </div>
                            {openingsGenError && (
                                <p className="text-xs text-red-400 mt-2">{openingsGenError}</p>
                            )}
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

                                        {/* 冒頭バリエーション（任意・最大100通り） */}
                                        {(() => {
                                            const variants = parseOpeningVariants(campaign.openingVariants);
                                            const sent = campaign.openingsSentCount ?? 0;
                                            const cyclePos = variants.length > 0 ? (sent % variants.length) + 1 : 0;
                                            const isOpen = !!openingsPanelOpen[campaign.id];
                                            const editText = openingsEditText[campaign.id] ?? "";
                                            const editCount = openingsEditCount[campaign.id] ?? 30;
                                            const editLoading = !!openingsEditLoading[campaign.id];
                                            const editError = openingsEditError[campaign.id];
                                            return (
                                                <div className="flex flex-col gap-2 text-xs pt-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-muted-foreground shrink-0">🎭 冒頭バリエーション:</span>
                                                        {variants.length > 0 ? (
                                                            <>
                                                                <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-xs font-bold border border-amber-500/30">
                                                                    {variants.length} 通り
                                                                </span>
                                                                <span className="text-muted-foreground/70 text-[10px]">
                                                                    次回送信: {cyclePos}/{variants.length}（送信済 {sent}）
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-muted-foreground/70 text-[10px]">未設定（共通CTA本文のみ送信）</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleOpeningsPanel(campaign)}
                                                            className="text-[11px] underline text-blue-400 hover:text-blue-300 ml-1"
                                                        >
                                                            {isOpen ? "閉じる" : "編集"}
                                                        </button>
                                                    </div>
                                                    {isOpen && (
                                                        <div className="border border-amber-500/20 bg-amber-500/5 rounded-md p-3 space-y-2">
                                                            <p className="text-[11px] text-muted-foreground">
                                                                1行＝1バリエーション。保存すると循環カウンタは 0 にリセットされます（差し替え後の先頭から送信）。
                                                            </p>
                                                            <textarea
                                                                value={editText}
                                                                onChange={(e) => setOpeningsEditText(prev => ({ ...prev, [campaign.id]: e.target.value }))}
                                                                rows={5}
                                                                className="w-full min-h-[6rem] border border-input bg-background px-3 py-2 text-xs rounded-md resize-y"
                                                                placeholder={`いいねありがとうございます！\nリポストありがとうございます🙌`}
                                                            />
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <label className="text-[11px] text-muted-foreground">AI で量産:</label>
                                                                <select
                                                                    value={editCount}
                                                                    onChange={(e) => setOpeningsEditCount(prev => ({ ...prev, [campaign.id]: Number(e.target.value) }))}
                                                                    className="h-7 border border-input bg-background px-2 py-0.5 text-[11px] rounded-md cursor-pointer"
                                                                >
                                                                    {[10, 20, 30, 50, 80, 100].map(n => <option key={n} value={n}>{n}通り</option>)}
                                                                </select>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={() => handleGenerateOpeningsForExisting(campaign)}
                                                                    disabled={editLoading}
                                                                    className="h-7 text-[11px]"
                                                                >
                                                                    {editLoading ? "処理中..." : "✨ AI で量産"}
                                                                </Button>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    現在: {linesToVariants(editText).length} 通り
                                                                </span>
                                                                <Button
                                                                    type="button"
                                                                    onClick={() => handleSaveOpenings(campaign)}
                                                                    disabled={editLoading}
                                                                    className="h-7 text-[11px] ml-auto"
                                                                >
                                                                    保存
                                                                </Button>
                                                            </div>
                                                            {editError && <p className="text-[11px] text-red-400">{editError}</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <div className="w-full md:w-1/3 bg-white/5 p-3 rounded-md border border-white/10 text-sm text-foreground/80 max-h-24 overflow-y-auto">
                                        <div className="font-semibold text-xs text-muted-foreground mb-1 border-b border-white/10 pb-1">送信内容プレビュー</div>
                                        <p className="whitespace-pre-wrap">{campaign.replyContent}</p>
                                    </div>

                                    <div className="flex md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0 justify-end">
                                        {effectiveActive && (
                                            <Button
                                                variant="outline"
                                                onClick={() => handleRunNow(campaign.id)}
                                                disabled={!!runNowLoading[campaign.id]}
                                                className="border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                                                title="チェック間隔を待たずに今すぐ実行し、結果ログを表示します（条件に合えば実際にリプライも送信されます）"
                                            >
                                                {runNowLoading[campaign.id] ? "実行中..." : "▶ 今すぐ実行"}
                                            </Button>
                                        )}
                                        <Button
                                            variant={effectiveActive ? "outline" : "default"}
                                            onClick={() => {
                                                if (isExpired && !campaign.isActive) {
                                                    toast.error("このキャンペーンは終了日時を過ぎています。再開するには終了日時を未来の時刻に更新してください。");
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

                                {/* 手動実行の結果ログ */}
                                {runNowLogs[campaign.id] && (
                                    <div className="mx-5 mb-5 -mt-2 rounded-md border border-emerald-500/20 bg-black/30 p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-emerald-400">▶ 実行ログ（最新）</span>
                                            <button
                                                type="button"
                                                onClick={() => setRunNowLogs(prev => ({ ...prev, [campaign.id]: null }))}
                                                className="text-[11px] text-muted-foreground hover:text-foreground"
                                            >
                                                閉じる
                                            </button>
                                        </div>
                                        <pre className="text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
{(runNowLogs[campaign.id] || []).join("\n")}
                                        </pre>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            「Liked users found: N」が0なら、対象ポストURLが正しいか／別アカで本当にいいねしたかを確認してください。
                                            「API Error」が出る場合はそのアカウントのXキー/プランをご確認ください。
                                        </p>
                                    </div>
                                )}
                            </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
