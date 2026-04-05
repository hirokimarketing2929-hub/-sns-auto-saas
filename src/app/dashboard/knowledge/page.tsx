"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function KnowledgePage() {
    const [loading, setLoading] = useState(false);
    const [knowledges, setKnowledges] = useState<any[]>([]);

    useEffect(() => {
        fetchKnowledges();
    }, []);

    const fetchKnowledges = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/knowledge");
            if (res.ok) {
                const data = await res.json();
                setKnowledges(data);
            }
        } catch (error) {
            console.error("Failed to fetch knowledges:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSeedDemodata = async () => {
        try {
            await fetch("/api/knowledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "seed" })
            });
            fetchKnowledges();
        } catch (error) {
            console.error("Seed error", error);
        }
    };

    const [newRule, setNewRule] = useState("");
    const [newRuleType, setNewRuleType] = useState("WINNING");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadCategory, setUploadCategory] = useState("AUTO");

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setIsUploading(true);

        const uploadData = new FormData();
        uploadData.append("category", uploadCategory);
        Array.from(e.target.files).forEach(file => {
            uploadData.append("files", file);
        });

        try {
            // Next.js API ルート (後ほど実装) へ送信
            const res = await fetch("/api/knowledge/upload", {
                method: "POST",
                body: uploadData
            });
            if (res.ok) {
                fetchKnowledges();
                alert("ファイルの解析とナレッジの追加が完了しました！");
            } else {
                const errData = await res.json();
                alert(`アップロードエラー: ${errData.message || "失敗しました"}`);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("通信エラーが発生しました。");
        } finally {
            setIsUploading(false);
            e.target.value = ""; // 選択リセット
        }
    };

    const handleAddManualRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRule.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/knowledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newRule,
                    type: newRuleType,
                    source: "ユーザー独自 (手動登録)"
                })
            });
            if (res.ok) {
                setNewRule("");
                fetchKnowledges();
            }
        } catch (error) {
            console.error("Failed to add manual rule:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const baseRules = knowledges.filter(k => k.type === "BASE");
    const templateRules = knowledges.filter(k => k.type === "TEMPLATE");
    const winningRules = knowledges.filter(k => k.type === "WINNING");
    const losingRules = knowledges.filter(k => k.type === "LOSING");

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">ナレッジベース (知識共有)</h2>
                    <p className="text-muted-foreground mt-2">
                        AIが過去の投稿から学習した、あなたのアカウント独自の「成功の型」と「避けるべきルール」です。<br />
                        ここに独自のノウハウ（カンペキな型）を手動で追加することもできます。
                    </p>
                </div>
                <div>
                    {knowledges.length === 0 && (
                        <Button variant="outline" onClick={handleSeedDemodata}>分析モデル（デモ）をロード</Button>
                    )}
                </div>
            </div>

            {/* 手動登録フォーム (ユーザー独自ナレッジ) */}
            <Card className="bg-white/50 border-gray-200 shadow-sm">
                <CardHeader className="py-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-xl">✍️</span> ユーザー独自ナレッジを追加
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddManualRule} className="flex gap-4 items-start">
                        <div className="w-[200px] flex-shrink-0">
                            <select
                                value={newRuleType}
                                onChange={(e) => setNewRuleType(e.target.value)}
                                className="w-full h-10 border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md"
                            >
                                <option value="BASE">📚 ベースナレッジ (Base)</option>
                                <option value="TEMPLATE">📝 投稿の型 (Template)</option>
                                <option value="WINNING">🌟 勝ちパターン (Winning)</option>
                                <option value="LOSING">🚫 負けパターン (Losing)</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={newRule}
                                onChange={(e) => setNewRule(e.target.value)}
                                placeholder="例: 『プロライン』というキーワードを必ず1回は含める"
                                rows={5}
                                className="w-full min-h-[5rem] border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md resize-y"
                            />
                        </div>
                        <Button type="submit" disabled={isSubmitting || !newRule.trim()}>
                            {isSubmitting ? "追加中..." : "追加"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* ファイルアップロード (マルチモーダル解析) */}
            <Card className="bg-white/50 border-gray-200 shadow-sm mt-4">
                <CardHeader className="py-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-xl">📁</span> ファイルからナレッジを抽出 (PDF, DOCX, 画像, MP4動画など)
                    </CardTitle>
                    <CardDescription>
                        資料や動画をアップロードすると、AIが内容を読み取ってナレッジ化します。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">格納先のナレッジ区分:</label>
                        <select
                            value={uploadCategory}
                            onChange={(e) => setUploadCategory(e.target.value)}
                            disabled={isUploading}
                            className="h-9 border border-input bg-background px-3 py-1 text-sm rounded-md"
                        >
                            <option value="AUTO">🤖 AIに自動分類させる</option>
                            <option value="BASE">📚 ベースナレッジに格納</option>
                            <option value="TEMPLATE">📝 投稿の型に格納</option>
                            <option value="WINNING">🌟 勝ちパターンに格納</option>
                            <option value="LOSING">🚫 負けパターンに格納</option>
                        </select>
                    </div>

                    <div className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors relative ${isUploading ? "border-indigo-300 bg-indigo-50" : "border-gray-300 hover:bg-gray-50"}`}>
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.docx,.pptx,image/*,video/mp4"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                        />
                        <div className="pointer-events-none">
                            <span className="text-4xl block mb-2">📥</span>
                            <p className="text-sm text-gray-600 font-medium">クリック、またはファイルをここにドロップしてアップロード</p>
                            <p className="text-xs text-gray-400 mt-1">対応形式: PDF, DOCX, PPTX, 画像(JPG/PNG), 動画(MP4)</p>
                        </div>
                    </div>
                    {isUploading && (
                        <div className="mt-4 text-sm text-indigo-600 flex items-center justify-center gap-2">
                            <span className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full px-2 py-2"></span>
                            ファイルをAIが解析中です... (動画などの場合は数分〜数十分かかる場合があります)
                        </div>
                    )}
                </CardContent>
            </Card>

            {loading ? (
                <div className="text-center py-10">データ読込中...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                    {/* ベースナレッジ */}
                    <Card className="border-indigo-200">
                        <CardHeader className="bg-indigo-50 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-indigo-800 text-lg">📚 ベースナレッジ</CardTitle>
                                <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-300">
                                    {baseRules.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-indigo-600 text-xs mt-1">
                                アカウントの土台となる構造化ルール
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {baseRules.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">データがありません</p> : null}
                            <ul className="space-y-3">
                                {baseRules.map((rule: any, idx: number) => (
                                    <li key={rule.id} className="flex gap-3 items-start p-3 bg-white border rounded-md shadow-sm">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {rule.category && (
                                                    <Badge variant="outline" className="text-[10px] text-gray-600 bg-gray-50 h-5 px-1.5">
                                                        🏷️ {rule.category}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-gray-800 text-sm font-medium">{rule.content}</p>
                                            <p className="text-xs text-gray-400 mt-1">抽出元: {rule.source} / {new Date(rule.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 投稿の型 (Template) */}
                    <Card className="border-emerald-200">
                        <CardHeader className="bg-emerald-50 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-emerald-800 text-lg">📝 投稿の型</CardTitle>
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                                    {templateRules.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-emerald-600 text-xs mt-1">
                                投稿の構成やフォーマット（テンプレート）
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {templateRules.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">データがありません</p> : null}
                            <ul className="space-y-3">
                                {templateRules.map((rule: any, idx: number) => (
                                    <li key={rule.id} className="flex gap-3 items-start p-3 bg-white border rounded-md shadow-sm">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {rule.category && (
                                                    <Badge variant="outline" className="text-[10px] text-gray-600 bg-gray-50 h-5 px-1.5">
                                                        🏷️ {rule.category}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-gray-800 text-sm font-medium">{rule.content}</p>
                                            <p className="text-xs text-gray-400 mt-1">抽出元: {rule.source} / {new Date(rule.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 勝ちパターン */}
                    <Card className="border-blue-200">
                        <CardHeader className="bg-blue-50 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-blue-800 text-lg">🌟 勝ちパターン</CardTitle>
                                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                                    {winningRules.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-blue-600 text-xs mt-1">
                                投稿生成時に「必ず含める」成功ルール
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {winningRules.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">抽出されたルールがありません</p> : null}
                            <ul className="space-y-3">
                                {winningRules.map((rule: any, idx: number) => (
                                    <li key={rule.id} className="flex gap-3 items-start p-3 bg-white border rounded-md shadow-sm">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {rule.category && (
                                                    <Badge variant="outline" className="text-[10px] text-gray-600 bg-gray-50 h-5 px-1.5">
                                                        🏷️ {rule.category}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-gray-800 text-sm font-medium">{rule.content}</p>
                                            <p className="text-xs text-gray-400 mt-1">抽出元: {rule.source} / {new Date(rule.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* ネガティブルール */}
                    <Card className="border-red-200">
                        <CardHeader className="bg-red-50 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-red-800 text-lg">🚫 負けパターン</CardTitle>
                                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                                    {losingRules.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-red-600 text-xs mt-1">
                                投稿生成時に「絶対に避ける」禁止ルール
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {losingRules.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">抽出されたルールがありません</p> : null}
                            <ul className="space-y-3">
                                {losingRules.map((rule: any, idx: number) => (
                                    <li key={rule.id} className="flex gap-3 items-start p-3 bg-white border rounded-md shadow-sm">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {rule.category && (
                                                    <Badge variant="outline" className="text-[10px] text-gray-600 bg-gray-50 h-5 px-1.5">
                                                        🏷️ {rule.category}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-gray-800 text-sm font-medium">{rule.content}</p>
                                            <p className="text-xs text-gray-400 mt-1">抽出元: {rule.source} / {new Date(rule.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
