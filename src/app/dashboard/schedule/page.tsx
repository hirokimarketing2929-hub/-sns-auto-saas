"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SchedulePage() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState<string | null>(null);
    const [schedulingDates, setSchedulingDates] = useState<Record<string, string>>({});

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
                    {posts.map((post) => (
                        <Card key={post.id} className={post.status === 'PUBLISHED' ? "bg-white/5 opacity-80" : ""}>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {post.platform} 用投稿
                                            {post.status === 'DRAFT' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">承認待ち (下書き)</Badge>}
                                            {post.status === 'SCHEDULED' && <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">予約済み</Badge>}
                                            {post.status === 'PUBLISHED' && <Badge variant="default" className="bg-green-600 hover:bg-green-600">投稿完了</Badge>}
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
                                <div className="bg-white/5 p-4 rounded-md border border-white/10 text-foreground/80 whitespace-pre-wrap text-sm shadow-inner">
                                    {post.content}
                                </div>

                                {/* 添付画像の表示 */}
                                {post.mediaUrls && JSON.parse(post.mediaUrls).length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {JSON.parse(post.mediaUrls).map((url: string, i: number) => (
                                            <div key={i} className="w-24 h-24 border border-white/10 rounded-md overflow-hidden bg-white/5 shrink-0">
                                                <img src={url} alt={`media-${i}`} className="object-cover w-full h-full" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ツリー投稿の表示 */}
                                {post.threadContents && JSON.parse(post.threadContents).length > 0 && (
                                    <div className="pl-4 border-l-2 border-purple-500/30 space-y-2">
                                        <p className="text-xs font-bold text-purple-400 mb-1">🌲 続くスレッド投稿</p>
                                        {JSON.parse(post.threadContents).map((t: string, i: number) => (
                                            <div key={i} className="bg-white/5 p-3 rounded-md border border-white/10 text-sm text-foreground/80 whitespace-pre-wrap">
                                                <span className="text-purple-400 font-bold mr-2">#{i + 2}</span>{t}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* インプレッション連動の表示 */}
                                {post.impressionTarget && post.impressionReplyContent && (
                                    <div className="bg-blue-500/10 p-3 rounded-md border border-blue-500/20 mt-2">
                                        <p className="text-xs font-bold text-blue-400 mb-1">🚀 インプレッション連動リプライ</p>
                                        <p className="text-xs text-blue-300 mb-2">このポストが <span className="font-bold text-lg">{post.impressionTarget}</span> imp を突破した時に自動で以下のリプライをぶら下げます。</p>
                                        <div className="bg-white/5 p-2 border border-white/10 rounded-sm text-sm whitespace-pre-wrap text-foreground/80">
                                            {post.impressionReplyContent}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex flex-col md:flex-row justify-end gap-3 pt-2">
                                {post.status !== 'PUBLISHED' && (
                                    <>
                                        <div className="flex items-center gap-2 mr-auto mb-2 md:mb-0">
                                            <input
                                                type="datetime-local"
                                                className="border border-white/10 bg-white/5 shadow-sm rounded-md px-3 py-2 text-sm text-foreground"
                                                value={schedulingDates[post.id] || (post.scheduledAt ? new Date(new Date(post.scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "")}
                                                onChange={(e) => handleDateChange(post.id, e.target.value)}
                                                disabled={publishing === post.id}
                                            />
                                            <Button
                                                variant="outline"
                                                disabled={publishing === post.id || !schedulingDates[post.id]}
                                                onClick={() => handleSchedule(post.id)}
                                            >
                                                日時を指定して予約
                                            </Button>
                                        </div>
                                        <Button
                                            variant="default"
                                            className="bg-black hover:bg-gray-800"
                                            disabled={publishing === post.id}
                                            onClick={() => handlePublishNow(post.id)}
                                        >
                                            {publishing === post.id ? "投稿中..." : "𝕏 今すぐポストする"}
                                        </Button>
                                    </>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
