"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown, Sparkles, ShieldCheck } from "lucide-react";

// 公式 / アフィリエイトリンク。本番デプロイ時は環境変数化推奨。
const PROLINE_REGISTER_URL = "https://proline.app/";

/**
 * /dashboard/proline ランディングページ。
 *
 * 訪問者は ProX Agent を既に使っている個人事業主・コンテンツ販売者・
 * アフィリエイター層。フォロワーは数百〜数千、売上は不安定。
 * このLPの仕事は「プロラインフリーの登録ボタンをクリックさせる」こと一本。
 *
 * コピーライティング設計（顧客には見せない裏設計）:
 *   - メインエンジン  : WANT（欲求）         → 静かに毎月積み上がる売上の絵を見せる
 *   - サブエンジン1   : 注意喚起             → 構造的に無理な点を可視化
 *   - サブエンジン2   : 真理（あるある）     → 「実は…」の気づき
 *   - クロージング    : 応援                 → あなたなら作れる、今がそのスタート
 *
 * デザイン方針（プロデザイナー指示書より）:
 *   - 全面 dark 基調（bg-zinc-950）。アプリ本体に違和感なく溶け込ませる
 *   - 紫グラデは H1 強調語と CTA の 2 箇所のみ
 *   - 数字は 1 画面 1 つルール、巨大 (text-7xl〜9xl)、amber-300、font-mono
 *   - 1 スクロール 1 メッセージ。py-24〜32 を恐れない
 *   - 絵文字でセクション見出しを飾らない（lucide-react を点的に）
 *   - CTA は 3 回（Hero 直下 / 中盤 / フィナーレ）
 */
export default function ProlineLpPage() {
    return (
        <div className="-m-8 bg-zinc-950 text-zinc-100 min-h-[calc(100vh+4rem)]">
            <Hero />
            <SectionDesire />
            <SectionProof />
            <SectionTruth />
            <SectionAnswer />
            <SectionRiskFree />
            <FinalCta />
            <ExistingUserNote />
        </div>
    );
}

/* =============================================================
 * Hero — 沈黙と問いかけ。CTAは1回目だけ。
 * ============================================================= */
function Hero() {
    return (
        <section className="relative min-h-screen flex items-center overflow-hidden">
            {/* 静かに揺らぐ紫の光（背景演出） */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%)]" />
            <div className="absolute top-1/3 right-0 w-[40rem] h-[40rem] rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-32 text-center space-y-10">
                <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase">
                    For ProX Agent users
                </p>

                <h1 className="text-[clamp(2rem,6vw,4.5rem)] font-bold tracking-tight leading-[1.15]">
                    <span className="text-zinc-400">フォロワーを増やすこと、</span>
                    <br />
                    <span className="text-zinc-100">いつのまにか</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                        ゴールにしていませんか。
                    </span>
                </h1>

                <p className="text-lg md:text-xl text-zinc-400 max-w-[42ch] mx-auto leading-[1.9]">
                    あなたが本当に欲しかったのは、<br className="hidden md:block" />
                    数字が伸びていくフォロー欄ではなく、<br />
                    <span className="text-zinc-100 font-semibold">寝ている間にも積み上がっていく売上</span>
                    だったはずです。
                </p>

                <div className="pt-8 flex flex-col items-center gap-3">
                    <CtaPrimary />
                    <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
                        無料 ・ 30秒 ・ クレカ不要
                    </p>
                </div>

                <div className="pt-20 text-zinc-600 flex flex-col items-center gap-2">
                    <span className="text-xs tracking-widest">SCROLL</span>
                    <ChevronDown className="size-4 animate-bounce" />
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 欲求 — あなたが本当に作りたかった絵
 * ============================================================= */
function SectionDesire() {
    return (
        <section className="py-32 md:py-40 border-t border-zinc-900">
            <div className="max-w-3xl mx-auto px-6 text-center space-y-10">
                <p className="text-zinc-500 text-sm tracking-widest uppercase">想像してみてください</p>

                <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[28ch] mx-auto">
                    朝起きて、スマホを開いたら、<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
                        昨晩の決済通知
                    </span>
                    が3件。
                </h2>

                <div className="space-y-6 text-lg md:text-xl text-zinc-400 leading-[2] max-w-[40ch] mx-auto pt-6">
                    <p>あなたは何もしていません。</p>
                    <p>昨日の自分は、いつもどおり寝ていただけ。</p>
                    <p className="text-zinc-200 font-semibold">
                        でも、仕組みが代わりに働いていた。
                    </p>
                </div>

                <p className="pt-12 text-zinc-500 text-base md:text-lg max-w-[36ch] mx-auto leading-[2]">
                    フォロワー数の伸びを毎日眺めている人と、<br />
                    この絵の中で生きている人の間にあるのは、<br />
                    <span className="text-zinc-200 font-semibold">才能の差ではありません。</span>
                </p>
            </div>
        </section>
    );
}

/* =============================================================
 * 証拠 — 数字を3つだけ、巨大に
 * ============================================================= */
function SectionProof() {
    return (
        <section className="py-32 md:py-40 bg-zinc-900/40 border-t border-zinc-900">
            <div className="max-w-5xl mx-auto px-6 space-y-20">
                <div className="text-center space-y-4">
                    <p className="text-zinc-500 text-sm tracking-widest uppercase">
                        この話を、誰がしているのか
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold text-zinc-100 leading-tight max-w-[28ch] mx-auto">
                        毎月、その絵を実際に作っている人間からの話です。
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-6 pt-8">
                    <BigNumber
                        prefix="月"
                        value="1,000"
                        suffix="万円"
                        caption="LINE自動化で毎月達成。机上論ではなく、自分のビジネスで毎月証明している数字"
                    />
                    <BigNumber
                        prefix=""
                        value="2→4"
                        suffix="億円"
                        caption="顧問先・加藤さんの売上推移。同じ導線を導入後、年商が倍に到達"
                    />
                    <BigNumber
                        prefix=""
                        value="100"
                        suffix="%"
                        caption="このLP の作者が、いま実際にプロラインフリーで運用している割合"
                    />
                </div>

                <p className="text-center text-zinc-400 max-w-[42ch] mx-auto leading-[1.9] pt-8">
                    AI を「触れるだけ」の人や、LINE を「構築できるだけ」の人は山ほどいる。<br className="hidden md:block" />
                    でも、<span className="text-zinc-100 font-semibold">X集客 × LINE教育 × 自動販売</span> を
                    一本の導線として設計し、毎月回し続けている人は、本当に少ない。
                </p>
            </div>
        </section>
    );
}

/* =============================================================
 * 真理 — Xだけで売上を作ろうとした人が必ずぶつかる壁
 * ============================================================= */
function SectionTruth() {
    return (
        <section className="py-32 md:py-40 border-t border-zinc-900">
            <div className="max-w-3xl mx-auto px-6 space-y-16">
                <div className="text-center space-y-5">
                    <p className="text-amber-400/80 text-sm tracking-widest uppercase">
                        実は、ここに気づいていない人が多い
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[24ch] mx-auto">
                        Xだけで売上は<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300">
                            上がりません。
                        </span>
                    </h2>
                    <p className="text-zinc-400 text-lg leading-[1.9] max-w-[36ch] mx-auto pt-2">
                        あなたの努力不足のせいではなく、<br />
                        Xという媒体に、構造的に3つの穴があるからです。
                    </p>
                </div>

                <div className="space-y-px bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800/50">
                    <Wall
                        index="01"
                        title="Xは『川』の媒体。投稿は流れて消える。"
                        body="昨日あなたを見つけてくれた人は、明日にはまた別の人のタイムラインへ流れていきます。X はメッセージが流れ続ける川。購買決定に必要な『何度も触れて信頼が積み上がる時間』を、構造上、確保できません。"
                        verdict="フォロワー数 ≠ あなたの顧客リスト。"
                    />
                    <Wall
                        index="02"
                        title="140文字では、人は買う気になりません。"
                        body="人は『知っている』だけでは買いません。なぜ今これが必要か。なぜあなたから買うべきか。買わない場合に何を失うか──この順番で時間をかけて理解して、初めて財布を開きます。X の単発投稿の構造では、この教育プロセスは完結しません。"
                        verdict="知ってる人 ≠ 買う人。教育の場が要る。"
                    />
                    <Wall
                        index="03"
                        title="販売の自動化が無いと、止まったら終わりです。"
                        body="毎回ローンチのたびに DM 対応、LP 修正、決済導線の手動運用…。これでは『時間』がボトルネックになり、売上は自分の稼働量に比例して頭打ちになります。集客と教育と販売を全部自分でやるのは、個人事業の延長であって、仕組みではありません。"
                        verdict="自分が止まると、売上も止まる構造。"
                    />
                </div>

                <div className="text-center space-y-5 pt-8">
                    <p className="text-2xl md:text-3xl font-bold leading-tight max-w-[24ch] mx-auto">
                        Xが悪いわけではありません。<br />
                        <span className="text-zinc-400 font-normal">Xの『役割』が違うのです。</span>
                    </p>
                    <p className="text-zinc-400 max-w-[36ch] mx-auto leading-[1.9]">
                        Xの仕事は『興味を持った人を見つけて反応してもらう』ところまで。<br />
                        そこから先の <span className="text-zinc-100 font-semibold">教育・信頼形成・販売・自動化</span>
                        は、別のツールで補完しないと、売上の壁が天井になります。
                    </p>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 答え — 足りないのはたった一つ
 * ============================================================= */
function SectionAnswer() {
    return (
        <section className="py-32 md:py-40 bg-zinc-900/40 border-t border-zinc-900">
            <div className="max-w-5xl mx-auto px-6 space-y-20">
                <div className="text-center space-y-5">
                    <p className="text-zinc-500 text-sm tracking-widest uppercase">
                        じゃあ、何が足りないのか
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[28ch] mx-auto">
                        足りなかったのは、<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
                            『教育と販売を、24時間勝手にやってくれる場所』
                        </span>
                    </h2>
                    <p className="text-zinc-400 text-lg leading-[1.9] max-w-[36ch] mx-auto pt-2">
                        その答えが、LINE による自動ステップ配信。<br />
                        そして、それを完全無料で実装できるのが、<span className="text-zinc-100 font-semibold">プロラインフリー</span>。
                    </p>
                </div>

                {/* 完成形ファネル */}
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
                        body="登録した瞬間からステップ配信が起動。なぜ必要か、なぜあなたから買うべきかを、順番に時間をかけて伝える。"
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

                <p className="text-center text-zinc-400 leading-[1.9] max-w-[40ch] mx-auto">
                    この3ステップが、<span className="text-zinc-100 font-semibold">毎日24時間、自動で回り続ける</span>。<br />
                    これが、あなたが最初に欲しかった絵の正体です。
                </p>

                <div className="flex justify-center pt-4">
                    <CtaSecondary />
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * リスクフリー — 失う物は何もない
 * ============================================================= */
function SectionRiskFree() {
    return (
        <section className="py-32 md:py-40 border-t border-zinc-900">
            <div className="max-w-3xl mx-auto px-6 space-y-16 text-center">
                <div className="space-y-5">
                    <p className="text-zinc-500 text-sm tracking-widest uppercase">
                        ここで、ふつうは値段の話が来る
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-[28ch] mx-auto">
                        ですが、これは<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-300">
                            完全無料
                        </span>です。
                    </h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
                    <PriceCell label="月額" value="¥0" />
                    <PriceCell label="登録手数料" value="¥0" />
                    <PriceCell label="クレカ" value="不要" />
                    <PriceCell label="解約金" value="無し" />
                </div>

                <p className="text-zinc-400 text-lg leading-[1.9] max-w-[36ch] mx-auto pt-4">
                    実質、失う物は <span className="text-zinc-100 font-bold">30秒の登録時間</span> だけ。<br />
                    合わなかったら、その瞬間に辞めて構いません。
                </p>

                <div className="pt-8 border-t border-zinc-900 max-w-[36ch] mx-auto" />

                <div className="space-y-4 pt-6">
                    <p className="text-amber-400/80 text-sm tracking-widest uppercase">
                        ただし、注意してください
                    </p>
                    <p className="text-zinc-300 leading-[1.9] max-w-[36ch] mx-auto">
                        『今、始めない』選択にだけは、<br />
                        <span className="text-amber-300 font-semibold">毎日積み上がる見えないコスト</span>がかかります。
                    </p>
                    <ul className="text-zinc-500 text-sm space-y-2 max-w-[36ch] mx-auto leading-relaxed pt-3">
                        <li>— ProX が集めるフォロワーが、リスト化されずに流出する</li>
                        <li>— 今月入るはずだった売上が、教育導線が無いので発生しない</li>
                        <li>— あなたの時間が、DMとLP対応で消えていく</li>
                        <li>— 競合との差が、毎日広がっていく</li>
                    </ul>
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * Final CTA — 爆発
 * ============================================================= */
function FinalCta() {
    return (
        <section className="relative min-h-[80vh] flex items-center overflow-hidden border-t border-zinc-900">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.15),transparent_70%)]" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-3xl" />

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-24 text-center space-y-12">
                <h2 className="text-3xl md:text-6xl font-bold leading-[1.15] max-w-[20ch] mx-auto">
                    <span className="text-zinc-400">「いつかやる」は、</span>
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-400">
                        永遠に来ません。
                    </span>
                </h2>

                <p className="text-zinc-400 text-lg md:text-xl leading-[1.9] max-w-[34ch] mx-auto">
                    必要なのは、<span className="text-zinc-100 font-bold">30秒の登録</span>だけ。<br />
                    それで、今日から仕組みが回り始めます。
                </p>

                <div className="space-y-3 pt-4">
                    <CtaPrimary size="xl" />
                    <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
                        無料 ・ 30秒 ・ クレカ不要 ・ いつでも辞められる
                    </p>
                </div>

                {/* リスクリバーサル */}
                <div className="pt-12 inline-flex items-center gap-2 text-zinc-400 text-sm bg-zinc-900/50 border border-zinc-800 px-5 py-3 rounded-full backdrop-blur">
                    <ShieldCheck className="size-4 text-emerald-400" />
                    合わなかったら、いつでも辞めてください。失う物は何もありません。
                </div>
            </div>
        </section>
    );
}

/* =============================================================
 * 既に登録済みの方向け（控えめなフッター）
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

function BigNumber({
    prefix, value, suffix, caption,
}: {
    prefix: string;
    value: string;
    suffix: string;
    caption: string;
}) {
    return (
        <div className="text-center space-y-4">
            <div className="flex items-end justify-center gap-1 leading-none">
                {prefix && <span className="text-xl md:text-2xl text-zinc-500 mb-3 font-light">{prefix}</span>}
                <span
                    className="text-6xl md:text-8xl font-mono font-bold tabular-nums text-amber-300"
                    style={{ textShadow: "0 0 40px rgba(252,211,77,0.25)" }}
                >
                    {value}
                </span>
                <span className="text-xl md:text-2xl text-zinc-500 mb-3 font-light">{suffix}</span>
            </div>
            <p className="text-zinc-400 text-sm leading-[1.8] max-w-[24ch] mx-auto">
                {caption}
            </p>
        </div>
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

function PriceCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <p className="text-xs tracking-widest text-zinc-500 uppercase">{label}</p>
            <p className="text-3xl md:text-4xl font-mono font-bold text-emerald-300">
                {value}
            </p>
        </div>
    );
}
