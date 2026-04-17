"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, Zap, CheckCircle2, Copy, Sparkles, Database, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type RepurposeResult = {
    extracted_format: string;
    extracted_emotion: string;
    generated_posts: string[];
};

type HQSuggestion = {
    id: string;
    category: string;
    type: string;
    content: string;
    source: string;
};

export default function ResearchPage() {
    const [activeTab, setActiveTab] = useState<"manual" | "ai" | "hq" | "trend">("ai");
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<RepurposeResult | null>(null);

    // Manual Tab State
    const [sourceText, setSourceText] = useState("");

    // HQ Tab State
    const [hqSuggestions, setHqSuggestions] = useState<HQSuggestion[]>([]);
    const [isLoadingHq, setIsLoadingHq] = useState(false);

    // Trend Tab State
    const [trendKeyword, setTrendKeyword] = useState("");

    // --- Tab Handlers ---

    // 1. 手動リサーチ
    const handleManualRepurpose = async () => {
        if (!sourceText.trim()) {
            alert("バズったポストのテキストなど、横展開の元となる文章を入力してください。");
            return;
        }
        await executeRepurposeRequest("/api/research/repurpose", { sourcePostText: sourceText });
    };

    // 2. AIおまかせリサーチ
    const handleAIAutoResearch = async () => {
        await executeRepurposeRequest("/api/research/auto_ai", {});
    };

    // 3. HQナレッジからのリサーチ
    const fetchHqSuggestions = async () => {
        try {
            setIsLoadingHq(true);
            const res = await fetch("/api/research/hq_suggestions");
            if (res.ok) {
                const data = await res.json();
                setHqSuggestions(data.suggestions || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingHq(false);
        }
    };

    useEffect(() => {
        if (activeTab === "hq" && hqSuggestions.length === 0) {
            fetchHqSuggestions();
        }
    }, [activeTab]);

    const handleHqRepurpose = async (suggestion: HQSuggestion) => {
        // ナレッジのテキストを抽出してrepurposeAPIに投げる
        await executeRepurposeRequest("/api/research/repurpose", { sourcePostText: suggestion.content });
    };

    // 4. Xトレンド検索 (Mock)
    const handleTrendResearch = async () => {
        if (!trendKeyword.trim()) {
            alert("検索キーワードを入力してください。");
            return;
        }
        // モック実装: キーワードに関連するバズポストのダミーテキストを用意してrepurposeする
        const mockBuzzText = `【${trendKeyword}の真実】\n実は9割の人が間違っている${trendKeyword}の常識。\nこれを知らないと一生損します。\n\n・ポイント1\n・ポイント2\n・ポイント3\n\n騙されたと思って試してみて下さい。成果が10倍になります。`;
        await executeRepurposeRequest("/api/research/repurpose", { sourcePostText: mockBuzzText });
    };

    // --- 共通リクエスト実行関数 ---
    const executeRepurposeRequest = async (endpoint: string, payload: any) => {
        try {
            setIsGenerating(true);
            setResult(null);

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "解析エラーが発生しました。");
            }

            const data = await res.json();
            setResult(data);
            alert("横展開が完了しました！\n自社テーマに置き換えられた新しい投稿案が生成されました。");

        } catch (error: any) {
            console.error(error);
            alert(`エラーが発生しました: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("クリップボードに投稿テキストをコピーしました。");
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">🔎 完全自動リサーチ＆横展開</h1>
                <p className="text-muted-foreground mt-2">
                    X運用で必須となる「他ジャンルからの発想の輸入」をAIで完全自動化。
                    あなたに合ったリサーチ方法を選び、AIに最強のオリジナル投稿案を作らせましょう。
                </p>
            </div>

            {/* Custom Tabs Navigation */}
            <div className="flex overflow-x-auto space-x-1 border-b border-white/10 dark:border-gray-800 pb-1">
                {[
                    { id: "ai", label: "🤖 AIおまかせ提案", icon: Sparkles },
                    { id: "hq", label: "🌟 本部ナレッジ引用", icon: Database },
                    { id: "trend", label: "📈 トレンド検索", icon: TrendingUp },
                    { id: "manual", label: "✍️ 手動入力", icon: Search },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 rounded-t-xl
                            ${activeTab === tab.id 
                                ? "border-blue-600 text-blue-700 bg-blue-50/50 dark:text-blue-400 dark:border-blue-500"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-gray-800"}`}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/60"}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 動的入力エリア */}
                <div className="space-y-6">
                    {activeTab === "ai" && (
                        <Card className="border-blue-200 dark:border-blue-900 shadow-sm bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-900 dark:to-blue-900/10">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-blue-500" />
                                    ゼロベース AIおまかせリサーチ
                                </CardTitle>
                                <CardDescription>
                                    AI自身が持つ「普遍的にバズりやすい無数の型と感情ベクトル」の記憶から、今の自社ターゲットに最も刺さる型を自動で選び出して投稿案を直クラフトします。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-center pb-8 pt-4">
                                <div className="p-6 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-blue-100 dark:border-blue-800 backdrop-blur-sm mb-6">
                                    <p className="text-sm text-muted-foreground font-medium mb-4">
                                        💡 リサーチ不要。ボタンを推すだけで、AIの頭脳にあるバズロジックを引き出します。
                                    </p>
                                    <Button 
                                        onClick={handleAIAutoResearch} 
                                        disabled={isGenerating}
                                        size="lg"
                                        className="w-full h-16 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                    >
                                        {isGenerating ? (
                                            <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> 脳内リサーチ＆生成中...</>
                                        ) : (
                                            <><Zap className="mr-2 h-6 w-6" /> AIに最強のポスト案を3つ作らせる</>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "hq" && (
                        <Card className="border-purple-200 dark:border-purple-900 shadow-sm bg-gradient-to-br from-white to-purple-50/50 dark:from-slate-900 dark:to-purple-900/10">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Database className="w-5 h-5 text-purple-500" />
                                    本部ナレッジからの自動横展開
                                </CardTitle>
                                <CardDescription>
                                    すでに別のアカウントで成果が出ている「本部共有済みの勝ちパターン（ナレッジ）」をピックアップし、自社用に書き換えます。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold text-muted-foreground">本部のおすすめナレッジ (ランダム3件)</span>
                                    <Button variant="outline" size="sm" onClick={fetchHqSuggestions} disabled={isLoadingHq}>
                                        🔄 再取得
                                    </Button>
                                </div>

                                {isLoadingHq ? (
                                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-500" /></div>
                                ) : hqSuggestions.length === 0 ? (
                                    <p className="text-center text-sm text-gray-400 py-8">現在表示できる本部ナレッジがありません。</p>
                                ) : (
                                    <div className="space-y-3">
                                        {hqSuggestions.map(s => (
                                            <div key={s.id} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-purple-100 dark:border-purple-900/30 shadow-sm hover:border-purple-300 dark:hover:border-purple-800 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">{s.category}</Badge>
                                                    <Button size="sm" variant="default" className="bg-purple-600 hover:bg-purple-700" disabled={isGenerating} onClick={() => handleHqRepurpose(s)}>
                                                        {isGenerating ? "適用中..." : "この型を使う"}
                                                    </Button>
                                                </div>
                                                <p className="text-sm mt-2 line-clamp-2 text-foreground/80 dark:text-gray-300">{s.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "trend" && (
                        <Card className="border-emerald-200 dark:border-emerald-900 shadow-sm bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-900/10">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                                    Xトレンド 自動検索＆横展開
                                </CardTitle>
                                <CardDescription>
                                    キーワードを指定すると、仮想のX APIを経由して関連するバズポストの構造を即座に抽出し、あなたのテーマに変換します。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">検索キーワード</label>
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="例：マーケティング、健康、副業 など" 
                                            value={trendKeyword}
                                            onChange={(e) => setTrendKeyword(e.target.value)}
                                            className="text-lg py-6"
                                        />
                                        <Button 
                                            onClick={handleTrendResearch} 
                                            disabled={isGenerating || !trendKeyword}
                                            className="h-auto px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                        >
                                            {isGenerating ? <Loader2 className="animate-spin w-5 h-5" /> : "検索して型を盗む"}
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg text-sm text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                                    ※現在は概念実証（MVP）のため、仮想トレンド検索モードで動作します。入力したキーワード周辺の一般的なバズ構造をシミュレーションして出力します。
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "manual" && (
                        <Card className="border-white/10 shadow-sm bg-white/5 dark:bg-gray-900/10">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Search className="w-5 h-5 text-muted-foreground" />
                                    手動リサーチ・横展開
                                </CardTitle>
                                <CardDescription>
                                    他テーマのバズ投稿テキストを貼り付けて構造を抽出します。同業者の投稿はパクリになるため別ジャンルを推奨します。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea
                                    placeholder="【実は...】という一文で始まる投稿や、箇条書きで構成された投稿など..."
                                    value={sourceText}
                                    onChange={(e) => setSourceText(e.target.value)}
                                    className="min-h-[200px] resize-none bg-white dark:bg-slate-900"
                                />
                                
                                <Button 
                                    onClick={handleManualRepurpose} 
                                    disabled={isGenerating || !sourceText}
                                    className="w-full h-12 text-md font-bold"
                                >
                                    {isGenerating ? (
                                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 要素分解＆横展開を実行中...</>
                                    ) : (
                                        <><Zap className="mr-2 h-5 w-5" /> テキストを解析して自社テーマに置き換える</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* 結果出力エリア */}
                <div className="space-y-6">
                    {isGenerating && (
                        <div className="h-[400px] flex flex-col items-center justify-center space-y-4 border-2 border-dashed rounded-xl p-6 text-center text-muted-foreground bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
                            <Loader2 className="h-12 w-12 animate-spin text-blue-500 relative z-10" />
                            <p className="font-bold text-lg relative z-10 text-slate-700 dark:text-slate-300">
                                AIがバズの設計図を構築中...
                            </p>
                            <p className="text-sm relative z-10 max-w-xs">
                                表面的な言葉を削ぎ落とし、純粋な構造（型）と感情ベクトル（16の熱量）の掛け合わせを計算しています。
                            </p>
                        </div>
                    )}

                    {!isGenerating && !result && (
                        <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground bg-white/50 dark:bg-slate-900/50">
                            <Sparkles className="h-16 w-16 mb-4 text-muted-foreground/40 dark:text-gray-700" />
                            <p className="text-lg font-medium text-muted-foreground">結果待機中...</p>
                            <p className="text-sm mt-2 max-w-sm">左側のエリアからリサーチ方法を選び、実行させるとここに生成された投稿案が表示されます。</p>
                        </div>
                    )}

                    {result && !isGenerating && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* 分析結果 */}
                            <Card className="border-blue-200 dark:border-blue-900 shadow-md">
                                <CardHeader className="bg-blue-50/50 dark:bg-blue-900/20 py-4 border-b border-blue-100 dark:border-blue-800">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        抽出・適用されたバズの設計図
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div>
                                        <h4 className="text-sm font-bold text-muted-foreground mb-1">📝 適用した 「型（骨組み）」</h4>
                                        <p className="text-sm leading-relaxed p-3 bg-white/5 dark:bg-slate-800 rounded-md border border-white/10 dark:border-slate-700 text-foreground/80 dark:text-slate-300 font-medium">
                                            {result.extracted_format}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-muted-foreground mb-2">🔥 刺激している「感情の16ベクトル」</h4>
                                        <Badge variant="default" className="text-sm px-3 py-1 bg-gradient-to-r from-red-500 to-orange-500 shadow-sm border-none">
                                            {result.extracted_emotion}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 生成された横展開ポスト */}
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold flex items-center gap-2 mt-8">
                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                    自社テーマへのオリジナル投稿案 ({result.generated_posts.length}件)
                                </h3>
                                
                                <div className="space-y-4">
                                    {result.generated_posts.map((post, index) => (
                                        <Card key={index} className="overflow-hidden border-white/10 hover:border-white/20 transition-colors shadow-sm">
                                            <div className="bg-white/5 dark:bg-gray-800/50 px-4 py-2 border-b border-white/10 flex justify-between items-center">
                                                <span className="text-sm font-bold text-foreground/80 dark:text-gray-300">
                                                    生成ポスト案 {index + 1}
                                                </span>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 text-xs hover:bg-white"
                                                    onClick={() => copyToClipboard(post)}
                                                >
                                                    <Copy className="w-3 h-3 mr-1" />
                                                    コピーして使う
                                                </Button>
                                            </div>
                                            <CardContent className="p-0">
                                                <Textarea 
                                                    readOnly 
                                                    value={post} 
                                                    className="min-h-[140px] text-sm whitespace-pre-wrap leading-relaxed font-mono rounded-none border-0 focus-visible:ring-0 p-4 bg-white dark:bg-slate-900"
                                                />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
