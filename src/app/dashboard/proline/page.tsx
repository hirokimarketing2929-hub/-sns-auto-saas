"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProlineIntegrationPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            {/* ヘッダーエリア */}
            <div className="text-center space-y-4 py-8">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 px-3 py-1 text-sm font-medium">
                    公式推奨連携ツール
                </Badge>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
                    ProX の真の力を引き出す<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
                        「プロラインフリー」連携
                    </span>
                </h1>
                <p className="text-lg text-gray-500 max-w-2xl mx-auto mt-4">
                    自動化された集客を確実に「売上」へと変えるため、LINE構築ツール決定版のプロラインフリーとの連携を強く推奨しています。
                </p>
            </div>

            {/* メインCTA */}
            <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border-0 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/20 blur-3xl mix-blend-screen"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl mix-blend-screen"></div>

                <CardContent className="p-8 md:p-12 relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 space-y-6">
                        <h2 className="text-2xl md:text-3xl font-bold leading-snug">
                            まだプロラインフリーの<br className="hidden md:block" />アカウントをお持ちでない方へ
                        </h2>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-500/20 text-emerald-400 p-1 rounded-full text-sm">✅</span>
                                <span className="text-gray-200">全自動のステップ配信機能が無料で何度でも使える</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-500/20 text-emerald-400 p-1 rounded-full text-sm">✅</span>
                                <span className="text-gray-200">ProX が集めたフォロワーを自動で教育・販売</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="bg-emerald-500/20 text-emerald-400 p-1 rounded-full text-sm">✅</span>
                                <span className="text-gray-200">圧倒的な成約率を誇る「プロの台本」も手に入る</span>
                            </li>
                        </ul>
                    </div>

                    <div className="w-full md:w-auto flex flex-col gap-3 shrink-0">
                        <a href="https://proline.app/" target="_blank" rel="noopener noreferrer" className="block">
                            <Button size="lg" className="w-full text-lg h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border-0 shadow-lg shadow-emerald-500/30">
                                今すぐ無料でアカウント作成
                            </Button>
                        </a>
                        <p className="text-xs text-center text-gray-400">※登録は無料、クレジット不要です</p>
                    </div>
                </CardContent>
            </Card>

            {/* AIを使ったシナジー解説 */}
            <div className="mt-16">
                <h3 className="text-2xl font-bold text-center mb-8">連携が生み出す強力なシナジー</h3>
                <div className="grid md:grid-cols-3 gap-6">
                    <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6 space-y-4 text-center">
                            <div className="w-12 h-12 mx-auto bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl">
                                🤖
                            </div>
                            <h4 className="font-bold text-gray-900">1. AIによる全自動集客</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                ProX がX（Twitter）やInstagramで最適な投稿を自動生成・自動投稿し、あなたのアカウントに多くの見込み客を集めます。
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6 space-y-4 text-center">
                            <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl">
                                🔄
                            </div>
                            <h4 className="font-bold text-gray-900">2. スムーズな流入導線</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                投稿の最後やプロフィールで「プロラインフリーの公式LINE」へと自然に誘導。AIが生み出した興味を逃さずリスト化します。
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6 space-y-4 text-center">
                            <div className="w-12 h-12 mx-auto bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-2xl">
                                💰
                            </div>
                            <h4 className="font-bold text-gray-900">3. 自動教育と爆発的売上</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                LINEに登録したユーザーに対し、プロラインのステップ配信が自動で教育＆セールスを実行。寝ていても売上が立つ仕組みが完成します。
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ボトム案内 */}
            <div className="text-center mt-12 bg-gray-50 rounded-2xl p-8 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-2">すでにアカウントをお持ちの方</h3>
                <p className="text-gray-600 text-sm mb-6">
                    引き続きProX の自動投稿機能にて、「CTA」に自身のプロラインURLを設定してご活用ください。
                </p>
                <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={() => window.location.href = '/dashboard/settings'}>
                        設定画面でCTAを確認する
                    </Button>
                    <Button variant="outline" onClick={() => window.location.href = '/dashboard/generate'}>
                        AI自動投稿を使ってみる
                    </Button>
                </div>
            </div>
        </div>
    );
}
