"use client";

import { signIn } from "next-auth/react";

export default function RelinkPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col px-4 text-center">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <span className="text-2xl">🔄</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-4">アップデートにより再連携が必要です</h1>
                <p className="text-gray-600 mb-8 text-sm leading-relaxed">
                    DM自動送信などの新機能がシステムに追加されました！
                    <br /><br />
                    新機能を有効にし、引き続きダッシュボードを安全にご利用いただくために、X（旧Twitter）の新しい権限での<strong>再連携</strong>が必要です。
                    お手数ですが、以下のボタンから再度アカウントを認証してください。
                </p>
                <button
                    onClick={() => signIn("twitter", { callbackUrl: "/dashboard" })}
                    className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    X で再連携してダッシュボードへ戻る
                </button>
            </div>
        </div>
    );
}
