"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type Target = {
    id: string;
    username: string;
    displayName: string | null;
    isActive: boolean;
    lastCheckedAt: string | null;
    createdAt: string;
};

type Suggestion = {
    id: string;
    targetUsername: string;
    tweetId: string;
    tweetUrl: string;
    tweetText: string;
    impressions: number | null;
    variants: string[];
    status: string;
    notifiedAt: string | null;
    createdAt: string;
};

export default function ReplyEngagementPage() {
    const [targets, setTargets] = useState<Target[]>([]);
    const [maxTargets, setMaxTargets] = useState(10);
    const [newUsername, setNewUsername] = useState("");
    const [newDisplayName, setNewDisplayName] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "" }>({ text: "", type: "" });

    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [suggLoading, setSuggLoading] = useState(false);
    const [checkRunning, setCheckRunning] = useState(false);

    useEffect(() => {
        fetchTargets();
        fetchSuggestions();
    }, []);

    const fetchTargets = async () => {
        try {
            const res = await fetch("/api/reply-engagement/targets");
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || data?.message || "ターゲット一覧の取得に失敗しました");
                return;
            }
            const data = await res.json();
            setTargets(data.targets || []);
            if (data.max) setMaxTargets(data.max);
        } catch (e) {
            console.error(e);
            toast.error(`通信エラー: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const fetchSuggestions = async () => {
        setSuggLoading(true);
        try {
            const res = await fetch("/api/reply-engagement/suggestions?limit=30");
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || data?.message || "リプ案履歴の取得に失敗しました");
                return;
            }
            const data = await res.json();
            setSuggestions(data.items || []);
        } catch (e) {
            console.error(e);
            toast.error(`通信エラー: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setSuggLoading(false);
        }
    };

    const safeParse = async (res: Response): Promise<{ data: any; raw: string }> => {
        const raw = await res.text();
        if (!raw) return { data: null, raw: "" };
        try { return { data: JSON.parse(raw), raw }; } catch { return { data: null, raw }; }
    };

    const addTarget = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername.trim()) return;
        setLoading(true);
        setMessage({ text: "", type: "" });
        try {
            const res = await fetch("/api/reply-engagement/targets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    payload: { username: newUsername.trim(), displayName: newDisplayName.trim() || null },
                }),
            });
            const { data, raw } = await safeParse(res);
            if (!res.ok || !data) {
                const snippet = (raw || "(空レスポンス)").slice(0, 200);
                setMessage({
                    text: data?.error || `登録に失敗しました (HTTP ${res.status}): ${snippet}`,
                    type: "error",
                });
            } else {
                setNewUsername("");
                setNewDisplayName("");
                setMessage({ text: `@${data.target.username} を登録しました`, type: "success" });
                await fetchTargets();
            }
        } catch (e) {
            setMessage({ text: (e as Error).message, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const toggleTarget = async (t: Target) => {
        try {
            const res = await fetch("/api/reply-engagement/targets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "toggle", payload: { id: t.id, isActive: !t.isActive } }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || data?.message || "稼働状態の更新に失敗しました");
                return;
            }
            fetchTargets();
        } catch (e) {
            console.error(e);
            toast.error(`通信エラー: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const deleteTarget = async (t: Target) => {
        if (!confirm(`@${t.username} を削除しますか？`)) return;
        try {
            const res = await fetch("/api/reply-engagement/targets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "delete", payload: { id: t.id } }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error || data?.message || "削除に失敗しました");
                return;
            }
            toast.success(`@${t.username} を削除しました`);
            fetchTargets();
        } catch (e) {
            console.error(e);
            toast.error(`通信エラー: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const runCheck = async () => {
        setCheckRunning(true);
        setMessage({ text: "", type: "" });
        try {
            const res = await fetch("/api/reply-engagement/check", { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                setMessage({ text: data?.error || "実行に失敗しました", type: "error" });
            } else {
                const suggested: number = data?.suggested ?? 0;
                const notified: number = data?.notified ?? 0;
                const errors: string[] = Array.isArray(data?.errors) ? data.errors : [];
                const hasError = errors.length > 0;
                const base = `実行完了: 通知 ${notified} 件 / 検出 ${suggested} 件`;
                setMessage({
                    text: hasError ? `${base} / エラー ${errors.length} 件: ${errors.slice(0, 2).join(" / ")}` : base,
                    type: hasError ? "error" : "success",
                });
                await Promise.all([fetchTargets(), fetchSuggestions()]);
            }
        } catch (e) {
            setMessage({ text: (e as Error).message, type: "error" });
        } finally {
            setCheckRunning(false);
        }
    };

    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success("コピーしました");
        } catch (e) {
            console.error(e);
            toast.error("コピーに失敗しました");
        }
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">💬 リプ周り半自動化</h2>
                <p className="text-muted-foreground mt-2">
                    ターゲットアカウントの高インプ投稿を自動検知し、AI が生成したリプライ案 3 本を ChatWork に通知します。<br />
                    送信自体は自動化せず、ChatWork で受け取った案を確認・コピペして X に貼り付ける半自動フローです。
                </p>
            </div>

            {/* ステータス/トリガー */}
            <Card>
                <CardHeader>
                    <CardTitle>🚀 今すぐチェック</CardTitle>
                    <CardDescription>
                        登録済みターゲットの直近 24 時間の投稿を走査し、閾値以上のインプの投稿があれば ChatWork へ通知します（通常は 30 分ごとに自動実行）。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Button onClick={runCheck} disabled={checkRunning} className="bg-sky-500 hover:bg-sky-600 text-white">
                        {checkRunning ? "実行中..." : "手動で実行する"}
                    </Button>
                    {message.text && (
                        <div className={`text-sm rounded p-3 border ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                            {message.type === "success" ? "✅" : "⚠️"} {message.text}
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                        ※ ChatWork API トークン・ルーム ID・AI プロバイダ (Anthropic または OpenAI) の設定が必要です → <Link href="/dashboard/settings" className="text-indigo-600 hover:underline">設定画面で登録</Link>
                    </p>
                </CardContent>
            </Card>

            {/* ターゲット管理 */}
            <Card>
                <CardHeader>
                    <CardTitle>🎯 ターゲットアカウント（最大 {maxTargets} 件）</CardTitle>
                    <CardDescription>
                        リプを送りに行きたい X アカウントを登録してください。有効なターゲットのみ自動チェックの対象になります。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={addTarget} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                        <div className="space-y-1">
                            <Label htmlFor="newUsername">ユーザー名（@ なし）</Label>
                            <Input
                                id="newUsername"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="例: hiroki_proline"
                                disabled={loading || targets.length >= maxTargets}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="newDisplayName">メモ / 表示名（任意）</Label>
                            <Input
                                id="newDisplayName"
                                value={newDisplayName}
                                onChange={(e) => setNewDisplayName(e.target.value)}
                                placeholder="例: マーケ系インフルエンサー"
                                disabled={loading || targets.length >= maxTargets}
                            />
                        </div>
                        <Button type="submit" disabled={loading || !newUsername.trim() || targets.length >= maxTargets}>
                            {loading ? "登録中..." : "＋ 追加"}
                        </Button>
                    </form>
                    {targets.length >= maxTargets && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            ターゲット数の上限 ({maxTargets} 件) に達しています。不要なものを削除してから追加してください。
                        </p>
                    )}

                    <div className="divide-y border rounded-md overflow-hidden">
                        {targets.length === 0 && (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                まだターゲットが登録されていません。
                            </div>
                        )}
                        {targets.map((t) => (
                            <div key={t.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium">
                                        @{t.username}
                                        {t.displayName && <span className="text-muted-foreground ml-2">（{t.displayName}）</span>}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {t.lastCheckedAt ? `最終チェック: ${new Date(t.lastCheckedAt).toLocaleString("ja-JP")}` : "まだチェックされていません"}
                                    </div>
                                </div>
                                <a
                                    href={`https://x.com/${t.username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-indigo-600 hover:underline"
                                >
                                    Xで見る
                                </a>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={t.isActive ? "default" : "outline"}
                                    onClick={() => toggleTarget(t)}
                                    className={t.isActive ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}
                                >
                                    {t.isActive ? "有効" : "停止中"}
                                </Button>
                                <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => deleteTarget(t)}>
                                    削除
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* 履歴 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        📜 過去のリプ案履歴
                        <Button type="button" size="sm" variant="outline" onClick={fetchSuggestions} disabled={suggLoading}>
                            {suggLoading ? "更新中..." : "更新"}
                        </Button>
                    </CardTitle>
                    <CardDescription>
                        直近 30 件まで。ChatWork のメッセージを流してしまった場合の再確認に。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {suggestions.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            まだ通知履歴がありません。ターゲット登録後、高インプ投稿が検出されたタイミングでここに追加されます。
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {suggestions.map((s) => (
                                <div key={s.id} className="border rounded-md p-3 bg-slate-50">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span>@{s.targetUsername}</span>
                                        <span>·</span>
                                        <span>インプ {typeof s.impressions === "number" ? s.impressions.toLocaleString("ja-JP") : "?"}</span>
                                        <span>·</span>
                                        <span>{new Date(s.createdAt).toLocaleString("ja-JP")}</span>
                                        <span>·</span>
                                        <span className={s.status === "notified" ? "text-emerald-700" : s.status === "failed" ? "text-red-600" : "text-slate-600"}>
                                            {s.status}
                                        </span>
                                        <a href={s.tweetUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-indigo-600 hover:underline">
                                            元ポストを開く ↗
                                        </a>
                                    </div>
                                    <div className="mt-2 text-sm whitespace-pre-wrap line-clamp-3 text-foreground/80">{s.tweetText}</div>
                                    <div className="mt-3 space-y-2">
                                        {s.variants.map((v, i) => (
                                            <div key={i} className="flex items-start gap-2 bg-white border rounded p-2">
                                                <span className="text-[11px] font-semibold text-muted-foreground shrink-0 mt-0.5">案{i + 1}</span>
                                                <div className="flex-1 text-sm whitespace-pre-wrap">{v}</div>
                                                <Button type="button" size="sm" variant="outline" onClick={() => copyText(v)}>
                                                    コピー
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ChatWork 通知セットアップ手順 */}
            <Card className="border-sky-200">
                <CardHeader>
                    <CardTitle>📘 ChatWork に通知を受け取る設定手順</CardTitle>
                    <CardDescription>
                        この機能の通知は <strong>ChatWork</strong> に届きます。初回のみ以下の設定が必要です（5分ほどで完了）。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 text-sm">
                    <ol className="space-y-4">
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-xs">1</span>
                            <div className="space-y-1">
                                <p className="font-semibold">ChatWork の API トークンを取得する</p>
                                <p className="text-muted-foreground">
                                    ChatWork にログイン →{" "}
                                    <a href="https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                        API 設定ページ
                                    </a>{" "}
                                    を開き、表示された <strong>API トークン</strong>（英数字の文字列）をコピーします。
                                </p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-xs">2</span>
                            <div className="space-y-1">
                                <p className="font-semibold">通知を受け取るルームの「ルーム ID」を調べる</p>
                                <p className="text-muted-foreground">
                                    通知を受け取りたい ChatWork のルーム（グループチャットやマイチャット）を開き、ブラウザの URL の末尾を見ます。<br />
                                    例：<code className="bg-slate-100 px-1 rounded">...#!rid<strong>123456789</strong></code> → この <strong>123456789</strong> の部分がルーム ID です。
                                </p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-xs">3</span>
                            <div className="space-y-1">
                                <p className="font-semibold">設定画面に貼り付けて保存する</p>
                                <p className="text-muted-foreground">
                                    <Link href="/dashboard/settings" className="text-indigo-600 hover:underline">設定画面</Link> の「💬 ChatWork 連携」欄に、
                                    <strong>API トークン</strong> と <strong>ルーム ID</strong> を入力して「設定を保存する」を押します。
                                </p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-xs">4</span>
                            <div className="space-y-1">
                                <p className="font-semibold">接続テストで通知が届くか確認する</p>
                                <p className="text-muted-foreground">
                                    設定画面の「🔌 接続テスト」「✉️ テストメッセージ送信」ボタンを押すと、指定ルームにテスト通知が届きます。
                                    ここでメッセージが届けば設定完了です。
                                </p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-xs">5</span>
                            <div className="space-y-1">
                                <p className="font-semibold">AI プロバイダのキーを登録する（リプ案生成に必須）</p>
                                <p className="text-muted-foreground">
                                    同じ設定画面で <strong>Anthropic Claude</strong> または <strong>OpenAI</strong> の API キーを登録します（どちらか一方でOK）。
                                    これが無いとリプ案が生成されず通知も飛びません。
                                </p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center text-xs">6</span>
                            <div className="space-y-1">
                                <p className="font-semibold">ターゲットを登録して「今すぐチェック」</p>
                                <p className="text-muted-foreground">
                                    このページ上部でターゲットアカウントを登録し、「🚀 今すぐチェック」を実行。
                                    対象の高インプ投稿が見つかると、ChatWork にリプ案 3 本が届きます（通常は 30 分ごとに自動実行）。
                                </p>
                            </div>
                        </li>
                    </ol>

                    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                        <p className="font-semibold">⚠️ 通知が届かないときのチェック</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>API トークン / ルーム ID が正しいか（接続テストで確認）</li>
                            <li>AI プロバイダのキーが登録されているか</li>
                            <li>有効なターゲットが登録されているか、対象投稿が「リプ対象のインプ閾値」を超えているか</li>
                            <li>トークンを発行した ChatWork アカウントが、そのルームに参加しているか</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
