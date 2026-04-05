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
