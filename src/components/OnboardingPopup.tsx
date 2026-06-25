"use client";

import { useEffect, useState } from "react";
import { ONBOARDING_OFFICIAL_LINE_URL } from "@/lib/proline";
import { X } from "lucide-react";

// 初回（端末ごとに1回）だけ表示する、公式LINE友だち追加 誘導ポップアップ。
//
// 位置づけ（決定 #027 が #024 を訂正）: 連携ファネルの正しい受け皿は「公式LINE経由」。
//   ProX登録 → このポップアップ → ★公式LINE友だち追加 → 公式LINE1通目 → プロライン登録。
//   直プロライン誘導ではなく、いったん公式LINEで owned list を資産化してから1通目で
//   プロラインへ誘導する。フレームは「売り込み」でなく「受け皿/先行情報・特典」（利他）。
//   ここが 7/31 連携KPI の実体的な入口。
//
// 計測: CTA クリック時に /api/funnel/onboarding-click を叩き、FunnelEvent として記録する。
//   （最終的な「連携 1カウント」は ProLine 側 webhook で別途到達。本イベントは入口計測。
//    source=prox_onboarding / utmCampaign=prox_onboarding_popup・冪等・レート制限つき。）
const SEEN_KEY = "prox_onboarding_proline_seen_v1";

export default function OnboardingPopup() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            if (!localStorage.getItem(SEEN_KEY)) {
                setOpen(true);
            }
        } catch {
            /* localStorage 不可環境では何もしない */
        }
    }, []);

    const markSeen = () => {
        try {
            localStorage.setItem(SEEN_KEY, "1");
        } catch {
            /* noop */
        }
    };

    const dismiss = () => {
        markSeen();
        setOpen(false);
    };

    // CTA: 入口クリックを FunnelEvent に記録してから公式LINE友だち追加を新規タブで開く。
    // 計測失敗・遅延が遷移を妨げないよう、beacon を投げてから即座に閉じる。
    const handleCtaClick = () => {
        try {
            // keepalive で、ページ遷移後も送信を継続させる（新規タブを開くため通常は影響しないが保険）。
            fetch("/api/funnel/onboarding-click", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                keepalive: true,
            }).catch(() => { /* 計測失敗は無視 */ });
        } catch {
            /* noop */
        }
        markSeen();
        setOpen(false);
        // リンク自体（<a target="_blank">）の既定動作で公式LINE友だち追加が開く。
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="閉じる"
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="bg-gradient-to-br from-emerald-500 to-green-600 px-6 py-7 text-white text-center">
                    <div className="text-3xl mb-2">🎁</div>
                    <h2 className="text-xl font-bold leading-snug">ProX を使い倒すための<br />公式LINEを受け取る</h2>
                    <p className="text-sm text-white/90 mt-2">
                        ProX で集めたフォロワーを「売上」に変える受け皿づくり。<br />
                        公式LINE で<strong>使い方動画</strong>・<strong>先行情報</strong>・<strong>特典</strong>を順番にお届けします。<br />
                        登録は無料・30秒。まずは受け取るだけでOKです。
                    </p>
                </div>

                <div className="p-6 space-y-3">
                    <a
                        href={ONBOARDING_OFFICIAL_LINE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleCtaClick}
                        className="block w-full text-center rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3.5 transition-colors"
                    >
                        ＋ 公式LINEで使い方動画・特典を受け取る（無料・30秒）
                    </a>
                    <button
                        type="button"
                        onClick={dismiss}
                        className="block w-full text-center text-sm text-slate-500 hover:text-slate-700 py-1"
                    >
                        あとで
                    </button>
                </div>
            </div>
        </div>
    );
}
