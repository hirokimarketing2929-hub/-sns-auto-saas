"use client";

import { Button } from "@/components/ui/button";
import {
    ArrowRight, Check, X, ShieldCheck, Sparkles, MessageCircle,
    Zap, Clock, Users, BarChart3, Tag, Bot, Target, Star,
} from "lucide-react";

const PROLINE_REGISTER_URL = "https://proline.app/";

/**
 * /dashboard/proline ランディングページ。
 *
 * デザインテイスト: autosns.jp 系 (プロラインフリー本家LP)
 *   - 白基調 + LINE緑 (emerald) アクセント
 *   - 巨大数字 (0円・無制限) でスキャナビリティ重視
 *   - 機能カード × グリッド、お客様の声、比較表、FAQ
 *   - 親しみやすく堅実なトーン
 *
 * 隠れ構造: 加藤将太「説得の価値観9」を順番通り埋め込み (顧客には見せない)
 *   1. 興味性・新規性          → Hero (2→4億 + 三大メッセージ)
 *   2. 目的・信念・自己開示    → "申し遅れました" 制作者紹介
 *   3. 夢・憧れ                → 朝の決済通知シーン (LF9: 快適/家族/お金)
 *   4. 恐怖・問題提起          → X単体運用の3つの壁
 *   5. ノウハウ・解決策        → 「足りなかったのは1つだけ」
 *   6. メリット                → 8つの機能 (LF9 紐付け) + ¥0 強調
 *   7. 限定性・緊急性          → 機会損失の可視化
 *   8. 不信の払拭・Q&A         → 顧客事例 + 比較表 + FAQ
 *   9. 後押し                  → 最終CTA + 感情訴求
 */
export default function ProlineLpPage() {
    return (
        <div className="-m-8 bg-white text-slate-900 min-h-[calc(100vh+4rem)]">
            <Hero />
            <ThreeMessages />
            <SectionWho />
            <SectionDream />
            <SectionFear />
            <SectionAnswer />
            <SectionFeatures />
            <SectionTestimonials />
            <SectionCompare />
            <SectionUrgency />
            <SectionFaq />
            <SectionFinal />
            <ExistingUserNote />
        </div>
    );
}

/* =============================================================
 * 1. Hero — 興味性・新規性
 * ============================================================= */
function Hero() {
    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 border-b border-slate-200">
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[40rem] h-[40rem] rounded-full bg-emerald-200/30 blur-3xl pointer-events-none" />

            <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
                {/* 信頼バッジ */}
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide">
                    <Star className="size-3.5 fill-emerald-500 text-emerald-500" />
                    ProX Agent 公式推奨 — LINE構築ツール No.1
                </div>

                <h1 className="mt-8 text-4xl md:text-6xl font-black tracking-tight leading-[1.2]">
                    Xで集めたフォロワーを、<br />
                    <span className="text-emerald-600 underline decoration-emerald-300 decoration-4 underline-offset-8">
                        "買ってくれるお客様"
                    </span>
                    に変える。
                </h1>

                <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                    顧問先・加藤さんが <span className="text-orange-500 font-bold">年商を2倍</span> にした追加施策は、
                    たった1つ。しかも <span className="text-emerald-600 font-bold">完全無料</span> です。
                </p>

                {/* 巨大ベネフィット数字 */}
                <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                    <BigStat label="月額" value="0" unit="円" />
                    <BigStat label="送信通数" value="無制限" unit="" />
                    <BigStat label="クレカ" value="不要" unit="" />
                </div>

                <div className="mt-10 flex flex-col items-center gap-3">
                    <CtaPrimary size="xl" />
                    <p className="text-xs text-slate-500">
                        ※登録は <span className="font-bold">30秒</span>。クレジットカード登録不要・解約金なし。
                    </p>
                </div>

                {/* 信頼性: メディア掲載風 */}
                <div className="mt-16 pt-8 border-t border-slate-200">
                    <p className="text-xs text-slate-500 tracking-widest uppercase mb-4">
                        次世代起業家育成セミナー公式採用 / 月商1,000万円以上の利用実績多数
                    </p>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 三大メッセージバナー (再強調)
 * ============================================================= */
function ThreeMessages() {
    return (
        <section className="bg-emerald-600 py-6 border-b-4 border-emerald-700">
            <div className="max-w-5xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 text-white">
                    <MessageBlock icon={<Check className="size-5" />} label="初期費用 0円" />
                    <MessageBlock icon={<Check className="size-5" />} label="月額費用 0円" />
                    <MessageBlock icon={<Check className="size-5" />} label="送信通数 上限なし" />
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 2. 自己開示 — 申し遅れました
 * ============================================================= */
function SectionWho() {
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        申し遅れました
                    </p>
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
                        この話をしているのは、<br />
                        <span className="text-emerald-600">毎月実際にやっている人間</span>です。
                    </h2>
                </div>

                <div className="bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-100">
                    <div className="flex flex-col md:flex-row items-start gap-8">
                        <div className="flex-shrink-0 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-3xl font-bold mx-auto md:mx-0">
                            吉
                        </div>
                        <div className="flex-1 space-y-4 text-center md:text-left">
                            <div>
                                <h3 className="text-xl md:text-2xl font-bold text-slate-900">
                                    吉留 大貴
                                </h3>
                                <p className="text-slate-500 text-sm mt-1">
                                    ProX Agent 開発者 / コンテンツ販売 × LINE自動化 月商1,000万円
                                </p>
                            </div>
                            <p className="text-slate-700 leading-relaxed">
                                顧問先の経営者・加藤さんは、私が提案した同じ導線を導入後、
                                年商を <strong className="text-orange-500">2億 → 4億</strong> に倍増させました。
                            </p>
                            <p className="text-slate-700 leading-relaxed">
                                机上論ではなく、自分のビジネスでも顧問先でも毎月証明している仕組みを、
                                今日あなたにそのままお渡しします。
                            </p>
                            <p className="text-slate-600 text-sm leading-relaxed bg-emerald-50 border-l-4 border-emerald-400 px-4 py-3 rounded-r">
                                ProX Agent を無料で配っている理由はシンプルです。<br />
                                <span className="text-slate-900 font-semibold">
                                    コンテンツ販売者を、消耗から解放したいから。
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 3. 夢・憧れ — 朝の決済通知
 * LF9: 快適 / 家族 / お金
 * ============================================================= */
function SectionDream() {
    return (
        <section className="py-20 md:py-28 bg-gradient-to-br from-amber-50/40 to-emerald-50/30 border-y border-slate-100">
            <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-orange-500 text-sm tracking-widest font-bold uppercase mb-3">
                        想像してみてください
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
                        朝、コーヒーを淹れる前に開いたスマホに、<br />
                        <span className="text-emerald-600">昨晩の決済通知が3件</span>。
                    </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <DreamCard
                        icon={<Clock className="size-6" />}
                        title="平日の夜が、家族のもとに"
                        body="深夜まで PC に向かう生活が終わり、子供と食卓を囲める時間が戻ってくる。あなたが本当に大切にしたかった『当たり前』が日常に。"
                    />
                    <DreamCard
                        icon={<Sparkles className="size-6" />}
                        title="休日も、寝ている間も"
                        body="温泉に入っている間にも、旅先で寝ている間にも、仕組みが代わりに売上を生み続ける。経済的な余裕と時間の自由が同時に手に入る。"
                    />
                </div>

                <p className="mt-12 text-center text-slate-600 max-w-2xl mx-auto leading-relaxed">
                    フォロワー数を毎日眺めている人と、この絵の中で生きている人の差は、<br />
                    <span className="text-slate-900 font-bold">才能ではなく、仕組みの有無だけ</span>です。
                </p>
            </div>
        </section>
    );
}

/* =============================================================
 * 4. 恐怖・問題提起
 * ============================================================= */
function SectionFear() {
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-rose-500 text-sm tracking-widest font-bold uppercase mb-3">
                        ここで現実の話をします
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
                        X運用『だけ』では、<br />
                        <span className="text-rose-500">売上は構造的に上がりません。</span>
                    </h2>
                    <p className="mt-6 text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        あなたが頑張っていないからではなく、<br />
                        Xという媒体に <span className="text-slate-900 font-semibold">構造的な抜け穴が3つ</span> 空いているからです。
                    </p>
                </div>

                <div className="space-y-5">
                    <Wall
                        index="01"
                        title="Xの投稿は、川のように流れて消える"
                        body="昨日あなたを見つけてくれた人は、明日にはもう別の人のタイムラインに流されています。あなたのプロフを毎日見に来る人は、ほぼいません。"
                        verdict="フォロワー数 ≠ 顧客リスト"
                    />
                    <Wall
                        index="02"
                        title="140文字では、人は買う気になりません"
                        body="人は『知っている』だけでは買いません。なぜ今必要か / なぜあなたから買うべきか / 買わないと何を失うか──を順番に時間をかけて理解して、初めて財布が開きます。"
                        verdict="知ってる人 ≠ 買う人"
                    />
                    <Wall
                        index="03"
                        title="販売の自動化が無いと、止まったら終わり"
                        body="毎回のローンチで DM 対応・LP 修正・決済導線の手動運用…。これでは『時間』がボトルネックになり、売上は自分の稼働量に正比例します。"
                        verdict="自分が止まると、売上も止まる"
                    />
                </div>

                <div className="mt-10 bg-rose-50 border-l-4 border-rose-400 rounded-r-2xl p-6 md:p-8">
                    <p className="text-rose-700 text-xs font-bold tracking-widest uppercase mb-3">
                        最も多い失敗パターン
                    </p>
                    <p className="text-slate-900 text-lg md:text-xl font-bold leading-relaxed mb-2">
                        「もっと頑張ってフォロワー増やせば、いつか売上もついてくる」
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                        ──これは、抜け穴の存在を知らない人が必ず辿るルートです。
                        フォロワー1万人になっても売上が変わらない人を、私はもう何人も見てきました。
                    </p>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 5. ノウハウ・解決策
 * ============================================================= */
function SectionAnswer() {
    return (
        <section className="py-20 md:py-28 bg-slate-50 border-y border-slate-100">
            <div className="max-w-5xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        では、足りないものは何か
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
                        足りなかったのは、<br />
                        <span className="text-emerald-600">たった1つだけ。</span>
                    </h2>
                    <p className="mt-6 text-xl md:text-2xl font-bold text-slate-700 max-w-2xl mx-auto leading-relaxed">
                        『教育と販売を、24時間勝手にやってくれる場所』。
                    </p>
                    <p className="mt-4 text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        その答えが <strong className="text-emerald-600">LINE による自動ステップ配信</strong>。
                        そして、それを完全無料で実装できるのが <strong className="text-emerald-600">プロラインフリー</strong> です。
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <FunnelStage
                        phase="STEP 1"
                        tool="ProX Agent"
                        target="X"
                        body="AIがあなたの軸に沿った投稿を毎日生成。フォロワーを集めて、興味を持った人をプロフィール経由で次へ流す。"
                        color="from-blue-50 to-cyan-50"
                        accent="text-blue-600"
                    />
                    <FunnelStage
                        phase="STEP 2"
                        tool="プロラインフリー"
                        target="LINE"
                        body="登録の瞬間からステップ配信が起動。なぜ必要か / なぜあなたから買うべきかを順番に伝えて教育。"
                        color="from-emerald-50 to-teal-50"
                        accent="text-emerald-600"
                    />
                    <FunnelStage
                        phase="STEP 3"
                        tool="プロラインフリー"
                        target="決済"
                        body="教育が終わったタイミングでオファー配信。決済リンクまで一気に到達。寝ている間も売上が立つ。"
                        color="from-orange-50 to-amber-50"
                        accent="text-orange-600"
                    />
                </div>

                <div className="mt-10 text-center">
                    <p className="text-slate-700 leading-relaxed max-w-2xl mx-auto mb-6">
                        この3ステップが <strong className="text-slate-900">毎日24時間、自動で回り続ける</strong>。<br />
                        加藤さんの年商を 2億 → 4億 に押し上げた仕組みの正体です。
                    </p>
                    <CtaSecondary />
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 6. メリット — 8つの機能
 * ============================================================= */
function SectionFeatures() {
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="max-w-6xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        プロラインフリーで手に入る機能
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
                        他社なら<span className="text-orange-500">月3万円〜</span>の機能が、<br />
                        全部 <span className="text-emerald-600 font-mono">¥0</span> で使える。
                    </h2>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <FeatureCard
                        icon={<MessageCircle className="size-6" />}
                        title="ステップ配信"
                        body="登録から数日かけて自動で教育→販売へ。シナリオ作成は GUI で完結。"
                    />
                    <FeatureCard
                        icon={<Tag className="size-6" />}
                        title="タグ管理"
                        body="登録経路・興味分野でユーザーを自動分類。属性ごとに最適な配信を。"
                    />
                    <FeatureCard
                        icon={<Target className="size-6" />}
                        title="絞り込み配信"
                        body="特定タグの保有者にだけメッセージを届ける。無駄打ちゼロで成約率UP。"
                    />
                    <FeatureCard
                        icon={<BarChart3 className="size-6" />}
                        title="流入分析"
                        body="どのCTAから何人登録したかを自動計測。改善ポイントが一目で分かる。"
                    />
                    <FeatureCard
                        icon={<Bot className="size-6" />}
                        title="自動応答"
                        body="キーワード反応で個別質問にも自動対応。営業時間外も逃さない。"
                    />
                    <FeatureCard
                        icon={<Users className="size-6" />}
                        title="友だち追加URL生成"
                        body="ProX Agent の投稿CTAにそのまま貼れる。X→LINE導線が30秒で完成。"
                    />
                    <FeatureCard
                        icon={<Zap className="size-6" />}
                        title="リッチメッセージ"
                        body="画像・動画・カードでクリック率を大幅向上。ステップ配信の中で自由に使える。"
                    />
                    <FeatureCard
                        icon={<Sparkles className="size-6" />}
                        title="販売台本テンプレ"
                        body="成約率の高い『教育→販売』シナリオが標準搭載。コピペで使える完成品。"
                    />
                </div>

                <p className="mt-10 text-center text-slate-500 text-sm">
                    ※ 上記すべての機能が、無料プランのまま無制限で使えます。
                </p>
            </div>
        </section>
    );
}

/* =============================================================
 * 顧客の声 (信頼補強)
 * ============================================================= */
function SectionTestimonials() {
    return (
        <section className="py-20 md:py-28 bg-slate-50 border-y border-slate-100">
            <div className="max-w-6xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        導入された方の声
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
                        実際に成果が出ている事例。
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <Testimonial
                        avatar="加"
                        avatarBg="from-orange-400 to-rose-500"
                        name="加藤さん"
                        role="経営者 / 顧問先"
                        result="2億 → 4億"
                        resultLabel="年商の推移"
                        body="X運用は数年前からやっていましたが、売上が伸び悩んでいました。プロラインフリーでの教育導線を組んでから、半年で売上が倍になりました。"
                    />
                    <Testimonial
                        avatar="吉"
                        avatarBg="from-emerald-400 to-teal-500"
                        name="吉留さん"
                        role="本ページ作者 / コンテンツ販売"
                        result="月1,000万円"
                        resultLabel="毎月の自動売上"
                        body="自分のビジネスでも同じ仕組みを運用しています。寝ている間に売上が立つ感覚を、一度味わうと元には戻れません。"
                    />
                    <Testimonial
                        avatar="A"
                        avatarBg="from-violet-400 to-fuchsia-500"
                        name="Aさん"
                        role="アフィリエイター"
                        result="月7桁達成"
                        resultLabel="フォロワー1,200人で"
                        body="フォロワーが少なくても、リストの質が高ければ売上は立つ。LINE教育の力を実感しています。ProX Agent との相性も抜群です。"
                    />
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 比較表
 * ============================================================= */
function SectionCompare() {
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="max-w-5xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-orange-500 text-sm tracking-widest font-bold uppercase mb-3">
                        他社のLINEツールと比べると
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
                        無料なのに、機能で<br />
                        <span className="text-emerald-600">他社の上位プランを上回る。</span>
                    </h2>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                    <table className="w-full text-left bg-white">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 md:p-5 text-slate-700 font-bold text-sm md:text-base">機能</th>
                                <th className="p-4 md:p-5 text-emerald-700 font-bold text-sm md:text-base bg-emerald-50/50 text-center">
                                    プロラインフリー
                                    <div className="text-xs font-normal text-emerald-600 mt-0.5">完全無料</div>
                                </th>
                                <th className="p-4 md:p-5 text-slate-500 font-bold text-sm md:text-base text-center">
                                    一般的な他社ツール
                                    <div className="text-xs font-normal text-slate-400 mt-0.5">月3〜5万円</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <CompareRow feature="月額費用" us="¥0" them="¥30,000〜" usOk />
                            <CompareRow feature="送信通数" us="無制限" them="月1,000通まで" usOk />
                            <CompareRow feature="ステップ配信" us={true} them={true} />
                            <CompareRow feature="タグ・絞り込み配信" us={true} them="上位プランのみ" usOk />
                            <CompareRow feature="自動応答" us={true} them={true} />
                            <CompareRow feature="販売台本テンプレ" us={true} them={false} usOk />
                            <CompareRow feature="ProX Agent 連携" us={true} them="非対応" usOk />
                            <CompareRow feature="解約金" us="¥0" them="あり" usOk />
                        </tbody>
                    </table>
                </div>

                <p className="mt-6 text-center text-slate-500 text-sm">
                    ※ プロラインフリーは、機能を無料で開放する代わりに任意のアップグレード制を採用しています。
                </p>
            </div>
        </section>
    );
}

/* =============================================================
 * 7. 限定性・緊急性
 * ============================================================= */
function SectionUrgency() {
    return (
        <section className="py-20 md:py-28 bg-amber-50/40 border-y border-amber-100">
            <div className="max-w-4xl mx-auto px-6 text-center">
                <p className="text-orange-500 text-sm tracking-widest font-bold uppercase mb-3">
                    1つだけ、注意してください
                </p>
                <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
                    いまこの瞬間も、<br />
                    <span className="text-orange-500">ProX が集めるフォロワーが流出しています。</span>
                </h2>

                <p className="mt-8 text-lg text-slate-700 max-w-2xl mx-auto leading-relaxed">
                    ProX Agent は毎日フォロワーを集めますが、教育の受け皿が無いと、<br />
                    その人たちは <span className="text-slate-900 font-bold">リスト化されずに流出</span> していきます。
                </p>

                <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                    <LossCell label="今月の機会損失" value="計測不能" />
                    <LossCell label="リスト化されない人数" value="増え続け" />
                    <LossCell label="競合との差" value="拡大中" />
                    <LossCell label="あなたの時間" value="消耗中" />
                </div>

                <div className="mt-10 inline-flex items-center gap-2 bg-orange-100 border border-orange-200 text-orange-700 px-5 py-3 rounded-full text-sm">
                    <Clock className="size-4" />
                    <strong>1日先延ばし = 1日分の損失が確定</strong>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 8. 不信の払拭・FAQ
 * ============================================================= */
function SectionFaq() {
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="max-w-3xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        よくあるご質問
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
                        「うまい話すぎないか？」<br />
                        <span className="text-emerald-600">正直な反応です。</span>
                    </h2>
                </div>

                <div className="space-y-4">
                    <Faq
                        q="本当に無料？どこかで課金が発生するのでは？"
                        a="月額もクレジット登録も不要。ステップ配信・タグ管理・絞り込み配信・流入分析まで、すべて無料プランで無制限に使えます。アップグレードは任意で、無料プランのまま月1,000万を回している事例もあります(私もその一人です)。"
                    />
                    <Faq
                        q="設定が難しそう。技術が無いと使えない？"
                        a="シナリオ配信は GUI で組めるので、コードは1行も書きません。テンプレートも豊富で、登録から30分で『最初のステップ配信』を稼働させた事例があります。ProX Agent との連携は、生成投稿のCTAに発行された LINE URL を貼り付けるだけです。"
                    />
                    <Faq
                        q="合わなかったら、お金や時間は取り戻せない？"
                        a="合わなければ、その瞬間に辞めて構いません。月額0円なので解約金もなく、データを消すだけ。失う物は『最初の30秒の登録時間』だけです。これが『リスクゼロで試せる』の正確な意味です。"
                    />
                    <Faq
                        q="他のLINEツールと比べて、なぜプロラインフリー？"
                        a="(1) 無料で本格機能、(2) 私が顧問業で実際に毎月使っており勝ちパターンを把握している、(3) ProX Agent との連携が最も自然、の3点です。私が ProX のCTA設定でデフォルト推奨にしているのも同じ理由です。"
                    />
                    <Faq
                        q="X以外のSNS集客にも使える？"
                        a="使えます。Instagram・YouTube・ブログなど、どこから来た見込み客でも、LINE登録さえしてもらえばあとはステップ配信が自動で教育〜販売を回します。むしろマルチチャネルでこそ威力を発揮します。"
                    />
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 9. Final CTA — 後押し
 * ============================================================= */
function SectionFinal() {
    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 py-20 md:py-28">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-emerald-300/20 blur-3xl" />

            <div className="relative max-w-3xl mx-auto px-6 text-center text-white">
                <p className="text-emerald-100 text-sm tracking-widest font-bold uppercase mb-4">
                    最後に、本音だけ言います
                </p>

                <h2 className="text-3xl md:text-5xl font-black leading-[1.2] max-w-2xl mx-auto">
                    「いつかやる」は、<br />
                    永遠に来ません。
                </h2>

                <div className="mt-8 space-y-4 text-lg text-emerald-50 leading-relaxed max-w-2xl mx-auto">
                    <p>
                        あなたがここまで読んだのは、<br />
                        薄々、答えに気づいているからです。
                    </p>
                    <p>
                        必要なのは、<strong className="text-white">30秒の登録</strong>と
                        <strong className="text-white">『今やる』の決断</strong>。<br />
                        それだけで、明日から構造が変わります。
                    </p>
                    <p className="text-white font-bold pt-2 text-xl md:text-2xl">
                        私を信じてボタンを押してください。<br />
                        あなたの夜を、家族のもとに返します。
                    </p>
                </div>

                <div className="mt-10 flex flex-col items-center gap-3">
                    <a
                        href={PROLINE_REGISTER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-[calc(100%-2rem)] max-w-md"
                    >
                        <Button
                            size="lg"
                            className="w-full h-16 bg-white hover:bg-slate-50 text-emerald-700 hover:text-emerald-800 font-black text-lg rounded-full shadow-2xl border-0 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Sparkles className="size-5 mr-2" />
                            30秒で無料アカウントを作成する
                            <ArrowRight className="size-5 ml-2" />
                        </Button>
                    </a>
                    <p className="text-emerald-100 text-xs tracking-widest uppercase">
                        無料 ・ 30秒 ・ クレカ不要 ・ いつでも辞められる
                    </p>
                </div>

                <div className="mt-12 inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/20 px-5 py-3 rounded-full text-sm">
                    <ShieldCheck className="size-4" />
                    合わなければ、その瞬間に辞めて大丈夫。失う物は何もありません。
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 既存ユーザー向け
 * ============================================================= */
function ExistingUserNote() {
    return (
        <section className="py-12 bg-slate-50 border-t border-slate-200">
            <div className="max-w-3xl mx-auto px-6 text-center space-y-4">
                <p className="text-slate-500 text-sm font-bold">すでにプロラインフリーをお持ちの方へ</p>
                <p className="text-slate-600 text-sm leading-relaxed max-w-xl mx-auto">
                    ProX Agent の自動投稿機能で、CTAに発行済みのプロラインURLを設定するだけで、
                    X集客 → LINE自動配信の連携が完了します。
                </p>
                <div className="flex justify-center gap-3 flex-wrap pt-2">
                    <Button
                        variant="outline"
                        onClick={() => (window.location.href = "/dashboard/settings")}
                        className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                        設定画面を開く
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => (window.location.href = "/dashboard/generate")}
                        className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                        AI自動投稿を試す
                    </Button>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 部品
 * ============================================================= */

function CtaPrimary({ size = "lg" }: { size?: "lg" | "xl" }) {
    const heightClass = size === "xl" ? "h-16 text-base md:text-lg" : "h-14 text-base";
    return (
        <a
            href={PROLINE_REGISTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-[calc(100%-2rem)] max-w-md mx-auto"
        >
            <Button
                size="lg"
                className={`w-full ${heightClass} bg-emerald-500 hover:bg-emerald-600 text-white font-black border-0 rounded-full shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]`}
            >
                <Sparkles className="size-5 mr-2" />
                30秒で無料アカウントを作成する
                <ArrowRight className="size-5 ml-2" />
            </Button>
        </a>
    );
}

function CtaSecondary() {
    return (
        <a href={PROLINE_REGISTER_URL} target="_blank" rel="noopener noreferrer">
            <Button className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-full shadow-md shadow-emerald-500/20 transition-all">
                この仕組みを今すぐ手に入れる
                <ArrowRight className="size-4 ml-2" />
            </Button>
        </a>
    );
}

function BigStat({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-4 md:p-6 text-center">
            <p className="text-xs md:text-sm text-slate-500 mb-1">{label}</p>
            <div className="flex items-end justify-center gap-1 leading-none">
                <span className="text-3xl md:text-5xl font-black text-emerald-600 tabular-nums">
                    {value}
                </span>
                {unit && <span className="text-base md:text-lg text-slate-700 font-bold mb-1">{unit}</span>}
            </div>
        </div>
    );
}

function MessageBlock({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center justify-center gap-2 font-bold text-base md:text-lg">
            <span className="bg-white text-emerald-600 rounded-full p-1">{icon}</span>
            <span>{label}</span>
        </div>
    );
}

function DreamCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                {icon}
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-900">{title}</h3>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base">{body}</p>
        </div>
    );
}

function Wall({ index, title, body, verdict }: { index: string; title: string; body: string; verdict: string }) {
    return (
        <div className="bg-white border border-rose-100 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex items-start gap-5">
                <span className="text-3xl md:text-4xl font-black text-rose-200 flex-shrink-0 leading-none">
                    {index}
                </span>
                <div className="flex-1 space-y-2">
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">{title}</h3>
                    <p className="text-slate-700 leading-relaxed text-sm md:text-base">{body}</p>
                    <p className="text-rose-600 font-bold pt-2 border-t border-rose-100 mt-3 text-sm md:text-base">
                        → {verdict}
                    </p>
                </div>
            </div>
        </div>
    );
}

function FunnelStage({
    phase, tool, target, body, color, accent,
}: {
    phase: string;
    tool: string;
    target: string;
    body: string;
    color: string;
    accent: string;
}) {
    return (
        <div className={`bg-gradient-to-br ${color} rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3`}>
            <p className={`text-xs tracking-widest font-bold uppercase ${accent}`}>{phase}</p>
            <div>
                <h3 className="text-xl font-bold text-slate-900">{tool}</h3>
                <p className="text-xs text-slate-500 mt-0.5">on {target}</p>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
        </div>
    );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 hover:shadow-md hover:border-emerald-200 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                {icon}
            </div>
            <h3 className="font-bold text-slate-900 mb-1.5">{title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{body}</p>
        </div>
    );
}

function Testimonial({
    avatar, avatarBg, name, role, result, resultLabel, body,
}: {
    avatar: string;
    avatarBg: string;
    name: string;
    role: string;
    result: string;
    resultLabel: string;
    body: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br ${avatarBg} text-white flex items-center justify-center text-xl font-bold`}>
                    {avatar}
                </div>
                <div>
                    <p className="font-bold text-slate-900">{name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{role}</p>
                </div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-xs text-emerald-700 font-bold tracking-wider uppercase mb-1">{resultLabel}</p>
                <p className="text-2xl md:text-3xl font-black text-emerald-700 leading-none">{result}</p>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">「{body}」</p>
        </div>
    );
}

function CompareRow({
    feature, us, them, usOk,
}: {
    feature: string;
    us: string | boolean;
    them: string | boolean;
    usOk?: boolean;
}) {
    return (
        <tr>
            <td className="p-4 md:p-5 text-slate-700 font-semibold text-sm md:text-base">{feature}</td>
            <td className={`p-4 md:p-5 text-center text-sm md:text-base ${usOk ? "bg-emerald-50/30" : ""}`}>
                {typeof us === "boolean" ? (
                    us ? <Check className="size-5 text-emerald-600 inline" /> : <X className="size-5 text-slate-300 inline" />
                ) : (
                    <span className="font-bold text-emerald-700">{us}</span>
                )}
            </td>
            <td className="p-4 md:p-5 text-center text-sm md:text-base">
                {typeof them === "boolean" ? (
                    them ? <Check className="size-5 text-slate-400 inline" /> : <X className="size-5 text-rose-400 inline" />
                ) : (
                    <span className="text-slate-500">{them}</span>
                )}
            </td>
        </tr>
    );
}

function LossCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white rounded-xl border border-orange-200 p-4 shadow-sm">
            <p className="text-[10px] md:text-xs tracking-widest font-bold text-slate-500 uppercase mb-1">{label}</p>
            <p className="text-base md:text-lg font-black text-orange-600">{value}</p>
        </div>
    );
}

function Faq({ q, a }: { q: string; a: string }) {
    return (
        <details className="group bg-slate-50 hover:bg-slate-100 transition rounded-2xl border border-slate-200 overflow-hidden">
            <summary className="cursor-pointer p-5 md:p-6 list-none">
                <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">Q</span>
                    <h3 className="flex-1 font-bold text-slate-900 leading-snug pt-0.5">{q}</h3>
                    <span className="flex-shrink-0 text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </div>
            </summary>
            <div className="px-5 md:px-6 pb-5 md:pb-6 pl-[3.75rem] md:pl-[4rem]">
                <div className="flex items-start gap-3 pt-2 border-t border-slate-200">
                    <p className="text-slate-700 leading-relaxed text-sm md:text-base pt-3">{a}</p>
                </div>
            </div>
        </details>
    );
}
