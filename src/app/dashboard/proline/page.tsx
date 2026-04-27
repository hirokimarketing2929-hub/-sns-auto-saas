"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle, ArrowRight, Award, BookOpenCheck, ChevronDown,
    CircleCheck, Clock, Flame, Hammer, Heart, Instagram, LineChart,
    Megaphone, MessageCircle, Quote, Rocket, ShieldCheck, Sparkles,
    Target, TrendingDown, Zap,
} from "lucide-react";

// 公式サイト or アフィリエイトリンク。本番反映時は環境変数化推奨。
const PROLINE_REGISTER_URL = "https://proline.app/";

// 6段階の「教育」セクションを順序通りに表示する LP。
// このフローはダイレクト・レスポンス・マーケティングの定石で、
//   1. 目的の教育    → ゴールを明確化（売上最大化）
//   2. 信用の教育    → 推す側の実績で「聞く価値あり」を作る
//   3. 問題点の教育  → 今のままでは届かない理由を提示
//   4. 手段の教育    → 解決策（LINE自動化＝プロラインフリー）を見せる
//   5. 投資の教育    → 無料 / リスク無し / 失う物が無いことを納得させる
//   6. 行動の教育    → 今すぐクリックさせる
// の流れで、訪問者の心理を段階的に動かす。

export default function ProlineLpPage() {
    return (
        <div className="-m-8 bg-white text-slate-900 min-h-[calc(100vh+4rem)]">
            {/* ============== HERO ============== */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white">
                <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-96 h-96 rounded-full bg-teal-500/15 blur-3xl" />

                <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 md:py-28 text-center space-y-8">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs font-semibold tracking-wider">
                        ProX × プロラインフリー
                    </Badge>

                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                        X運用、頑張ってるのに<br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                            売上が伸びない
                        </span>
                        の正体。
                    </h1>

                    <p className="text-base md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                        フォロワー数が増えても、インプが伸びても、それが <span className="font-bold text-white">売上に直結しない</span> のはなぜか。<br className="hidden md:block" />
                        答えは「<span className="font-bold text-emerald-300">教育と販売の自動化</span>」が抜けているからです。
                    </p>

                    <div className="pt-4 flex flex-col items-center gap-2">
                        <a href={PROLINE_REGISTER_URL} target="_blank" rel="noopener noreferrer" className="block w-full max-w-md">
                            <Button size="lg" className="w-full text-lg h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border-0 shadow-xl shadow-emerald-500/30">
                                <Sparkles className="size-5 mr-2" />
                                今すぐ無料でプロラインフリーを開設
                                <ArrowRight className="size-5 ml-2" />
                            </Button>
                        </a>
                        <p className="text-xs text-slate-400">※登録30秒・完全無料・クレジット不要</p>
                    </div>

                    <div className="pt-12 text-slate-500 text-sm flex flex-col items-center gap-2 animate-bounce">
                        <span>まずは「なぜ必要なのか」を3分で</span>
                        <ChevronDown className="size-5" />
                    </div>
                </div>
            </section>

            {/* ============== STAGE 1: 目的の教育 ============== */}
            <section className="py-16 md:py-24 bg-white">
                <div className="max-w-4xl mx-auto px-6 space-y-10">
                    <SectionHeader
                        step={1}
                        label="目的の教育"
                        icon={<Target className="size-6" />}
                        title="あなたが本当に欲しいのは、いいねでもフォロワーでもない。"
                        subtitle="ゴールを取り違えるとX運用は『努力の沼』になる。"
                    />

                    <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-6 md:p-10 space-y-6 text-base md:text-lg leading-relaxed text-slate-700">
                            <p>
                                X運用を始めた目的を、一度言語化してみてください。
                            </p>
                            <p className="font-bold text-slate-900 text-xl md:text-2xl">
                                「フォロワー1万人」ですか？<br />
                                それとも「<span className="text-emerald-600">月100万・1000万を自動で生む仕組み</span>」ですか？
                            </p>
                            <p>
                                多くの人は前者を <strong>過程の指標</strong> としてしか見ていなかったはずなのに、
                                気づくとフォロワー数や日々のインプ数を <strong>ゴール</strong> にしてしまっている。
                            </p>
                            <p>
                                でも、フォロワーが10万人いても <strong>売上は0円</strong> のアカウントは存在します。
                                逆に、フォロワー1,000人で <strong>月7桁</strong> のアカウントもあります。
                            </p>
                            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-5 rounded-r-md mt-6">
                                <p className="font-bold text-emerald-900 text-lg">
                                    ✅ X運用の本当のゴールは「売上の最大化」。<br />
                                    フォロワー数は手段の一つにすぎない。
                                </p>
                            </div>
                            <p>
                                このページではその前提で、<strong>「なぜ X 単体では売上最大化が困難で、何を組み合わせれば達成できるのか」</strong> を順番に説明していきます。
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* ============== STAGE 2: 信用の教育 ============== */}
            <section className="py-16 md:py-24 bg-slate-50">
                <div className="max-w-4xl mx-auto px-6 space-y-10">
                    <SectionHeader
                        step={2}
                        label="信用の教育"
                        icon={<ShieldCheck className="size-6" />}
                        title="そう言ってる『お前は誰やねん』に答えます。"
                        subtitle="この導線で実際に結果を出している人間が、根拠を持ってお伝えしています。"
                    />

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="border-slate-200 shadow-sm">
                            <CardContent className="p-6 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                        <Award className="size-5" />
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-900">月1,000万を自動で回す本人</h3>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    ProX を作っているのは、コンテンツ販売 × LINE自動化で <strong className="text-slate-900">月1,000万円</strong> を実際に毎月達成している現役プレイヤー。机上論ではなく、自分のビジネスで毎月証明している仕組みをそのままお渡ししています。
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardContent className="p-6 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                                        <LineChart className="size-5" />
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-900">顧問先の実績</h3>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    顧問契約をしているクライアントの加藤さんは、この導線設計を導入後 <strong className="text-slate-900">2億 → 4億</strong> に到達。LINE自動化を売上の中核に据えた典型的な成功事例です。
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardContent className="p-6 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                        <Hammer className="size-5" />
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-900">プロラインフリー構築の現場経験</h3>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    プロラインフリー本体の構築・運用を顧問業として継続。<strong className="text-slate-900">10ステップ構築マニュアル</strong> を含むナレッジ集を実務で使い込んでおり、機能の使いどころと外しどころを把握しています。
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm">
                            <CardContent className="p-6 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                        <Rocket className="size-5" />
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-900">AI / SaaS 開発の実装力</h3>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    AIを「ツール紹介」で終わらせず、<strong className="text-slate-900">自分でSaaSを設計・実装して配布</strong>する側。今あなたが触っているこの ProX Agent も、そのアウトプットの一つです。
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 mt-8">
                        <Quote className="size-6 text-slate-300 mb-3" />
                        <p className="text-slate-700 italic leading-relaxed">
                            「AIを触れるだけの人」「LINEを構築できるだけの人」はたくさんいます。
                            でも <strong className="not-italic text-slate-900">ビジネスの解像度を保ったまま、X集客 × LINE教育 × 自動販売</strong> を一本の導線として設計・運用できる人は本当に少ない。
                            このLPは、その少数派の視点で書かれています。
                        </p>
                    </div>
                </div>
            </section>

            {/* ============== STAGE 3: 問題点の教育（最重要） ============== */}
            <section className="py-16 md:py-24 bg-gradient-to-br from-rose-50 via-white to-orange-50">
                <div className="max-w-4xl mx-auto px-6 space-y-10">
                    <SectionHeader
                        step={3}
                        label="問題点の教育"
                        icon={<AlertTriangle className="size-6" />}
                        title="X運用『だけ』では、売上最大化は構造的に不可能です。"
                        subtitle="頑張りで解決できないボトルネックが、X単体運用には3つあります。"
                    />

                    <div className="space-y-6">
                        <ProblemCard
                            number="01"
                            icon={<TrendingDown className="size-5" />}
                            title="X はストック性が無い『川』のメディア"
                            body="あなたのプロフィールを訪れた今日のフォロワーは、明日はもう別の人のタイムラインに流れていきます。X はメッセージが流れ続ける『川』であり、購買に必要な『何度も触れて信頼を積み上げる時間』を確保するのが本質的に難しい媒体です。"
                            highlight="フォロワー数 ≠ 顧客リスト。"
                        />

                        <ProblemCard
                            number="02"
                            icon={<MessageCircle className="size-5" />}
                            title="教育の場が無いと、見込み客が『買う理由』に到達しない"
                            body="人は『知っている』だけでは買いません。『なぜ今これが必要か』『なぜあなたから買うべきか』『買わない場合に何を失うか』を順番に理解して、初めて財布を開きます。Xの140文字 × 単発投稿の構造では、この教育プロセスを完結させられません。"
                            highlight="知ってる人 ≠ 買う人。教育の場が必要。"
                        />

                        <ProblemCard
                            number="03"
                            icon={<Clock className="size-5" />}
                            title="販売の自動化が無いと、24時間自分が動き続けることになる"
                            body="毎回ローンチのたびにDM対応・LP修正・決済導線の手動運用…。これでは『時間』がボトルネックになり、売上は自分の稼働量に比例して頭打ちになります。集客と教育と販売を全部自分でやるのは『個人事業の延長』であって、仕組み化された事業ではありません。"
                            highlight="自分が止まると売上も止まる構造。"
                        />
                    </div>

                    <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-10 mt-10 shadow-xl">
                        <div className="flex items-start gap-4">
                            <Flame className="size-8 text-orange-400 flex-shrink-0 mt-1" />
                            <div className="space-y-3">
                                <h3 className="text-xl md:text-2xl font-bold">
                                    結論：X 単体運用は <span className="text-orange-300">『集客の入り口』専用ツール</span>です。
                                </h3>
                                <p className="text-slate-300 leading-relaxed">
                                    X の役割は「興味を持った人を見つけて反応してもらう」ところまで。
                                    そこから先の <strong className="text-white">『教育 → 信頼形成 → 販売 → 自動化』</strong> は、
                                    別のツールで補完しないと売上の壁が天井になります。
                                </p>
                                <p className="text-orange-200 font-semibold pt-2">
                                    じゃあ、その『別のツール』とは何か？ → 次のセクションで答えを示します。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============== STAGE 4: 手段の教育 ============== */}
            <section className="py-16 md:py-24 bg-white">
                <div className="max-w-5xl mx-auto px-6 space-y-10">
                    <SectionHeader
                        step={4}
                        label="手段の教育"
                        icon={<Hammer className="size-6" />}
                        title="答えは『LINE × 自動ステップ配信』。それも、プロラインフリー一択。"
                        subtitle="なぜ『LINE』なのか。なぜ『プロラインフリー』なのか。"
                    />

                    {/* なぜLINEか */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-6 md:p-10 space-y-5">
                            <h3 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <MessageCircle className="size-6 text-emerald-600" />
                                なぜ『LINE』が最強の教育・販売チャネルなのか
                            </h3>
                            <div className="grid md:grid-cols-3 gap-4">
                                <ReasonCell
                                    metric="開封率 80%↑"
                                    title="メールの数倍の到達力"
                                    body="メルマガ平均開封率 15〜20% に対し、LINE 公式アカウントの平均開封率は 60〜80% 以上。メッセージが『確実に届く』のがLINEの圧倒的優位。"
                                />
                                <ReasonCell
                                    metric="ストック性"
                                    title="登録 = リスト資産化"
                                    body="X のフォロワーと違い、LINE登録者は『個別に何度でも教育メッセージを届けられる確定リスト』。アルゴリズムに依存しない。"
                                />
                                <ReasonCell
                                    metric="購買と直結"
                                    title="購入導線まで地続き"
                                    body="日本人ユーザーの 95% 以上が日常的に使うインフラ。決済・予約・問い合わせまで違和感なく流せる。"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* なぜプロラインフリーか */}
                    <Card className="border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50/50 to-teal-50/50">
                        <CardContent className="p-6 md:p-10 space-y-5">
                            <h3 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <Sparkles className="size-6 text-emerald-600" />
                                なぜLINEツールで『プロラインフリー』を選ぶべきか
                            </h3>
                            <ul className="space-y-4">
                                <FeatureRow
                                    label="完全無料で本格機能"
                                    body="ステップ配信・絞り込み配信・タグ管理・流入分析。他ツールなら月数千〜数万円する機能が、登録から完全無料で使い放題。"
                                />
                                <FeatureRow
                                    label="シナリオ配信が直感的"
                                    body="ステップ配信のシナリオを GUI で組めるので、コードを書かずにファネルが完成する。テンプレも豊富。"
                                />
                                <FeatureRow
                                    label="ProX Agent と完全互換"
                                    body="ProX が生成する投稿のCTAに『プロラインフリーのLINE登録URL』を差し込むだけで、X集客 → LINE教育 → 自動販売が一気通貫で繋がる。"
                                />
                                <FeatureRow
                                    label="プロの台本テンプレ付き"
                                    body="成約率の高い『教育→販売』のシナリオテンプレが標準搭載。0からシナリオを書く必要がない。"
                                />
                            </ul>
                        </CardContent>
                    </Card>

                    {/* 完成形ビジュアル */}
                    <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-10">
                        <h3 className="text-xl md:text-2xl font-bold mb-6 text-center">
                            完成形：あなたのビジネスはこう変わる
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <FunnelStep
                                step="集客"
                                tool="ProX Agent (X)"
                                desc="AIが毎日最適な投稿を自動生成・配信。フォロワーを増やし、興味を持った人をプロフィールに集める。"
                                color="from-blue-500 to-cyan-500"
                            />
                            <FunnelStep
                                step="教育"
                                tool="プロラインフリー"
                                desc="LINEに流入した見込み客に、ステップ配信で『なぜ必要か』『なぜあなたから買うべきか』を順番に伝える。"
                                color="from-emerald-500 to-teal-500"
                            />
                            <FunnelStep
                                step="販売"
                                tool="プロラインフリー"
                                desc="教育が終わったタイミングでオファー配信。決済リンクまで一気に到達。寝てる間に売上が立つ仕組み。"
                                color="from-purple-500 to-pink-500"
                            />
                        </div>
                        <p className="text-center text-slate-300 text-sm mt-6">
                            この3ステップが <strong className="text-white">毎日24時間、自動で回り続ける</strong>のが完成形です。
                        </p>
                    </div>
                </div>
            </section>

            {/* ============== STAGE 5: 投資の教育 ============== */}
            <section className="py-16 md:py-24 bg-slate-50">
                <div className="max-w-4xl mx-auto px-6 space-y-10">
                    <SectionHeader
                        step={5}
                        label="投資の教育"
                        icon={<BookOpenCheck className="size-6" />}
                        title="投資は『0円』。失う物は何もない。"
                        subtitle="でも、『今やらない』選択にだけは、巨大な機会損失コストがかかります。"
                    />

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
                            <CardContent className="p-6 md:p-8 space-y-4">
                                <h3 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                                    <CircleCheck className="size-5" />
                                    プロラインフリーを始めるコスト
                                </h3>
                                <ul className="space-y-3 text-slate-700">
                                    <CostItem label="月額利用料" value="¥0" highlight />
                                    <CostItem label="登録手数料" value="¥0" highlight />
                                    <CostItem label="クレジットカード" value="不要" highlight />
                                    <CostItem label="解約金" value="無し（いつでも辞められる）" />
                                    <CostItem label="登録にかかる時間" value="約30秒" />
                                </ul>
                                <p className="text-sm text-emerald-700 font-semibold pt-2">
                                    実質、失う物は <strong>30秒の時間だけ</strong>。
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-rose-200 bg-rose-50/40 shadow-sm">
                            <CardContent className="p-6 md:p-8 space-y-4">
                                <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                                    <AlertTriangle className="size-5" />
                                    『今、始めない』場合の機会損失
                                </h3>
                                <ul className="space-y-3 text-slate-700">
                                    <CostItem label="ProX が集めるフォロワー" value="リスト化されずに流出" warn />
                                    <CostItem label="今月入るはずだった売上" value="教育導線が無いので発生せず" warn />
                                    <CostItem label="あなたの時間" value="DM・LP対応で消費し続ける" warn />
                                    <CostItem label="競合との差" value="毎日広がっていく" warn />
                                </ul>
                                <p className="text-sm text-rose-700 font-semibold pt-2">
                                    これらは <strong>毎日積み上がる『見えないコスト』</strong>です。
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="bg-white border-2 border-emerald-300 rounded-2xl p-6 md:p-10 mt-8 shadow-md">
                        <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-4">
                            シンプルな数式で考えてみてください。
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6 text-center">
                            <div className="p-5 bg-rose-50 rounded-lg border border-rose-200">
                                <p className="text-xs text-rose-600 font-bold mb-1">A. 今のまま</p>
                                <p className="text-2xl font-extrabold text-rose-700">¥0 投資 = ¥0 売上</p>
                                <p className="text-sm text-rose-700/80 mt-2">時間とフォロワーを毎日消費</p>
                            </div>
                            <div className="p-5 bg-emerald-50 rounded-lg border border-emerald-200">
                                <p className="text-xs text-emerald-600 font-bold mb-1">B. プロラインフリー導入</p>
                                <p className="text-2xl font-extrabold text-emerald-700">¥0 投資 = ?? 売上</p>
                                <p className="text-sm text-emerald-700/80 mt-2">あなたの努力が積み上がる仕組みに変わる</p>
                            </div>
                        </div>
                        <p className="text-center text-slate-600 mt-6">
                            <strong>どちらも投資額は同じ ¥0。</strong>違うのは『その後の積み上がり方』だけです。
                        </p>
                    </div>
                </div>
            </section>

            {/* ============== STAGE 6: 行動の教育 ============== */}
            <section className="py-20 md:py-28 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-96 h-96 rounded-full bg-teal-500/15 blur-3xl" />

                <div className="relative z-10 max-w-4xl mx-auto px-6 space-y-10 text-center">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs font-semibold tracking-wider">
                        STEP 6 — 行動の教育
                    </Badge>

                    <h2 className="text-3xl md:text-5xl font-extrabold leading-tight">
                        「いつかやる」は、<span className="text-rose-400">永遠に来ない</span>。<br />
                        やるなら <span className="text-emerald-300">今</span> です。
                    </h2>

                    <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        ここまで読んでくれたあなたなら、もう答えは出ているはず。<br />
                        必要なのは <strong className="text-white">30秒の登録作業だけ</strong>。
                    </p>

                    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 md:p-8 max-w-2xl mx-auto text-left space-y-3">
                        <p className="text-sm font-bold text-emerald-300 mb-2">▶ 登録後の3ステップ</p>
                        <ActionStep n={1} text="このボタンを押して、プロラインフリー公式サイトへ移動" />
                        <ActionStep n={2} text="メールアドレスとパスワードを入力（30秒）" />
                        <ActionStep n={3} text="ProXの設定画面で、CTAに発行されたLINEのURLを貼り付け" />
                        <p className="text-xs text-slate-400 pt-3 border-t border-white/10 mt-4">
                            これだけで、X集客 → LINE教育 → 自動販売の <strong>仕組みが完成</strong>します。
                        </p>
                    </div>

                    <div className="pt-4 flex flex-col items-center gap-3">
                        <a href={PROLINE_REGISTER_URL} target="_blank" rel="noopener noreferrer" className="block w-full max-w-md">
                            <Button size="lg" className="w-full text-lg h-16 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border-0 shadow-2xl shadow-emerald-500/40 font-bold">
                                <Zap className="size-5 mr-2" />
                                30秒で完了：無料で開設する
                                <ArrowRight className="size-5 ml-2" />
                            </Button>
                        </a>
                        <p className="text-xs text-slate-400">クレジットカード不要・解約自由・本登録手数料0円</p>
                    </div>

                    {/* リスクリバーサル */}
                    <div className="pt-10">
                        <div className="inline-flex items-center gap-2 text-slate-300 text-sm bg-white/5 px-4 py-2 rounded-full">
                            <ShieldCheck className="size-4 text-emerald-400" />
                            合わなかったら、いつでも辞めて構いません。<strong className="text-white ml-1">失う物は何もない。</strong>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============== すでに登録済みの方向け ============== */}
            <section className="py-12 bg-white border-t border-slate-200">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">すでにプロラインフリーをお持ちの方</h3>
                    <p className="text-slate-600 text-sm mb-6">
                        ProX Agent の自動投稿機能で、CTAに発行済みのプロラインURLを設定するだけで、X集客 → LINE自動配信の連携が完了します。
                    </p>
                    <div className="flex justify-center gap-3 flex-wrap">
                        <Button variant="outline" onClick={() => window.location.href = '/dashboard/settings'}>
                            設定画面でCTAを確認する
                        </Button>
                        <Button variant="outline" onClick={() => window.location.href = '/dashboard/generate'}>
                            AI自動投稿を試す
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}

/* =====================================================================
 * 部品コンポーネント — 各セクションで再利用
 * ===================================================================== */

function SectionHeader({
    step, label, icon, title, subtitle,
}: {
    step: number;
    label: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
}) {
    return (
        <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2">
                <Badge variant="outline" className="bg-slate-900 text-white border-slate-900 px-3 py-1 text-xs font-bold tracking-wider">
                    STEP {step}
                </Badge>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 text-xs font-bold flex items-center gap-1.5">
                    {icon}
                    {label}
                </Badge>
            </div>
            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                {title}
            </h2>
            <p className="text-slate-600 text-sm md:text-base max-w-2xl mx-auto">
                {subtitle}
            </p>
        </div>
    );
}

function ProblemCard({
    number, icon, title, body, highlight,
}: {
    number: string;
    icon: React.ReactNode;
    title: string;
    body: string;
    highlight: string;
}) {
    return (
        <Card className="border-rose-200 bg-white shadow-sm">
            <CardContent className="p-6 md:p-8 space-y-3">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                        <div className="text-3xl font-black text-rose-200">{number}</div>
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 text-rose-600">
                            {icon}
                            <h3 className="font-bold text-lg text-slate-900">{title}</h3>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{body}</p>
                        <p className="text-rose-700 font-bold pt-2 border-t border-rose-100 mt-3">
                            → {highlight}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ReasonCell({
    metric, title, body,
}: {
    metric: string;
    title: string;
    body: string;
}) {
    return (
        <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 space-y-2">
            <div className="text-emerald-600 text-sm font-bold">{metric}</div>
            <div className="font-bold text-slate-900">{title}</div>
            <p className="text-slate-600 text-sm leading-relaxed">{body}</p>
        </div>
    );
}

function FeatureRow({ label, body }: { label: string; body: string }) {
    return (
        <li className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center mt-0.5">
                <CircleCheck className="size-4" />
            </div>
            <div>
                <div className="font-bold text-slate-900">{label}</div>
                <p className="text-slate-600 text-sm leading-relaxed">{body}</p>
            </div>
        </li>
    );
}

function FunnelStep({
    step, tool, desc, color,
}: {
    step: string;
    tool: string;
    desc: string;
    color: string;
}) {
    return (
        <div className="space-y-3">
            <div className={`bg-gradient-to-br ${color} text-white rounded-xl p-5 shadow-lg`}>
                <div className="text-xs font-bold opacity-80 mb-1">{step}</div>
                <div className="text-lg font-bold">{tool}</div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed px-1">{desc}</p>
        </div>
    );
}

function CostItem({
    label, value, highlight, warn,
}: {
    label: string;
    value: string;
    highlight?: boolean;
    warn?: boolean;
}) {
    return (
        <li className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200/50 last:border-0">
            <span className="text-sm text-slate-600">{label}</span>
            <span className={
                "font-bold text-sm " +
                (highlight ? "text-emerald-700" : warn ? "text-rose-700" : "text-slate-900")
            }>
                {value}
            </span>
        </li>
    );
}

function ActionStep({ n, text }: { n: number; text: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                {n}
            </div>
            <p className="text-slate-200 text-sm leading-relaxed">{text}</p>
        </div>
    );
}
