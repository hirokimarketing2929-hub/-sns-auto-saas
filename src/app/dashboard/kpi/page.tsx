"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface KpiScenario {
    id: string;
    name: string;
    order: number;
    targetValue: number;
    currentValue: number;
}

export default function KpiDashboardPage() {
    const [scenarios, setScenarios] = useState<KpiScenario[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // フォーム用ステート
    const [newName, setNewName] = useState("");
    const [newTarget, setNewTarget] = useState("");

    useEffect(() => {
        fetchScenarios();
    }, []);

    const fetchScenarios = async () => {
        try {
            const res = await fetch("/api/kpi");
            const data = await res.json();
            if (res.ok) {
                setScenarios(data.scenarios || []);
            }
        } catch (error) {
            console.error("Failed to fetch scenarios", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddScenario = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        try {
            const res = await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    payload: {
                        name: newName,
                        targetValue: newTarget || 0,
                        currentValue: 0
                    }
                })
            });

            if (res.ok) {
                setNewName("");
                setNewTarget("");
                fetchScenarios();
            }
        } catch (error) {
            console.error("Failed to add scenario", error);
        }
    };

    const handleDeleteScenario = async (id: string) => {
        if (!confirm("この項目を削除しますか？")) return;
        try {
            const res = await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "delete",
                    payload: { id }
                })
            });
            if (res.ok) fetchScenarios();
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index === 0) return;
        const newScenarios = [...scenarios];
        // 入れ替え
        const temp = newScenarios[index];
        newScenarios[index] = newScenarios[index - 1];
        newScenarios[index - 1] = temp;

        // order再割り当て
        const reordered = newScenarios.map((s, i) => ({ id: s.id, order: i }));

        // API保存
        setScenarios(newScenarios); // 楽観的UI更新
        await fetch("/api/kpi", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reorder", payload: { scenarios: reordered } })
        });
    };

    const handleMoveDown = async (index: number) => {
        if (index === scenarios.length - 1) return;
        const newScenarios = [...scenarios];
        // 入れ替え
        const temp = newScenarios[index];
        newScenarios[index] = newScenarios[index + 1];
        newScenarios[index + 1] = temp;

        // order再割り当て
        const reordered = newScenarios.map((s, i) => ({ id: s.id, order: i }));

        // API保存
        setScenarios(newScenarios); // 楽観的UI更新
        await fetch("/api/kpi", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reorder", payload: { scenarios: reordered } })
        });
    };

    const handleGasSyncPrompt = () => {
        alert("【GAS連携機能】\nGASからPOSTリクエストを `/api/kpi` エンドポイントに送信することで、スプレッドシートやプロラインの数値を自動でcurrentValueに同期させることができます。(現在APIエンドポイントの受け皿のみ実装済)");
    };

    if (isLoading) return <div className="p-8">読み込み中...</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight mb-2">📊 データ分析 (KPIダッシュボード)</h2>
                    <p className="text-muted-foreground">
                        プロラインやLP、Xからの集客〜成約までの動線を可視化します。「LPアクセス」「LINE登録」「動画視聴」などのシナリオを自由に追加し、実績と歩留まりを確認できます。
                    </p>
                </div>
                <div>
                    <Button onClick={handleGasSyncPrompt} variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20">
                        🔗 スプレッドシート/GAS 連携設定
                    </Button>
                </div>
            </div>

            {/* KPIダッシュボード (ステップ可視化) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {scenarios.map((scenario, index) => {
                    // 歩留まり(遷移率)の計算: 1つ前のステップのcurrentValueに対する現在のcurrentValueの割合
                    let conversionRate = null;
                    if (index > 0 && scenarios[index - 1].currentValue > 0) {
                        conversionRate = Math.round((scenario.currentValue / scenarios[index - 1].currentValue) * 100);
                    }

                    return (
                        <div key={scenario.id} className="relative">
                            <Card className="h-full border-t-4 border-t-blue-500 shadow-sm relative overflow-hidden group">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                            Step {index + 1}
                                        </CardTitle>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex bg-white/10 rounded shadow-sm border border-white/20 text-xs">
                                            <button onClick={() => handleMoveUp(index)} disabled={index === 0} className="p-1 hover:bg-gray-100 disabled:opacity-30">◀</button>
                                            <button onClick={() => handleDeleteScenario(scenario.id)} className="p-1 hover:bg-red-50 text-red-500">×</button>
                                            <button onClick={() => handleMoveDown(index)} disabled={index === scenarios.length - 1} className="p-1 hover:bg-gray-100 disabled:opacity-30">▶</button>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold mt-1 text-foreground line-clamp-2 leading-tight h-10">{scenario.name}</h3>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-blue-400">{scenario.currentValue}</span>
                                        <span className="text-sm font-medium text-muted-foreground">/ {scenario.targetValue} 目標</span>
                                    </div>

                                    {/* 達成率プログレスバー */}
                                    <div className="mt-4 h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500"
                                            style={{ width: `${Math.min(100, (scenario.currentValue / (scenario.targetValue || 1)) * 100)}%` }}
                                        />
                                    </div>

                                    {/* コンバージョン率 (歩留まり) */}
                                    {conversionRate !== null && (
                                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded-r-md shadow-sm z-10 hidden md:block">
                                            ◀ {conversionRate}%
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* モバイルレイアウト用の下矢印（遷移率） */}
                            {conversionRate !== null && (
                                <div className="md:hidden flex justify-center my-2 text-purple-400 font-bold text-sm">
                                    ▼ {conversionRate}% 遷移
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 新規シナリオ追加フォーム */}
            <Card className="bg-white/5 border-dashed border-2 border-white/20">
                <CardHeader className="py-4">
                    <CardTitle className="text-lg">＋ 新しいトラッキング項目(シナリオ)を追加する</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddScenario} className="flex gap-4 items-end flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">項目名 (例: LINE友だち追加数)</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="LP訪問数、予約完了数 など"
                                className="w-full h-10 border border-white/10 bg-white/5 px-3 py-2 text-sm rounded-md text-foreground"
                                required
                            />
                        </div>
                        <div className="w-[150px]">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">目標数値 (任意)</label>
                            <input
                                type="number"
                                value={newTarget}
                                onChange={(e) => setNewTarget(e.target.value)}
                                placeholder="例: 100"
                                className="w-full h-10 border border-white/10 bg-white/5 px-3 py-2 text-sm rounded-md text-foreground"
                            />
                        </div>
                        <Button type="submit" disabled={!newName.trim()} className="mb-0">
                            追加
                        </Button>
                    </form>
                </CardContent>
            </Card>

        </div>
    );
}
