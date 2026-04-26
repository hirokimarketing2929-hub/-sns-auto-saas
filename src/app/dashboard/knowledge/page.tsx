"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type KnowledgeRow = {
    id: string;
    type: string;
    content: string;
    category?: string | null;
    source?: string | null;
    order?: number;
    createdAt: string;
};

export default function KnowledgePage() {
    const [loading, setLoading] = useState(false);
    const [knowledges, setKnowledges] = useState<KnowledgeRow[]>([]);

    // AI生成設定 + アカウント運用設定（旧 /dashboard/settings から移設）
    const [accountForm, setAccountForm] = useState({
        targetAudience: "",
        targetPain: "",
        ctaUrl: "",
        accountConcept: "",
        profile: "",
    });
    const [loadingAccount, setLoadingAccount] = useState(true);
    const [savingAccount, setSavingAccount] = useState(false);
    const [accountMsg, setAccountMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

    // ナレッジ行ごとの三点リーダーメニュー
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // ドラッグ&ドロップ状態（ref で保持して再レンダーを避ける）
    const dragState = useRef<{ id: string; type: string } | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    useEffect(() => {
        fetchKnowledges();
        fetchAccountSettings();
    }, []);

    // メニュー外クリックで閉じる
    useEffect(() => {
        if (!openMenuId) return;
        const onClick = () => setOpenMenuId(null);
        // 次のイベントループで登録してトグル自身を拾わないようにする
        const t = setTimeout(() => document.addEventListener("click", onClick), 0);
        return () => {
            clearTimeout(t);
            document.removeEventListener("click", onClick);
        };
    }, [openMenuId]);

    const fetchAccountSettings = async () => {
        try {
            setLoadingAccount(true);
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                setAccountForm({
                    targetAudience: data.targetAudience || "",
                    targetPain: data.targetPain || "",
                    ctaUrl: data.ctaUrl || "",
                    accountConcept: data.accountConcept || "",
                    profile: data.profile || "",
                });
            }
        } catch (error) {
            console.error("Failed to fetch account settings:", error);
        } finally {
            setLoadingAccount(false);
        }
    };

    const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setAccountForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveAccount = async () => {
        setSavingAccount(true);
        setAccountMsg(null);
        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(accountForm),
            });
            if (res.ok) {
                setAccountMsg({ text: "運用設定を保存しました。", type: "success" });
            } else {
                setAccountMsg({ text: "保存に失敗しました。", type: "error" });
            }
        } catch (error) {
            console.error("Save account error:", error);
            setAccountMsg({ text: "エラーが発生しました。", type: "error" });
        } finally {
            setSavingAccount(false);
        }
    };

    const handleDeleteKnowledge = async (id: string) => {
        if (!confirm("このナレッジを削除しますか？この操作は取り消せません。")) return;
        try {
            const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
            if (res.ok) {
                setKnowledges(prev => prev.filter(k => k.id !== id));
            } else {
                alert("削除に失敗しました。");
            }
        } catch (error) {
            console.error("Delete knowledge error:", error);
            alert("通信エラーが発生しました。");
        } finally {
            setOpenMenuId(null);
        }
    };

    const handleDragStart = (id: string, type: string) => {
        dragState.current = { id, type };
    };

    const handleDragOver = (e: React.DragEvent, overId: string, overType: string) => {
        if (!dragState.current) return;
        if (dragState.current.type !== overType) return; // 同じ type 内のみ
        e.preventDefault();
        setDragOverId(overId);
    };

    const handleDragEnd = () => {
        dragState.current = null;
        setDragOverId(null);
    };

    const handleDrop = async (e: React.DragEvent, targetId: string, targetType: string) => {
        e.preventDefault();
        const drag = dragState.current;
        if (!drag || drag.type !== targetType || drag.id === targetId) {
            handleDragEnd();
            return;
        }

        // ローカルで即座に並び替え
        setKnowledges(prev => {
            const items = [...prev];
            const fromIdx = items.findIndex(i => i.id === drag.id);
            const toIdx = items.findIndex(i => i.id === targetId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const [moved] = items.splice(fromIdx, 1);
            items.splice(toIdx, 0, moved);
            return items;
        });
        handleDragEnd();

        // サーバへ同一 type 内の並びを送信
        const reordered = (() => {
            const current = [...knowledges];
            const fromIdx = current.findIndex(i => i.id === drag.id);
            const toIdx = current.findIndex(i => i.id === targetId);
            if (fromIdx === -1 || toIdx === -1) return null;
            const [moved] = current.splice(fromIdx, 1);
            current.splice(toIdx, 0, moved);
            return current.filter(k => k.type === targetType).map(k => k.id);
        })();
        if (!reordered) return;

        try {
            await fetch("/api/knowledge/reorder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: reordered }),
            });
        } catch (error) {
            console.error("Reorder error:", error);
            // 失敗時は再取得して整合性を戻す
            fetchKnowledges();
        }
    };

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

    // ナレッジ行を描画するヘルパー。ドラッグ並び替えと三点リーダーメニューを共通化。
    const renderKnowledgeItem = (
        rule: KnowledgeRow,
        idx: number,
        type: string,
        badgeBg: string,
        badgeText: string
    ) => {
        const isDragOver = dragOverId === rule.id;
        return (
            <li
                key={rule.id}
                draggable
                onDragStart={() => handleDragStart(rule.id, type)}
                onDragOver={(e) => handleDragOver(e, rule.id, type)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, rule.id, type)}
                className={`flex gap-3 items-start p-3 bg-white/5 border border-white/10 rounded-md shadow-sm cursor-move transition-all ${isDragOver ? "ring-2 ring-purple-400/60 translate-y-[1px]" : ""}`}
            >
                <span className={`flex-shrink-0 w-6 h-6 rounded-full ${badgeBg} ${badgeText} flex items-center justify-center font-bold text-sm select-none`}>
                    {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {rule.category && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground bg-white/5 border-white/10 h-5 px-1.5">
                                🏷️ {rule.category}
                            </Badge>
                        )}
                    </div>
                    <p className="text-foreground/80 text-sm font-medium break-words">{rule.content}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">抽出元: {rule.source ?? "-"} / {new Date(rule.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === rule.id ? null : rule.id)}
                        className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors leading-none"
                        aria-label="メニューを開く"
                    >
                        <span className="inline-block text-lg leading-none select-none">⋯</span>
                    </button>
                    {openMenuId === rule.id && (
                        <div className="absolute right-0 top-full mt-1 z-10 min-w-[120px] bg-popover border border-border rounded-md shadow-lg py-1">
                            <button
                                type="button"
                                onClick={() => handleDeleteKnowledge(rule.id)}
                                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                                🗑️ 削除
                            </button>
                        </div>
                    )}
                </div>
            </li>
        );
    };

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

            {/* AI生成設定 & アカウント運用設定（旧「設定・ペルソナ登録」から移設） */}
            <Card className="bg-white/5 border-white/10 shadow-sm">
                <CardHeader className="py-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-xl">🎯</span> AI生成設定・運用設定
                    </CardTitle>
                    <CardDescription>
                        AIが投稿を生成する際に参照する、あなたのアカウント専用のペルソナ・発信軸・誘導先を設定します。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingAccount ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">読み込み中...</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="targetAudience" className="text-sm font-medium text-foreground/80">
                                    ターゲットペルソナ（誰に向けて発信するか）
                                </label>
                                <input
                                    id="targetAudience"
                                    name="targetAudience"
                                    placeholder="例: SNS運用代行会社、個人事業主"
                                    value={accountForm.targetAudience}
                                    onChange={handleAccountChange}
                                    disabled={savingAccount}
                                    className="w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="targetPain" className="text-sm font-medium text-foreground/80">
                                    ターゲットの主な悩み
                                </label>
                                <textarea
                                    id="targetPain"
                                    name="targetPain"
                                    placeholder="例: フォロワーが伸びない、集客から販売につながらない"
                                    value={accountForm.targetPain}
                                    onChange={handleAccountChange}
                                    disabled={savingAccount}
                                    className="w-full min-h-[80px] border border-input bg-background px-3 py-2 text-sm rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="ctaUrl" className="text-sm font-medium text-foreground/80">
                                    誘導先（リードマグネット/プロラインのURL）
                                </label>
                                <input
                                    id="ctaUrl"
                                    name="ctaUrl"
                                    type="url"
                                    placeholder="https://proline.example.com/..."
                                    value={accountForm.ctaUrl}
                                    onChange={handleAccountChange}
                                    disabled={savingAccount}
                                    className="w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="accountConcept" className="text-sm font-medium text-foreground/80">
                                    アカウントのコンセプト（全体像）
                                </label>
                                <input
                                    id="accountConcept"
                                    name="accountConcept"
                                    placeholder="例: 売上目標達成を支援する実践的なノウハウ発信"
                                    value={accountForm.accountConcept}
                                    onChange={handleAccountChange}
                                    disabled={savingAccount}
                                    className="w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <p className="text-xs text-muted-foreground">AIがブレない発信軸を持つための基準になります。</p>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="profile" className="text-sm font-medium text-foreground/80">
                                    発信者のプロフィール・立ち位置
                                </label>
                                <input
                                    id="profile"
                                    name="profile"
                                    placeholder="例: SNS集客のプロフェッショナル"
                                    value={accountForm.profile}
                                    onChange={handleAccountChange}
                                    disabled={savingAccount}
                                    className="w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            {accountMsg && (
                                <div className={`p-3 rounded-md text-sm ${accountMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                    {accountMsg.text}
                                </div>
                            )}
                            <Button onClick={handleSaveAccount} disabled={savingAccount}>
                                {savingAccount ? "保存中..." : "設定を保存"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 手動登録フォーム (ユーザー独自ナレッジ) */}
            <Card className="bg-white/5 border-white/10 shadow-sm">
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
            <Card className="bg-white/5 border-white/10 shadow-sm mt-4">
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
                        <label className="text-sm font-medium text-foreground/80">格納先のナレッジ区分:</label>
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

                    <div className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors relative ${isUploading ? "border-purple-500/50 bg-purple-500/10" : "border-white/20 hover:bg-white/5"}`}>
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
                            <p className="text-sm text-foreground/80 font-medium">クリック、またはファイルをここにドロップしてアップロード</p>
                            <p className="text-xs text-muted-foreground mt-1">対応形式: PDF, DOCX, PPTX, 画像(JPG/PNG), 動画(MP4)</p>
                        </div>
                    </div>
                    {isUploading && (
                        <div className="mt-4 text-sm text-purple-400 flex items-center justify-center gap-2">
                            <span className="animate-spin h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full px-2 py-2"></span>
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
                    <Card className="border-purple-500/30">
                        <CardHeader className="bg-purple-500/10 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-purple-400 text-lg">📚 ベースナレッジ</CardTitle>
                                <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                                    {baseRules.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-purple-300/70 text-xs mt-1">
                                アカウントの土台となる構造化ルール
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {baseRules.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">データがありません</p> : null}
                            <ul className="space-y-3">
                                {baseRules.map((rule, idx) => renderKnowledgeItem(rule, idx, "BASE", "bg-purple-500/30", "text-purple-300"))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 投稿の型 (Template) */}
                    <Card className="border-emerald-500/30">
                        <CardHeader className="bg-emerald-500/10 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-emerald-400 text-lg">📝 投稿の型</CardTitle>
                                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    {templateRules.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-emerald-300/70 text-xs mt-1">
                                投稿の構成やフォーマット（テンプレート）
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {templateRules.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">データがありません</p> : null}
                            <ul className="space-y-3">
                                {templateRules.map((rule, idx) => renderKnowledgeItem(rule, idx, "TEMPLATE", "bg-emerald-500/30", "text-emerald-300"))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 勝ちパターン */}
                    <Card className="border-blue-500/30">
                        <CardHeader className="bg-blue-500/10 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-blue-400 text-lg">🌟 勝ちパターン</CardTitle>
                                <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                                    {winningRules.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-blue-300/70 text-xs mt-1">
                                投稿生成時に「必ず含める」成功ルール
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {winningRules.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">抽出されたルールがありません</p> : null}
                            <ul className="space-y-3">
                                {winningRules.map((rule, idx) => renderKnowledgeItem(rule, idx, "WINNING", "bg-blue-500/30", "text-blue-300"))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* ネガティブルール */}
                    <Card className="border-red-500/30">
                        <CardHeader className="bg-red-500/10 rounded-t-lg pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-red-400 text-lg">🚫 負けパターン</CardTitle>
                                <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30">
                                    {losingRules.length} 件
                                </Badge>
                            </div>
                            <CardDescription className="text-red-300/70 text-xs mt-1">
                                投稿生成時に「絶対に避ける」禁止ルール
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {losingRules.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">抽出されたルールがありません</p> : null}
                            <ul className="space-y-3">
                                {losingRules.map((rule, idx) => renderKnowledgeItem(rule, idx, "LOSING", "bg-red-500/30", "text-red-300"))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
