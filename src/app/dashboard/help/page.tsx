"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, ChevronDown, Mail } from "lucide-react";

type QA = { q: string; a: React.ReactNode };

const QAS: QA[] = [
    {
        q: "投稿はどうやって作りますか？",
        a: <>左メニューの「投稿作成」でテーマを入力して生成します。「リアルタイムリサーチ」をONにすると、最新トレンドを web 検索してから生成します（設定でAnthropic または OpenAI のAPIキーが必要です）。</>,
    },
    {
        q: "「テンプレート化に失敗」と出ます。",
        a: <>AIのAPIキーが未設定／無効の可能性が高いです。「設定」画面で Anthropic（Claude）または OpenAI のAPIキーを保存してください。設定のキーはサーバー側より優先されます。</>,
    },
    {
        q: "リアルタイムリサーチが使えません。",
        a: <>「設定」に Anthropic または OpenAI のAPIキーを保存すると、そのキーで web 検索リサーチが動きます。キーが無い場合は通常生成にフォールバックします（エラーにはなりません）。</>,
    },
    {
        q: "アカウントごとに設定を変えたい。",
        a: <>左メニューのアカウント切替で対象アカウントをクリックすると、そのアカウント専用の設定ページが開きます。X(Twitter)のAPIキーやコンセプト・ターゲットを個別に設定できます（AIキーは全アカウント共通です）。</>,
    },
    {
        q: "リサーチでツリー（連投）を作れますか？",
        a: <>「リサーチ・横展開」の手動入力タブで「＋ツリーを追加」を押すと最大10投稿まで入力でき、提案もツリー形式で返ります。提案を「スケジューラーに保存」するとツリーのまま予約できます。</>,
    },
    {
        q: "予約・下書きを消したい。",
        a: <>「投稿スケジューラー」の各投稿に「🗑 削除」ボタンがあります（投稿済みは対象外）。</>,
    },
    {
        q: "シークレットリプライの注意点は？",
        a: <>メンション送信はシャドウバンのリスクがあるため自己責任でご利用ください。基本はDM送信を推奨しますが、DMには送信数制限があり、相手がDM受信可の設定である必要があります。</>,
    },
    {
        q: "データ分析の数字が0です。",
        a: <>X分析データは同期cronが定期的に取得します。直近の投稿から順次反映されるため、反映まで時間がかかる場合があります。</>,
    },
];

function Item({ qa }: { qa: QA }) {
    const [open, setOpen] = useState(false);
    return (
        <Card className="bg-white border-slate-200">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
            >
                <span className="font-semibold text-slate-900">{qa.q}</span>
                <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <CardContent className="pt-0 pb-5 px-5 text-sm text-slate-600 leading-relaxed">
                    {qa.a}
                </CardContent>
            )}
        </Card>
    );
}

export default function HelpPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <HelpCircle className="w-7 h-7 text-sky-500" /> Q&A・使い方
                </h1>
                <p className="text-slate-600 mt-2">よくある質問と使い方をまとめました。</p>
            </div>

            <div className="space-y-2">
                {QAS.map((qa, i) => <Item key={i} qa={qa} />)}
            </div>

            <Card className="bg-indigo-50 border-indigo-200">
                <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="font-semibold text-slate-900">解決しませんか？</p>
                        <p className="text-sm text-slate-600">エラー報告・新機能のご要望はお問い合わせから。</p>
                    </div>
                    <Link
                        href="/dashboard/contact"
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium"
                    >
                        <Mail className="w-4 h-4" /> お問い合わせ
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
