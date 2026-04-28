"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown, ShieldCheck, Clock, Sparkles } from "lucide-react";

const PROLINE_REGISTER_URL = "https://proline.app/";

/**
 * /dashboard/proline ランディングページ。
 *
 * 顧客には絶対に見せない裏の設計図 —— 加藤将太氏の「説得の価値観9」を順番通りに配置。
 *   1. 興味性・新規性          → Hero。フックは具体数字 + 反直観
 *   2. 目的・信念・自己開示    → 「申し遅れました」セクション
 *   3. 夢・憧れ                → 朝の決済通知シーン (LF9: 快適/他人に勝つ/お金)
 *   4. 恐怖・問題提起          → 構造的な3つの壁 (注意喚起)
 *   5. ノウハウ・解決策        → 「足りなかったのはたった一つ」
 *   6. メリット (LF9 + お金)   → 手に入る5つを LF9 と紐付けて提示
 *   7. 限定性・緊急性          → 機会損失が毎日積み上がる時計
 *   8. 不信の払拭・Q&A         → 4つの典型的な不安にひとつずつ答える
 *   9. 後押し (クロージング)   → 最後に感情で背中を押す + 巨大CTA
 *
 * デザイン原則 (デザイナー指示書):
 *   - dark 基調 (zinc-950)
 *   - 紫グラデは H1 強調語と CTA のみ
 *   - 数字は 1画面1つ、巨大、font-mono、amber-300 + glow
 *   - 1スクロール1メッセージ、py-32〜40 を恐れない
 *   - 絵文字でセクション見出しを飾らない (lucide icon を点的に)
 *   - CTA は 3 回 (Hero 直下 / 中盤 / フィナーレ)
 */
export default function ProlineLpPage() {
    return (
        <div className="-m-8 bg-zinc-950 text-zinc-100 min-h-[calc(100vh+4rem)]">
            <Hero />
            <SectionWho />
            <SectionDream />
            <SectionFear />
            <SectionAnswer />
            <SectionBenefits />
            <SectionUrgency />
            <SectionFaq />
            <SectionFinal />
            <ExistingUserNote />
        </div>
    );
}

/* =============================================================
 * 1. 興味性・新規性 — Hero
 * 反直観 + 具体数字 で「もっと聞きたい」を作る
 * ============================================================= */
function Hero() {
    return (
        <section className="relative min-h-screen flex items-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%)]" />
            <div className="absolute top-1/3 right-0 w-[40rem] h-[40rem] rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-32 text-center space-y-12">
                <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase">
                    For ProX Agent users — only
                </p>

                <div className="space-y-8">
                    <p className="text-zinc-400 text-base md:text-lg leading-[1.9]">
                        あるコンサルタントが、年商を
                    </p>

                    <div className="flex items-end justify-center gap-3 leading-none">
                        <span
                            className="text-7xl md:text-9xl font-mono font-bold tabular-nums text-amber-300"
                            style={{ textShadow: "0 0 50px rgba(252,211,77,0.3)" }}
                        >
                            2→4
                        </span>
                        <span className="text-2xl md:text-4xl text-zinc-500 mb-3 font-light">億</span>
                    </div>

                    <h1 className="text-[clamp(1.5rem,4.5vw,3rem)] font-bold tracking-tight leading-[1.4] max-w-[28ch] mx-auto">
                        に倍増させた、その追加施策は<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                            たった一つ。しかも完全無料。
                        </span>
                    </h1>
                </div>

                <p className="text-base md:text-lg text-zinc-400 max-w-[36ch] mx-auto leading-[1.9] pt-4">
                    X運用だけでは絶対に届かなかった売上の壁を、<br />
                    一晩で取り払った仕組みの話を、これからします。
                </p>

                <div className="pt-8 flex flex-col items-center gap-3">
                    <CtaPrimary />
                    <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
                        無料 ・ 30秒 ・ クレカ不要
                    </p>
                </div>

                <div className="pt-16 text-zinc-600 flex flex-col items-center gap-2">
                    <span className="text-xs tracking-widest">続きを読む</span>
                    <ChevronDown className="size-4 animate-bounce" />
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 2. 目的・信念・自己開示 — 「申し遅れました」
 * ============================================================= */
function SectionWho() {
    return (
        <section className="py-32 md:py-40 border-t border-zinc-900">
            <div className="max-w-3xl mx-auto px-6 space-y-12">
                <div className="space-y-5">
                    <p className="text-zinc-500 text-sm tracking-widest uppercase">
                        申し遅れました
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold leading-[1.4]">
                        私は <span className="text-zinc-100">吉留大貴</span>。<br />
                        この ProX Agent を作って、あなたに無料で渡している人間です。
                    </h2>
                </div>

                <div className="space-y-6 text-base md:text-lg text-zinc-400 leading-[2] max-w-[42ch]">
                    <p>
                        肩書きを並べるのは好きじゃないので、最低限だけお伝えします。
                    </p>
                    <p>
                        コンテンツ販売 × LINE自動化で、毎月
                        <span className="text-amber-300 font-mono font-bold">1,000万円</span>
                        を自動で生む仕組みを、いまも自分のビジネスで毎月回しています。
                    </p>
                    <p>
                        顧問先の経営者・加藤さんは、この同じ導線を導入した結果、年商を
                        <span className="text-amber-300 font-mono font-bold">2億 → 4億</span>
                        に倍増させました。
                    </p>
                    <p className="text-zinc-200 font-semibold">
                        机上論ではなく、自分と顧問先で毎月証明している仕組みを、これからお見せします。
                    </p>
                </div>

                <div className="border-l-2 border-violet-500/40 pl-6 py-2 max-w-[42ch]">
                    <p className="text-zinc-300 italic leading-[1.9]">
                        私が ProX Agent を <span className="text-zinc-100 font-semibold not-italic">無料で配っている理由</span> は、はっきりしています。
                    </p>
                    <p className="text-zinc-300 italic leading-[1.9] pt-3">
                        コンテンツ販売者を、消耗から解放したいからです。
                        毎日 DM を返し、LP を直し、深夜まで作業し続ける生活から抜け出すには、
                        『仕組み』を持つしかない。私はその一部を、あなたに渡しています。
                    </p>
                    <p className="text-zinc-300 italic leading-[1.9] pt-3">
                        ただし、ProX Agent だけでは <span className="text-amber-300 not-italic font-semibold">片手落ち</span> です。
                        その理由を、これから説明します。
                    </p>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 3. 夢・憧れ — 朝の決済通知シーン
 * LF9: 快適 / 他人に勝つ / お金
 * ============================================================= */
function SectionDream() {
    return (
        <section className="py-32 md:py-40 bg-zinc-900/40 border-t border-zinc-900">
            <div className="max-w-3xl mx-auto px-6 text-center space-y-12">
                <p className="text-zinc-500 text-sm tracking-widest uppercase">想像してみてください</p>

                <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[26ch] mx-auto">
                    朝、目を覚まして、<br />
                    コーヒーを淹れる前に、<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
                        スマホを開く。
                    </span>
                </h2>

                <div className="space-y-7 text-lg md:text-xl text-zinc-400 leading-[2] max-w-[36ch] mx-auto pt-4">
                    <p>昨晩の決済通知が <span className="text-amber-300 font-mono font-bold">3件</span>。</p>
                    <p>合計 <span className="text-amber-300 font-mono font-bold">15万円</span>。</p>
                    <p className="text-zinc-200 font-semibold pt-3">
                        あなたは、何もしていません。<br />
                        昨日の自分は、いつもどおり寝ていただけ。
                    </p>
                    <p>
                        でも『仕組み』が、24時間ずっと働いていた。
                    </p>
                </div>

                <div className="pt-12 grid md:grid-cols-2 gap-6 text-left max-w-[40ch] md:max-w-2xl mx-auto">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-2">
                        <p className="text-xs tracking-widest text-zinc-500 uppercase">あなたの平日の夜</p>
                        <p className="text-zinc-300 leading-[1.8]">
                            子供と食卓を囲み、家族と一緒に過ごす時間が戻ってくる。
                        </p>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-2">
                        <p className="text-xs tracking-widest text-zinc-500 uppercase">あなたの週末</p>
                        <p className="text-zinc-300 leading-[1.8]">
                            旅行先で、温泉に入っている間にも売上が積み上がっていく。
                        </p>
                    </div>
                </div>

                <p className="pt-12 text-zinc-500 text-base md:text-lg max-w-[34ch] mx-auto leading-[2]">
                    フォロワー数を毎日眺めている人と、<br />
                    この絵の中で生きている人の差は、<br />
                    <span className="text-zinc-200 font-semibold">才能ではなく、仕組みの有無</span>です。
                </p>
            </div>
        </section>
    );
}

/* =============================================================
 * 4. 恐怖・問題提起 — 3つの構造的な壁
 * 注意喚起 / 危機回避
 * ============================================================= */
function SectionFear() {
    return (
        <section className="py-32 md:py-40 border-t border-zinc-900">
            <div className="max-w-3xl mx-auto px-6 space-y-16">
                <div className="text-center space-y-5">
                    <p className="text-amber-400/80 text-sm tracking-widest uppercase">
                        ここで現実の話をします
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[24ch] mx-auto">
                        X運用『だけ』では、<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300">
                            売上は構造的に上がりません。
                        </span>
                    </h2>
                    <p className="text-zinc-400 text-lg leading-[1.9] max-w-[36ch] mx-auto pt-2">
                        あなたが頑張っていないからではない。<br />
                        Xという媒体に、抜け穴が3つ空いているからです。
                    </p>
                </div>

                <div className="space-y-px bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800/50">
                    <Wall
                        index="01"
                        title="Xの投稿は、川のように流れて消える。"
                        body="昨日あなたを見つけてくれた人は、明日にはもう別人のタイムラインに流されています。あなたのプロフを毎日見に来る人は、ほぼいません。Xは『川』の媒体で、購買決定に必要な『何度も触れて信頼が積み上がる時間』を、構造上、確保できないのです。"
                        verdict="フォロワー数 ≠ あなたの顧客リスト。"
                    />
                    <Wall
                        index="02"
                        title="140文字では、人は買う気にならない。"
                        body="人は『知っている』だけでは買いません。なぜ今これが必要か。なぜあなたから買うべきか。買わないと何を失うか──を順番に時間をかけて理解して、はじめて財布が開きます。X の単発投稿の構造で、この教育プロセスを完結させるのは無理です。"
                        verdict="知ってる人 ≠ 買う人。教育の場が要る。"
                    />
                    <Wall
                        index="03"
                        title="販売の自動化が無いと、止まったら終わる。"
                        body="毎回のローンチで DM を返し、LP を直し、決済導線を組み直す…。これでは『時間』がボトルネックになり、売上は自分の稼働量に正比例します。集客と教育と販売を全部自分でやるのは、個人事業の延長であって、仕組みではありません。"
                        verdict="自分が止まると、売上も止まる構造。"
                    />
                </div>

                <div className="bg-rose-950/30 border border-rose-900/40 rounded-2xl p-6 md:p-10 mt-10">
                    <p className="text-rose-300 text-sm tracking-widest uppercase mb-4">
                        最も多い失敗パターン
                    </p>
                    <p className="text-zinc-200 text-lg md:text-xl font-semibold leading-[1.8] mb-3">
                        「もっと頑張ってフォロワー増やせば、いつか売上もついてくる」
                    </p>
                    <p className="text-zinc-400 leading-[1.9]">
                        ──これは、抜け穴の存在を知らない人が必ず辿るルートです。
                        頑張っても穴の手前を行ったり来たりするだけで、向こう側には届かない。
                        フォロワー1万人になっても、売上が変わらない人を、私はもう何人も見ました。
                    </p>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 5. ノウハウ・解決策 — 足りなかったたった一つ
 * ============================================================= */
function SectionAnswer() {
    return (
        <section className="py-32 md:py-40 bg-zinc-900/40 border-t border-zinc-900">
            <div className="max-w-5xl mx-auto px-6 space-y-20">
                <div className="text-center space-y-5">
                    <p className="text-zinc-500 text-sm tracking-widest uppercase">
                        では、足りないものは何か
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[26ch] mx-auto">
                        足りなかったのは、<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
                            たった一つだけ。
                        </span>
                    </h2>
                    <p className="text-zinc-300 text-xl md:text-2xl font-semibold leading-[1.7] max-w-[32ch] mx-auto pt-3">
                        『教育と販売を、24時間、勝手にやってくれる場所』。
                    </p>
                    <p className="text-zinc-400 text-base md:text-lg leading-[1.9] max-w-[36ch] mx-auto pt-2">
                        その答えが、LINE による自動ステップ配信。<br />
                        そして、それを完全無料で実装できるのが、<br />
                        <span className="text-zinc-100 font-semibold">プロラインフリー</span>です。
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-px bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-800/50">
                    <FunnelStage
                        phase="01 — 集客"
                        tool="ProX Agent"
                        target="X"
                        body="あなたの軸に沿った投稿を AI が毎日生成。フォロワーを集めて、興味を持った人をプロフィール経由で次へ流す。"
                        accent="from-blue-500/20 to-cyan-500/10"
                    />
                    <FunnelStage
                        phase="02 — 教育"
                        tool="プロラインフリー"
                        target="LINE"
                        body="登録の瞬間からステップ配信が起動。なぜ必要か、なぜあなたから買うべきかを、順番に時間をかけて伝える。"
                        accent="from-violet-500/20 to-fuchsia-500/10"
                    />
                    <FunnelStage
                        phase="03 — 販売"
                        tool="プロラインフリー"
                        target="決済"
                        body="教育が終わったタイミングでオファー配信。決済リンクまで一気に到達。寝ている間にも『昨晩の通知3件』が届く。"
                        accent="from-amber-500/20 to-orange-500/10"
                    />
                </div>

                <div className="text-center space-y-6">
                    <p className="text-zinc-300 text-lg md:text-xl leading-[1.9] max-w-[40ch] mx-auto">
                        この3ステップが、<span className="text-zinc-100 font-bold">毎日24時間、自動で回り続ける</span>。<br />
                        これが、加藤さんの年商を 2億 → 4億 に押し上げた仕組みの正体です。
                    </p>
                    <div className="pt-6 flex justify-center">
                        <CtaSecondary />
                    </div>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 6. メリット — LF9 + お金で「真の価値」を提示
 * ============================================================= */
function SectionBenefits() {
    return (
        <section className="py-32 md:py-40 border-t border-zinc-900">
            <div className="max-w-4xl mx-auto px-6 space-y-16">
                <div className="text-center space-y-5">
                    <p className="text-zinc-500 text-sm tracking-widest uppercase">
                        この仕組みが回り始めたら
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[28ch] mx-auto">
                        あなたが手に入れる5つ。
                    </h2>
                </div>

                <div className="space-y-px bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800/50">
                    <BenefitRow
                        title="自由な時間"
                        body="DM 返信・LP 修正・コンテンツ作成 を自動化システムが代行。1日の作業時間が 8時間 → 1時間 に短縮された顧問先もあります。"
                    />
                    <BenefitRow
                        title="家族と過ごす夜"
                        body="深夜まで PC に向かう生活が終わり、子供と食卓を囲める。あなたが本当に大切にしたかった『当たり前』が戻ってきます。"
                    />
                    <BenefitRow
                        title="競合より一歩先を行く感覚"
                        body="同業の仲間がまだ手作業でやっていることを、あなただけは仕組みが代わりにやっている状態。差は、毎日着実に広がります。"
                    />
                    <BenefitRow
                        title="経済的な余裕"
                        body="売上が稼働量に縛られなくなる。寝ても、休んでも、旅行しても、仕組みが利益を生み続ける。これが本当の『経済的安定』。"
                    />
                    <BenefitRow
                        title="積み上がる資産としてのリスト"
                        body="LINE 登録者は『何度でも教育メッセージを届けられる確定リスト』。X の流動的なフォロワーと違い、リストは消えずに資産として積み上がります。"
                    />
                </div>

                <p className="text-center text-zinc-400 text-base md:text-lg leading-[1.9] max-w-[40ch] mx-auto pt-6">
                    これら全部を手に入れるための投資額は、<br />
                    <span className="text-emerald-300 font-mono font-bold text-2xl md:text-3xl">¥0</span>
                </p>
            </div>
        </section>
    );
}

/* =============================================================
 * 7. 限定性・緊急性 — 機会損失の時計
 * ============================================================= */
function SectionUrgency() {
    return (
        <section className="py-32 md:py-40 bg-zinc-900/40 border-t border-zinc-900">
            <div className="max-w-3xl mx-auto px-6 space-y-14 text-center">
                <div className="space-y-5">
                    <p className="text-amber-400/80 text-sm tracking-widest uppercase">
                        いま、この瞬間にも
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[26ch] mx-auto">
                        ProX Agent は、毎日<br />
                        <span className="text-amber-300 font-mono">フォロワーを集め続け</span>ています。
                    </h2>
                </div>

                <div className="space-y-7 text-base md:text-lg text-zinc-400 leading-[2] max-w-[36ch] mx-auto">
                    <p>
                        でも、教育の受け皿が無いので、<br />
                        その人たちは <span className="text-zinc-100 font-semibold">リスト化されずに流出</span>しています。
                    </p>
                    <p className="text-zinc-300 font-semibold">
                        これは、毎日続いています。<br />
                        今日も、明日も、明後日も。
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 max-w-3xl mx-auto">
                    <LossCell label="今月の機会損失" value="∞" />
                    <LossCell label="リスト化されない人数" value="∞" />
                    <LossCell label="競合との差" value="拡大中" />
                    <LossCell label="あなたの時間" value="消耗中" />
                </div>

                <div className="pt-8 flex items-center justify-center gap-3 text-zinc-400 text-sm">
                    <Clock className="size-4 text-amber-400" />
                    <span>1日先延ばしする = 1日分の損失が確定する</span>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 8. 不信の払拭・Q&A — 4つの典型的な不安
 * ============================================================= */
function SectionFaq() {
    return (
        <section className="py-32 md:py-40 border-t border-zinc-900">
            <div className="max-w-3xl mx-auto px-6 space-y-12">
                <div className="text-center space-y-5">
                    <p className="text-zinc-500 text-sm tracking-widest uppercase">
                        ここまで読んで、たぶんこう思っているはず
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[28ch] mx-auto">
                        「うまい話すぎないか？」
                    </h2>
                    <p className="text-zinc-400 text-base md:text-lg leading-[1.9] max-w-[36ch] mx-auto pt-2">
                        正直な反応です。<br />
                        典型的な4つの不安に、ひとつずつ答えます。
                    </p>
                </div>

                <div className="space-y-4">
                    <Faq
                        q="本当に無料？ どこかで課金が発生するのでは？"
                        a="プロラインフリーは、ステップ配信・絞り込み配信・タグ管理・流入分析まで、すべて無料プランで使えます。月額もクレジットカード登録も不要。アップグレードは任意で、無料プランのまま月1,000万を回している人もいます (私もその一人です)。"
                    />
                    <Faq
                        q="設定が難しそう。技術が無いと使えないのでは？"
                        a="シナリオ配信は GUI で組めるので、コードは1行も書きません。テンプレートも豊富で、登録から30分で『最初のステップ配信』を稼働させた事例があります。ProX Agent との連携は、生成投稿のCTAに発行された LINE URL を貼り付けるだけです。"
                    />
                    <Faq
                        q="合わなかったら? お金や時間を取り戻せない?"
                        a="合わなければ、その瞬間に辞めて構いません。月額0円なので解約金もなく、データを消すだけ。失う物は『最初の30秒の登録時間』だけです。これが『リスクゼロで試せる』の正確な意味です。"
                    />
                    <Faq
                        q="他の LINE ツールと比べて、なぜプロラインフリー?"
                        a="(1) 無料で本格機能、(2) 私が顧問業で実際に毎月使っており勝ちパターンを把握している、(3) ProX Agent との連携が最も自然、の3点です。私が ProX のCTA設定でデフォルト推奨にしているのも同じ理由です。"
                    />
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 9. 後押し — Final CTA
 * 感情で背中を押す + 巨大ボタン
 * ============================================================= */
function SectionFinal() {
    return (
        <section className="relative min-h-[85vh] flex items-center overflow-hidden border-t border-zinc-900">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18),transparent_70%)]" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-3xl" />

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-24 text-center space-y-12">
                <p className="text-zinc-500 text-sm tracking-widest uppercase">
                    最後に、本音だけ言います
                </p>

                <h2 className="text-3xl md:text-6xl font-bold leading-[1.15] max-w-[20ch] mx-auto">
                    <span className="text-zinc-400">「いつかやる」は、</span>
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-400">
                        永遠に来ません。
                    </span>
                </h2>

                <div className="space-y-5 text-base md:text-lg text-zinc-300 leading-[2] max-w-[36ch] mx-auto">
                    <p>
                        あなたがここまで読んだのは、<br />
                        薄々、答えに気づいているからです。
                    </p>
                    <p>
                        必要なのは、<span className="text-zinc-100 font-bold">30秒の登録</span>と、
                        <span className="text-zinc-100 font-bold">『今やる』の決断</span>。<br />
                        それだけで、明日からの構造が変わります。
                    </p>
                    <p className="text-zinc-100 font-bold pt-2">
                        私を信じて、ボタンを押してください。<br />
                        あなたの夜を、家族のもとに返します。
                    </p>
                </div>

                <div className="space-y-3 pt-4">
                    <CtaPrimary size="xl" />
                    <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
                        無料 ・ 30秒 ・ クレカ不要 ・ いつでも辞められる
                    </p>
                </div>

                <div className="pt-12 inline-flex items-center gap-2 text-zinc-400 text-sm bg-zinc-900/50 border border-zinc-800 px-5 py-3 rounded-full backdrop-blur">
                    <ShieldCheck className="size-4 text-emerald-400" />
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
        <section className="py-12 bg-zinc-950 border-t border-zinc-900">
            <div className="max-w-3xl mx-auto px-6 text-center space-y-4">
                <p className="text-zinc-500 text-sm">すでにプロラインフリーをお持ちの方へ</p>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-[40ch] mx-auto">
                    ProX Agent の自動投稿機能で、CTAに発行済みのプロラインURLを設定するだけで、
                    X集客 → LINE自動配信の連携が完了します。
                </p>
                <div className="flex justify-center gap-3 flex-wrap pt-2">
                    <Button
                        variant="outline"
                        onClick={() => (window.location.href = "/dashboard/settings")}
                        className="border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                    >
                        設定画面を開く
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => (window.location.href = "/dashboard/generate")}
                        className="border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
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
    const heightClass = size === "xl" ? "h-16 text-lg" : "h-14 text-base";
    return (
        <a
            href={PROLINE_REGISTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-[calc(100%-2rem)] max-w-md mx-auto"
        >
            <Button
                size="lg"
                className={`w-full ${heightClass} bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 font-bold rounded-full shadow-[0_0_40px_rgba(167,139,250,0.4)] hover:shadow-[0_0_60px_rgba(167,139,250,0.55)] transition-all hover:scale-[1.02] active:scale-[0.98]`}
            >
                <Sparkles className="size-5 mr-2" />
                30秒で無料開設する
                <ArrowRight className="size-5 ml-2" />
            </Button>
        </a>
    );
}

function CtaSecondary() {
    return (
        <a href={PROLINE_REGISTER_URL} target="_blank" rel="noopener noreferrer">
            <Button
                variant="outline"
                className="h-12 px-8 border-violet-500/40 bg-violet-500/5 text-violet-200 hover:bg-violet-500/10 hover:text-violet-100 hover:border-violet-500/60 rounded-full"
            >
                この仕組みを今すぐ手に入れる
                <ArrowRight className="size-4 ml-2" />
            </Button>
        </a>
    );
}

function Wall({
    index, title, body, verdict,
}: {
    index: string;
    title: string;
    body: string;
    verdict: string;
}) {
    return (
        <div className="bg-zinc-950 p-8 md:p-10">
            <div className="flex items-start gap-5">
                <span className="text-2xl md:text-3xl font-mono font-bold text-zinc-700 flex-shrink-0">
                    {index}
                </span>
                <div className="space-y-3 flex-1">
                    <h3 className="text-xl md:text-2xl font-bold text-zinc-100 leading-tight">
                        {title}
                    </h3>
                    <p className="text-zinc-400 leading-[1.9]">{body}</p>
                    <p className="text-amber-300/90 font-semibold pt-1 text-sm md:text-base">
                        → {verdict}
                    </p>
                </div>
            </div>
        </div>
    );
}

function FunnelStage({
    phase, tool, target, body, accent,
}: {
    phase: string;
    tool: string;
    target: string;
    body: string;
    accent: string;
}) {
    return (
        <div className={`bg-zinc-950 p-8 space-y-4 bg-gradient-to-br ${accent}`}>
            <p className="text-xs tracking-widest text-zinc-500 uppercase">{phase}</p>
            <div className="space-y-1">
                <h3 className="text-xl font-bold text-zinc-100">{tool}</h3>
                <p className="text-xs text-zinc-500">on {target}</p>
            </div>
            <p className="text-sm text-zinc-400 leading-[1.8]">{body}</p>
        </div>
    );
}

function BenefitRow({ title, body }: { title: string; body: string }) {
    return (
        <div className="bg-zinc-950 p-6 md:p-8">
            <div className="flex items-start gap-5">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center mt-1">
                    <Sparkles className="size-4" />
                </div>
                <div className="space-y-2 flex-1">
                    <h3 className="text-lg md:text-xl font-bold text-zinc-100">{title}</h3>
                    <p className="text-zinc-400 leading-[1.9]">{body}</p>
                </div>
            </div>
        </div>
    );
}

function LossCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <p className="text-[10px] md:text-xs tracking-widest text-zinc-500 uppercase">{label}</p>
            <p className="text-2xl md:text-3xl font-mono font-bold text-rose-400">{value}</p>
        </div>
    );
}

function Faq({ q, a }: { q: string; a: string }) {
    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 md:p-7 space-y-3">
            <h3 className="text-base md:text-lg font-bold text-zinc-100 flex items-start gap-3">
                <span className="text-violet-400 font-mono flex-shrink-0">Q.</span>
                <span>{q}</span>
            </h3>
            <p className="text-zinc-400 leading-[1.9] flex items-start gap-3">
                <span className="text-emerald-400 font-mono flex-shrink-0">A.</span>
                <span>{a}</span>
            </p>
        </div>
    );
}
