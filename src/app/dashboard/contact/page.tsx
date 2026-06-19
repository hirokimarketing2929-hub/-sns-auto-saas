"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send, CheckCircle2, Mail } from "lucide-react";

const CATEGORIES = ["エラー報告", "新機能依頼", "その他"] as const;

export default function ContactPage() {
    const [category, setCategory] = useState<string>("エラー報告");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!message.trim()) {
            setError("お問い合わせ内容を入力してください。");
            return;
        }
        setSending(true);
        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category, message: message.trim() }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(d.message || "送信に失敗しました。");
                return;
            }
            setDone(true);
            setMessage("");
        } catch {
            setError("通信エラーが発生しました。");
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Mail className="w-7 h-7 text-indigo-500" /> お問い合わせ
                </h1>
                <p className="text-slate-600 mt-2">
                    エラー報告・新機能のご要望・その他のご相談はこちらから。運営に届きます。
                </p>
            </div>

            {done ? (
                <Card className="bg-white border-emerald-200">
                    <CardContent className="p-8 text-center space-y-3">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                        <p className="text-lg font-bold text-slate-900">送信しました！</p>
                        <p className="text-sm text-slate-600">お問い合わせありがとうございます。内容を確認し、必要に応じてご連絡します。</p>
                        <Button variant="outline" onClick={() => setDone(false)}>続けて送信する</Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-white border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg text-slate-900">お問い合わせフォーム</CardTitle>
                        <CardDescription>種別を選んで内容をご記入ください。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="category">お問い合わせ種別</Label>
                                <select
                                    id="category"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                                >
                                    {CATEGORIES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="message">お問い合わせ内容</Label>
                                <Textarea
                                    id="message"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="できるだけ具体的にご記入ください（例：どの画面で / 何をしたら / どうなったか）"
                                    className="bg-white min-h-[160px]"
                                    maxLength={5000}
                                />
                                <p className="text-xs text-slate-400 text-right">{message.length} / 5000</p>
                            </div>
                            {error && (
                                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">⚠️ {error}</p>
                            )}
                            <Button type="submit" disabled={sending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 送信中...</> : <><Send className="w-4 h-4 mr-2" /> 送信する</>}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
