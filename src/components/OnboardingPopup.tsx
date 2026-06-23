"use client";

import { useEffect, useState } from "react";
import { ONBOARDING_LINE_URL } from "@/lib/proline";
import { X } from "lucide-react";

// 初回（端末ごとに1回）だけ表示する、ProLine アフィリエイト連携誘導ポップアップ。
//
// 位置づけ（決定 #024）: 連携エンジン = ProX オンボーディング自体。
//   ProX 登録直後にこのポップアップで ProLine（プロラインフリー）への連携を推進する。
//   ここが 7/31 連携KPI の実体的な入口。
//
// 計測: CTA クリック時に /api/funnel/onboarding-click を叩き、FunnelEvent として記録する。
//   （最終的な「連携 1カウント」は ProLine 側 webhook で別途到達。本イベントは入口計測。）
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

    // CTA: 連携導線への遷移を FunnelEvent に記録してからオーナー公式LINEを新規タブで開く。
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
        // リンク自体（<a target="_blank">）の既定動作でオーナー公式LINEが開く。
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
                    <h2 className="text-xl font-bold leading-snug">ProX を120%使い倒す最初の一歩</h2>
                    <p className="text-sm text-white/90 mt-2">
                        ProX で集めたフォロワーを「売上」に変える受け皿が、<br />
                        無料のLINE構築ツール「プロラインフリー」。<br />
                        まずは無料で連携して、自動販売の土台をつくりましょう。
                    </p>
                </div>

                <div className="p-6 space-y-3">
                    <a
                        href={ONBOARDING_LINE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleCtaClick}
                        className="block w-full text-center rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3.5 transition-colors"
                    >
                        ＋ 無料でプロラインフリーと連携する（30秒）
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
