"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, RefreshCw, Users, Eye, Target, Sparkles,
    TrendingUp, BarChart3, Activity, Lightbulb, AlertCircle, Scale,
    MessageCircle, MousePointerClick
} from "lucide-react";
import Link from "next/link";

type Summary = {
    range: { days: number; since: string; until: string };
    groupBy: "day" | "week" | "month";
    xProfile: {
        username?: string; name?: string; followersCount?: number;
        followingCount?: number; tweetCount?: number; profileImageUrl?: string;
        fetchedAt?: string; error?: string;
    };
    posts: {
        count: number; totalImpressions: number; totalConversions: number;
        totalReplies: number; totalUrlClicks: number;
        avgImpressions: number;
        top: Array<{ id: string; content: string; impressions: number; conversions: number; replies: number; urlClicks: number; likes: number; retweets: number; postedAt: string; externalId?: string | null }>;
        daily: Array<{ date: string; posts: number; impressions: number; replies: number; urlClicks: number; likes: number; retweets: number }>;
        recent: Array<{ id: string; content: string; impressions: number; conversions: number; replies: number; urlClicks: number; likes: number; retweets: number; postedAt: string; externalId?: string | null; analysisStatus: string }>;
    };
    funnel: {
        today: number; month: number; inRangeTotal: number;
        daily: Array<{ date: string; count: number }>;
        byForm: Array<{ formName: string; count: number }>;
        byUtmCampaign: Array<{ utmCampaign: string | null; count: number }>;
        byUtmContent: Array<{ utmContent: string; count: number }>;
    };
};

type Suggestion = {
    type: "BASE" | "TEMPLATE" | "WINNING" | "LOSING" | string;
    level: "tactic" | "strategy" | string;
    confidence: "high" | "medium" | "low" | string;
    content: string;
    rationale: string;
    caveat: string | null;
};

type Insight = {
    headline?: string;
    tldr?: string;
    what_worked?: string;
    what_didnt?: string;
    next_moves?: string[];
    suggestions?: Suggestion[];
    _fallback?: boolean;
    _parseFailed?: boolean;
    _rawPreview?: string;
    _meta?: { days: number; engine: string; posts_analyzed: number; funnel_events: number };
};

export default function AnalysisPage() {
    const [days, setDays] = useState<number>(30);
    const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [insight, setInsight] = useState<Insight | null>(null);
    const [insightLoading, setInsightLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // グラフホバー用
    const [hoveredPostBar, setHoveredPostBar] = useState<number | null>(null);
    const [hoveredFunnelBar, setHoveredFunnelBar] = useState<number | null>(null);

    // ポジネガ判定用
    const [thresholdImpression, setThresholdImpression] = useState(1000);
    const [thresholdConversion, setThresholdConversion] = useState(1);
    const [classifying, setClassifying] = useState(false);
    const [classifyResult, setClassifyResult] = useState<{ positive: number; negative: number; unanalyzed: number; total: number } | null>(null);

    // サジェストごとの状態: { [index]: "pending" | "approving" | "approved" | "rejected" }
    const [suggestionStatus, setSuggestionStatus] = useState<Record<number, "pending" | "approving" | "approved" | "rejected">>({});
    // 編集モード用
    const [editingSuggestion, setEditingSuggestion] = useState<number | null>(null);
    const [editedContent, setEditedContent] = useState<string>("");

    const fetchSummary = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/analysis/summary?days=${days}&groupBy=${groupBy}`);
            if (res.ok) {
                setSummary(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [days, groupBy]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    const runInsight = async () => {
        setInsightLoading(true);
        setSuggestionStatus({});
        setEditingSuggestion(null);
        try {
            const res = await fetch("/api/analysis/insight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ days }),
            });
            if (res.ok) setInsight(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setInsightLoading(false);
        }
    };

    const approveSuggestion = async (index: number, contentOverride?: string) => {
        if (!insight?.suggestions) return;
        const s = insight.suggestions[index];
        if (!s) return;

        // 戦略レベルの提案には強い確認ダイアログ
        if (s.level === "strategy") {
            const msg = [
                "⚠️ これは戦略レベルの変更です。",
                "",
                `【内容】${contentOverride ?? s.content}`,
                s.caveat ? `【注意】${s.caveat}` : "",
                "",
                "アカウント全体の方向性に関わる変更のため、直近データのノイズで方向転換すると危険です。",
                "本当にこのルールをナレッジに追加しますか？",
            ].filter(Boolean).join("\n");
            if (!confirm(msg)) return;
        }
        // 低信頼度も確認（戦術でも low は注意）
        else if (s.confidence === "low") {
            if (!confirm(`信頼度が低いサジェストです。${s.caveat ? `\n\n${s.caveat}` : ""}\n\nそれでも追加しますか？`)) return;
        }

        setSuggestionStatus(prev => ({ ...prev, [index]: "approving" }));
        try {
            const contentToSave = contentOverride ?? s.content;
            const category = s.level === "strategy" ? "戦略" : "戦術";
            const sourceLabel = `AI分析提案（${category}・信頼度 ${s.confidence} / 期間 ${days}日）`;
            const res = await fetch("/api/knowledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: s.type,
                    category,
                    content: s.rationale
                        ? `${contentToSave}\n\n【根拠】${s.rationale}`
                        : contentToSave,
                    source: sourceLabel,
                }),
            });
            if (res.ok) {
                setSuggestionStatus(prev => ({ ...prev, [index]: "approved" }));
                setEditingSuggestion(null);
            } else {
                setSuggestionStatus(prev => ({ ...prev, [index]: "pending" }));
                alert("ナレッジ追加に失敗しました");
            }
        } catch (e) {
            console.error(e);
            setSuggestionStatus(prev => ({ ...prev, [index]: "pending" }));
        }
    };

    const rejectSuggestion = (index: number) => {
        setSuggestionStatus(prev => ({ ...prev, [index]: "rejected" }));
    };

    const startEditSuggestion = (index: number, content: string) => {
        setEditingSuggestion(index);
        setEditedContent(content);
    };

    const runClassify = async () => {
        setClassifying(true);
        try {
            const res = await fetch("/api/past-posts/classify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ thresholdImpression, thresholdConversion }),
            });
            if (res.ok) {
                const data = await res.json();
                setClassifyResult({
                    positive: data.positiveCount ?? 0,
                    negative: data.negativeCount ?? 0,
                    unanalyzed: data.unanalyzedCount ?? 0,
                    total: (data.positiveCount ?? 0) + (data.negativeCount ?? 0) + (data.unanalyzedCount ?? 0),
                });
                await fetchSummary();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`❌ 判定失敗: ${err.message || res.status}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setClassifying(false);
        }
    };

    const syncPastPosts = async () => {
        setSyncing(true);
        try {
            const res = await fetch("/api/past-posts/sync", { method: "POST" });
            if (res.ok) {
                alert("✅ 過去投稿を同期しました");
                await fetchSummary();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`❌ 同期失敗: ${err.message || res.status}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSyncing(false);
        }
    };

    // 軸の最大値を「データ最大値より少し上」のキリの良い数字にスナップ
    //   最小 100・最大 1億の範囲内でクランプ
    //   ユーザーデータの magnitude に応じて 1.2x / 1.5x / 2x のいずれかに丸める
    const niceCeil = (value: number, minClamp = 100, maxClamp = 100_000_000): number => {
        if (value <= 0) return minClamp;
        if (value >= maxClamp) return maxClamp;
        const withHeadroom = value * 1.15; // 15% の余白を確保
        const magnitude = Math.pow(10, Math.floor(Math.log10(withHeadroom)));
        const normalized = withHeadroom / magnitude;
        let niceNorm: number;
        if (normalized <= 1) niceNorm = 1;
        else if (normalized <= 1.5) niceNorm = 1.5;
        else if (normalized <= 2) niceNorm = 2;
        else if (normalized <= 3) niceNorm = 3;
        else if (normalized <= 5) niceNorm = 5;
        else if (normalized <= 7) niceNorm = 7;
        else niceNorm = 10;
        return Math.max(minClamp, Math.min(maxClamp, Math.ceil(niceNorm * magnitude)));
    };

    // 数値を「1.2万 / 340 / 1.5M」等の短縮表記に
    const formatCompact = (n: number): string => {
        if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億`;
        if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}万`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
        return n.toLocaleString();
    };

    const rawMaxPostImp = Math.max(0, ...(summary?.posts.daily.map(d => d.impressions) ?? [0]));
    const rawMaxFunnel = Math.max(0, ...(summary?.funnel.daily.map(d => d.count) ?? [0]));
    const maxPostImp = niceCeil(rawMaxPostImp, 100, 100_000_000);
    const maxFunnel = niceCeil(rawMaxFunnel, 5, 10_000);

    // Y軸の目盛り（0, 25%, 50%, 75%, 100%）
    const yTicks = (max: number) => [0, 0.25, 0.5, 0.75, 1].map(r => Math.round(max * r));

    return (
        <div className="space-y-6 max-w-7xl">
            <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">📊 データ分析</h1>
                    <p className="text-slate-600 mt-2">X運用とプロラインフリーの導線を統合分析。AI が何が効いたか / 次に何をすべきかを提案します。</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1">
                        {[7, 30, 90].map(d => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-3 py-1 text-xs rounded font-semibold ${days === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                            >直近 {d} 日</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1">
                        {(["day", "week", "month"] as const).map(g => (
                            <button
                                key={g}
                                onClick={() => setGroupBy(g)}
                                className={`px-3 py-1 text-xs rounded font-semibold ${groupBy === g ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                            >{g === "day" ? "日別" : g === "week" ? "週別" : "月別"}</button>
                        ))}
                    </div>
                    <Button variant="outline" onClick={fetchSummary} disabled={loading}>
                        <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                        更新
                    </Button>
                    <Button onClick={syncPastPosts} disabled={syncing} className="bg-sky-600 hover:bg-sky-700 text-white border-sky-600">
                        {syncing ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Activity className="size-4 mr-1.5" />}
                        X から投稿を同期
                    </Button>
                </div>
            </div>

            {loading && !summary && (
                <div className="py-20 text-center text-slate-500">
                    <Loader2 className="size-8 mx-auto animate-spin text-slate-400" />
                    <p className="mt-3">データを集計中...</p>
                </div>
            )}

            {summary && (
                <>
                    {/* KPI サマリー（2段構成） */}
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                        <Card className="bg-white border-slate-200">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-slate-500 font-medium">フォロワー数</span>
                                    <Users className="size-4 text-purple-500" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">
                                    {summary.xProfile.followersCount?.toLocaleString() ?? (summary.xProfile.error ? "—" : "...")}
                                </div>
                                {summary.xProfile.username && (
                                    <p className="text-xs text-slate-500 mt-1">@{summary.xProfile.username}</p>
                                )}
                                {summary.xProfile.error && (
                                    <p className="text-[11px] text-rose-500 mt-1">{summary.xProfile.error}</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-slate-200">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-slate-500 font-medium">投稿数（{days}日）</span>
                                    <BarChart3 className="size-4 text-sky-500" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">{summary.posts.count.toLocaleString()}</div>
                                <p className="text-xs text-slate-500 mt-1">合計 {summary.posts.totalImpressions.toLocaleString()} imp</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-slate-200">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-slate-500 font-medium">平均インプレッション</span>
                                    <Eye className="size-4 text-amber-500" />
                                </div>
                                <div className="text-2xl font-bold text-slate-900">{summary.posts.avgImpressions.toLocaleString()}</div>
                                <p className="text-xs text-slate-500 mt-1">1投稿あたり</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-slate-200">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-slate-500 font-medium">プロライン登録（{days}日）</span>
                                    <Target className="size-4 text-emerald-500" />
                                </div>
                                <div className="text-2xl font-bold text-emerald-600">{summary.funnel.inRangeTotal.toLocaleString()}</div>
                                <p className="text-xs text-slate-500 mt-1">今日 {summary.funnel.today} / 今月 {summary.funnel.month}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-slate-200">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-slate-500 font-medium">合計リプ（{days}日）</span>
                                    <MessageCircle className="size-4 text-rose-500" />
                                </div>
                                <div className="text-2xl font-bold text-rose-600">{summary.posts.totalReplies.toLocaleString()}</div>
                                <p className="text-xs text-slate-500 mt-1">1投稿平均 {summary.posts.count > 0 ? Math.round(summary.posts.totalReplies / summary.posts.count) : 0}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-slate-200">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-slate-500 font-medium">URLクリック（{Math.min(days, 30)}日）</span>
                                    <MousePointerClick className="size-4 text-indigo-500" />
                                </div>
                                <div className="text-2xl font-bold text-indigo-600">{summary.posts.totalUrlClicks.toLocaleString()}</div>
                                <p className="text-xs text-slate-500 mt-1">※ X仕様で30日限定メトリクス</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* AI インサイト */}
                    <Card className="bg-white border-purple-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                                    <Sparkles className="size-5 text-purple-500" />
                                    🧠 AI による {days} 日の分析インサイト
                                </CardTitle>
                                <Button onClick={runInsight} disabled={insightLoading} className="bg-purple-600 hover:bg-purple-700 text-white">
                                    {insightLoading ? <><Loader2 className="size-4 mr-1.5 animate-spin" />生成中...</> : <><Lightbulb className="size-4 mr-1.5" />分析を実行</>}
                                </Button>
                            </div>
                            <CardDescription className="text-slate-600">
                                投稿データ + プロライン導線 + 自社ナレッジから、何が効いて何がダメで、次に何をすべきかを日本語で提案します。
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!insight ? (
                                <div className="text-sm text-slate-500 py-6 text-center border-2 border-dashed border-slate-200 rounded-md">
                                    右上の「分析を実行」ボタンで AI インサイトを生成できます。
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {insight._fallback && (
                                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                                            <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                                            <span>{insight.tldr}</span>
                                        </div>
                                    )}
                                    {insight._parseFailed && (
                                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 space-y-2">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                                                <span>{insight.tldr}</span>
                                            </div>
                                            <Button size="sm" onClick={runInsight} className="bg-rose-600 hover:bg-rose-700 text-white h-7 text-xs">
                                                再試行
                                            </Button>
                                            {insight._rawPreview && (
                                                <details className="text-[10px] text-slate-500">
                                                    <summary className="cursor-pointer">AI の生応答（先頭500文字）</summary>
                                                    <pre className="mt-1 p-2 bg-white border border-slate-200 rounded text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto">{insight._rawPreview}</pre>
                                                </details>
                                            )}
                                        </div>
                                    )}
                                    {insight.headline && (
                                        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                                            <h4 className="font-bold text-slate-900 text-base">{insight.headline}</h4>
                                            {insight.tldr && !insight._fallback && <p className="text-sm text-slate-700 mt-2 leading-relaxed">{insight.tldr}</p>}
                                        </div>
                                    )}
                                    {insight.what_worked && (
                                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md">
                                            <h5 className="font-bold text-emerald-900 text-sm mb-1.5">✅ 上手くいった点</h5>
                                            <p className="text-sm text-emerald-900/80 whitespace-pre-wrap leading-relaxed">{insight.what_worked}</p>
                                        </div>
                                    )}
                                    {insight.what_didnt && (
                                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md">
                                            <h5 className="font-bold text-rose-900 text-sm mb-1.5">⚠️ 上手くいかなかった点</h5>
                                            <p className="text-sm text-rose-900/80 whitespace-pre-wrap leading-relaxed">{insight.what_didnt}</p>
                                        </div>
                                    )}
                                    {insight.next_moves && insight.next_moves.length > 0 && (
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                                            <h5 className="font-bold text-blue-900 text-sm mb-2">🎯 次に取るべきアクション</h5>
                                            <ul className="space-y-2">
                                                {insight.next_moves.map((m, i) => (
                                                    <li key={i} className="flex gap-2 text-sm text-blue-900/80">
                                                        <span className="text-blue-600 font-bold">{i + 1}.</span>
                                                        <span className="flex-1 leading-relaxed">{m}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {insight._meta && (
                                        <p className="text-[10px] text-slate-400 text-right">
                                            {insight._meta.engine} ・ 投稿 {insight._meta.posts_analyzed} 件・ ファネル {insight._meta.funnel_events} 件を分析
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* AI ナレッジ追加サジェスト */}
                    {insight && insight.suggestions && insight.suggestions.length > 0 && (
                        <Card className="bg-white border-indigo-200 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                                    <Lightbulb className="size-5 text-indigo-500" />
                                    💡 ProX ナレッジ追加の提案（{insight.suggestions.length} 件）
                                </CardTitle>
                                <CardDescription className="text-slate-600">
                                    AI が分析から抽出した「ナレッジに入れるべきルール候補」です。
                                    戦術は即承認 OK、戦略は慎重に検討してください。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {insight.suggestions.map((s, i) => {
                                    const status = suggestionStatus[i] || "pending";
                                    const isStrategy = s.level === "strategy";
                                    const isLowConf = s.confidence === "low";
                                    const typeStyle = s.type === "WINNING" ? "bg-blue-100 text-blue-800 border-blue-200"
                                        : s.type === "LOSING" ? "bg-rose-100 text-rose-800 border-rose-200"
                                            : s.type === "TEMPLATE" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                : "bg-purple-100 text-purple-800 border-purple-200";
                                    const levelStyle = isStrategy
                                        ? "bg-amber-100 text-amber-800 border-amber-300"
                                        : "bg-slate-100 text-slate-700 border-slate-200";
                                    const confStyle = s.confidence === "high" ? "bg-emerald-50 text-emerald-700"
                                        : s.confidence === "medium" ? "bg-slate-50 text-slate-600"
                                            : "bg-rose-50 text-rose-600";
                                    const cardBorder = status === "approved" ? "border-emerald-400 bg-emerald-50/40"
                                        : status === "rejected" ? "border-slate-200 bg-slate-50/30 opacity-50"
                                            : isStrategy ? "border-amber-200 bg-amber-50/30"
                                                : "border-slate-200";

                                    return (
                                        <div key={i} className={`p-4 border-2 rounded-lg transition-all ${cardBorder}`}>
                                            {/* ラベル群 */}
                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                <Badge variant="outline" className={`${typeStyle} text-[10px] font-bold`}>
                                                    {s.type === "WINNING" ? "🌟 勝ちパターン" :
                                                        s.type === "LOSING" ? "🚫 負けパターン" :
                                                            s.type === "TEMPLATE" ? "📝 型" : "📚 ベース"}
                                                </Badge>
                                                <Badge variant="outline" className={`${levelStyle} text-[10px] font-bold`}>
                                                    {isStrategy ? "🎯 戦略（慎重に）" : "🧪 戦術"}
                                                </Badge>
                                                <Badge variant="outline" className={`${confStyle} text-[10px]`}>
                                                    信頼度 {s.confidence}
                                                </Badge>
                                                {status === "approved" && (
                                                    <Badge className="bg-emerald-600 text-white text-[10px]">✅ 追加済み</Badge>
                                                )}
                                                {status === "rejected" && (
                                                    <Badge variant="outline" className="text-[10px] text-slate-400">却下</Badge>
                                                )}
                                            </div>

                                            {/* 本文 */}
                                            {editingSuggestion === i ? (
                                                <textarea
                                                    value={editedContent}
                                                    onChange={e => setEditedContent(e.target.value)}
                                                    rows={3}
                                                    className="w-full text-sm p-2 border border-indigo-300 rounded-md mb-2 bg-white text-slate-800"
                                                />
                                            ) : (
                                                <p className="text-sm font-medium text-slate-800 leading-relaxed mb-2">{s.content}</p>
                                            )}

                                            {/* 根拠 */}
                                            {s.rationale && (
                                                <p className="text-xs text-slate-500 leading-relaxed mb-2">
                                                    <span className="font-semibold">根拠: </span>{s.rationale}
                                                </p>
                                            )}

                                            {/* 注意書き */}
                                            {s.caveat && (
                                                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 mb-2">
                                                    <AlertCircle className="size-3.5 flex-shrink-0 mt-0.5" />
                                                    <span className="leading-relaxed">{s.caveat}</span>
                                                </div>
                                            )}

                                            {/* 低信頼度の警告 */}
                                            {isLowConf && !s.caveat && (
                                                <div className="flex items-start gap-2 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 mb-2">
                                                    <AlertCircle className="size-3.5 flex-shrink-0 mt-0.5" />
                                                    <span>信頼度が低いため、現時点のナレッジ化は推奨しません。</span>
                                                </div>
                                            )}

                                            {/* アクションボタン */}
                                            {status === "pending" && (
                                                <div className="flex gap-2 flex-wrap mt-2">
                                                    {editingSuggestion === i ? (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => approveSuggestion(i, editedContent)}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                                                            >
                                                                ✓ 編集内容で承認
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setEditingSuggestion(null)}
                                                                className="h-8 text-xs"
                                                            >
                                                                キャンセル
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => approveSuggestion(i)}
                                                                className={`${isStrategy ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white h-8 text-xs`}
                                                            >
                                                                {isStrategy ? "⚠️ 戦略として追加" : "✓ ナレッジに追加"}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => startEditSuggestion(i, s.content)}
                                                                className="h-8 text-xs"
                                                            >
                                                                ✏️ 編集して追加
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => rejectSuggestion(i)}
                                                                className="text-slate-500 hover:text-rose-500 h-8 text-xs"
                                                            >
                                                                却下
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {status === "approving" && (
                                                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                                                    <Loader2 className="size-3 animate-spin" /> 追加中...
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex items-start gap-2">
                                    <span className="text-base">💡</span>
                                    <span>
                                        承認したルールは「ナレッジベース」画面に反映され、次回以降の AI 投稿生成時に参照されます。
                                        戦略（🎯）レベルの提案は方向性を変えるものなので、複数の分析結果を見てから反映するのがおすすめです。
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* X 投稿パフォーマンス */}
                        <Card className="bg-white border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                                    <BarChart3 className="size-5 text-sky-500" />
                                    X 投稿パフォーマンス
                                </CardTitle>
                                <CardDescription className="text-slate-600">
                                    直近 {days} 日の投稿インプレッション推移
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {summary.posts.daily.length === 0 ? (
                                    <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-md space-y-3">
                                        <p className="text-sm text-slate-500">
                                            同期されている投稿がありません。<br />
                                            まず X から過去投稿を取り込んでください。
                                        </p>
                                        <Button
                                            onClick={syncPastPosts}
                                            disabled={syncing}
                                            className="bg-sky-600 hover:bg-sky-700 text-white"
                                        >
                                            {syncing ? <><Loader2 className="size-4 mr-1.5 animate-spin" />同期中...</> : <><Activity className="size-4 mr-1.5" />X から投稿を同期する</>}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="relative mb-3 flex gap-1">
                                        {/* ツールチップ */}
                                        {hoveredPostBar !== null && summary.posts.daily[hoveredPostBar] && (
                                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-10 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
                                                <div className="font-bold">{summary.posts.daily[hoveredPostBar].date}</div>
                                                <div className="text-sky-300 font-bold text-sm">
                                                    {summary.posts.daily[hoveredPostBar].impressions.toLocaleString()} imp
                                                </div>
                                                <div className="text-[10px] text-slate-300">
                                                    投稿 {summary.posts.daily[hoveredPostBar].posts} 件
                                                </div>
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                            </div>
                                        )}
                                        {/* Y軸ラベル */}
                                        <div className="flex flex-col justify-between h-32 text-[9px] text-slate-400 text-right pr-1 shrink-0 w-10">
                                            {yTicks(maxPostImp).slice().reverse().map((t, i) => (
                                                <span key={i} className="leading-none">{formatCompact(t)}</span>
                                            ))}
                                        </div>
                                        {/* グラフ本体 */}
                                        <div className="flex-1 relative">
                                            {/* グリッドライン */}
                                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                                {yTicks(maxPostImp).slice().reverse().map((_, i) => (
                                                    <div key={i} className="h-px bg-slate-100" />
                                                ))}
                                            </div>
                                            <div className="flex items-end justify-between gap-1 h-32 relative">
                                                {summary.posts.daily.map((d, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex-1 flex flex-col items-center gap-1 min-w-0 cursor-pointer h-full justify-end"
                                                        onMouseEnter={() => setHoveredPostBar(i)}
                                                        onMouseLeave={() => setHoveredPostBar(null)}
                                                    >
                                                        <div
                                                            className={`w-full bg-gradient-to-t rounded-t transition-all ${hoveredPostBar === i
                                                                ? "from-sky-700 to-sky-500 ring-2 ring-sky-400"
                                                                : "from-sky-600 to-sky-400"}`}
                                                            style={{ height: `${(d.impressions / maxPostImp) * 100}%`, minHeight: d.impressions > 0 ? "3px" : "0" }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between gap-1 mt-1">
                                                {summary.posts.daily.map((d, i) => (
                                                    <span key={i} className="flex-1 text-[9px] text-slate-400 truncate text-center min-w-0">{d.date.slice(5)}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-3">
                                    <h5 className="text-xs font-bold text-slate-600 mb-2">🏆 TOP 5 インプレッション</h5>
                                    {summary.posts.top.length === 0 ? (
                                        <p className="text-xs text-slate-400">データなし</p>
                                    ) : (
                                        <ul className="space-y-1.5">
                                            {summary.posts.top.map((p, i) => (
                                                <li key={p.id} className="p-2 bg-slate-50 rounded-md border border-slate-100">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <span className="text-[10px] font-bold text-slate-500">#{i + 1}</span>
                                                        <span className="text-xs font-bold text-sky-600">{p.impressions.toLocaleString()} imp</span>
                                                    </div>
                                                    <p className="text-xs text-slate-700 line-clamp-2 whitespace-pre-wrap">{p.content}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* プロライン 導線 */}
                        <Card className="bg-white border-emerald-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                                    <Target className="size-5 text-emerald-500" />
                                    プロラインフリー 導線
                                </CardTitle>
                                <CardDescription className="text-slate-600">
                                    直近 {days} 日の LINE 登録推移
                                    <Link href="/dashboard/settings" className="ml-2 text-purple-600 hover:underline">🛠連携設定</Link>
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {summary.funnel.inRangeTotal === 0 ? (
                                    <div className="text-sm text-slate-500 py-6 text-center border-2 border-dashed border-slate-200 rounded-md">
                                        登録データがまだ届いていません。
                                        <br />
                                        <Link href="/dashboard/settings" className="text-purple-600 hover:underline">設定画面</Link>から webhook を構築してください。
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative mb-3 flex gap-1">
                                            {hoveredFunnelBar !== null && summary.funnel.daily[hoveredFunnelBar] && (
                                                <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-10 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
                                                    <div className="font-bold">{summary.funnel.daily[hoveredFunnelBar].date}</div>
                                                    <div className="text-emerald-300 font-bold text-sm">
                                                        {summary.funnel.daily[hoveredFunnelBar].count.toLocaleString()} 件登録
                                                    </div>
                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                                </div>
                                            )}
                                            {/* Y軸ラベル */}
                                            <div className="flex flex-col justify-between h-32 text-[9px] text-slate-400 text-right pr-1 shrink-0 w-8">
                                                {yTicks(maxFunnel).slice().reverse().map((t, i) => (
                                                    <span key={i} className="leading-none">{formatCompact(t)}</span>
                                                ))}
                                            </div>
                                            <div className="flex-1 relative">
                                                {/* グリッドライン */}
                                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ height: "128px" }}>
                                                    {yTicks(maxFunnel).slice().reverse().map((_, i) => (
                                                        <div key={i} className="h-px bg-slate-100" />
                                                    ))}
                                                </div>
                                                <div className="flex items-end justify-between gap-1 h-32 relative">
                                                    {summary.funnel.daily.map((d, i) => (
                                                        <div
                                                            key={i}
                                                            className="flex-1 flex flex-col items-center gap-1 min-w-0 cursor-pointer h-full justify-end"
                                                            onMouseEnter={() => setHoveredFunnelBar(i)}
                                                            onMouseLeave={() => setHoveredFunnelBar(null)}
                                                        >
                                                            <div
                                                                className={`w-full bg-gradient-to-t rounded-t transition-all ${hoveredFunnelBar === i
                                                                    ? "from-emerald-700 to-emerald-500 ring-2 ring-emerald-400"
                                                                    : "from-emerald-600 to-emerald-400"}`}
                                                                style={{ height: `${(d.count / maxFunnel) * 100}%`, minHeight: d.count > 0 ? "3px" : "0" }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-between gap-1 mt-1">
                                                    {summary.funnel.daily.map((d, i) => (
                                                        <div key={i} className="flex-1 flex flex-col items-center min-w-0">
                                                            <span className="text-[9px] text-slate-400 truncate">{d.date.slice(5)}</span>
                                                            <span className="text-[9px] font-bold text-emerald-600">{d.count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {summary.funnel.byForm.length > 0 && (
                                            <div className="mt-3">
                                                <h5 className="text-xs font-bold text-slate-600 mb-2">📋 フォーム別内訳</h5>
                                                <div className="space-y-1.5">
                                                    {summary.funnel.byForm.map((f, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs p-2 bg-emerald-50 border border-emerald-100 rounded">
                                                            <span className="text-slate-700">{f.formName}</span>
                                                            <Badge variant="outline" className="bg-white border-emerald-200 text-emerald-700">{f.count} 件</Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {summary.funnel.byUtmCampaign.length > 0 && (
                                            <div className="mt-3">
                                                <h5 className="text-xs font-bold text-slate-600 mb-2">🏷 UTM キャンペーン別</h5>
                                                <div className="space-y-1.5">
                                                    {summary.funnel.byUtmCampaign.map((c, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs p-2 bg-sky-50 border border-sky-100 rounded">
                                                            <span className="text-slate-700 font-mono">{c.utmCampaign}</span>
                                                            <Badge variant="outline" className="bg-white border-sky-200 text-sky-700">{c.count} 件</Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ポジネガ判定 */}
                    <Card className="bg-white border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                                <Scale className="size-5 text-slate-600" />
                                ⚖️ ポジネガ判定（投稿の勝ち・負け分類）
                            </CardTitle>
                            <CardDescription className="text-slate-600">
                                過去投稿を閾値で「勝ち（POSITIVE）／負け（NEGATIVE）」に自動分類します。勝ち投稿はナレッジ抽出・AI生成の参考データに使われます。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 現在の状態サマリー */}
                            {summary.posts.recent.length > 0 && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                                        <div className="text-xs text-emerald-700 font-medium mb-1">✓ 勝ち（POSITIVE）</div>
                                        <div className="text-2xl font-bold text-emerald-700">
                                            {summary.posts.recent.filter(p => p.analysisStatus === "POSITIVE").length}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-center">
                                        <div className="text-xs text-rose-700 font-medium mb-1">× 負け（NEGATIVE）</div>
                                        <div className="text-2xl font-bold text-rose-700">
                                            {summary.posts.recent.filter(p => p.analysisStatus === "NEGATIVE").length}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                                        <div className="text-xs text-slate-600 font-medium mb-1">未分類</div>
                                        <div className="text-2xl font-bold text-slate-600">
                                            {summary.posts.recent.filter(p => p.analysisStatus !== "POSITIVE" && p.analysisStatus !== "NEGATIVE").length}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 閾値設定 */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">インプレッション閾値</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={100}
                                        value={thresholdImpression}
                                        onChange={(e) => setThresholdImpression(Number(e.target.value) || 0)}
                                        className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-600">CV閾値</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={thresholdConversion}
                                        onChange={(e) => setThresholdConversion(Number(e.target.value) || 0)}
                                        className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900"
                                    />
                                </div>
                                <Button
                                    onClick={runClassify}
                                    disabled={classifying}
                                    className="bg-slate-900 hover:bg-slate-800 text-white h-10"
                                >
                                    {classifying ? <><Loader2 className="size-4 mr-1.5 animate-spin" />判定中...</> : <><Scale className="size-4 mr-1.5" />ポジネガ判定を実行</>}
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                両方の閾値を <span className="font-bold">同時に超えた投稿のみ「勝ち」</span>と判定されます。
                                閾値は保存され、次回以降の AI 生成ルールに反映されます。
                            </p>

                            {/* 判定結果通知 */}
                            {classifyResult && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800">
                                    ✅ {classifyResult.total} 件中、勝ち <span className="font-bold">{classifyResult.positive}</span> 件 / 負け <span className="font-bold">{classifyResult.negative}</span> 件 に分類しました
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 最近の投稿テーブル */}
                    {summary.posts.recent.length > 0 && (
                        <Card className="bg-white border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                                    <TrendingUp className="size-5 text-slate-600" />
                                    最近の投稿 {summary.posts.recent.length} 件
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-y border-slate-200 text-xs text-slate-500">
                                            <tr>
                                                <th className="text-left p-3 font-medium whitespace-nowrap">投稿日</th>
                                                <th className="text-left p-3 font-medium">本文（冒頭）</th>
                                                <th className="text-right p-3 font-medium whitespace-nowrap">インプ</th>
                                                <th className="text-right p-3 font-medium whitespace-nowrap">リプ</th>
                                                <th className="text-right p-3 font-medium whitespace-nowrap">URLクリック</th>
                                                <th className="text-right p-3 font-medium whitespace-nowrap">エンゲ合計</th>
                                                <th className="text-center p-3 font-medium">状態</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary.posts.recent.map(p => (
                                                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                                                        {new Date(p.postedAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-3 max-w-md">
                                                        <p className="text-sm text-slate-700 line-clamp-2">{p.content}</p>
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-sky-600 whitespace-nowrap">
                                                        {p.impressions.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right text-rose-600 font-semibold whitespace-nowrap">
                                                        {p.replies.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right text-indigo-600 font-semibold whitespace-nowrap">
                                                        {p.urlClicks.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right text-emerald-600 font-semibold whitespace-nowrap">
                                                        {p.conversions.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <Badge variant="outline" className={
                                                            p.analysisStatus === "POSITIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                                                : p.analysisStatus === "NEGATIVE" ? "bg-rose-50 text-rose-700 border-rose-200 text-[10px]"
                                                                    : "bg-slate-50 text-slate-600 border-slate-200 text-[10px]"
                                                        }>
                                                            {p.analysisStatus === "POSITIVE" ? "✓ 勝ち" : p.analysisStatus === "NEGATIVE" ? "× 負け" : "未分析"}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
