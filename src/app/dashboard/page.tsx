import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">ダッシュボード</h2>
            <p className="text-gray-500">
                AIエージェントの稼働状況と最新の投稿ステータスを確認できます。
            </p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">連携アカウント数</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">2</div>
                        <p className="text-xs text-muted-foreground mt-1 text-green-600">
                            X, Instagram 連携済み
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">今月の自動投稿数</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">14</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            昨日より +1件
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">最新のエラー</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground mt-1 text-green-600">
                            システムは正常に稼働しています
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>最近の投稿一覧 (X)</CardTitle>
                        <CardDescription>直近で自動生成された投稿です。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="p-4 border rounded-md bg-white">
                                <p className="text-sm text-gray-500 mb-2">2026/03/04 12:00 投稿完了</p>
                                <p className="text-sm border-l-4 border-blue-500 pl-4 py-1">
                                    AIによる自動化ツール導入したら、作業時間が1/10になった...！🔥
                                    もっと早く導入すべきだった。詳しいやり方はここから↓
                                    [URL]
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
