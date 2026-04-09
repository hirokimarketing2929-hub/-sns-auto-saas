"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AnalysisPage() {
    const [loading, setLoading] = useState(false);
    const [posts, setPosts] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);

    useEffect(() => {
        fetchPosts();
        fetchSettings();
    }, []);

    const fetchPosts = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/past-posts");
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

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        }
    };

    const handleSyncFromX = async () => {
        setIsSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch("/api/past-posts/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();

            if (res.ok) {
                setSyncResult({
                    type: "success",
                    message: data.message,
                    detail: "ポジティブ: " + (data.classified?.positive || 0) + "件 / ネガティブ: " + (data.classified?.negative || 0) + "件"
                });
                fetchPosts();
            } else {
                setSyncResult({
                    type: "error",
                    message: data.message || "同期に失敗しました"
                });
            }
        } catch (error) {
            console.error("Sync error:", error);
            setSyncResult({
                type: "error",
                message: "同期中に予期せぬエラーが発生しました"
            });
        } finally {
            setIsSyncing(false);
        }
    };

    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyzeAll = async () => {
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/analyze", {
                method: "POST"
            });
            const data = await res.json();

            if (res.ok) {
                setSyncResult({
                    type: "success",
                    message: "分析が完了しました！ 新たに " + data.count + " 個のナレッジが「ナレッジベース」に追加されました。"
                });
            } else {
                setSyncResult({
                    type: "error",
                    message: "エラー: " + data.message
                });
            }
        } catch (error) {
            console.error("Analyze error:", error);
            setSyncResult({
                type: "error",
                message: "分析中に予期せぬエラーが発生しました"
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const positivePosts = posts.filter(p => p.analysisStatus === "POSITIVE");
    const negativePosts = posts.filter(p => p.analysisStatus === "NEGATIVE");
    const unanalyzedPosts = posts.filter(p => p.analysisStatus === "UNANALYZED");

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">データ分析（ポジティブ/ネガティブ）</h2>
                    <p className="text-muted-foreground mt-2">
                        連携済みXアカウントの過去ポストを取得し、インプレッション数でAIが「成功パターン」と「失敗パターン」を自動分類します。
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <Button
                    onClick={handleSyncFromX}
                    disabled={isSyncing}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    {isSyncing ? "同期中..." : "Xから過去ポストを同期"}
                </Button>
                <Button
                    onClick={handleAnalyzeAll}
                    disabled={posts.length === 0 || isAnalyzing}
                    className="bg-indigo-600 hover:bg-indigo-700"
                >
                    {isAnalyzing ? "分析中..." : "フルオートAI分析を実行"}
                </Button>
            </div>

            {syncResult && (
                <div className={
                    "p-4 rounded-md text-sm " +
                    (syncResult.type === "success"
                        ? "bg-green-50 border border-green-200 text-green-800"
                        : "bg-red-50 border border-red-200 text-red-800")
                }>
                    <div className="font-semibold">{syncResult.message}</div>
                    {syncResult.detail && <div className="mt-1 text-xs">{syncResult.detail}</div>}
                </div>
            )}

            {settings && (
                <div className="bg-gray-50 border p-4 rounded-md text-sm text-gray-700">
                    <strong>【現在の判定しきい値】</strong> インプレッション: {settings.thresholdImpression ?? 1000} 以上の場合に「ポジティブ」と判定し、成功法則を抽出します。 (※設定画面で変更可能)
                </div>
            )}

            {posts.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-700">{positivePosts.length}</div>
                        <div className="text-sm text-green-600">ポジティブ</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">{negativePosts.length}</div>
                        <div className="text-sm text-red-600">ネガティブ</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-gray-700">{unanalyzedPosts.length}</div>
                        <div className="text-sm text-gray-600">未分析</div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-10">データ読込中...</div>
            ) : posts.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <div className="text-4xl mb-4">&#x1F426;</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">過去のポストデータがありません</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        上の「Xから過去ポストを同期」ボタンを押して、連携済みXアカウントから過去の投稿を取得してください。
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                    <Card className="border-green-200">
                        <CardHeader className="bg-green-50 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-green-800">ポジティブリポジトリ</CardTitle>
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                    {positivePosts.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-green-600">しきい値をクリアし、成功法則の抽出元となる投稿群</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4 max-h-[600px] overflow-y-auto">
                            {positivePosts.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">該当するポストがありません</p> : null}
                            {positivePosts.map(post => (
                                <div key={post.id} className="p-3 border rounded-md shadow-sm bg-white">
                                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</div>
                                    <div className="flex justify-between mt-3 text-xs text-gray-500 border-t pt-2">
                                        <span className="font-semibold text-blue-600">IMP: {post.impressions?.toLocaleString()}</span>
                                        <span className="font-semibold text-orange-600">ENG: {post.conversions?.toLocaleString()}</span>
                                        <span>{new Date(post.postedAt).toLocaleDateString("ja-JP")}</span>
                                    </div>
                                    {post.externalId && (
                                        <div className="mt-1 text-right">
                                            <a href={"https://x.com/i/status/" + post.externalId} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                                                Xで見る
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-red-200">
                        <CardHeader className="bg-red-50 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-red-800">ネガティブリポジトリ</CardTitle>
                                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                                    {negativePosts.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-red-600">反応が悪く、禁止ルールの抽出元となる投稿群</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4 max-h-[600px] overflow-y-auto">
                            {negativePosts.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">該当するポストがありません</p> : null}
                            {negativePosts.map(post => (
                                <div key={post.id} className="p-3 border rounded-md shadow-sm bg-white">
                                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</div>
                                    <div className="flex justify-between mt-3 text-xs text-gray-500 border-t pt-2">
                                        <span className="font-semibold text-blue-600">IMP: {post.impressions?.toLocaleString()}</span>
                                        <span className="font-semibold text-orange-600">ENG: {post.conversions?.toLocaleString()}</span>
                                        <span>{new Date(post.postedAt).toLocaleDateString("ja-JP")}</span>
                                    </div>
                                    {post.externalId && (
                                        <div className="mt-1 text-right">
                                            <a href={"https://x.com/i/status/" + post.externalId} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                                                Xで見る
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AnalysisPage() {
    const [loading, setLoading] = useState(false);
    const [posts, setPosts] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        fetchPosts();
        fetchSettings();
    }, []);

    const fetchPosts = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/past-posts");
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

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        }
    };

    const handleSeedDemodata = async () => {
        try {
            await fetch("/api/past-posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "seed" })
            });
            fetchPosts();
        } catch (error) {
            console.error("Seed error", error);
        }
    };

    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyzeAll = async () => {
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/analyze", {
                method: "POST"
            });
            const data = await res.json();

            if (res.ok) {
                alert(`分析が完了しました！\n新たに ${data.count} 個のナレッジが「ナレッジベース」に追加されました。`);
            } else {
                alert(`エラー: ${data.message}`);
            }
        } catch (error) {
            console.error("Analyze error:", error);
            alert("分析中に予期せぬエラーが発生しました");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 分類
    const positivePosts = posts.filter(p => p.analysisStatus === "POSITIVE");
    const negativePosts = posts.filter(p => p.analysisStatus === "NEGATIVE");
    const unanalyzedPosts = posts.filter(p => p.analysisStatus === "UNANALYZED");

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">データ分析（ポジティブ/ネガティブ）</h2>
                    <p className="text-muted-foreground mt-2">
                        過去の投稿ポストを自動で分類し、AIが「成功パターン」と「失敗パターン」を抽出します。
                    </p>
                </div>
                <div className="flex gap-2">
                    {posts.length === 0 && (
                        <Button variant="outline" onClick={handleSeedDemodata}>デモデータを生成</Button>
                    )}
                    <Button onClick={handleAnalyzeAll} disabled={posts.length === 0 || isAnalyzing} className="bg-indigo-600">
                        {isAnalyzing ? "🧠 分析中..." : "📊 フルオートAI分析を実行"}
                    </Button>
                </div>
            </div>

            {settings && (
                <div className="bg-gray-50 border p-4 rounded-md text-sm text-gray-700">
                    <strong>【現在の判定しきい値】</strong> インプレッション: {settings.thresholdImpression} 이상 / コンバージョン: {settings.thresholdConversion} 以上の場合に「ポジティブ」と判定し、成功法則を抽出します。 (※設定画面で変更可能)
                </div>
            )}

            {loading ? (
                <div className="text-center py-10">データ読込中...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {/* ポジティブリポジトリ (成功パターン) */}
                    <Card className="border-green-200">
                        <CardHeader className="bg-green-50 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-green-800">✅ ポジティブリポジトリ</CardTitle>
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                    {positivePosts.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-green-600">しきい値をクリアし、成功法則の抽出元となる投稿群</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4 max-h-[600px] overflow-y-auto">
                            {positivePosts.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">データがありません</p> : null}
                            {positivePosts.map(post => (
                                <div key={post.id} className="p-3 border rounded-md shadow-sm bg-white">
                                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</div>
                                    <div className="flex justify-between mt-3 text-xs text-gray-500 border-t pt-2">
                                        <span className="font-semibold text-blue-600">👀 IMP: {post.impressions}</span>
                                        <span className="font-semibold text-orange-600">🛒 CV: {post.conversions}</span>
                                        <span>{new Date(post.postedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* ネガティブリポジトリ (失敗パターン) */}
                    <Card className="border-red-200">
                        <CardHeader className="bg-red-50 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-red-800">❌ ネガティブリポジトリ</CardTitle>
                                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                                    {negativePosts.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-red-600">反応が悪く、禁止ルールの抽出元となる投稿群</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4 max-h-[600px] overflow-y-auto">
                            {negativePosts.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">データがありません</p> : null}
                            {negativePosts.map(post => (
                                <div key={post.id} className="p-3 border rounded-md shadow-sm bg-white">
                                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</div>
                                    <div className="flex justify-between mt-3 text-xs text-gray-500 border-t pt-2">
                                        <span className="font-semibold text-blue-600">👀 IMP: {post.impressions}</span>
                                        <span className="font-semibold text-orange-600">🛒 CV: {post.conversions}</span>
                                        <span>{new Date(post.postedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
