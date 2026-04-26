"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ThreadStyle = "chain" | "impression_triggered";

type EditForm = {
    content: string;
    threadContents: string[];
    threadStyle: ThreadStyle;
    impressionTarget: string; // 入力欄用に string で保持
    impressionReplyContent: string;
};

type PostData = {
    id: string;
    content: string;
    platform: string;
    status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | string;
    scheduledAt: string | null;
    createdAt: string;
    mediaUrls: string | null;           // JSON 文字列（配列）
    threadContents: string | null;      // JSON 文字列（配列）
    threadStyle?: ThreadStyle | string;
    impressionTarget: number | null;
    impressionReplyContent: string | null;
    postedTweetId?: string | null;
    isImpressionReplySent?: boolean;
};

export default function SchedulePage() {
    const [posts, setPosts] = useState<PostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState<string | null>(null);
    const [schedulingDates, setSchedulingDates] = useState<Record<string, string>>({});

    // 編集関連のステート
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({
        content: "",
        threadContents: [],
        threadStyle: "chain",
        impressionTarget: "",
        impressionReplyContent: ""
    });
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/posts");
            if (res.ok) {
                const data = await res.json();
                setPosts(data);
            }
        } catch (error) {
            console.error("Failed to fetch posts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePublishNow = async (id: string) => {
        if (!confirm("本当にこの内容を今すぐX(Twitter)へ投稿しますか？")) return;

        setPublishing(id);
        try {
            const res = await fetch(`/api/posts/${id}/publish`, {
                method: "POST"
            });
            const result = await res.json();

            if (res.ok) {
                alert("✅ 投稿に成功しました！");
                fetchPosts(); // リストを更新
            } else {
                alert(`❌ 投稿に失敗しました: ${result.message}`);
            }
        } catch (error) {
            console.error("Publish error:", error);
            alert("エラーが発生しました。");
        } finally {
            setPublishing(null);
        }
    };

    const handleSchedule = async (id: string) => {
        const dateStr = schedulingDates[id];
        if (!dateStr) {
            alert("予約日時を選択してください。");
            return;
        }

        const scheduledAt = new Date(dateStr);
        if (scheduledAt <= new Date()) {
            alert("未来の日時を指定してください。");
            return;
        }

        if (!confirm(`${scheduledAt.toLocaleString()} に予約投稿します。よろしいですか？`)) return;

        setPublishing(id);
        try {
            const res = await fetch(`/api/posts/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() })
            });

            if (res.ok) {
                alert("✅ 予約に成功しました！");
                fetchPosts();
            } else {
                const result = await res.json();
                alert(`❌ 予約に失敗しました: ${result.message}`);
            }
        } catch (error) {
            console.error("Schedule error:", error);
            alert("エラーが発生しました。");
        } finally {
            setPublishing(null);
        }
    };

    const handleDateChange = (id: string, value: string) => {
        setSchedulingDates(prev => ({ ...prev, [id]: value }));
    };

    // --- 編集フロー ---
    const parseThreadContents = (raw: unknown): string[] => {
        if (!raw || typeof raw !== "string") return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
        } catch {
            return [];
        }
    };

    const handleStartEdit = (post: PostData) => {
        setEditingId(post.id);
        setEditForm({
            content: post.content ?? "",
            threadContents: parseThreadContents(post.threadContents),
            threadStyle: post.threadStyle === "impression_triggered" ? "impression_triggered" : "chain",
            impressionTarget: post.impressionTarget != null ? String(post.impressionTarget) : "",
            impressionReplyContent: post.impressionReplyContent ?? ""
        });
    };

    const handleCancelEdit = () => {
        if (savingEdit) return;
        setEditingId(null);
        setEditForm({ content: "", threadContents: [], threadStyle: "chain", impressionTarget: "", impressionReplyContent: "" });
    };

    const handleEditContentChange = (value: string) => {
        setEditForm(prev => ({ ...prev, content: value }));
    };

    const handleEditThreadChange = (index: number, value: string) => {
        setEditForm(prev => {
            const next = [...prev.threadContents];
            next[index] = value;
            return { ...prev, threadContents: next };
        });
    };

    const handleAddThread = () => {
        setEditForm(prev => ({ ...prev, threadContents: [...prev.threadContents, ""] }));
    };

    const handleRemoveThread = (index: number) => {
        setEditForm(prev => {
            const next = [...prev.threadContents];
            next.splice(index, 1);
            return { ...prev, threadContents: next };
        });
    };

    const handleEditImpressionTargetChange = (value: string) => {
        setEditForm(prev => ({ ...prev, impressionTarget: value }));
    };

    const handleEditImpressionReplyChange = (value: string) => {
        setEditForm(prev => ({ ...prev, impressionReplyContent: value }));
    };

    const handleSaveEdit = async (id: string) => {
        if (!editForm.content || editForm.content.trim().length === 0) {
            alert("投稿本文は空にできません。");
            return;
        }

        // impressionTarget の数値バリデーション
        let impressionTargetPayload: number | null = null;
        const rawImp = editForm.impressionTarget.trim();
        if (rawImp.length > 0) {
            const n = Number(rawImp);
            if (!Number.isFinite(n) || n < 0) {
                alert("インプレッション目標値は0以上の数値を指定してください。");
                return;
            }
            impressionTargetPayload = Math.floor(n);
        }

        // インプ連動を使うならリプライ内容も必須、どちらか片方は不可とする
        const hasImpTarget = impressionTargetPayload !== null;
        const hasImpReply = editForm.impressionReplyContent.trim().length > 0;
        if (hasImpTarget !== hasImpReply) {
            if (!confirm("インプレッション連動の目標値とリプライ内容は両方セットする必要があります。片方のみでは発動しません。そのまま保存しますか？")) {
                return;
            }
        }

        // impression_triggered を選んでいる場合、目標インプ数が必須
        if (editForm.threadContents.length > 0 && editForm.threadStyle === "impression_triggered" && !hasImpTarget) {
            alert("「📈 一定インプ達成後に送信」を選択する場合は、目標インプ数の入力が必須です。");
            return;
        }

        setSavingEdit(true);
        try {
            const body = {
                content: editForm.content,
                threadContents: editForm.threadContents
                    .map(t => t.trim())
                    .filter(t => t.length > 0),
                threadStyle: editForm.threadStyle,
                impressionTarget: impressionTargetPayload,
                impressionReplyContent: editForm.impressionReplyContent.trim() || null
            };

            const res = await fetch(`/api/posts/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                alert("✅ 編集を保存しました。");
                setEditingId(null);
                setEditForm({ content: "", threadContents: [], threadStyle: "chain", impressionTarget: "", impressionReplyContent: "" });
                fetchPosts();
            } else {
                const result = await res.json();
                alert(`❌ 保存に失敗しました: ${result.message}`);
            }
        } catch (error) {
            console.error("Edit save error:", error);
            alert("エラーが発生しました。");
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">投稿スケジューラー</h2>
                    <p className="text-muted-foreground mt-2">
                        生成された投稿の確認や、X(Twitter)への即時投稿・予約配信を行います。
                    </p>
                </div>
                <Button variant="outline" onClick={fetchPosts} disabled={loading}>
                    🔄 最新の情報に更新
                </Button>
            </div>

            {loading ? (
                <div className="py-12 text-center text-muted-foreground">データを読み込み中...</div>
            ) : posts.length === 0 ? (
                <div className="mt-12 text-center text-muted-foreground py-12 border-2 border-dashed rounded-lg">
                    保存された投稿がありません。「投稿生成」からAIに投稿を作成させてください。
                </div>
            ) : (
                <div className="grid gap-6">
                    {posts.map((post) => {
                        const isEditing = editingId === post.id;
                        const canEdit = post.status !== 'PUBLISHED';

                        return (
                            <Card key={post.id} className={post.status === 'PUBLISHED' ? "bg-white/5 opacity-80" : ""}>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                {post.platform} 用投稿
                                                {post.status === 'DRAFT' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">承認待ち (下書き)</Badge>}
                                                {post.status === 'SCHEDULED' && <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">予約済み</Badge>}
                                                {post.status === 'PUBLISHED' && <Badge variant="default" className="bg-green-600 hover:bg-green-600">投稿完了</Badge>}
                                                {isEditing && <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-100">編集中</Badge>}
                                            </CardTitle>
                                            <CardDescription className="mt-1 flex flex-col gap-1">
                                                <span>作成日時: {new Date(post.createdAt).toLocaleString()}</span>
                                                {post.scheduledAt && (
                                                    <span className="text-blue-600 font-medium">
                                                        予約日時: {new Date(post.scheduledAt).toLocaleString()}
                                                    </span>
                                                )}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    {/* 投稿本文 */}
                                    {isEditing ? (
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-muted-foreground">投稿本文</label>
                                            <textarea
                                                className="w-full min-h-[140px] bg-white/5 p-4 rounded-md border border-white/10 text-foreground text-sm whitespace-pre-wrap shadow-inner resize-y"
                                                value={editForm.content}
                                                onChange={(e) => handleEditContentChange(e.target.value)}
                                                disabled={savingEdit}
                                                placeholder="投稿本文を入力"
                                            />
                                            <div className="text-right text-xs text-muted-foreground">
                                                {editForm.content.length} 文字
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white/5 p-4 rounded-md border border-white/10 text-foreground/80 whitespace-pre-wrap text-sm shadow-inner">
                                            {post.content}
                                        </div>
                                    )}

                                    {/* 添付画像の表示（編集モードでは表示のみ。差し替えは今回スコープ外） */}
                                    {post.mediaUrls && JSON.parse(post.mediaUrls).length > 0 && (
                                        <div>
                                            {isEditing && (
                                                <label className="text-xs font-semibold text-muted-foreground">添付画像（編集不可）</label>
                                            )}
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {JSON.parse(post.mediaUrls).map((url: string, i: number) => (
                                                    <div key={i} className="w-24 h-24 border border-white/10 rounded-md overflow-hidden bg-white/5 shrink-0">
                                                        <img src={url} alt={`media-${i}`} className="object-cover w-full h-full" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* スレッド投稿 */}
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-xs font-semibold text-muted-foreground">🌲 続くスレッド投稿</label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleAddThread}
                                                    disabled={savingEdit}
                                                >
                                                    + スレッド追加
                                                </Button>
                                            </div>
                                            {editForm.threadContents.length === 0 && (
                                                <p className="text-xs text-muted-foreground italic">スレッドはまだありません。</p>
                                            )}

                                            {/* スレッドスタイル切替 */}
                                            {editForm.threadContents.length > 0 && (
                                                <div className="flex flex-col gap-3 p-3 bg-white/5 border border-white/10 rounded-md">
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                        <span className="text-xs font-semibold text-muted-foreground shrink-0">送信タイミング:</span>
                                                        <div className="flex gap-2 flex-wrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditForm(prev => ({ ...prev, threadStyle: "chain" }))}
                                                                disabled={savingEdit}
                                                                className={`text-xs px-3 py-1.5 rounded-md border transition-colors font-semibold ${editForm.threadStyle === "chain"
                                                                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                                                            >
                                                                🔗 投稿時に即リプ連鎖
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditForm(prev => ({ ...prev, threadStyle: "impression_triggered" }))}
                                                                disabled={savingEdit}
                                                                className={`text-xs px-3 py-1.5 rounded-md border transition-colors font-semibold ${editForm.threadStyle === "impression_triggered"
                                                                    ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                                                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                                                            >
                                                                📈 一定インプ達成後に送信
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                                                        {editForm.threadStyle === "chain"
                                                            ? "元ポストに続けて案1→案2→案3 の順でリプ連鎖で今すぐ投稿します。"
                                                            : "元ポストのみ先に投稿し、下で指定した目標インプ数を超えた時点で、続きの案をリプ連鎖で自動送信します。"}
                                                    </p>

                                                    {/* impression_triggered 選択時のインライン入力 */}
                                                    {editForm.threadStyle === "impression_triggered" && (
                                                        <div className="space-y-1.5 pt-2 border-t border-white/10">
                                                            <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                                                                🎯 目標インプレッション数
                                                                <span className="text-[10px] text-rose-500 font-bold">*必須</span>
                                                            </label>
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    step={100}
                                                                    className="flex-1 text-sm p-2 bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
                                                                    value={editForm.impressionTarget}
                                                                    onChange={(e) => handleEditImpressionTargetChange(e.target.value)}
                                                                    disabled={savingEdit}
                                                                    placeholder="例: 10000"
                                                                />
                                                                <span className="text-xs text-muted-foreground shrink-0">imp 超えたら送信</span>
                                                            </div>
                                                            <p className="text-[11px] text-muted-foreground/80">
                                                                15分ごとに cron が元ポストのインプ数をチェックし、この値を超えた瞬間に続きのリプが自動で投稿されます。
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {editForm.threadContents.map((t, i) => (
                                                <div key={i} className="pl-4 border-l-2 border-purple-500/30 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-bold text-purple-400">#{i + 2}</span>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleRemoveThread(i)}
                                                            disabled={savingEdit}
                                                        >
                                                            削除
                                                        </Button>
                                                    </div>
                                                    <textarea
                                                        className="w-full min-h-[80px] bg-white/5 p-3 rounded-md border border-white/10 text-foreground text-sm whitespace-pre-wrap resize-y"
                                                        value={t}
                                                        onChange={(e) => handleEditThreadChange(i, e.target.value)}
                                                        disabled={savingEdit}
                                                        placeholder={`スレッド投稿 #${i + 2} の内容`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        post.threadContents && JSON.parse(post.threadContents).length > 0 && (
                                            <div className="pl-4 border-l-2 border-purple-500/30 space-y-2">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <p className="text-xs font-bold text-purple-400">🌲 続くスレッド投稿</p>
                                                    <Badge variant="secondary" className={post.threadStyle === "impression_triggered"
                                                        ? "bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]"
                                                        : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]"}>
                                                        {post.threadStyle === "impression_triggered" ? "📈 一定インプ達成後に送信" : "🔗 投稿時に即リプ連鎖"}
                                                    </Badge>
                                                </div>
                                                {JSON.parse(post.threadContents).map((t: string, i: number) => (
                                                    <div key={i} className="bg-white/5 p-3 rounded-md border border-white/10 text-sm text-foreground/80 whitespace-pre-wrap">
                                                        <span className="text-purple-400 font-bold mr-2">#{i + 2}</span>{t}
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    )}

                                    {/* インプレッション連動 */}
                                    {isEditing ? (
                                        <div className="bg-blue-500/10 p-3 rounded-md border border-blue-500/20 mt-2 space-y-3">
                                            <p className="text-xs font-bold text-blue-400">🚀 インプレッション連動リプライ</p>
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-blue-300 shrink-0">目標インプ数:</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step={100}
                                                    className="w-40 bg-white/5 p-2 rounded-md border border-white/10 text-foreground text-sm"
                                                    value={editForm.impressionTarget}
                                                    onChange={(e) => handleEditImpressionTargetChange(e.target.value)}
                                                    disabled={savingEdit}
                                                    placeholder="例: 10000"
                                                />
                                                <span className="text-xs text-blue-300">imp を突破したら発動</span>
                                            </div>
                                            <textarea
                                                className="w-full min-h-[80px] bg-white/5 p-3 rounded-md border border-white/10 text-foreground text-sm whitespace-pre-wrap resize-y"
                                                value={editForm.impressionReplyContent}
                                                onChange={(e) => handleEditImpressionReplyChange(e.target.value)}
                                                disabled={savingEdit}
                                                placeholder="インプレッション到達時にぶら下げるリプライ内容（URLなど）"
                                            />
                                            <p className="text-[11px] text-blue-300/80">
                                                目標値とリプライ内容は両方セットしてください。どちらか一方だけでは発動しません。
                                            </p>
                                        </div>
                                    ) : (
                                        post.impressionTarget && post.impressionReplyContent && (
                                            <div className="bg-blue-500/10 p-3 rounded-md border border-blue-500/20 mt-2">
                                                <p className="text-xs font-bold text-blue-400 mb-1">🚀 インプレッション連動リプライ</p>
                                                <p className="text-xs text-blue-300 mb-2">このポストが <span className="font-bold text-lg">{post.impressionTarget}</span> imp を突破した時に自動で以下のリプライをぶら下げます。</p>
                                                <div className="bg-white/5 p-2 border border-white/10 rounded-sm text-sm whitespace-pre-wrap text-foreground/80">
                                                    {post.impressionReplyContent}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </CardContent>

                                <CardFooter className="flex flex-col md:flex-row justify-end gap-3 pt-2">
                                    {isEditing ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                disabled={savingEdit}
                                                onClick={handleCancelEdit}
                                            >
                                                キャンセル
                                            </Button>
                                            <Button
                                                variant="default"
                                                disabled={savingEdit}
                                                onClick={() => handleSaveEdit(post.id)}
                                            >
                                                {savingEdit ? "保存中..." : "💾 編集を保存"}
                                            </Button>
                                        </>
                                    ) : (
                                        canEdit && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    className="mr-auto"
                                                    disabled={publishing === post.id || editingId !== null}
                                                    onClick={() => handleStartEdit(post)}
                                                >
                                                    ✏️ 編集
                                                </Button>
                                                <div className="flex items-center gap-2 mb-2 md:mb-0">
                                                    <input
                                                        type="datetime-local"
                                                        className="border border-white/10 bg-white/5 shadow-sm rounded-md px-3 py-2 text-sm text-foreground"
                                                        value={schedulingDates[post.id] || (post.scheduledAt ? new Date(new Date(post.scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "")}
                                                        onChange={(e) => handleDateChange(post.id, e.target.value)}
                                                        disabled={publishing === post.id || editingId !== null}
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        disabled={publishing === post.id || !schedulingDates[post.id] || editingId !== null}
                                                        onClick={() => handleSchedule(post.id)}
                                                    >
                                                        日時を指定して予約
                                                    </Button>
                                                </div>
                                                <Button
                                                    variant="default"
                                                    className="bg-black hover:bg-gray-800"
                                                    disabled={publishing === post.id || editingId !== null}
                                                    onClick={() => handlePublishNow(post.id)}
                                                >
                                                    {publishing === post.id ? "投稿中..." : "𝕏 今すぐポストする"}
                                                </Button>
                                            </>
                                        )
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
