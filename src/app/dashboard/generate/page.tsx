"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

export default function GeneratePreviewPage() {
    const [loading, setLoading] = useState(false);
    const [generatedPost, setGeneratedPost] = useState<{ content: string, platform: string } | null>(null);
    const [error, setError] = useState("");
    const [userSettings, setUserSettings] = useState<any>(null);
    const [knowledges, setKnowledges] = useState<any[]>([]);
    const [pastPosts, setPastPosts] = useState<any[]>([]);
    const [kpis, setKpis] = useState<any[]>([]);
    const [enforce140, setEnforce140] = useState(false);

    // スレッド・インプ連動用ステート
    const [threadContents, setThreadContents] = useState<string[]>([]);
    const [impressionTarget, setImpressionTarget] = useState<number | "">("");
    const [impressionReplyContent, setImpressionReplyContent] = useState<string>("");

    // 画像アップロード用ステート
    const [attachedImages, setAttachedImages] = useState<string[]>([]);
    const [uploadingImage, setUploadingImage] = useState(false);

    // マウント時にユーザーの設定とナレッジを読み込む
    useEffect(() => {
        const fetchData = async () => {
            try {
                // キャッシュ回避と、1つのAPIエラーが全体をブロックしないための個別fetch
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

    const handleGenerate = async () => {
        setLoading(true);
        setError("");
        try {
            if (!userSettings) {
                throw new Error("設定データが読み込めませんでした。左の「設定・ペルソナ登録」からまずは設定を保存してください。");
            }

            const positiveRules = knowledges.filter(k => k.type === "WINNING").map(k => k.content);
            const negativeRules = knowledges.filter(k => k.type === "LOSING").map(k => k.content);
            const templateRules = knowledges.filter(k => k.type === "TEMPLATE").map(k => k.content);

            // DBから取得した設定とナレッジを使ってPython APIを叩く
            const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
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
                    // スプレッドシート連携機能用：過去投稿とKPI
                    past_posts: pastPosts.map(p => ({ content: p.content, imp: p.impressions })),
                    kpi_data: kpis.map(k => ({ name: k.name, target: k.targetValue, current: k.currentValue }))
                }),
            });

            if (!response.ok) {
                throw new Error("AIサーバーのエラーが発生しました");
            }

            const data = await response.json();
            setGeneratedPost(data);
        } catch (err: any) {
            setError(err.message || "生成に失敗しました。Pythonのサーバーが起動しているか確認してください。");
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
                setThreadContents([]);
                setImpressionTarget("");
                setImpressionReplyContent("");
                setAttachedImages([]);
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

        // Xの仕様として通常4枚まで
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
            // inputをリセット
            e.target.value = "";
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">投稿生成 (プレビュー)</h2>
                    <p className="text-muted-foreground mt-2">
                        AIがリサーチ結果に基づいて生成した投稿を確認し、承認します。
                    </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer bg-gray-50 border px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
                        <input
                            type="checkbox"
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                            checked={enforce140}
                            onChange={(e) => setEnforce140(e.target.checked)}
                        />
                        Xの無料枠上限（140文字）に収める
                    </label>
                    <Button
                        variant="default"
                        onClick={handleGenerate}
                        disabled={loading}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 border-0"
                    >
                        {loading ? "⏳ AIが考え中..." : "✨ 今すぐAIで新しい投稿を生成する"}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-md">
                    {error}
                </div>
            )}

            {generatedPost && (
                <div className="space-y-6 mt-8">
                    <Card className="border-l-4 border-l-blue-500 shadow-md">
                        <CardHeader>
                            <div className="flex justify-between">
                                <div>
                                    <CardTitle className="text-xl">【生成完了】{generatedPost.platform}用投稿草案</CardTitle>
                                    <CardDescription>生成日時: {new Date().toLocaleString()}</CardDescription>
                                </div>
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold h-fit">承認待ち</span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-gray-50 p-6 rounded-md border min-h-[150px] font-medium text-lg text-gray-800 whitespace-pre-wrap">
                                {generatedPost.content}
                            </div>

                            <hr className="my-6 border-gray-200" />

                            {/* スレッド投稿の追加UI */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-gray-700">🌲 ツリー（スレッド）投稿の追加</h3>
                                <p className="text-xs text-gray-500">本投稿にぶら下げる形で連続投稿したい場合、ここに入力します。</p>
                                {threadContents.map((t, index) => (
                                    <div key={index} className="flex gap-2 items-start">
                                        <div className="bg-gray-200 text-gray-600 rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-2 text-xs">{index + 2}</div>
                                        <textarea
                                            value={t}
                                            onChange={(e) => {
                                                const newThreads = [...threadContents];
                                                newThreads[index] = e.target.value;
                                                setThreadContents(newThreads);
                                            }}
                                            className="w-full text-sm p-3 border rounded-md"
                                            rows={3}
                                            placeholder={`リプライ ${index + 1}`}
                                        />
                                        <Button variant="outline" size="sm" className="mt-2 text-red-500 shrink-0" onClick={() => {
                                            const newThreads = threadContents.filter((_, i) => i !== index);
                                            setThreadContents(newThreads);
                                        }}>削除</Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => setThreadContents([...threadContents, ""])}>+ スレッドを追加</Button>
                            </div>

                            <hr className="my-6 border-gray-200" />

                            {/* 画像添付UI */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-gray-700">🖼 画像・メディアの添付（任意）</h3>
                                <p className="text-xs text-gray-500">投稿と一緒にアップロードする画像をこちらに追加します。（最大4枚まで）</p>

                                {attachedImages.length > 0 && (
                                    <div className="flex flex-wrap gap-4 mt-2">
                                        {attachedImages.map((url, idx) => (
                                            <div key={idx} className="relative w-32 h-32 border rounded-md overflow-hidden bg-gray-100">
                                                <img src={url} alt={`attached-${idx}`} className="object-cover w-full h-full" />
                                                <button
                                                    onClick={() => setAttachedImages(attachedImages.filter((_, i) => i !== idx))}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-80 hover:opacity-100"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-2">
                                    <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                                        {uploadingImage ? "アップロード中..." : "+ 画像を選択してアップロード"}
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
                            </div>

                            <hr className="my-6 border-gray-200" />

                            {/* インプレッション連動リプライの追加UI */}
                            <div className="space-y-3 bg-blue-50/50 p-4 border border-blue-100 rounded-md">
                                <h3 className="font-bold text-blue-800">🚀 シャドウバン対策：インプ連動URLリプライ設定</h3>
                                <p className="text-xs text-blue-600">本投稿に最初からURLを含めないことでインプレッション低下を防ぎ、指定のインプレッション数に到達した際に自動でURL入りリプライをぶら下げます。</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-gray-700">発動インプレッション閾値</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={impressionTarget}
                                            onChange={(e) => setImpressionTarget(e.target.value ? Number(e.target.value) : "")}
                                            placeholder="例: 1000"
                                            className="w-full text-sm p-2 border rounded-md"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-gray-700">追撃するリプライ文章（URLなど）</label>
                                        <textarea
                                            value={impressionReplyContent}
                                            onChange={(e) => setImpressionReplyContent(e.target.value)}
                                            placeholder="例: 詳細はこちら！ https://example.com"
                                            className="w-full text-sm p-2 border rounded-md"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                        <CardFooter className="flex justify-end gap-3 pb-6 pr-6">
                            <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => {
                                setGeneratedPost(null);
                                setThreadContents([]);
                                setImpressionTarget("");
                                setImpressionReplyContent("");
                            }}>破棄して再生成</Button>
                            <Button variant="default" className="bg-blue-600" onClick={handleApprove} disabled={loading}>承認・予約・自動投稿へ</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {!generatedPost && !loading && (
                <div className="mt-12 text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
                    右上の「生成する」ボタンを押すと、AIが投稿を作成します。
                </div>
            )}
        </div>
    );
}
