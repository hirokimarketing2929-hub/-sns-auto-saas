import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "利用規約（β簡易版） | ProX",
    description: "ProX クローズドβ版 利用規約（簡易版）",
};

// 決定: β簡易版の利用規約（リリース前チェックリスト 6.1）。
// 正式版は専門家レビューを経て後日掲示する（このページは簡易版）。
export default function TermsPage() {
    return (
        <main className="min-h-screen bg-slate-900 text-slate-200 py-12 px-4 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-6">
                <div className="space-y-2">
                    <Link href="/login" className="text-sm text-indigo-400 hover:text-indigo-300">← ログインに戻る</Link>
                    <h1 className="text-2xl font-bold text-white">ProX 利用規約（β簡易版）</h1>
                    <p className="text-xs text-slate-400">
                        本規約は ProX クローズドβ版に適用される簡易版です。正式版は後日掲示します。
                    </p>
                </div>

                <ol className="space-y-5 text-sm leading-relaxed list-decimal pl-5">
                    <li>
                        <span className="font-semibold text-white">サービスの提供（β版・現状有姿）</span><br />
                        本サービス「ProX」は、<span className="font-semibold">つどいラボ（以下「当社」）</span>が提供します。現在クローズドβ版として無料で、現状有姿（as-is）で提供されます。当社は動作・成果を保証せず、β期間中は予告なくサービス内容の変更・中断・終了を行うことがあります。
                    </li>
                    <li>
                        <span className="font-semibold text-white">アカウントと遵守事項</span><br />
                        利用者は、X(Twitter) の規約および適用される法令を遵守し、自身が正当な権限を有するアカウントのみを連携するものとします。第三者のアカウントを無断で連携・利用してはなりません。
                    </li>
                    <li>
                        <span className="font-semibold text-white">生成コンテンツの責任</span><br />
                        本サービスは AI により投稿案を生成・補助しますが、実際に投稿する内容の最終的な確認・判断・責任は利用者に帰属します。スパム、虚偽、第三者の権利を侵害する内容、その他法令・X規約に反する投稿を行ってはなりません。
                    </li>
                    <li>
                        <span className="font-semibold text-amber-300">シャドウバン・アカウントバン等の免責（重要）</span><br />
                        利用者は、本サービスが X(Twitter) への投稿を自動化・補助するものであり、自動化ツールの利用には <span className="font-semibold">X社の判断によるシャドウバン（表示制限）・リーチ低下・アカウントの凍結／制限／削除（アカウントバン）等のリスク</span> が伴うことを理解し、<span className="font-semibold">自己の責任において</span> 本サービスを利用するものとします。当社は、X社が行うこれらの措置（シャドウバン、アカウントの凍結・制限・削除、表示制限、リーチ低下等）について、その原因を問わず<span className="font-semibold">一切の責任を負いません</span>。
                    </li>
                    <li>
                        <span className="font-semibold text-white">アフィリエイトの開示</span><br />
                        本サービスは「プロラインフリー」等のアフィリエイト（紹介）リンクを含みます。利用者が当該リンクから登録・利用した場合、当社に紹介報酬が発生することがあります。
                    </li>
                    <li>
                        <span className="font-semibold text-white">免責・責任の制限</span><br />
                        当社は、本サービスの利用または利用不能により利用者に生じた損害について、法令上許容される範囲で一切の責任を負いません。
                    </li>
                    <li>
                        <span className="font-semibold text-white">準拠法</span><br />
                        本規約は日本法に準拠します。
                    </li>
                </ol>

                <div className="border-t border-slate-700 pt-4 text-xs text-slate-400 space-y-1">
                    <p>※ 本規約はβ簡易版です。所在地その他の事項を含む正式版を後日掲示します。</p>
                    <p>事業者：つどいラボ　お問い合わせ：hiroki.marketing2929@gmail.com</p>
                    <p>あわせて <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline">プライバシーポリシー</Link> をご確認ください。</p>
                </div>
            </div>
        </main>
    );
}
