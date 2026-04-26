"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, Zap, CheckCircle2, Copy, Sparkles, AtSign, ShieldAlert, Heart, Repeat, MessageCircle, Quote, ExternalLink, Wand2, Pencil, Save, X, CalendarPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type FetchedPost = {
    text: string;
    author: { username: string | null; displayName: string | null };
    metrics: { likes: number; retweets: number; replies: number; quotes: number; impressions: number | null };
    tweetUrl: string | null;
    createdAt: string | null;
    mode: "url" | "username";
};

type GeneratedVariant = {
    angle_key: string;
    angle_label: string;
    content: string;
};

type Placeholder = { key: string; meaning: string };

type RepurposeResult = {
    extracted_format: string;
    extracted_emotion: string;
    generated_posts: string[];
    generated_variants?: GeneratedVariant[];
    template?: string;
    placeholders?: Placeholder[];
    _fallback?: boolean;
    _message?: string;
    _engine?: string;
    _user_theme?: string;
    _used_theme?: {
        target_audience: string;
        target_pain: string;
        account_concept: string;
        profile: string;
        cta_url: string;
    };
};

export default function ResearchPage() {
    const [activeTab, setActiveTab] = useState<"ai" | "target" | "manual">("ai");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [result, setResult] = useState<RepurposeResult | null>(null);

    // Manual Tab State
    const [sourceText, setSourceText] = useState("");

    // @username or URL tab state
    const [targetInput, setTargetInput] = useState("");
    const [fetchedPost, setFetchedPost] = useState<FetchedPost | null>(null);

    // 共通：ユーザー入力テーマ（書き換え時の必須入力）
    const [userTheme, setUserTheme] = useState("");

    // 生成結果カードの編集状態
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<string>("");
    const [savingToSchedulerIdx, setSavingToSchedulerIdx] = useState<number | null>(null);

    // 1. AIおまかせリサーチ
    const handleAIAutoResearch = async () => {
        setFetchedPost(null);
        await executeRepurposeRequest("/api/research/auto_ai", {});
    };

    // 2a. @username または URL → ポスト取得のみ
    const handleFetchPost = async () => {
        const v = targetInput.trim();
        if (!v) {
            alert("@ユーザー名または投稿 URL を入力してください。");
            return;
        }
        try {
            setIsFetching(true);
            setResult(null);
            setFetchedPost(null);

            const res = await fetch("/api/research/fetch-post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input: v }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "取得に失敗しました。");
            }
            const data: FetchedPost = await res.json();
            setFetchedPost(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            alert(`エラー: ${msg}`);
        } finally {
            setIsFetching(false);
        }
    };

    // 2b. 取得したポストを自社テーマに書き換え（新：テンプレ化 → テーマ穴埋め）
    const handleRewriteFetched = async () => {
        if (!fetchedPost) return;
        if (!userTheme.trim()) {
            alert("テーマを入力してください（書き換えには必須です）。");
            return;
        }
        await executeRepurposeRequest("/api/research/structure-rewrite", {
            sourcePostText: fetchedPost.text,
            userTheme: userTheme.trim(),
        });
    };

    // 3. 手動リサーチ（同じくテンプレ化 → テーマ穴埋め）
    const handleManualRepurpose = async () => {
        if (!sourceText.trim()) {
            alert("横展開の元となる投稿テキストを入力してください。");
            return;
        }
        if (!userTheme.trim()) {
            alert("テーマを入力してください（書き換えには必須です）。");
            return;
        }
        setFetchedPost(null);
        await executeRepurposeRequest("/api/research/structure-rewrite", {
            sourcePostText: sourceText,
            userTheme: userTheme.trim(),
        });
    };

    // --- 共通リクエスト実行関数（AI生成系） ---
    const executeRepurposeRequest = async (endpoint: string, payload: Record<string, unknown>) => {
        try {
            setIsGenerating(true);
            setResult(null);

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "解析エラーが発生しました。");
            }

            const data = await res.json();
            setResult(data);
        } catch (error: unknown) {
            console.error(error);
            const msg = error instanceof Error ? error.message : String(error);
            alert(`エラーが発生しました: ${msg}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("クリップボードに投稿テキストをコピーしました。");
    };

    // 編集開始
    const handleStartEditVariant = (index: number, content: string) => {
        setEditingIndex(index);
        setEditDraft(content);
    };

    // 編集キャンセル
    const handleCancelEditVariant = () => {
        setEditingIndex(null);
        setEditDraft("");
    };

    // 編集確定：result の generated_variants / generated_posts の該当インデックスだけ書き換える
    const handleConfirmEditVariant = (index: number) => {
        if (!result) return;
        const newContent = editDraft.trim();
        if (!newContent) {
            alert("本文は空にできません。");
            return;
        }
        setResult(prev => {
            if (!prev) return prev;
            const variants = [...(prev.generated_variants ?? [])];
            const posts = [...prev.generated_posts];
            if (variants[index]) variants[index] = { ...variants[index], content: newContent };
            if (posts[index] !== undefined) posts[index] = newContent;
            return { ...prev, generated_variants: variants, generated_posts: posts };
        });
        setEditingIndex(null);
        setEditDraft("");
    };

    // スケジューラー（DB）に DRAFT として保存
    const handleSaveVariantToScheduler = async (index: number, content: string) => {
        if (!content.trim()) {
            alert("本文が空のため保存できません。");
            return;
        }
        setSavingToSchedulerIdx(index);
        try {
            const res = await fetch("/api/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content,
                    platform: "X",
                    status: "DRAFT",
                }),
            });
            if (res.ok) {
                alert("✅ スケジューラーに下書き保存しました。\n左メニュー『投稿スケジューラー』から配信設定できます。");
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`❌ 保存に失敗しました: ${err.message || res.status}`);
            }
        } catch (error) {
            console.error("Save to scheduler error:", error);
            alert("通信エラーが発生しました。");
        } finally {
            setSavingToSchedulerIdx(null);
        }
    };

    const tabs: { id: "ai" | "target" | "manual"; label: string; Icon: typeof Sparkles }[] = [
        { id: "ai", label: "🤖 AIおまかせ提案", Icon: Sparkles },
        { id: "target", label: "🔍 @username / URL から取得", Icon: AtSign },
        { id: "manual", label: "✍️ 手動入力", Icon: Search },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">🔎 完全自動リサーチ＆横展開</h1>
                <p className="text-slate-600 mt-2">
                    X運用で必須となる「他ジャンルからの発想の輸入」をAIで自動化。
                    リサーチ方法を選び、AIに最強のオリジナル投稿案を作らせましょう。
                </p>
            </div>

            {/* Custom Tabs Navigation */}
            <div className="flex overflow-x-auto space-x-1 border-b border-slate-200 pb-1">
                {tabs.map(({ id, label, Icon }) => {
                    const active = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 rounded-t-xl whitespace-nowrap
                                ${active
                                    ? "border-blue-600 text-blue-700 bg-blue-50"
                                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                        >
                            <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-400"}`} />
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 動的入力エリア */}
                <div className="space-y-6">
                    {activeTab === "ai" && (
                        <Card className="border-blue-200 shadow-sm bg-white">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
                                    <Sparkles className="w-5 h-5 text-blue-500" />
                                    ゼロベース AIおまかせリサーチ
                                </CardTitle>
                                <CardDescription className="text-slate-600">
                                    AI自身が持つ「普遍的にバズりやすい無数の型と感情ベクトル」から、今の自社ターゲットに最も刺さる型を自動で選び、投稿案を直クラフトします。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pb-8 pt-2">
                                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                                    <p className="text-sm text-slate-700 font-medium mb-4 text-center">
                                        💡 リサーチ不要。ボタンを押すだけで AI が 3つの投稿案を生成します。
                                    </p>
                                    <Button
                                        onClick={handleAIAutoResearch}
                                        disabled={isGenerating}
                                        size="lg"
                                        className="w-full h-16 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
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

                    {activeTab === "target" && (
                        <Card className="border-sky-200 shadow-sm bg-white">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
                                    <AtSign className="w-5 h-5 text-sky-500" />
                                    @username または 投稿 URL から取得
                                </CardTitle>
                                <CardDescription className="text-slate-600">
                                    @ユーザー名なら最近の公開ポストから人気順のトップ1を自動選出。投稿 URL（x.com/～/status/～）を直接貼り付ければその1件を取得します。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">@username もしくは 投稿 URL</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                            <Input
                                                placeholder="username または https://x.com/username/status/..."
                                                value={targetInput}
                                                onChange={(e) => setTargetInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !e.nativeEvent.isComposing && !isFetching && !isGenerating && targetInput.trim()) {
                                                        e.preventDefault();
                                                        handleFetchPost();
                                                    }
                                                }}
                                                className="pl-9 text-base h-12 bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                                                autoCapitalize="off"
                                                autoCorrect="off"
                                                spellCheck={false}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleFetchPost}
                                            disabled={isFetching || isGenerating || !targetInput.trim()}
                                            className="h-12 px-5 bg-sky-600 hover:bg-sky-700 text-white font-bold"
                                        >
                                            {isFetching ? <Loader2 className="animate-spin w-5 h-5" /> : "取得"}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        ※ 設定画面の X API キー（BYOK）で認証。非公開アカウントは取得できません。
                                    </p>
                                </div>

                                {/* テーマ入力（書き換え時の必須入力） */}
                                {fetchedPost && (
                                    <div className="space-y-2 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                        <label className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">!</span>
                                            書き換え後のメインテーマ <span className="text-rose-600">*必須</span>
                                        </label>
                                        <Input
                                            placeholder="例: AIを使った営業効率化 / LINE公式のCV最大化 / プロラインで自動集客 など"
                                            value={userTheme}
                                            onChange={(e) => setUserTheme(e.target.value)}
                                            className="h-11 bg-white border-indigo-300 text-slate-900 placeholder:text-slate-400"
                                            maxLength={120}
                                        />
                                        <p className="text-xs text-indigo-700">
                                            元ポストの骨組みに、この1行のテーマと自社ナレッジから抽出した言葉を埋め込みます。できるだけ具体的に入力してください。
                                        </p>
                                    </div>
                                )}

                                {/* 取得後のプレビュー + 書き換えボタン */}
                                {fetchedPost && (
                                    <div className="space-y-3 p-4 bg-sky-50 border border-sky-200 rounded-lg">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="text-sm">
                                                <span className="font-bold text-sky-700">{fetchedPost.author.username || "(取得元)"}</span>
                                                {fetchedPost.author.displayName && (
                                                    <span className="text-slate-500 text-xs ml-1">({fetchedPost.author.displayName})</span>
                                                )}
                                            </div>
                                            {fetchedPost.tweetUrl && (
                                                <a
                                                    href={fetchedPost.tweetUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-sky-700 hover:text-sky-900 inline-flex items-center gap-1"
                                                >
                                                    元ポストを開く <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>

                                        <div className="p-3 bg-white border border-sky-100 rounded-md text-sm whitespace-pre-wrap text-slate-800 leading-relaxed">
                                            {fetchedPost.text}
                                        </div>

                                        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                                            <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500" /> {fetchedPost.metrics.likes.toLocaleString()}</span>
                                            <span className="inline-flex items-center gap-1"><Repeat className="w-3.5 h-3.5 text-emerald-500" /> {fetchedPost.metrics.retweets.toLocaleString()}</span>
                                            <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-sky-500" /> {fetchedPost.metrics.replies.toLocaleString()}</span>
                                            <span className="inline-flex items-center gap-1"><Quote className="w-3.5 h-3.5 text-violet-500" /> {fetchedPost.metrics.quotes.toLocaleString()}</span>
                                            {fetchedPost.metrics.impressions !== null && (
                                                <span className="inline-flex items-center gap-1 text-slate-700 font-medium">👁️ {fetchedPost.metrics.impressions.toLocaleString()} imp</span>
                                            )}
                                        </div>

                                        <Button
                                            onClick={handleRewriteFetched}
                                            disabled={isGenerating || !userTheme.trim()}
                                            className="w-full h-12 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold disabled:opacity-50"
                                        >
                                            {isGenerating ? (
                                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> 分析＆自社テーマに書き換え中...</>
                                            ) : (
                                                <><Wand2 className="mr-2 h-5 w-5" /> このポストを自社テーマに書き換える</>
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {/* X 規約コンプライアンス表示 */}
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex gap-2 text-xs text-amber-900 leading-relaxed">
                                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                                    <div>
                                        <span className="font-semibold">X 開発者規約準拠：</span>
                                        公式 X API のみ使用（スクレイピング禁止）、取得した他人のポスト本文は DB 保存せず一時処理、出力は「構造」を参考にした独自投稿で、元ポストをそのまま再投稿する機能は提供しません。
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "manual" && (
                        <Card className="border-slate-200 shadow-sm bg-white">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
                                    <Search className="w-5 h-5 text-slate-500" />
                                    手動リサーチ・横展開
                                </CardTitle>
                                <CardDescription className="text-slate-600">
                                    他ジャンルのバズ投稿テキストを貼り付けて構造を抽出します。同業者の投稿はパクリ扱いになる恐れがあるため、別ジャンルを推奨します。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea
                                    placeholder="【実は...】という一文で始まる投稿や、箇条書きで構成された投稿など..."
                                    value={sourceText}
                                    onChange={(e) => setSourceText(e.target.value)}
                                    className="min-h-[200px] resize-none bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                                />

                                {/* テーマ入力（必須） */}
                                <div className="space-y-2 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                    <label className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">!</span>
                                        書き換え後のメインテーマ <span className="text-rose-600">*必須</span>
                                    </label>
                                    <Input
                                        placeholder="例: AIを使った営業効率化 / LINE公式のCV最大化 / プロラインで自動集客 など"
                                        value={userTheme}
                                        onChange={(e) => setUserTheme(e.target.value)}
                                        className="h-11 bg-white border-indigo-300 text-slate-900 placeholder:text-slate-400"
                                        maxLength={120}
                                    />
                                    <p className="text-xs text-indigo-700">
                                        元ポストの骨組みに、この1行のテーマと自社ナレッジから抽出した言葉を埋め込みます。できるだけ具体的に入力してください。
                                    </p>
                                </div>

                                <Button
                                    onClick={handleManualRepurpose}
                                    disabled={isGenerating || !sourceText || !userTheme.trim()}
                                    className="w-full h-12 text-md font-bold bg-slate-900 hover:bg-slate-800 text-white"
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
                        <div className="h-[400px] flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-white shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
                            <Loader2 className="h-12 w-12 animate-spin text-blue-500 relative z-10" />
                            <p className="font-bold text-lg relative z-10 text-slate-800">
                                AIがバズの設計図を構築中...
                            </p>
                            <p className="text-sm relative z-10 max-w-xs text-slate-600">
                                表面的な言葉を削ぎ落とし、純粋な構造（型）と感情ベクトル（16の熱量）の掛け合わせを計算しています。
                            </p>
                        </div>
                    )}

                    {!isGenerating && !result && (
                        <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-white">
                            <Sparkles className="h-16 w-16 mb-4 text-slate-300" />
                            <p className="text-lg font-medium text-slate-600">結果待機中...</p>
                            <p className="text-sm mt-2 max-w-sm text-slate-500">左側からリサーチ方法を選び、実行すると生成された投稿案がここに表示されます。</p>
                        </div>
                    )}

                    {result && !isGenerating && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* 分析結果（投稿の型 + 感情ベクトル） */}
                            <Card className="border-blue-200 shadow-md bg-white overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 py-4 border-b border-blue-100">
                                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                                        <Search className="w-5 h-5 text-blue-600" />
                                        抽出・適用されたバズの設計図
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-5 space-y-5">
                                    {/* 投稿の型 */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-bold text-slate-700">📝 採用された「投稿の型（骨組み）」</h4>
                                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Post Template</span>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-md border-l-4 border-blue-500 text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                                            {result.extracted_format}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">
                                            ※ この「型」は、ポストの導入・展開・結論などの構成パターンを言語化したものです。生成された3案は、この骨組みに沿って自社テーマで書き起こされています。
                                        </p>
                                    </div>

                                    {/* 感情の16ベクトル */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-bold text-slate-700">🔥 刺激している「感情の16ベクトル」</h4>
                                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Emotion Vector</span>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-md border border-orange-200">
                                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white flex items-center justify-center text-2xl shadow-md">
                                                🔥
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-base font-bold text-slate-900 leading-tight">
                                                    {result.extracted_emotion}
                                                </div>
                                                <p className="text-xs text-slate-600 mt-1">
                                                    読者の「熱量」を動かす感情の種類。FUN / WOW / 尊い / 癒し / 感動 / 知識 / あるある / 納得 / 主張 / 物申す / 応援 / 共感 / 驚愕 / 好奇心 / 危機感 / 欲求 の 16 ベクトルから採用されています。
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* テンプレート（プレースホルダ可視化）*/}
                                    {result.template && (
                                        <div className="pt-3 border-t border-slate-200">
                                            <h4 className="text-sm font-bold text-slate-700 mb-2">🧩 抽出したテンプレート（ここに穴埋めされました）</h4>
                                            <div className="p-3 bg-violet-50 border border-violet-200 rounded-md text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-mono">
                                                {result.template}
                                            </div>
                                            {result.placeholders && result.placeholders.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {result.placeholders.map((p, i) => (
                                                        <Badge key={i} variant="outline" className="bg-violet-50 border-violet-200 text-violet-700 text-[10px]">
                                                            <span className="font-bold">{p.key}</span>
                                                            <span className="ml-1 text-slate-500">{p.meaning}</span>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                            {result._user_theme && (
                                                <p className="text-xs text-slate-600 mt-2">
                                                    ▶ 入力テーマ: <span className="font-semibold text-indigo-700">「{result._user_theme}」</span> と自社ナレッジを使って穴埋めしています。
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {result._fallback && result._message && (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                            ⚠️ {result._message}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* 生成された横展開ポスト */}
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold flex items-center gap-2 mt-8 text-slate-900">
                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                    自社テーマへのオリジナル投稿案 ({result.generated_posts.length}件)
                                </h3>

                                <div className="space-y-4">
                                    {(result.generated_variants && result.generated_variants.length > 0
                                        ? result.generated_variants
                                        : result.generated_posts.map((content, i): GeneratedVariant => ({ angle_key: `v${i}`, angle_label: `案 ${i + 1}`, content }))
                                    ).map((variant, index) => {
                                        const badgeStyle = variant.angle_key === "audience"
                                            ? "bg-sky-100 text-sky-800 border-sky-200"
                                            : variant.angle_key === "pain"
                                                ? "bg-rose-100 text-rose-800 border-rose-200"
                                                : variant.angle_key === "concept"
                                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                    : "bg-slate-100 text-slate-700 border-slate-200";
                                        const isEditingThis = editingIndex === index;
                                        const isSavingThis = savingToSchedulerIdx === index;
                                        return (
                                            <Card key={index} className={`overflow-hidden border-slate-200 hover:border-slate-300 transition-colors shadow-sm bg-white ${isEditingThis ? "ring-2 ring-amber-400/50" : ""}`}>
                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-700">
                                                            案 {index + 1}
                                                        </span>
                                                        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${badgeStyle}`}>
                                                            {variant.angle_label}
                                                        </Badge>
                                                        {isEditingThis && (
                                                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 border-amber-200">
                                                                ✏️ 編集中
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {isEditingThis ? (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8 text-xs bg-white hover:bg-slate-100 border-slate-300 text-slate-700"
                                                                    onClick={handleCancelEditVariant}
                                                                >
                                                                    <X className="w-3 h-3 mr-1" />
                                                                    キャンセル
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                                                                    onClick={() => handleConfirmEditVariant(index)}
                                                                >
                                                                    <Save className="w-3 h-3 mr-1" />
                                                                    編集を確定
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8 text-xs bg-white hover:bg-slate-100 border-slate-300 text-slate-700"
                                                                    onClick={() => copyToClipboard(variant.content)}
                                                                    disabled={isSavingThis}
                                                                >
                                                                    <Copy className="w-3 h-3 mr-1" />
                                                                    コピー
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8 text-xs bg-white hover:bg-slate-100 border-slate-300 text-slate-700"
                                                                    onClick={() => handleStartEditVariant(index, variant.content)}
                                                                    disabled={editingIndex !== null || isSavingThis}
                                                                >
                                                                    <Pencil className="w-3 h-3 mr-1" />
                                                                    編集
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                                                                    onClick={() => handleSaveVariantToScheduler(index, variant.content)}
                                                                    disabled={editingIndex !== null || isSavingThis}
                                                                >
                                                                    {isSavingThis ? (
                                                                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 保存中</>
                                                                    ) : (
                                                                        <><CalendarPlus className="w-3 h-3 mr-1" /> スケジューラーに保存</>
                                                                    )}
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <CardContent className="p-0">
                                                    {isEditingThis ? (
                                                        <div className="flex flex-col">
                                                            <Textarea
                                                                value={editDraft}
                                                                onChange={(e) => setEditDraft(e.target.value)}
                                                                className="min-h-[160px] text-sm whitespace-pre-wrap leading-relaxed font-mono rounded-none border-0 focus-visible:ring-0 p-4 bg-amber-50/40 text-slate-800"
                                                                placeholder="投稿本文を編集..."
                                                                autoFocus
                                                            />
                                                            <div className="flex items-center justify-between text-[11px] px-4 py-1.5 bg-amber-50 border-t border-amber-100 text-amber-900">
                                                                <span>{editDraft.length} 文字</span>
                                                                <span className="text-amber-700/80">この編集は確定するまで保存されません</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <Textarea
                                                            readOnly
                                                            value={variant.content}
                                                            className="min-h-[140px] text-sm whitespace-pre-wrap leading-relaxed font-mono rounded-none border-0 focus-visible:ring-0 p-4 bg-white text-slate-800"
                                                        />
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
