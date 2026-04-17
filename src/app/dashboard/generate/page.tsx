"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ThinkingLog, type ResearchLogEntry } from "@/components/prox/thinking-log";
import { ResearchToggle } from "@/components/prox/research-toggle";
import { GlassCard } from "@/components/prox/glass-card";
import { Sparkles, Send, Trash2, Plus, ImagePlus, TreePine, Rocket, PenLine } from "lucide-react";

export default function GeneratePreviewPage() {
    const [loading, setLoading] = useState(false);
    const [generatedPost, setGeneratedPost] = useState<{ content: string, platform: string } | null>(null);
    const [error, setError] = useState("");
    const [userSettings, setUserSettings] = useState<any>(null);
    const [knowledges, setKnowledges] = useState<any[]>([]);
    const [pastPosts, setPastPosts] = useState<any[]>([]);
    const [kpis, setKpis] = useState<any[]>([]);
    const [enforce140, setEnforce140] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [userTheme, setUserTheme] = useState("");
    const [saveAsKnowledge, setSaveAsKnowledge] = useState(false);

    // スレッド・インプ連動用ステート
    const [threadContents, setThreadContents] = useState<string[]>([]);
    const [impressionTarget, setImpressionTarget] = useState<number | "">("");
    const [impressionReplyContent, setImpressionReplyContent] = useState<string>("");

    // 画像アップロード用ステート
    const [attachedImages, setAttachedImages] = useState<string[]>([]);
    const [uploadingImage, setUploadingImage] = useState(false);

    // ProX新機能：リアルタイムリサーチ
    const [researchEnabled, setResearchEnabled] = useState(false);
    const [researchLogs, setResearchLogs] = useState<ResearchLogEntry[]>([]);
    const [isResearching, setIsResearching] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const timestamp = Date.now();

                const settingsRes = await fetch(`/api/settings?t=${timestamp}`).catch(() => null);
                if (settingsRes && settingsRes.ok) {
                    const settingsData = await settingsRes.json().catch(() => ({}));
                    if (!settingsData.message) setUserSettings(settingsData);
                }

                const knowledgeRes = await fetch(`/api/knowledge?t=${timestamp}`).catch(() => null);
                if (knowledgeRes && knowledgeRes.ok) {
                    const knowledgeData = await knowledgeRes.json().catch(() => []);
                    setKnowledges(knowledgeData);
                }

                const pastPostsRes = await fetch(`/api/past-posts?t=${timestamp}`).catch(() => null);
                if (pastPostsRes && pastPostsRes.ok) {
                    const pastPostsData = await pastPostsRes.json().catch(() => []);
                    if (!pastPostsData.message) setPastPosts(pastPostsData);
                }

                const kpiRes = await fetch(`/api/kpi?t=${timestamp}`).catch(() => null);
                if (kpiRes && kpiRes.ok) {
                    const kpiData = await kpiRes.json().catch(() => ({}));
                    if (!kpiData.message) setKpis(kpiData.scenarios || []);
                }

            } catch (err) {
                console.error("Failed to fetch data", err);
            }
        };
        fetchData();
    }, []);

    // リサーチログにエントリを追加するヘルパー
    const addResearchLog = (type: ResearchLogEntry["type"], message: string, detail?: string) => {
        const entry: ResearchLogEntry = {
            id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type,
            message,
            timestamp: Date.now(),
            detail,
        };
        setResearchLogs(prev => [...prev, entry]);
    };

    const handleGenerate = async () => {
        setLoading(true);
        setError("");
        setResearchLogs([]);

        try {
            if (!userSettings) {
                throw new Error("設定データが読み込めませんでした。左の「設定・ペルソナ登録」からまずは設定を保存してください。");
            }

            // リサーチモードがオンの場合、思考ログを表示
            if (researchEnabled) {
                setIsResearching(true);
                addResearchLog("thinking", "生成パラメータを構築中...");
                await new Promise(r => setTimeout(r, 600));
                addResearchLog("searching", "Xトレンドをリサーチ中...", "MCP経由でリアルタイムデータを取得");
                await new Promise(r => setTimeout(r, 1200));
                addResearchLog("analyzing", "トレンドデータを分析し、最適なテーマを選定中...");
                await new Promise(r => setTimeout(r, 800));
            }

            const positiveRules = knowledges.filter(k => k.type === "WINNING").map(k => k.content);
            const negativeRules = knowledges.filter(k => k.type === "LOSING").map(k => k.content);
            const templateRules = knowledges.filter(k => k.type === "TEMPLATE").map(k => k.content);

            if (researchEnabled) {
                addResearchLog("thinking", "ナレッジベースと照合中...", `勝ちパターン: ${positiveRules.length}件, 禁止ルール: ${negativeRules.length}件`);
                await new Promise(r => setTimeout(r, 500));
            }

            const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    platform: "X",
                    target_audience: userSettings.targetAudience || "SNS運用代行会社、個人事業主",
                    target_pain: userSettings.targetPain || "フォロワーが伸びない、集客から販売につながらない",
                    cta_url: userSettings.ctaUrl || "https://proline.example.com",
                    account_concept: userSettings.accountConcept || "",
                    profile: userSettings.profile || "",
                    policy: userSettings.policy || "",
                    template_rules: templateRules,
                    positive_rules: positiveRules,
                    negative_rules: negativeRules,
                    enforce_140_limit: enforce140,
                    past_posts: pastPosts.map(p => ({ content: p.content, imp: p.impressions })),
                    kpi_data: kpis.map(k => ({ name: k.name, target: k.targetValue, current: k.currentValue })),
                    user_theme: userTheme,
                    enable_research: researchEnabled,
                }),
            });

            if (!response.ok) {
                throw new Error("AIサーバーのエラーが発生しました");
            }

            const data = await response.json();

            if (researchEnabled) {
                addResearchLog("complete", "投稿の生成が完了しました");
                setIsResearching(false);
            }

            setGeneratedPost(data);
            setIsEditing(false);

            if (userTheme.trim() && saveAsKnowledge) {
                try {
                    await fetch("/api/knowledge", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "TEMPLATE",
                            category: "お気に入りテーマ",
                            content: `【保存されたテーマ指示】\n${userTheme}`,
                            source: "生成画面から手動保存"
                        })
                    });
                } catch (e) {
                    console.error("Failed to save knowledge", e);
                }
            }

        } catch (err: any) {
            setError(err.message || "生成に失敗しました。Pythonのサーバーが起動しているか確認してください。");
            if (researchEnabled) {
                addResearchLog("complete", "エラーが発生しました");
                setIsResearching(false);
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!generatedPost) return;
        setLoading(true);
        try {
            const res = await fetch("/api/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: generatedPost.content,
                    platform: generatedPost.platform,
                    status: "DRAFT",
                    threadContents: threadContents.length > 0 ? JSON.stringify(threadContents) : null,
                    impressionTarget: impressionTarget ? Number(impressionTarget) : null,
                    impressionReplyContent: impressionReplyContent || null,
                    mediaUrls: attachedImages.length > 0 ? JSON.stringify(attachedImages) : null
                })
            });

            if (res.ok) {
                alert("投稿を「スケジューラー」に保存しました！\nメニューから「投稿スケジューラー」を開いて配信設定を行ってください。");
                setGeneratedPost(null);
                setIsEditing(false);
                setThreadContents([]);
                setImpressionTarget("");
                setImpressionReplyContent("");
                setAttachedImages([]);
                setResearchLogs([]);
            } else {
                alert("保存に失敗しました");
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("エラーが発生しました");
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (attachedImages.length + files.length > 4) {
            alert("画像は最大4枚まで添付できます。");
            return;
        }

        setUploadingImage(true);
        try {
            const newUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append("file", files[i]);

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (res.ok) {
                    const data = await res.json();
                    newUrls.push(data.url);
                } else {
                    console.error("Upload failed for file:", files[i].name);
                }
            }
            setAttachedImages([...attachedImages, ...newUrls]);
        } catch (error) {
            console.error("Upload error:", error);
            alert("画像のアップロード中にエラーが発生しました。");
        } finally {
            setUploadingImage(false);
            e.target.value = "";
        }
    };

    return (
        <div className="space-y-6 max-w-4xl animate-fade-up">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                        <span className="text-gradient-prox">投稿生成</span>
                    </h2>
                    <p className="text-muted-foreground mt-2">
                        AIがリサーチ結果に基づいて生成した投稿を確認し、承認します。
                    </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground/70 cursor-pointer glass px-3 py-2 rounded-xl hover:bg-white/8 transition-colors">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded accent-purple-500"
                            checked={enforce140}
                            onChange={(e) => setEnforce140(e.target.checked)}
                        />
                        Xの無料枠上限（140文字）に収める
                    </label>
                    <Button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="gradient-prox border-0 text-white shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transition-all rounded-xl px-6 py-2.5"
                    >
                        {loading ? (
                            <>
                                <span className="flex gap-1 mr-2">
                                    <span className="size-1.5 rounded-full bg-white animate-thinking-dot-1" />
                                    <span className="size-1.5 rounded-full bg-white animate-thinking-dot-2" />
                                    <span className="size-1.5 rounded-full bg-white animate-thinking-dot-3" />
                                </span>
                                AIが生成中...
                            </>
                        ) : (
                            <>
                                <Sparkles className="size-4 mr-2" />
                                投稿を生成する
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Research Toggle - ProX New Feature */}
            <div className="animate-fade-up-delay-1">
                <ResearchToggle
                    enabled={researchEnabled}
                    onToggle={setResearchEnabled}
                    className="w-full"
                />
            </div>

            {/* Theme Input */}
            <GlassCard className="animate-fade-up-delay-2">
                <div className="space-y-3">
                    <label className="flex items-center gap-2 font-semibold text-foreground/90">
                        <PenLine className="size-4 text-purple-400" />
                        投稿テーマ・要望の指定
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground font-normal">任意</span>
                    </label>
                    <p className="text-sm text-muted-foreground">
                        特定の話題や書き方がある場合に入力してください。空欄の場合はAIがおまかせでテーマを設定します。
                    </p>
                    <textarea
                        value={userTheme}
                        onChange={(e) => setUserTheme(e.target.value)}
                        placeholder="例：AIで業務効率化する具体的な体験談について書いて。読者の不安を煽るような文章で。"
                        className="w-full text-sm p-4 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/30 focus:outline-none placeholder:text-muted-foreground/40 text-foreground resize-none transition-all"
                        rows={3}
                    />
                    <div className="flex justify-end">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground/80 transition-colors">
                            <input
                                type="checkbox"
                                checked={saveAsKnowledge}
                                onChange={(e) => setSaveAsKnowledge(e.target.checked)}
                                className="w-4 h-4 rounded accent-purple-500"
                            />
                            このテーマをナレッジとして保存
                        </label>
                    </div>
                </div>
            </GlassCard>

            {/* Thinking Log - ProX New Feature */}
            <ThinkingLog
                logs={researchLogs}
                isActive={isResearching}
                className="animate-fade-up-delay-3"
            />

            {/* Error Display */}
            {error && (
                <div className="p-4 glass rounded-xl border-l-4 border-red-500 text-red-300 animate-fade-up">
                    {error}
                </div>
            )}

            {/* Generated Post Preview */}
            {generatedPost && (
                <div className="space-y-6 mt-4 animate-fade-up">
                    <GlassCard glow>
                        <div className="space-y-5">
                            {/* Post Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground">
                                        生成完了 — {generatedPost.platform}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {new Date().toLocaleString("ja-JP")}
                                    </p>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/20">
                                    承認待ち
                                </span>
                            </div>

                            {/* Post Content */}
                            {isEditing ? (
                                <textarea
                                    value={generatedPost.content}
                                    onChange={(e) => setGeneratedPost({ ...generatedPost, content: e.target.value })}
                                    className="w-full bg-white/5 p-5 rounded-xl border border-white/10 min-h-[150px] text-base text-foreground whitespace-pre-wrap resize-y focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
                                    placeholder="投稿内容を自由に編集できます"
                                />
                            ) : (
                                <div className="bg-white/5 p-5 rounded-xl border border-white/10 min-h-[150px] text-base text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                    {generatedPost.content}
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="text-muted-foreground hover:text-purple-300"
                                >
                                    <PenLine className="size-3.5 mr-1.5" />
                                    {isEditing ? "編集を確定" : "手動で編集"}
                                </Button>
                            </div>

                            <div className="h-px bg-white/5" />

                            {/* Thread Posts */}
                            <div className="space-y-3">
                                <h4 className="flex items-center gap-2 font-semibold text-foreground/80 text-sm">
                                    <TreePine className="size-4 text-emerald-400" />
                                    ツリー（スレッド）投稿
                                </h4>
                                <p className="text-xs text-muted-foreground">本投稿にぶら下げる形で連続投稿したい場合に入力します。</p>
                                {threadContents.map((t, index) => (
                                    <div key={index} className="flex gap-2 items-start">
                                        <div className="glass rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-2 text-xs text-muted-foreground font-medium">
                                            {index + 2}
                                        </div>
                                        <textarea
                                            value={t}
                                            onChange={(e) => {
                                                const newThreads = [...threadContents];
                                                newThreads[index] = e.target.value;
                                                setThreadContents(newThreads);
                                            }}
                                            className="w-full text-sm p-3 bg-white/5 border border-white/10 rounded-xl text-foreground focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
                                            rows={3}
                                            placeholder={`リプライ ${index + 1}`}
                                        />
                                        <Button variant="ghost" size="sm" className="mt-2 text-red-400 shrink-0 hover:text-red-300 hover:bg-red-500/10" onClick={() => {
                                            setThreadContents(threadContents.filter((_, i) => i !== index));
                                        }}>
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="ghost" size="sm" onClick={() => setThreadContents([...threadContents, ""])} className="text-muted-foreground hover:text-foreground">
                                    <Plus className="size-3.5 mr-1.5" />
                                    スレッドを追加
                                </Button>
                            </div>

                            <div className="h-px bg-white/5" />

                            {/* Image Upload */}
                            <div className="space-y-3">
                                <h4 className="flex items-center gap-2 font-semibold text-foreground/80 text-sm">
                                    <ImagePlus className="size-4 text-blue-400" />
                                    画像・メディア添付
                                    <span className="text-[10px] text-muted-foreground font-normal">最大4枚</span>
                                </h4>

                                {attachedImages.length > 0 && (
                                    <div className="flex flex-wrap gap-3 mt-2">
                                        {attachedImages.map((url, idx) => (
                                            <div key={idx} className="relative w-28 h-28 rounded-xl overflow-hidden glass">
                                                <img src={url} alt={`attached-${idx}`} className="object-cover w-full h-full" />
                                                <button
                                                    onClick={() => setAttachedImages(attachedImages.filter((_, i) => i !== idx))}
                                                    className="absolute top-1.5 right-1.5 bg-red-500/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500 transition-colors"
                                                >
                                                    x
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium glass rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all">
                                    <ImagePlus className="size-4" />
                                    {uploadingImage ? "アップロード中..." : "画像を選択"}
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        disabled={uploadingImage || attachedImages.length >= 4}
                                    />
                                </label>
                            </div>

                            <div className="h-px bg-white/5" />

                            {/* Impression Reply */}
                            <div className="space-y-3 glass-strong rounded-xl p-4">
                                <h4 className="flex items-center gap-2 font-semibold text-foreground/80 text-sm">
                                    <Rocket className="size-4 text-purple-400" />
                                    シャドウバン対策：インプ連動URLリプライ
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    本投稿にURLを含めずインプレッション低下を防ぎ、指定のインプレッション数到達時に自動でURL入りリプライを配信します。
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-foreground/70">発動インプレッション閾値</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={impressionTarget}
                                            onChange={(e) => setImpressionTarget(e.target.value ? Number(e.target.value) : "")}
                                            placeholder="例: 1000"
                                            className="w-full text-sm p-2.5 bg-white/5 border border-white/10 rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-foreground/70">追撃リプライ文章（URL等）</label>
                                        <textarea
                                            value={impressionReplyContent}
                                            onChange={(e) => setImpressionReplyContent(e.target.value)}
                                            placeholder="例: 詳細はこちら！ https://example.com"
                                            className="w-full text-sm p-2.5 bg-white/5 border border-white/10 rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => {
                                        setGeneratedPost(null);
                                        setThreadContents([]);
                                        setImpressionTarget("");
                                        setImpressionReplyContent("");
                                        setResearchLogs([]);
                                    }}
                                >
                                    <Trash2 className="size-4 mr-1.5" />
                                    破棄して再生成
                                </Button>
                                <Button
                                    onClick={handleApprove}
                                    disabled={loading}
                                    className="gradient-prox border-0 text-white shadow-lg hover:shadow-xl rounded-xl px-5"
                                >
                                    <Send className="size-4 mr-1.5" />
                                    承認・予約・自動投稿へ
                                </Button>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Empty State */}
            {!generatedPost && !loading && (
                <div className="mt-8 text-center py-16 glass rounded-2xl border border-dashed border-white/10 animate-fade-up-delay-3">
                    <Sparkles className="size-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground/50">
                        右上の「投稿を生成する」ボタンを押すと、AIが投稿を作成します。
                    </p>
                </div>
            )}
        </div>
    );
}
