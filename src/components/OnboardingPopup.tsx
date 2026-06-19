"use client";

import { useEffect, useState } from "react";
import { PROLINE_DIRECT_URL } from "@/lib/proline";
import { X } from "lucide-react";

// 初回（端末ごとに1回）だけ表示する、ProLine の LINE 登録誘導ポップアップ。
// LINE 登録 URL をタップするとポップアップが閉じ、以降は表示されない。
const SEEN_KEY = "prox_onboarding_line_seen_v1";

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

    const dismiss = () => {
        try {
            localStorage.setItem(SEEN_KEY, "1");
        } catch {
            /* noop */
        }
        setOpen(false);
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
                    <h2 className="text-xl font-bold leading-snug">ProX へようこそ！</h2>
                    <p className="text-sm text-white/90 mt-2">
                        運用のコツ・最新ノウハウ・限定特典を LINE で配信中。<br />
                        まずは友だち追加から始めましょう。
                    </p>
                </div>

                <div className="p-6 space-y-3">
                    <a
                        href={PROLINE_DIRECT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={dismiss}
                        className="block w-full text-center rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3.5 transition-colors"
                    >
                        ＋ LINE で友だち追加する（無料）
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
