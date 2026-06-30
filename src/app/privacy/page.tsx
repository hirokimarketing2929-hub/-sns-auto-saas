import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "プライバシーポリシー（β簡易版） | ProX",
    description: "ProX クローズドβ版 プライバシーポリシー（簡易版）",
};

// 決定: β簡易版のプライバシーポリシー（リリース前チェックリスト 6.1 / 6.2）。
// 正式版は専門家レビューを経て後日掲示する（このページは簡易版）。
export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-slate-900 text-slate-200 py-12 px-4 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-6">
                <div className="space-y-2">
                    <Link href="/login" className="text-sm text-indigo-400 hover:text-indigo-300">← ログインに戻る</Link>
                    <h1 className="text-2xl font-bold text-white">ProX プライバシーポリシー（β簡易版）</h1>
                    <p className="text-xs text-slate-400">
                        つどいラボ（以下「当社」）は、本サービス「ProX」クローズドβ版における個人情報の取扱いについて、以下のとおり定めます。本ポリシーは簡易版であり、正式版を後日掲示します。
                    </p>
                </div>

                <ol className="space-y-5 text-sm leading-relaxed list-decimal pl-5">
                    <li>
                        <span className="font-semibold text-white">取得する情報</span><br />
                        メールアドレス・お名前、X(Twitter) アカウント情報および連携（OAuth）トークン、利用者が任意で登録する AI（Anthropic / OpenAI 等）の API キー、サービスの利用ログ（生成・投稿・利用回数等）、プロライン導線に関するイベント情報。
                    </li>
                    <li>
                        <span className="font-semibold text-white">利用目的</span><br />
                        投稿の生成・予約・X への投稿、利用状況の分析・改善、フリーミアム（無料枠）の管理、お問い合わせ対応など、本サービスの提供・運営のために利用します。
                    </li>
                    <li>
                        <span className="font-semibold text-white">保管とセキュリティ</span><br />
                        X 連携トークンおよび利用者が登録した API キー等の機微情報は、<span className="font-semibold">AES-256-GCM により暗号化して保管</span>します。当社はこれらの情報を第三者に販売しません。
                    </li>
                    <li>
                        <span className="font-semibold text-white">外部サービスへの送信（委託先）</span><br />
                        本サービスの提供に必要な範囲で、AI による生成のため Anthropic / OpenAI、投稿・取得のため X(Twitter) API、導線管理のため プロラインフリー（autosns）等の外部サービスに情報を送信します。
                    </li>
                    <li>
                        <span className="font-semibold text-white">BYOK（API キーの自己管理）</span><br />
                        利用者がご自身の AI API キーを登録する場合、当該キーは利用者自身が管理する資産です。設定画面からいつでも削除でき、退会時には当社の保有する当該情報を削除します。
                    </li>
                    <li>
                        <span className="font-semibold text-white">開示・訂正・削除</span><br />
                        本人からのご請求に応じて、当社が保有する当該本人の情報の開示・訂正・削除に対応します。アカウント削除（退会）により関連データを削除します。
                    </li>
                    <li>
                        <span className="font-semibold text-white">お問い合わせ窓口</span><br />
                        つどいラボ　メール：hiroki.marketing2929@gmail.com
                    </li>
                </ol>

                <div className="border-t border-slate-700 pt-4 text-xs text-slate-400 space-y-1">
                    <p>※ 本ポリシーはβ簡易版です。所在地その他の事項を含む正式版を後日掲示します。</p>
                    <p>あわせて <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 underline">利用規約</Link> をご確認ください。</p>
                </div>
            </div>
        </main>
    );
}
