"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HQKnowledgePage() {
    const [loading, setLoading] = useState(false);
    const [knowledges, setKnowledges] = useState<any[]>([]);

    useEffect(() => {
        const fetchKnowledges = async () => {
            try {
                setLoading(true);
                const res = await fetch("/api/hq-knowledge");
                if (res.ok) {
                    const data = await res.json();
                    setKnowledges(data);
                }
            } catch (error) {
                console.error("Failed to fetch HQ knowledges:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchKnowledges();
    }, []);

    const getTypeColor = (type: string) => {
        switch (type) {
            case "BASE": return "bg-indigo-100 text-indigo-800";
            case "TEMPLATE": return "bg-emerald-100 text-emerald-800";
            case "WINNING": return "bg-blue-100 text-blue-800";
            case "LOSING": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "BASE": return "📚 ベースナレッジ";
            case "TEMPLATE": return "📝 投稿の型";
            case "WINNING": return "🌟 勝ちパターン";
            case "LOSING": return "🚫 負けパターン";
            default: return type;
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">本部共有ナレッジ (HQ Dashboard)</h2>
                <p className="text-muted-foreground mt-2">
                    各ユーザーが「本部へ共有」をオンにしたナレッジ（成功/失敗法則）が集約される場所です。<br/>
                    全体の傾向を把握し、全ユーザーへ還元するマニュアル作りに活用できます。
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white">
                    <CardHeader className="py-4">
                        <CardTitle className="text-lg">総共有数</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{knowledges.length} <span className="text-sm font-normal text-gray-500">件</span></p>
                    </CardContent>
                </Card>
                <Card className="bg-white">
                    <CardHeader className="py-4">
                        <CardTitle className="text-lg">勝ちパターン</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-blue-600">{knowledges.filter(k => k.type === "WINNING").length} <span className="text-sm font-normal text-gray-500">件</span></p>
                    </CardContent>
                </Card>
                <Card className="bg-white">
                    <CardHeader className="py-4">
                        <CardTitle className="text-lg">投稿の型</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-emerald-600">{knowledges.filter(k => k.type === "TEMPLATE").length} <span className="text-sm font-normal text-gray-500">件</span></p>
                    </CardContent>
                </Card>
                <Card className="bg-white">
                    <CardHeader className="py-4">
                        <CardTitle className="text-lg">参加ユーザー数</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{new Set(knowledges.map(k => k.userId)).size} <span className="text-sm font-normal text-gray-500">人</span></p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>共有ナレッジ一覧</CardTitle>
                    <CardDescription>最新の共有ナレッジから順に表示します</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">読み込み中...</div>
                    ) : knowledges.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">現在、本部に共有されているナレッジはありません。</div>
                    ) : (
                        <div className="space-y-4">
                            {knowledges.map(rule => (
                                <div key={rule.id} className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="w-48 shrink-0 flex flex-col gap-2">
                                        <Badge variant="secondary" className={`w-fit ${getTypeColor(rule.type)}`}>
                                            {getTypeLabel(rule.type)}
                                        </Badge>
                                        {rule.category && (
                                            <Badge variant="outline" className="w-fit text-[10px] text-gray-600 bg-gray-50">
                                                🏷️ {rule.category}
                                            </Badge>
                                        )}
                                        <div className="flex items-center gap-2 mt-2">
                                            {rule.user.image ? (
                                                <img src={rule.user.image} alt="icon" className="w-6 h-6 rounded-full" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">👤</div>
                                            )}
                                            <div className="text-xs text-gray-600 truncate flex-1">
                                                {rule.user.name || rule.user.email || '名無しさん'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-gray-900 font-medium whitespace-pre-wrap">{rule.content}</p>
                                        <div className="flex justify-between items-center mt-3">
                                            <p className="text-xs text-gray-400">元ソース: {rule.source || '不明'}</p>
                                            <p className="text-xs text-gray-400">{new Date(rule.createdAt).toLocaleString('ja-JP')}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
