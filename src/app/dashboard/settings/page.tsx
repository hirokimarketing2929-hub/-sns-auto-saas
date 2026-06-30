"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import XAccountManager from "@/components/XAccountManager";

/**
 * 認証情報フィールド（APIキー等）の共通入力欄。
 * locked=true のときは読み取り専用で内容をそのまま表示し、「編集」を押すまで入力できない。
 */
function CredentialField({
    name, label, value, locked, onChange, onUnlock, placeholder, help, labelExtra,
}: {
    name: string;
    label: string;
    value: string;
    locked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUnlock: () => void;
    placeholder?: string;
    help?: React.ReactNode;
    labelExtra?: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={name} className="flex items-center gap-2">{label}{labelExtra}</Label>
                {locked && (
                    <button
                        type="button"
                        onClick={onUnlock}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                        ✏️ 編集
                    </button>
                )}
            </div>
            <Input
                id={name}
                name={name}
                type="text"
                readOnly={locked}
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className={locked ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white"}
            />
            {locked && <p className="text-[11px] text-slate-400">設定済み（変更するには「編集」を押してください）</p>}
            {help}
        </div>
    );
}

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
    // BYOK 入力 UI は決定 #033 で常時表示（任意入力）になったため、byokEnabled による表示ガードは廃止。
    // サーバの byokEnabled フラグはオーナー鍵フォールバック挙動の制御用としてサーバ側でのみ使用する。
    const [cwTestState, setCwTestState] = useState<{ loading: boolean; text: string; type: "success" | "error" | "" }>({ loading: false, text: "", type: "" });
    // 認証情報フィールドの編集ロック解除状態（保存済みの値は既定でロックし「編集」で解除）
    const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
    const unlock = (k: string) => setUnlocked(prev => ({ ...prev, [k]: true }));

    // プロラインフリー連携 webhook token
    const [funnelToken, setFunnelToken] = useState<string>("");
    const [funnelUrl, setFunnelUrl] = useState<string>("");
    const [signingSecret, setSigningSecret] = useState<string>("");
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
                    setSigningSecret(data.signingSecret || "");
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
                setSigningSecret(data.signingSecret || "");
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

    // 署名付き GAS コード（HMAC-SHA256）。受信側 verifyWebhookSignature と数学的に一致:
    //   署名対象 = `${timestamp}.${body}` / 鍵 = signingSecret(hex文字列のUTF-8バイト)
    //   ヘッダ   = X-ProX-Timestamp(ミリ秒) / X-ProX-Signature(小文字hex)
    //   body は「実際に送るバイト列」をそのまま署名する（JSON.stringify した同一文字列）。
    const gasSnippet = funnelUrl ? `function doPost(e) {
  // 1) プロラインからのデータをシートに書き込む既存処理
  //    （元のマニュアル通りの処理を残す）
  //    ...

  // 2) 本 SaaS に署名付きで転送してダッシュボードで追跡できるようにする
  try {
    var payload = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};

    // --- 署名秘密（この値は ProX 設定画面に表示されたものを貼る。外部に出さない）---
    var SIGNING_SECRET = '${signingSecret || "<ProX設定画面の署名秘密をここに貼る>"}';

    // 送る本文。署名対象と「全く同じ文字列」を使うのが必須（整形のズレ＝検証失敗）。
    var body = JSON.stringify({
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
    });

    var timestamp = String(Date.now()); // ミリ秒。受信側の ±5分窓に収める
    var signature = prox_sign_(SIGNING_SECRET, timestamp + '.' + body);

    UrlFetchApp.fetch('${funnelUrl}', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'X-ProX-Timestamp': timestamp,
        'X-ProX-Signature': signature
      },
      payload: body,           // ← 署名した body と同一バイト列を送る
      muteHttpExceptions: true
    });
  } catch (err) {
    console.warn('SaaS 転送失敗:', err);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// HMAC-SHA256(message, key) を小文字 hex で返す。
// 受信側 createHmac('sha256', secretHex).update(message).digest('hex') と一致する。
// 鍵は secretHex 文字列の UTF-8 バイト列（Node 側も hex 文字列を key にしているため一致）。
function prox_sign_(secret, message) {
  var raw = Utilities.computeHmacSha256Signature(message, secret); // byte[]（符号付き）
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] + 256) % 256;            // 符号付きバイトを 0..255 に
    var h = b.toString(16);
    if (h.length === 1) h = '0' + h;          // 1桁は 0 埋め
    hex += h;
  }
  return hex; // 小文字 hex
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
                setUnlocked({}); // 保存後は再びロック状態に戻す
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
                {/* 共通 / アカウント別 の凡例 */}
                <div className="mt-3 flex flex-col sm:flex-row gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-300">
                        🌐 全アカウント共通 — 一度設定すればすべてのアカウントで使われます
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300">
                        👤 このアカウント専用 — 切り替え中のアカウントにのみ適用されます
                    </span>
                </div>
            </div>

            {/* サブアカウント管理 — 無制限に追加可能 */}
            <Card className="border-purple-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                <CardContent className="pt-6">
                    <XAccountManager />
                </CardContent>
            </Card>

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
                            {/* 生成AI プロバイダ（Claude / OpenAI）— 常時表示・任意入力（決定 #033）。
                                自分の API キーを登録すると「1日1回無料」制度を卒業し、常に自分の鍵で無制限に使えます
                                （当社鍵は一切消費しません）。未登録でも 1日1回は当社鍵で無料生成できます。 */}
                            {/* id="ai-api-key": リサーチ生成ゲート（#036）のポップアップ「AI APIキーを登録する」ボタンの遷移先アンカー。 */}
                            <div id="ai-api-key" className="space-y-4 scroll-mt-20">
                                <h3 className="text-lg font-semibold">🤖 生成 AI プロバイダ API キー (BYOK)
                                    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 align-middle">任意</span>
                                    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 align-middle">🌐 全アカ共通</span>
                                </h3>
                                <div className="bg-indigo-50 p-4 rounded-md border border-indigo-200">
                                    <p className="text-sm text-indigo-900 mb-1">
                                        投稿生成・リサーチ等で使用する LLM プロバイダの API キーを登録します（任意）。
                                    </p>
                                    <p className="text-xs text-indigo-800 mb-2">
                                        🎁 <span className="font-semibold">未登録でも 1日1回まで当社の AI で無料生成</span>できます。
                                        ご自身のキーを登録すると<span className="font-semibold">1日1回の制限がなくなり、常にご自身のキーで無制限</span>に使えます
                                        （費用はお客様の API 利用分のみ）。
                                    </p>
                                    <p className="text-[11px] text-indigo-700 mb-3 leading-relaxed">
                                        ※ 入力されたキーは暗号化して安全に保管され、AI 生成のリクエストにのみ使用します。
                                        いつでも削除・変更できます。登録をもって本取り扱いに同意したものとみなします。
                                    </p>
                                    <p className="text-xs text-indigo-700 mb-4">
                                        ※ Anthropic Claude が第一優先。どちらか一方を入力すれば動作します。両方入っている場合は Claude が使われます。
                                    </p>

                                    <div className="space-y-4">
                                        <CredentialField
                                            name="anthropicApiKey"
                                            label="Anthropic Claude API Key"
                                            labelExtra={<span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 border border-indigo-300 rounded-full px-2 py-0.5">推奨</span>}
                                            placeholder="sk-ant-api03-..."
                                            value={formData.anthropicApiKey}
                                            onChange={handleChange}
                                            locked={!!formData.anthropicApiKey && !unlocked.anthropicApiKey}
                                            onUnlock={() => unlock("anthropicApiKey")}
                                            help={<p className="text-xs text-gray-600">取得先: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">console.anthropic.com → API Keys</a> （Claude Sonnet 4.6 を使用）</p>}
                                        />

                                        <CredentialField
                                            name="openaiApiKey"
                                            label="OpenAI API Key"
                                            placeholder="sk-proj-..."
                                            value={formData.openaiApiKey}
                                            onChange={handleChange}
                                            locked={!!formData.openaiApiKey && !unlocked.openaiApiKey}
                                            onUnlock={() => unlock("openaiApiKey")}
                                            help={<p className="text-xs text-gray-600">取得先: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">platform.openai.com → API keys</a> （GPT-4o を使用）</p>}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="text-lg font-semibold">システム連携設定 (X/Twitter 自動投稿用)
                                    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 align-middle">👤 このアカウント専用</span>
                                </h3>


                                <div className="bg-gray-50 p-4 rounded-md border mt-6">
                                    <h4 className="font-medium text-gray-900 mb-2">【テスト用】個別APIキー設定 (BYOK)</h4>
                                    <p className="text-sm text-gray-600 mb-4">
                                        各ユーザーが自身のDeveloper API通信費用を負担するテスト用の方法です。<br />
                                        ※こちらの入力がある場合は優先して使用されます。
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <CredentialField
                                            name="xApiKey"
                                            label="API Key"
                                            value={formData.xApiKey}
                                            onChange={handleChange}
                                            locked={!!formData.xApiKey && !unlocked.xApiKey}
                                            onUnlock={() => unlock("xApiKey")}
                                        />
                                        <CredentialField
                                            name="xApiSecret"
                                            label="API Secret"
                                            value={formData.xApiSecret}
                                            onChange={handleChange}
                                            locked={!!formData.xApiSecret && !unlocked.xApiSecret}
                                            onUnlock={() => unlock("xApiSecret")}
                                        />
                                        <CredentialField
                                            name="xAccessToken"
                                            label="Access Token"
                                            value={formData.xAccessToken}
                                            onChange={handleChange}
                                            locked={!!formData.xAccessToken && !unlocked.xAccessToken}
                                            onUnlock={() => unlock("xAccessToken")}
                                        />
                                        <CredentialField
                                            name="xAccessSecret"
                                            label="Access Token Secret"
                                            value={formData.xAccessSecret}
                                            onChange={handleChange}
                                            locked={!!formData.xAccessSecret && !unlocked.xAccessSecret}
                                            onUnlock={() => unlock("xAccessSecret")}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 外部ツール（スプレッドシート連携） */}
                            <div className="space-y-4 pt-4 border-t mt-6">
                                <h3 className="text-lg font-semibold">外部連携 (スプレッドシート・GAS)
                                    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 align-middle">👤 このアカウント専用</span>
                                </h3>
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
                                <h3 className="text-lg font-semibold">🧩 プロラインフリー 連携（導線分析）
                                    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 align-middle">👤 このアカウント専用</span>
                                </h3>
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

                                {signingSecret && (
                                    <div className="space-y-2">
                                        <Label>🔐 署名秘密（HMAC 鍵 / 下の GAS コードに自動で埋め込み済み）</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={signingSecret}
                                                readOnly
                                                type="password"
                                                className="bg-slate-50 font-mono text-xs"
                                            />
                                            <Button type="button" variant="outline" onClick={() => copyToClipboard(signingSecret, "署名秘密")} disabled={!signingSecret}>
                                                コピー
                                            </Button>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">
                                            ⚠️ この値は<strong>あなた専用の署名鍵</strong>です。第三者に渡さないでください。偽の連携データ注入を防ぐため、β以降は GAS にこの署名が必須になります。URL を再発行すると署名秘密も変わります。
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>📝 GAS に貼り付けるテンプレートコード（署名付き）</Label>
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
                                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                                ⚠️ β以降は署名必須化のため、この「GAS なし直接送信」方式は署名を付けられず受信側で拒否されます。β運用では上記 <strong>A. の署名付き GAS 方式</strong>を使ってください。
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
                                <h3 className="text-lg font-semibold">💬 ChatWork 連携（リプ周り半自動化）
                                    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 align-middle">🌐 トークンは共通</span>
                                </h3>
                                <p className="text-[11px] text-amber-500/90 -mt-1">※ 送信先ルームIDのアカウント別設定は今後対応予定（現在は共通設定です）。</p>
                                <p className="text-xs text-muted-foreground -mt-2">
                                    ターゲットアカウントの高インプ投稿が見つかった際に、該当 URL とコピペ用リプライ案 3 本を ChatWork のルームへ自動送信します。
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <CredentialField
                                        name="chatworkApiToken"
                                        label="ChatWork API トークン"
                                        placeholder="ChatWork 設定 → API から取得"
                                        value={formData.chatworkApiToken}
                                        onChange={handleChange}
                                        locked={!!formData.chatworkApiToken && !unlocked.chatworkApiToken}
                                        onUnlock={() => unlock("chatworkApiToken")}
                                        help={<p className="text-[11px] text-muted-foreground">取得先: <a href="https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">chatwork.com → API 設定</a></p>}
                                    />
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
