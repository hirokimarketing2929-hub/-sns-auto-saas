import Link from "next/link";
import { Button } from "@/components/ui/button";

// クローズドβ 簡易LP / 招待導線（ロードマップ B-5）。
// 旧実装は `/login` への即時リダイレクトのみで「外部の入口」が存在しなかった（CTO監査 観点8）。
// ここでは登録できる入口となる最小LPを置く。
//
// 【コピーは仮】本文・見出しはコンテンツ担当が後で差し替える前提のプレースホルダ。
// 文言だけ差し替えれば良いよう、構造（ヒーロー / 特長 / CTA）だけ先に用意する。

const FEATURES = [
    {
        title: "X運用をAIで自動化",
        body: "（仮）ナレッジを学習したAIが、あなたのアカウントに合わせた投稿を生成します。",
    },
    {
        title: "予約投稿・自動リプライ",
        body: "（仮）投稿の予約から反応への自動リプライまで、運用の手間を大幅に削減します。",
    },
    {
        title: "BYOK（自分のAPIキー）",
        body: "（仮）ご自身のAIキーを使うので、コストは透明・安心。データもあなたの管理下に。",
    },
];

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
            {/* ヒーロー */}
            <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center">
                <span className="mb-4 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-1 text-xs text-slate-300">
                    クローズドβ（招待制）
                </span>
                <h1 className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
                    ProX
                </h1>
                {/* 【仮コピー】コンテンツ担当が差し替え */}
                <p className="mt-6 max-w-2xl text-lg text-slate-300">
                    （仮）X運用をAIで自動化する、プロのためのSNS運用基盤。
                    投稿生成・予約・自動リプライをひとつに。
                </p>

                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                    <Button asChild size="lg">
                        <Link href="/login">招待コードで登録する</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="border-slate-600 text-slate-200">
                        <Link href="/login">ログイン</Link>
                    </Button>
                </div>
                <p className="mt-4 text-xs text-slate-400">
                    現在は招待制です。招待コードをお持ちの方のみご登録いただけます。
                </p>

                {/* 特長（仮） */}
                <section className="mt-20 grid w-full gap-6 text-left sm:grid-cols-3">
                    {FEATURES.map((f) => (
                        <div
                            key={f.title}
                            className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 backdrop-blur-sm"
                        >
                            <h3 className="text-base font-semibold text-slate-100">{f.title}</h3>
                            <p className="mt-2 text-sm text-slate-400">{f.body}</p>
                        </div>
                    ))}
                </section>
            </main>

            <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-500">
                © {new Date().getFullYear()} ProX — クローズドβ
            </footer>
        </div>
    );
}
