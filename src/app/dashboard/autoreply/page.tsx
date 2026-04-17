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
    createdAt: string;
}

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
                        replyType: newReplyType
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
                                <label className="text-sm font-medium text-foreground/80 block mb-1">監視対象のポストURL（またはポストID）</label>
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
                        </div>

                        <div>
                            <label className="text-sm font-medium text-foreground/80 block mb-2">送信方式の選択</label>
                            <div className="space-y-2">
                                <label className={`flex items-center gap-3 cursor-pointer p-3 border rounded-md transition-colors ${newReplyType === 'REPLY' ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                                    <input type="radio" value="REPLY" checked={newReplyType === 'REPLY'} onChange={(e) => setNewReplyType(e.target.value)} className="w-5 h-5 focus:ring-blue-500" />
                                    <div>
                                        <span className="text-sm font-bold block text-foreground">💬 通常リプライ</span>
                                        <span className="text-xs text-muted-foreground block">監視対象のポストのツリー上にそのまま公開リプライとしてぶら下げます。</span>
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
                                ※スパム判定を避けるため、実際の送信時はシステムのAIが文末などにランダムな絵文字や微小な揺らぎを自動付与して送信します。
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
                        {campaigns.map((campaign) => (
                            <Card key={campaign.id} className={`transition-all ${campaign.isActive ? 'border-l-4 border-l-green-500' : 'opacity-70 border-l-4 border-l-gray-300'}`}>
                                <CardContent className="p-5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-lg text-foreground">{campaign.name}</h4>
                                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${campaign.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-muted-foreground'}`}>
                                                {campaign.isActive ? '🟢 稼働中 (監視中)' : '⚫️ 停止中'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-foreground/80 bg-white/5 p-2 rounded max-w-xl truncate border border-white/10">
                                            <span className="font-semibold">対象:</span> <a href={campaign.targetUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{campaign.targetUrl}</a>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="font-semibold text-foreground/80">条件:</span>
                                            <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/30">
                                                {renderTriggerLabels(campaign)}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${campaign.replyType === 'DM' ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' : campaign.replyType === 'MENTION' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-white/10 text-muted-foreground border-white/20'}`}>
                                                {campaign.replyType === 'DM' ? '✉️ DM' : campaign.replyType === 'MENTION' ? '🤫 メンション' : '💬 通常リプライ'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="w-full md:w-1/3 bg-white/5 p-3 rounded-md border border-white/10 text-sm text-foreground/80 max-h-24 overflow-y-auto">
                                        <div className="font-semibold text-xs text-muted-foreground mb-1 border-b border-white/10 pb-1">送信内容プレビュー</div>
                                        <p className="whitespace-pre-wrap">{campaign.replyContent}</p>
                                    </div>

                                    <div className="flex md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0 justify-end">
                                        <Button
                                            variant={campaign.isActive ? "outline" : "default"}
                                            onClick={() => handleToggleActive(campaign.id, campaign.isActive)}
                                            className={campaign.isActive ? "border-red-500/50 hover:bg-red-500/10 hover:text-red-400" : ""}
                                        >
                                            {campaign.isActive ? "監視を停止" : "監視を再開"}
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
