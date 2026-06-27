"use client";

import { Button } from "@/components/ui/button";
import {
    ArrowRight, Check, X, ShieldCheck, Sparkles, MessageCircle,
    Zap, Clock, Users, BarChart3, Tag, Bot, Target, Star,
} from "lucide-react";
import { PROLINE_DIRECT_URL } from "@/lib/proline";

// 最終CTAは /direct（LINE友だち追加に直行）に向けて成約までの摩擦を最小化する。
const PROLINE_REGISTER_URL = PROLINE_DIRECT_URL;

/**
 * /dashboard/proline ランディングページ（コピー v4 反映版）。
 *
 * デザインテイスト: autosns.jp 系 (プロラインフリー本家LP)
 *   - 白基調 + LINE緑 (emerald) アクセント / 巨大数字でスキャナビリティ重視
 *   - 機能カード × グリッド、実績カルーセル、声、比較表、FAQ
 *   - スマホ: 1カラム & 横スクロールのカルーセル / PC: グリッド
 *
 * 構成（感情の波）:
 *   1. フック(問いかけ)        → Hero
 *   2. 自己開示 + 実績4枚       → SectionWho + 実績カルーセル
 *   3. 未来(事業者/副業の2軸)   → SectionDream
 *   4. 問題提起(3つの壁)        → SectionFear
 *   5. 解決(1つだけ + 3STEP)    → SectionAnswer
 *   6. 機能                     → SectionFeatures
 *   7. 声(その後の変化)         → SectionTestimonials
 *   8. 比較表 / 緊急性 / FAQ    → SectionCompare / SectionUrgency / SectionFaq
 *   9. クロージング             → SectionFinal
 *  10. 既存ユーザー(KPI予告)    → ExistingUserNote
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
            <SectionConsult />
            <SectionFinal />
            <ExistingUserNote />
        </div>
    );
}

/* =============================================================
 * 1. Hero — フック（問いかけ）
 * ============================================================= */
function Hero() {
    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 border-b border-slate-200">
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[40rem] h-[40rem] rounded-full bg-emerald-200/30 blur-3xl pointer-events-none" />

            <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
                {/* 信頼バッジ */}
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide">
                    <Star className="size-3.5 fill-emerald-500 text-emerald-500" />
                    ProX Agent 公式推奨 — 無料LINE構築ツール No.1
                </div>

                <h1 className="mt-8 text-3xl md:text-5xl font-black tracking-tight leading-[1.35] md:leading-[1.3]">
                    Xで集めたフォロワーを、<br />
                    <span className="text-emerald-600 underline decoration-emerald-300 decoration-4 underline-offset-8">
                        「買ってくれるお客様」
                    </span>
                    に変えて、<br />
                    毎月 <span className="text-orange-500">&quot;放置するだけ&quot;</span> で商品が売れる——<br />
                    そんな LINE自動化の仕組みづくりが、<br />
                    <span className="text-emerald-600 text-4xl md:text-6xl">&quot;無料&quot;</span> ではじめられるとしたら、<br />
                    <span className="text-slate-600 text-xl md:text-3xl font-bold">試してみる価値はあると思いませんか？</span>
                </h1>

                <p className="mt-8 text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                    ProX開発者・吉留大貴が、
                    <span className="text-orange-500 font-bold">月100万円以上を売り上げるクライアントを量産</span>
                    してきたLINE自動化の仕組みを、あなたも
                    <span className="text-emerald-600 font-bold">&quot;無料&quot;</span> で手に入れませんか？
                </p>

                {/* 巨大ベネフィット数字 */}
                <div className="mt-12 grid grid-cols-3 gap-3 md:gap-4 max-w-2xl mx-auto">
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

                {/* 信頼性ストリップ */}
                <div className="mt-16 pt-8 border-t border-slate-200">
                    <p className="text-xs text-slate-500 tracking-wide mb-4 leading-relaxed">
                        連携10万アカウント以上 / インフルエンサーから大阪王将まで導入している無料LINE自動化ツール
                    </p>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 三大メッセージバナー
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
 * 2. 自己開示 + 実績カルーセル
 * ============================================================= */
function SectionWho() {
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="max-w-5xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        申し遅れました
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold text-slate-900 leading-tight">
                        この話をしているのは、<br />
                        1,500件以上を見てきた<br className="md:hidden" />
                        <span className="text-emerald-600">&quot;リストマーケティングのプロ&quot;</span>です。
                    </h2>
                </div>

                <div className="max-w-4xl mx-auto bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-100">
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
                                    ProX 開発者 / プロライン認定コンサルタント（有料指名1位・お客様満足度1位の実績あり）
                                </p>
                            </div>
                            <p className="text-slate-700 leading-relaxed">
                                この話をしているのは、これまで <strong className="text-slate-900">累計1,500件以上のLINE自動化コンサル</strong> を行ってきた、リストマーケティングのプロです。
                            </p>
                            <p className="text-slate-700 leading-relaxed">
                                きれいごとを並べるつもりはありません。私は今日まで、業種も規模もバラバラのクライアントに、<strong className="text-slate-900">同じ1つの導線</strong> を入れてきました。
                                そして、そのほとんどで結果が出ています。証拠を4つ、置いておきます。
                            </p>
                        </div>
                    </div>
                </div>

                {/* 実績カルーセル: スマホ=横スクロール / PC=4カラム */}
                <div className="mt-10 flex md:grid md:grid-cols-4 gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-4 md:pb-0 -mx-6 px-6 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <AchievementCard name="整体協会の会長様" tag="整体×経営の講座" value="月100〜300万" note="＋ローンチ単月1,000万" />
                    <AchievementCard name="令和の虎の社長様" tag="財務の講座" value="月250万" note="完全自動で販売" />
                    <AchievementCard name="オンライン卓球教室" tag="動画完結型の講座" value="月300万" note="オンライン完結で販売" />
                    <AchievementCard name="元プロ野球選手の教室" tag="スポーツ教室" value="ゼロから構築" note="立ち上げを支援" />
                </div>
                <p className="mt-4 text-center text-slate-400 text-xs md:hidden">← 横にスワイプ →</p>
            </div>
        </section>
    );
}

/* =============================================================
 * 3. 未来 — 事業者 / 副業 の2軸
 * ============================================================= */
function SectionDream() {
    return (
        <section className="py-20 md:py-28 bg-gradient-to-br from-amber-50/40 to-emerald-50/30 border-y border-slate-100">
            <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-orange-500 text-sm tracking-widest font-bold uppercase mb-3">
                        想像してみてください
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
                        あなたが手を動かさなくても、<br />
                        商品が売れて、<span className="text-emerald-600">&quot;自由な時間&quot;が増えていく</span>毎日を。
                    </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <DreamCard
                        eyebrow="事業者の方へ"
                        icon={<Clock className="size-6" />}
                        title="セールスの苦悩から、解放される"
                        body="DM対応、ローンチ、価格説明——そのたびに削られていた時間。「自分が動かないと売上が止まる」という一人社長の限界。それを仕組みが丸ごと肩代わりします。空いた時間で、商品改善・採用・戦略といった“本来やるべき仕事”に、ようやく集中できる。"
                    />
                    <DreamCard
                        eyebrow="副業の方へ"
                        icon={<Sparkles className="size-6" />}
                        title="時間を売らずに、収益が積み上がる"
                        body="本業の合間も、眠っている間も、通勤中も、仕組みが代わりに教育と販売を回し続ける。時間を切り売りせず、自由な時間を持ったまま、自動収益がコツコツ育っていく。「働いた分だけ」の世界から、静かに抜け出せます。"
                    />
                </div>

                <p className="mt-12 text-center text-slate-600 max-w-2xl mx-auto leading-relaxed">
                    フォロワー数を毎日眺めている人と、この絵の中で生きている人の差は、<br />
                    <span className="text-slate-900 font-bold">才能ではなく、&quot;仕組み&quot;の有無だけ</span>です。
                </p>
            </div>
        </section>
    );
}

/* =============================================================
 * 4. 問題提起
 * ============================================================= */
function SectionFear() {
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-rose-500 text-sm tracking-widest font-bold uppercase mb-3">
                        ここで現実の話をします
                    </p>
                    <h2 className="text-2xl md:text-5xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
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
 * 5. 解決
 * ============================================================= */
function SectionAnswer() {
    return (
        <section className="py-20 md:py-28 bg-slate-50 border-y border-slate-100">
            <div className="max-w-5xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        では、足りないものは何か
                    </p>
                    <h2 className="text-2xl md:text-5xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
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
                        tool="セールス or 自動販売"
                        target="決済"
                        body="教育が終わったタイミングでオファー配信。決済リンクまで一気に到達。寝ている間も売上が立つ。"
                        color="from-orange-50 to-amber-50"
                        accent="text-orange-600"
                    />
                </div>

                <div className="mt-10 text-center">
                    <p className="text-slate-700 leading-relaxed max-w-2xl mx-auto mb-6">
                        この3ステップが <strong className="text-slate-900">毎日24時間、自動で回り続ける</strong>。<br />
                        これが、<strong className="text-slate-900">月100万円以上のクライアントを量産してきた仕組み</strong>の正体です。
                    </p>
                    <CtaSecondary />
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 6. 機能
 * ============================================================= */
function SectionFeatures() {
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="max-w-6xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        プロラインフリーで手に入る機能
                    </p>
                    <h2 className="text-2xl md:text-5xl font-bold text-slate-900 leading-tight">
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
                </div>

                <p className="mt-10 text-center text-slate-500 text-sm">
                    ※ 上記すべての機能が、無料プランのまま無制限で使えます。
                </p>
            </div>
        </section>
    );
}

/* =============================================================
 * 7. お客様の声（その後の変化・ストーリー）
 * ============================================================= */
function SectionTestimonials() {
    return (
        <section className="py-20 md:py-28 bg-slate-50 border-y border-slate-100">
            <div className="max-w-6xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        導入された方の声
                    </p>
                    <h2 className="text-2xl md:text-5xl font-bold text-slate-900 leading-tight">
                        仕組みを入れたあと、何が変わったか。
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <Testimonial
                        avatar="整"
                        avatarBg="from-emerald-400 to-teal-500"
                        name="整体協会の会長様"
                        role="整体×経営の講座"
                        body="正直、最初は半信半疑でした。でも導線を組んでから、私が施術や講義に集中している間にも申込みが入るようになった。“売る時間”がまるごと消えて、教える時間が増えた。これが一番の変化です。"
                    />
                    <Testimonial
                        avatar="虎"
                        avatarBg="from-orange-400 to-rose-500"
                        name="令和の虎の社長様"
                        role="財務の講座"
                        body="財務という固いテーマでも、ステップ配信が順番に納得を作ってくれる。営業しなくても“わかってる人”だけが申し込んでくるので、クレームもキャンセルも激減しました。"
                    />
                    <Testimonial
                        avatar="卓"
                        avatarBg="from-violet-400 to-fuchsia-500"
                        name="オンライン卓球教室"
                        role="動画完結型の講座"
                        body="対面前提だった指導が、動画講座として全国に届くようになりました。寝て起きたら決済通知、という朝を初めて経験して、もう元の働き方には戻れません。"
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
                    <h2 className="text-2xl md:text-5xl font-bold text-slate-900 leading-tight">
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
 * 8. 緊急性
 * ============================================================= */
function SectionUrgency() {
    return (
        <section className="py-20 md:py-28 bg-amber-50/40 border-y border-amber-100">
            <div className="max-w-4xl mx-auto px-6 text-center">
                <p className="text-orange-500 text-sm tracking-widest font-bold uppercase mb-3">
                    1つだけ、注意してください
                </p>
                <h2 className="text-2xl md:text-5xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
                    いまこの瞬間も、<br />
                    <span className="text-orange-500">ProX が集めるフォロワーが流出しています。</span>
                </h2>

                <p className="mt-8 text-base md:text-lg text-slate-700 max-w-2xl mx-auto leading-relaxed">
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
 * 9. FAQ
 * ============================================================= */
function SectionFaq() {
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="max-w-3xl mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-emerald-600 text-sm tracking-widest font-bold uppercase mb-3">
                        よくあるご質問
                    </p>
                    <h2 className="text-2xl md:text-5xl font-bold text-slate-900 leading-tight">
                        「うまい話すぎないか？」<br />
                        <span className="text-emerald-600">正直な反応です。</span>
                    </h2>
                </div>

                <div className="space-y-4">
                    <Faq
                        q="本当に無料？どこかで課金が発生するのでは？"
                        a="月額もクレジット登録も不要です。ステップ配信・タグ管理・絞り込み配信・流入分析まで、本格機能がそのまま無料で使えます。まずは無料の範囲だけで、「X → LINE → 販売」の導線はしっかり作れます。（アップグレードは任意です。）"
                    />
                    <Faq
                        q="設定が難しそう。技術が無いと使えない？"
                        a="ご安心ください。使い方は無料の動画講座で学べます。しかもただの操作説明ではなく、108万円の商品を18億円売り切った“売り方の理論”までセットで学べる構成。下手に高額講座を買うより、質の高いセミナーがここでは無料で見られる──そういうレベルの中身です。シナリオ自体も GUI で組めるので、コードは1行も書きません。"
                    />
                    <Faq
                        q="合わなかったら、お金や時間は取り戻せない？"
                        a="合わなければ、その瞬間に辞めて構いません。月額0円なので解約金もなく、データを消すだけ。失う物は『最初の30秒の登録時間』だけです。これが『リスクゼロで試せる』の正確な意味です。"
                    />
                    <Faq
                        q="他のLINEツールと比べて、なぜプロラインフリー？"
                        a="(1) 無料で本格機能、(2) 私がプロライン認定コンサルタントとして1,500件以上の構築を見てきて勝ちパターンを把握している、(3) ProX Agent との連携が最も自然、の3点です。私が ProX のCTA設定でデフォルト推奨にしているのも同じ理由です。"
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
 * 9.5 無料コンサル訴求（無料お試し者限定で吉留を指名）
 * ============================================================= */
function SectionConsult() {
    const steps = [
        "LINEのチャットでメールアドレスを入力",
        "導入・使い方の動画を見る",
        "公式LINEとプロラインを連携する",
        "無料コンサルの概要動画を見る",
        "有料プランを無料お試し（最大90日無料・いつでも解約OK）",
        "無料お試しをした人限定で「吉留 大貴」を指名できる",
    ];
    return (
        <section className="py-20 md:py-28 bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 text-white">
            <div className="max-w-4xl mx-auto px-6">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-emerald-200 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide mb-6">
                        <Star className="size-3.5 fill-emerald-300 text-emerald-300" />
                        無料お試しをした人だけの特典
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black leading-tight max-w-3xl mx-auto">
                        ProX開発者・吉留大貴の個別コンサルを、<br />
                        <span className="text-emerald-300">1回 &quot;無料&quot;</span> で。
                    </h2>
                    <p className="mt-6 text-emerald-50/90 leading-relaxed max-w-2xl mx-auto text-sm md:text-base">
                        あなたの事業・副業の「戦略設計」から「導線づくり」まで丸ごとサポート。
                        <br className="hidden md:block" />
                        通常 <strong className="text-white">40分29,700円</strong>・累計 <strong className="text-white">1,500件以上</strong> の個別コンサルを、受けてみませんか？
                    </p>
                </div>

                {/* 登録後の流れ ①〜⑥ */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-10">
                    <p className="text-xs font-bold tracking-widest uppercase text-emerald-300 mb-6 text-center">
                        無料コンサルまでの流れ
                    </p>
                    <ol className="space-y-4">
                        {steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-4">
                                <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${i === steps.length - 1 ? "bg-emerald-400 text-slate-900" : "bg-white/15 text-emerald-200"}`}>
                                    {i + 1}
                                </span>
                                <p className={`pt-1 leading-relaxed text-sm md:text-base ${i === steps.length - 1 ? "text-white font-bold" : "text-emerald-50/90"}`}>
                                    {step}
                                </p>
                            </li>
                        ))}
                    </ol>
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
                            className="w-full h-16 bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-black text-base md:text-lg rounded-full shadow-2xl border-0 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Sparkles className="size-5 mr-2" />
                            無料ではじめてコンサルまで受ける
                            <ArrowRight className="size-5 ml-2" />
                        </Button>
                    </a>
                    <p className="text-emerald-100/80 text-xs">
                        まずは無料のプロラインフリー登録から。費用はかかりません。
                    </p>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 10. Final CTA
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
                            30秒・無料でLINE追加してはじめる
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
 * 既存ユーザー向け（KPI連携の予告）
 * ============================================================= */
function ExistingUserNote() {
    return (
        <section className="py-12 bg-slate-50 border-t border-slate-200">
            <div className="max-w-3xl mx-auto px-6 text-center space-y-3">
                <p className="text-slate-500 text-sm font-bold">すでにプロラインフリーをお持ちの方へ</p>
                <p className="text-slate-700 text-base md:text-lg font-bold leading-relaxed max-w-xl mx-auto">
                    プロラインとProXのKPIを、まとめて管理できる<br className="hidden md:block" />
                    <span className="text-emerald-600">『KPI管理機能』を近日リリース予定</span>です。
                </p>
                <p className="text-slate-500 text-sm">連携機能のリリースを、お楽しみに。</p>
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
                30秒・無料でLINE追加してはじめる
                <ArrowRight className="size-5 ml-2" />
            </Button>
        </a>
    );
}

function CtaSecondary() {
    return (
        <a href={PROLINE_REGISTER_URL} target="_blank" rel="noopener noreferrer">
            <Button className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-full shadow-md shadow-emerald-500/20 transition-all">
                LINEで今すぐ受け取る
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
                <span className="text-2xl md:text-5xl font-black text-emerald-600 tabular-nums">
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

function AchievementCard({ name, tag, value, note }: { name: string; tag: string; value: string; note: string }) {
    return (
        <div className="snap-start shrink-0 w-[78%] sm:w-[46%] md:w-auto bg-white rounded-2xl border border-emerald-100 shadow-sm p-6 flex flex-col">
            <p className="text-xs text-slate-500 mb-1">{name}</p>
            <p className="text-sm font-bold text-slate-700 mb-4">{tag}</p>
            <p className="text-2xl font-black text-emerald-600 leading-none tabular-nums whitespace-nowrap">{value}</p>
            <p className="text-xs text-slate-500 mt-2">{note}</p>
        </div>
    );
}

function DreamCard({ eyebrow, icon, title, body }: { eyebrow?: string; icon: React.ReactNode; title: string; body: string }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                {icon}
            </div>
            {eyebrow && (
                <p className="text-xs font-bold tracking-widest uppercase text-emerald-600">{eyebrow}</p>
            )}
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
    avatar, avatarBg, name, role, body,
}: {
    avatar: string;
    avatarBg: string;
    name: string;
    role: string;
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
