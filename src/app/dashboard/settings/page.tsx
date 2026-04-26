"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const router = useRouter();

    const [formData, setFormData] = useState({
        xApiKey: "",
        xApiSecret: "",
        xAccessToken: "",
        xAccessSecret: "",
        xAccountName: "",
        xProfileImageUrl: "",
        spreadsheetUrl: "",
        anthropicApiKey: "",
        openaiApiKey: "",
        chatworkApiToken: "",
        chatworkRoomId: "",
        replyEngagementMinImp: "500",
    });
    const [cwTestState, setCwTestState] = useState<{ loading: boolean; text: string; type: "success" | "error" | "" }>({ loading: false, text: "", type: "" });

    // プロラインフリー連携 webhook token
    const [funnelToken, setFunnelToken] = useState<string>("");
    const [funnelUrl, setFunnelUrl] = useState<string>("");
    const [copyNotice, setCopyNotice] = useState<string>("");

    useEffect(() => {
        fetchSettings();
        fetchFunnelToken();
    }, []);

    const fetchFunnelToken = async () => {
        try {
            const res = await fetch("/api/funnel/token");
            if (res.ok) {
                const data = await res.json();
                if (data.token) {
                    setFunnelToken(data.token);
                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                    setFunnelUrl(`${origin}/api/funnel/webhook/${data.token}`);
                }
            }
        } catch (e) {
            console.error("Failed to fetch funnel token", e);
        }
    };

    const regenerateFunnelToken = async () => {
        if (!confirm("webhook URL を再発行しますか？既存の GAS 設定から旧 URL を新しいものに差し替える必要があります。")) return;
        try {
            const res = await fetch("/api/funnel/token", { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setFunnelToken(data.token);
                const origin = typeof window !== "undefined" ? window.location.origin : "";
                setFunnelUrl(`${origin}/api/funnel/webhook/${data.token}`);
                setCopyNotice("新しい URL を発行しました");
                setTimeout(() => setCopyNotice(""), 2500);
            }
        } catch (e) {
            console.error("regenerate error", e);
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopyNotice(`${label} をコピーしました`);
            setTimeout(() => setCopyNotice(""), 2500);
        } catch (e) {
            console.error("copy error", e);
        }
    };

    const gasSnippet = funnelUrl ? `function doPost(e) {
  // 1) プロラインからのデータをシートに書き込む既存処理
  //    （元のマニュアル通りの処理を残す）
  //    ...

  // 2) 本 SaaS に転送してダッシュボードで追跡できるようにする
  try {
    var payload = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    UrlFetchApp.fetch('${funnelUrl}', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        form_name: '<フォーム名をここに>',  // 例: 無料相談
        date: payload.date || new Date().toISOString(),
        uid: payload.uid,
        snsname: payload.snsname,
        form_data: payload.form_data || payload,
        // 以下は LP 側から form に混ぜている場合のみ（任意）
        utm_source: payload.utm_source,
        utm_medium: payload.utm_medium,
        utm_campaign: payload.utm_campaign,
        utm_content: payload.utm_content
      }),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.warn('SaaS 転送失敗:', err);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}` : "";

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                setFormData({
                    xApiKey: data.xApiKey || "",
                    xApiSecret: data.xApiSecret || "",
                    xAccessToken: data.xAccessToken || "",
                    xAccessSecret: data.xAccessSecret || "",
                    xAccountName: data.xAccountName || "",
                    xProfileImageUrl: data.xProfileImageUrl || "",
                    spreadsheetUrl: data.spreadsheetUrl || "",
                    anthropicApiKey: data.anthropicApiKey || "",
                    openaiApiKey: data.openaiApiKey || "",
                    chatworkApiToken: data.chatworkApiToken || "",
                    chatworkRoomId: data.chatworkRoomId || "",
                    replyEngagementMinImp: String(data.replyEngagementMinImp ?? 500),
                });
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        // 数値フィールドは半角数字のみ許容（空欄も許容して自由に打ち直せるように）
        if (name === "replyEngagementMinImp") {
            const cleaned = value.replace(/[^0-9]/g, "");
            setFormData(prev => ({ ...prev, replyEngagementMinImp: cleaned }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const testChatwork = async (sendTest: boolean) => {
        setCwTestState({ loading: true, text: "", type: "" });
        try {
            const res = await fetch("/api/reply-engagement/chatwork-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiToken: formData.chatworkApiToken,
                    roomId: formData.chatworkRoomId,
                    sendTest,
                }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                setCwTestState({
                    loading: false,
                    type: "success",
                    text: sendTest
                        ? `ルームにテストメッセージを送信しました（アカウント: ${data.name || "?"})`
                        : `接続成功（アカウント: ${data.name || "?"})`,
                });
            } else {
                setCwTestState({ loading: false, type: "error", text: data?.error || "接続に失敗しました" });
            }
        } catch (e) {
            setCwTestState({ loading: false, type: "error", text: (e as Error).message });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: "", type: "" });

        try {
            const payload = {
                ...formData,
                replyEngagementMinImp: Number(formData.replyEngagementMinImp) || 500,
            };
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const updatedSettings = await res.json();
                setFormData(prev => ({
                    ...prev,
                    xAccountName: updatedSettings.xAccountName || "",
                    xProfileImageUrl: updatedSettings.xProfileImageUrl || ""
                }));
                setMessage({ text: "設定を保存しました。アカウント名とアイコンが反映されました。", type: "success" });
                router.refresh(); // サイドバーなどのサーバーコンポーネントを再取得して表示を更新
            } else {
                setMessage({ text: "保存に失敗しました。", type: "error" });
            }
        } catch (error) {
            setMessage({ text: "エラーが発生しました。", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">設定</h2>
                <p className="text-muted-foreground mt-2">
                    X (Twitter) の自動投稿用 API キーと、外部ツール連携のエンドポイントを管理します。<br />
                    ※ AIペルソナ・運用方針などの設定は「ナレッジベース」画面に移動しました。
                </p>
            </div>

            {/* アカウント基本情報（最上部に独立） */}
            <Card className="border-indigo-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <CardHeader>
                    <CardTitle className="text-xl flex justify-between items-center">
                        アカウント管理情報
                        {formData.xProfileImageUrl && (
                            <img src={formData.xProfileImageUrl} alt="icon" className="w-10 h-10 rounded-full border border-gray-200" />
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 max-w-md">
                        <Label htmlFor="xAccountNameTop" className="text-gray-700 font-semibold">管理名 (任意)</Label>
                        <Input
                            id="xAccountNameTop"
                            name="xAccountName"
                            placeholder="例: メイン告知アカウント (空欄で自動取得)"
                            value={formData.xAccountName}
                            onChange={handleChange}
                            className="bg-white"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            空欄のまま下の「システム連携設定」でAPIキーを保存すると、Xの表示名(@ユーザー名)とアイコン画像が自動で取得・表示されます。
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>システム・外部連携</CardTitle>
                    <CardDescription>
                        X (Twitter) 自動投稿用の API キーと、外部ツール連携のエンドポイントを設定します。<br />
                        ※ AIペルソナや発信軸の設定は「ナレッジベース」画面に移動しました。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-8 text-center text-gray-500">データを読み込み中...</div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* 生成AI プロバイダ（Claude / OpenAI） */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">🤖 生成 AI プロバイダ API キー (BYOK)</h3>
                                <div className="bg-indigo-50 p-4 rounded-md border border-indigo-200">
                                    <p className="text-sm text-indigo-900 mb-1">
                                        リサーチ画面の「構造を保持してテーマ置換」機能で使用する LLM プロバイダの API キーを登録します。
                                    </p>
                                    <p className="text-xs text-indigo-700 mb-4">
                                        ※ Anthropic Claude が第一優先。どちらか一方を入力すれば動作します。両方入っている場合は Claude が使われます。
                                    </p>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="anthropicApiKey" className="flex items-center gap-2">
                                                Anthropic Claude API Key
                                                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 border border-indigo-300 rounded-full px-2 py-0.5">推奨</span>
                                            </Label>
                                            <Input
                                                id="anthropicApiKey"
                                                name="anthropicApiKey"
                                                type="password"
                                                placeholder="sk-ant-api03-..."
                                                value={formData.anthropicApiKey}
                                                onChange={handleChange}
                                                className="bg-white"
                                            />
                                            <p className="text-xs text-gray-600">
                                                取得先: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">console.anthropic.com → API Keys</a> （Claude Sonnet 4.6 を使用）
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                                            <Input
                                                id="openaiApiKey"
                                                name="openaiApiKey"
                                                type="password"
                                                placeholder="sk-proj-..."
                                                value={formData.openaiApiKey}
                                                onChange={handleChange}
                                                className="bg-white"
                                            />
                                            <p className="text-xs text-gray-600">
                                                取得先: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">platform.openai.com → API keys</a> （GPT-4o を使用）
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="text-lg font-semibold">システム連携設定 (X/Twitter 自動投稿用)</h3>


                                <div className="bg-gray-50 p-4 rounded-md border mt-6">
                                    <h4 className="font-medium text-gray-900 mb-2">【テスト用】個別APIキー設定 (BYOK)</h4>
                                    <p className="text-sm text-gray-600 mb-4">
                                        各ユーザーが自身のDeveloper API通信費用を負担するテスト用の方法です。<br />
                                        ※こちらの入力がある場合は優先して使用されます。
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="xApiKey">API Key</Label>
                                            <Input
                                                id="xApiKey"
                                                name="xApiKey"
                                                type="password"
                                                value={formData.xApiKey}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="xApiSecret">API Secret</Label>
                                            <Input
                                                id="xApiSecret"
                                                name="xApiSecret"
                                                type="password"
                                                value={formData.xApiSecret}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="xAccessToken">Access Token</Label>
                                            <Input
                                                id="xAccessToken"
                                                name="xAccessToken"
                                                type="password"
                                                value={formData.xAccessToken}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="xAccessSecret">Access Token Secret</Label>
                                            <Input
                                                id="xAccessSecret"
                                                name="xAccessSecret"
                                                type="password"
                                                value={formData.xAccessSecret}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 外部ツール（スプレッドシート連携） */}
                            <div className="space-y-4 pt-4 border-t mt-6">
                                <h3 className="text-lg font-semibold">外部連携 (スプレッドシート・GAS)</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="spreadsheetUrl">スプレッドシートWebアプリ(GAS)のURL</Label>
                                    <Input
                                        id="spreadsheetUrl"
                                        name="spreadsheetUrl"
                                        type="url"
                                        placeholder="https://script.google.com/macros/s/.../exec"
                                        value={formData.spreadsheetUrl}
                                        onChange={handleChange}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        過去のポストやインプレッション数、営業KPIなどを連携するためのエンドポイントURLです。
                                    </p>
                                </div>
                            </div>

                            {/* プロラインフリー連携 webhook */}
                            <div className="space-y-4 pt-4 border-t mt-6">
                                <h3 className="text-lg font-semibold">🧩 プロラインフリー 連携（導線分析）</h3>
                                <p className="text-xs text-muted-foreground -mt-2">
                                    プロラインの GAS（doPost）から、本 SaaS の webhook へフォーム登録データを転送することで、X投稿→LP→LINE登録 までの導線数値をダッシュボードで追えます。
                                </p>

                                <div className="space-y-2">
                                    <Label>📨 あなた専用の webhook URL（この URL を GAS が叩きます）</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={funnelUrl}
                                            readOnly
                                            className="bg-slate-50 font-mono text-xs"
                                        />
                                        <Button type="button" variant="outline" onClick={() => copyToClipboard(funnelUrl, "webhook URL")} disabled={!funnelUrl}>
                                            コピー
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={regenerateFunnelToken} className="text-xs text-red-500 hover:bg-red-50">
                                            再発行
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        ※ 再発行すると古い URL は無効化されます（他者に漏れた場合のみ実行）。
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>📝 GAS に貼り付けるテンプレートコード</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={() => copyToClipboard(gasSnippet, "GAS コード")} disabled={!gasSnippet}>
                                            コードをコピー
                                        </Button>
                                    </div>
                                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-md text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
{gasSnippet || "webhook URL を発行中..."}
                                    </pre>
                                    <details className="text-xs text-muted-foreground">
                                        <summary className="cursor-pointer hover:text-foreground">🛠 A. フォーム送信連携の手順（GAS経由）</summary>
                                        <ol className="list-decimal pl-5 mt-2 space-y-1">
                                            <li>プロラインの「外部システム連携」用にスプレッドシートを開き、拡張機能 → Apps Script を起動</li>
                                            <li>上記コードを <code>Code.gs</code> の <code>doPost</code> に貼り付け（既存処理を残したまま、2) のブロックを追加）</li>
                                            <li>「デプロイ → 新しいデプロイ → ウェブアプリ」を選択、アクセス権限を「全員」に設定して発行</li>
                                            <li>発行された URL をプロラインのフォーム設定「登録発生時に外部システムにデータを送信する」に貼り付け</li>
                                            <li>テスト登録すると、当ダッシュボードに数秒で反映</li>
                                        </ol>
                                    </details>

                                    <details className="text-xs text-muted-foreground">
                                        <summary className="cursor-pointer hover:text-foreground font-semibold">🎯 B. シナリオ登録連携の手順（簡単・推奨）</summary>
                                        <div className="pl-5 mt-2 space-y-2">
                                            <p>
                                                プロラインの <strong>シナリオ登録時の「外部システムへ URL を送信」機能</strong>を使う場合は、GAS 不要で本 SaaS の webhook URL を直接登録するだけで完了します。
                                            </p>
                                            <ol className="list-decimal pl-4 space-y-1">
                                                <li>プロラインの該当シナリオ設定画面を開く</li>
                                                <li>「外部システムへ URL を送信する」を有効化</li>
                                                <li>上の webhook URL をそのまま貼り付け</li>
                                                <li>送信データに以下を含めるよう設定（プロラインのテンプレ変数を使用）：
                                                    <pre className="mt-1 p-2 bg-slate-100 rounded text-[10px] whitespace-pre-wrap">{`{
  "scenario_name": "<シナリオ名>",
  "uid": "{{uid}}",
  "snsname": "{{snsname}}",
  "date": "{{date}}"
}`}</pre>
                                                </li>
                                                <li>テスト登録すると、シナリオ別の数値が KPI 画面のプルダウンに自動で現れます</li>
                                            </ol>
                                        </div>
                                    </details>
                                </div>

                                {copyNotice && (
                                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
                                        ✅ {copyNotice}
                                    </div>
                                )}
                            </div>

                            {/* ChatWork 連携（リプ周り半自動化） */}
                            <div className="space-y-4 pt-4 border-t mt-6">
                                <h3 className="text-lg font-semibold">💬 ChatWork 連携（リプ周り半自動化）</h3>
                                <p className="text-xs text-muted-foreground -mt-2">
                                    ターゲットアカウントの高インプ投稿が見つかった際に、該当 URL とコピペ用リプライ案 3 本を ChatWork のルームへ自動送信します。
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="chatworkApiToken">ChatWork API トークン</Label>
                                        <Input
                                            id="chatworkApiToken"
                                            name="chatworkApiToken"
                                            type="password"
                                            placeholder="ChatWork 設定 → API から取得"
                                            value={formData.chatworkApiToken}
                                            onChange={handleChange}
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            取得先: <a href="https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">chatwork.com → API 設定</a>
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="chatworkRoomId">送信先ルーム ID</Label>
                                        <Input
                                            id="chatworkRoomId"
                                            name="chatworkRoomId"
                                            placeholder="例: 123456789"
                                            value={formData.chatworkRoomId}
                                            onChange={handleChange}
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            ルーム URL の末尾 <code>#!rid123456789</code> の <code>123456789</code> 部分
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="replyEngagementMinImp">リプ対象のインプレッション閾値</Label>
                                        <Input
                                            id="replyEngagementMinImp"
                                            name="replyEngagementMinImp"
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            autoComplete="off"
                                            placeholder="500"
                                            value={formData.replyEngagementMinImp}
                                            onChange={handleChange}
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            この数値以上のインプを獲得しているターゲット投稿のみリプ案を生成します（デフォルト 500・半角数字で入力）
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" disabled={cwTestState.loading || !formData.chatworkApiToken} onClick={() => testChatwork(false)}>
                                        {cwTestState.loading ? "確認中..." : "🔌 接続テスト"}
                                    </Button>
                                    <Button type="button" variant="outline" disabled={cwTestState.loading || !formData.chatworkApiToken || !formData.chatworkRoomId} onClick={() => testChatwork(true)}>
                                        {cwTestState.loading ? "送信中..." : "✉️ テストメッセージ送信"}
                                    </Button>
                                </div>
                                {cwTestState.text && (
                                    <div className={`text-xs rounded p-2 border ${cwTestState.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                                        {cwTestState.type === "success" ? "✅" : "⚠️"} {cwTestState.text}
                                    </div>
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                    ※ ターゲットアカウントの登録・履歴確認は <a href="/dashboard/reply-engagement" className="text-indigo-600 hover:underline">リプ周り半自動化</a> ページから行います。
                                </p>
                            </div>

                            {message.text && (
                                <div className={`p-4 rounded-md mt-6 ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                    {message.text}
                                </div>
                            )}

                            <Button type="submit" disabled={saving} className="mt-4 w-full md:w-auto">
                                {saving ? "保存中..." : "設定を保存する"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
