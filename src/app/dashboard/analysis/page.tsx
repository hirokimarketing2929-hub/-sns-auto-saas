"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Loader2, Brain, TrendingUp, TrendingDown, SlidersHorizontal,
    RefreshCw, Sparkles, BarChart3, CheckCircle2, AlertCircle, Download
} from "lucide-react";

type PastPost = {
    id: string;
    content: string;
    impressions: number;
    conversions: number;
    analysisStatus: string;
    postedAt: string;
    externalId?: string | null;
};

type SyncResult = {
    type: "success" | "error";
    message: string;
    detail?: string;
};

export default function AnalysisPage() {
    const [loading, setLoading] = useState(false);
    const [posts, setPosts] = useState<PastPost[]>([]);

    // 閾値設定
    const [thresholdImpression, setThresholdImpression] = useState(1000);
    const [thresholdConversion, setThresholdConversion] = useState(1);
    const [isClassifying, setIsClassifying] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [classifyResult, setClassifyResult] = useState<{ positive: number; negative: number } | null>(null);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

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
                if (data.thresholdImpression != null) setThresholdImpression(data.thresholdImpression);
                if (data.thresholdConversion != null) setThresholdConversion(data.thresholdConversion);
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        }
    };

    // Xから過去ポストを同期（連携済みXアカウントから直接取得）
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

    // 閾値に基づいてポジネガ自動分類
    const handleClassify = async () => {
        setIsClassifying(true);
        setClassifyResult(null);
        try {
            const res = await fetch("/api/past-posts/classify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ thresholdImpression, thresholdConversion })
            });
            const data = await res.json();
            if (res.ok) {
                setClassifyResult({ positive: data.positive, negative: data.negative });
                fetchPosts();
            } else {
                alert(`エラー: ${data.message}`);
            }
        } catch (error) {
            console.error("Classify error:", error);
            alert("分類中にエラーが発生しました");
        } finally {
            setIsClassifying(false);
        }
    };

    // AI分析（ナレッジ抽出）
    const handleAnalyzeAll = async () => {
        if (positivePosts.length === 0 && negativePosts.length === 0) {
            alert("まず閾値を設定して「自動分類」を実行してください。");
            return;
        }
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

    const positivePosts = posts.filter((p: PastPost) => p.analysisStatus === "POSITIVE");
    const negativePosts = posts.filter((p: PastPost) => p.analysisStatus === "NEGATIVE");
    const unanalyzedPosts = posts.filter((p: PastPost) => p.analysisStatus === "UNANALYZED");

    return (
        <div className="space-y-6 max-w-6xl">
            {/* ヘッダー */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-purple-400" />
                        データ分析
                    </h2>
                    <p className="text-muted-foreground mt-2">
                        連携済みXアカウントの過去ポストを取得し、閾値で自動分類した上で、AIが「成功パターン」と「失敗パターン」をナレッジとして抽出します。
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleSyncFromX}
                        disabled={isSyncing}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 font-bold"
                    >
                        {isSyncing ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 同期中...</>
                        ) : (
                            <><Download className="mr-2 h-4 w-4" /> Xから過去ポストを同期</>
                        )}
                    </Button>
                </div>
            </div>

            {syncResult && (
                <div className={
                    "p-4 rounded-md text-sm " +
                    (syncResult.type === "success"
                        ? "bg-green-500/10 border border-green-500/30 text-green-300"
                        : "bg-red-500/10 border border-red-500/30 text-red-300")
                }>
                    <div className="font-semibold">{syncResult.message}</div>
                    {syncResult.detail && <div className="mt-1 text-xs">{syncResult.detail}</div>}
                </div>
            )}

            {/* 閾値設定パネル */}
            <div className="glass rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <SlidersHorizontal className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-bold">ポジネガ判定の閾値設定</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    投稿のインプレッション数とコンバージョン数の閾値を設定し、自動でポジティブ/ネガティブに分類します。
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            インプレッション閾値
                        </label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={0}
                                value={thresholdImpression}
                                onChange={(e) => setThresholdImpression(Number(e.target.value))}
                                className="bg-white/5 border-white/10 text-lg font-mono"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">以上</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            コンバージョン閾値
                        </label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={0}
                                value={thresholdConversion}
                                onChange={(e) => setThresholdConversion(Number(e.target.value))}
                                className="bg-white/5 border-white/10 text-lg font-mono"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">以上</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                        onClick={handleClassify}
                        disabled={isClassifying || posts.length === 0}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 font-bold"
                    >
                        {isClassifying ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 分類中...</>
                        ) : (
                            <><RefreshCw className="mr-2 h-4 w-4" /> 閾値で自動分類する</>
                        )}
                    </Button>
                    <Button
                        onClick={handleAnalyzeAll}
                        disabled={isAnalyzing || (positivePosts.length === 0 && negativePosts.length === 0)}
                        variant="outline"
                        className="border-purple-500/30 hover:bg-purple-500/10 font-bold"
                    >
                        {isAnalyzing ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> AI分析中...</>
                        ) : (
                            <><Brain className="mr-2 h-4 w-4" /> AIでナレッジ抽出</>
                        )}
                    </Button>
                </div>

                {classifyResult && (
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                        <span className="text-sm text-green-300">
                            分類完了: ポジティブ {classifyResult.positive}件 / ネガティブ {classifyResult.negative}件
                        </span>
                    </div>
                )}
            </div>

            {/* ステータスサマリー */}
            <div className="grid grid-cols-3 gap-4">
                <div className="glass rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{positivePosts.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">ポジティブ</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-red-400">{negativePosts.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">ネガティブ</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-gray-400">{unanalyzedPosts.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">未分類</div>
                </div>
            </div>

            {/* 投稿リスト */}
            {loading ? (
                <div className="text-center py-10 text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> データ読込中...
                </div>
            ) : posts.length === 0 ? (
                <div className="glass rounded-xl p-10 text-center space-y-3">
                    <AlertCircle className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                    <p className="text-lg font-medium text-muted-foreground">分析データがありません</p>
                    <p className="text-sm text-muted-foreground/70">
                        上の「Xから過去ポストを同期」ボタンを押して、連携済みXアカウントから過去の投稿を取得してください。
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                    {/* ポジティブリポジトリ */}
                    <div className="glass rounded-xl overflow-hidden border border-emerald-500/20">
                        <div className="bg-emerald-500/10 px-5 py-4 border-b border-emerald-500/20">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" /> ポジティブリポジトリ
                                </h3>
                                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    {positivePosts.length} 件
                                </Badge>
                            </div>
                            <p className="text-xs text-emerald-300/70 mt-1">閾値をクリアした成功投稿群</p>
                        </div>
                        <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {positivePosts.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">該当する投稿がありません</p>
                            ) : null}
                            {positivePosts.map((post: PastPost) => (
                                <div key={post.id} className="p-3 border border-white/10 rounded-lg bg-white/5 hover:bg-white/[0.08] transition-colors">
                                    <div className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-4">{post.content}</div>
                                    <div className="flex justify-between mt-3 text-xs text-muted-foreground border-t border-white/10 pt-2">
                                        <span className="font-semibold text-blue-400">IMP: {post.impressions?.toLocaleString() ?? 0}</span>
                                        <span className="font-semibold text-amber-400">CV: {post.conversions ?? 0}</span>
                                        <span>{new Date(post.postedAt).toLocaleDateString("ja-JP")}</span>
                                    </div>
                                    {post.externalId && (
                                        <div className="mt-1 text-right">
                                            <a href={"https://x.com/i/status/" + post.externalId} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                                                Xで見る
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ネガティブリポジトリ */}
                    <div className="glass rounded-xl overflow-hidden border border-red-500/20">
                        <div className="bg-red-500/10 px-5 py-4 border-b border-red-500/20">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                                    <TrendingDown className="w-5 h-5" /> ネガティブリポジトリ
                                </h3>
                                <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30">
                                    {negativePosts.length} 件
                                </Badge>
                            </div>
                            <p className="text-xs text-red-300/70 mt-1">閾値未達の改善対象投稿群</p>
                        </div>
                        <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {negativePosts.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">該当する投稿がありません</p>
                            ) : null}
                            {negativePosts.map((post: PastPost) => (
                                <div key={post.id} className="p-3 border border-white/10 rounded-lg bg-white/5 hover:bg-white/[0.08] transition-colors">
                                    <div className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-4">{post.content}</div>
                                    <div className="flex justify-between mt-3 text-xs text-muted-foreground border-t border-white/10 pt-2">
                                        <span className="font-semibold text-blue-400">IMP: {post.impressions?.toLocaleString() ?? 0}</span>
                                        <span className="font-semibold text-amber-400">CV: {post.conversions ?? 0}</span>
                                        <span>{new Date(post.postedAt).toLocaleDateString("ja-JP")}</span>
                                    </div>
                                    {post.externalId && (
                                        <div className="mt-1 text-right">
                                            <a href={"https://x.com/i/status/" + post.externalId} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                                                Xで見る
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
