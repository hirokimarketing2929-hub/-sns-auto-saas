"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface KpiScenario {
    id: string;
    name: string;
    order: number;
    targetValue: number;
    currentValue: number;
    metricSource: string;
    metricPeriodDays: number | null;
}

// メトリクス選択肢
type MetricOption = {
    value: string;         // metricSource の値
    label: string;         // UI 表示
    group: "manual" | "x" | "proline";
    needsPeriod?: boolean; // 期間指定が必要か
};

const BASE_METRIC_OPTIONS: MetricOption[] = [
    { value: "manual", label: "✍️ 手動で入力（自動反映なし）", group: "manual" },
    { value: "x_followers", label: "X: 現在のフォロワー数", group: "x" },
    { value: "x_posts_count", label: "X: 投稿数", group: "x", needsPeriod: true },
    { value: "x_impressions_total", label: "X: 合計インプレッション", group: "x", needsPeriod: true },
    { value: "x_impressions_avg", label: "X: 平均インプレッション", group: "x", needsPeriod: true },
    { value: "x_profile_clicks_total", label: "X: プロフクリック総数（30日限定）", group: "x" },
    { value: "x_profile_click_rate", label: "X: プロフ遷移率（‰、30日限定）", group: "x" },
    { value: "proline_registrations_today", label: "プロライン: 今日の登録数（全体）", group: "proline" },
    { value: "proline_registrations_month", label: "プロライン: 今月の登録数（全体）", group: "proline" },
    { value: "proline_registrations_total", label: "プロライン: 期間登録数（全体）", group: "proline", needsPeriod: true },
    { value: "proline_scenario_total", label: "プロライン: シナリオ登録 期間合計", group: "proline", needsPeriod: true },
];

// 手動入力系のプリセット（名前をワンクリックで入れる）
const MANUAL_PRESETS = [
    { name: "note 閲覧数", emoji: "📝" },
    { name: "Brain 閲覧数", emoji: "🧠" },
    { name: "LP 訪問数", emoji: "🌐" },
    { name: "メルマガ登録数", emoji: "📧" },
    { name: "YouTube 再生数", emoji: "▶️" },
    { name: "Instagram フォロワー数", emoji: "📷" },
];

const PERIOD_OPTIONS = [7, 30, 90];

export default function KpiDashboardPage() {
    const [scenarios, setScenarios] = useState<KpiScenario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [availableForms, setAvailableForms] = useState<string[]>([]);
    const [availableScenarios, setAvailableScenarios] = useState<string[]>([]);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [syncingAll, setSyncingAll] = useState(false);

    // 新規追加フォーム
    const [newName, setNewName] = useState("");
    const [newTarget, setNewTarget] = useState("");
    const [newMetricSource, setNewMetricSource] = useState<string>("manual");
    const [newPeriod, setNewPeriod] = useState<number>(30);

    const fetchScenarios = useCallback(async () => {
        try {
            const res = await fetch("/api/kpi");
            const data = await res.json();
            if (res.ok) setScenarios(data.scenarios || []);
        } catch (error) {
            console.error("Failed to fetch scenarios", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // プロラインの「フォーム別 / シナリオ別」メトリクスを動的選択肢として出すために、名前を取得
    const fetchForms = useCallback(async () => {
        try {
            const res = await fetch("/api/funnel/events?days=90");
            if (res.ok) {
                const data = await res.json();
                const forms: string[] = (data.byForm || []).map((b: { formName: string }) => b.formName).filter((n: string) => n && n !== "(未指定)");
                setAvailableForms(forms);
                const scenarios: string[] = (data.byScenario || []).map((b: { scenarioName: string }) => b.scenarioName).filter((n: string) => n && n !== "(未指定)");
                setAvailableScenarios(scenarios);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        fetchScenarios();
        fetchForms();
    }, [fetchScenarios, fetchForms]);

    const metricOptions: MetricOption[] = [
        ...BASE_METRIC_OPTIONS,
        ...availableForms.map(f => ({
            value: `proline_form:${f}`,
            label: `プロライン: フォーム「${f}」登録数`,
            group: "proline" as const,
            needsPeriod: true,
        })),
        ...availableScenarios.map(s => ({
            value: `proline_scenario:${s}`,
            label: `プロライン: シナリオ「${s}」登録数`,
            group: "proline" as const,
            needsPeriod: true,
        })),
    ];

    const selectedOption = metricOptions.find(m => m.value === newMetricSource) || BASE_METRIC_OPTIONS[0];
    const showPeriodSelect = !!selectedOption.needsPeriod;

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
                        currentValue: 0,
                        metricSource: newMetricSource,
                        metricPeriodDays: showPeriodSelect ? newPeriod : null,
                    },
                }),
            });
            if (res.ok) {
                setNewName("");
                setNewTarget("");
                setNewMetricSource("manual");
                setNewPeriod(30);
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
                body: JSON.stringify({ action: "delete", payload: { id } }),
            });
            if (res.ok) fetchScenarios();
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    const syncOne = async (id: string) => {
        setSyncingId(id);
        try {
            const res = await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "sync", payload: { id } }),
            });
            if (res.ok) await fetchScenarios();
        } catch (e) {
            console.error(e);
        } finally {
            setSyncingId(null);
        }
    };

    const syncAll = async () => {
        setSyncingAll(true);
        try {
            const res = await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "sync_all" }),
            });
            if (res.ok) await fetchScenarios();
        } catch (e) {
            console.error(e);
        } finally {
            setSyncingAll(false);
        }
    };

    const updateManualValue = async (id: string, currentValue: number) => {
        try {
            await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_manual_value",
                    payload: { id, currentValue },
                }),
            });
            fetchScenarios();
        } catch (e) {
            console.error(e);
        }
    };

    const updateMetric = async (id: string, metricSource: string, metricPeriodDays: number | null) => {
        try {
            await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_metric",
                    payload: { id, metricSource, metricPeriodDays },
                }),
            });
            fetchScenarios();
        } catch (e) {
            console.error(e);
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index === 0) return;
        const n = [...scenarios];
        [n[index - 1], n[index]] = [n[index], n[index - 1]];
        setScenarios(n);
        await fetch("/api/kpi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reorder", payload: { scenarios: n.map((s, i) => ({ id: s.id, order: i })) } }),
        });
    };
    const handleMoveDown = async (index: number) => {
        if (index === scenarios.length - 1) return;
        const n = [...scenarios];
        [n[index + 1], n[index]] = [n[index], n[index + 1]];
        setScenarios(n);
        await fetch("/api/kpi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reorder", payload: { scenarios: n.map((s, i) => ({ id: s.id, order: i })) } }),
        });
    };

    const getSourceLabel = (src: string): string => {
        const opt = metricOptions.find(m => m.value === src);
        if (opt) return opt.label;
        if (src.startsWith("proline_form:")) return `プロライン: ${src.substring("proline_form:".length)}`;
        return src;
    };

    // メトリクスソースに応じた表示整形
    const formatCurrentValue = (src: string, value: number): string => {
        if (src === "x_profile_click_rate") {
            // ‰（千分率）で保存 → % 小数点1桁で表示（15 → 1.5%）
            return `${(value / 10).toFixed(1)}%`;
        }
        return value.toLocaleString();
    };
    const formatTargetValue = (src: string, value: number): string => {
        if (src === "x_profile_click_rate") {
            return `${(value / 10).toFixed(1)}%`;
        }
        return value.toLocaleString();
    };

    if (isLoading) return <div className="p-8 text-slate-500">読み込み中...</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">🎯 KPI 目標（ファネル可視化）</h2>
                    <p className="text-slate-600">
                        各ステップの目標と実績を並べて歩留まりを可視化します。数値は X や プロラインから自動反映、もしくは手入力が選べます。
                    </p>
                </div>
                <Button onClick={syncAll} disabled={syncingAll || scenarios.length === 0} variant="outline">
                    {syncingAll ? <><Loader2 className="size-4 mr-1.5 animate-spin" />全て同期中...</> : <><RefreshCw className="size-4 mr-1.5" />全カードを再取得</>}
                </Button>
            </div>

            {/* KPIダッシュボード */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {scenarios.map((scenario, index) => {
                    let conversionRate: number | null = null;
                    if (index > 0 && scenarios[index - 1].currentValue > 0) {
                        conversionRate = Math.round((scenario.currentValue / scenarios[index - 1].currentValue) * 100);
                    }
                    const isAuto = scenario.metricSource !== "manual";
                    const isSyncing = syncingId === scenario.id;

                    return (
                        <div key={scenario.id} className="relative">
                            <Card
                                className={`h-full border-t-4 shadow-sm relative overflow-hidden group transition-all ${isAuto ? "border-t-emerald-500" : "border-t-slate-400"}`}
                                onClick={() => isAuto && !isSyncing && syncOne(scenario.id)}
                                style={isAuto ? { cursor: "pointer" } : {}}
                                title={isAuto ? "タップして最新の値を取得" : ""}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Step {index + 1}
                                        </CardTitle>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex bg-white rounded shadow-sm border border-slate-200 text-xs">
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }} disabled={index === 0} className="p-1 hover:bg-slate-100 disabled:opacity-30">◀</button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteScenario(scenario.id); }} className="p-1 hover:bg-red-50 text-red-500">×</button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }} disabled={index === scenarios.length - 1} className="p-1 hover:bg-slate-100 disabled:opacity-30">▶</button>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold mt-1 text-slate-900 line-clamp-2 leading-tight h-10">{scenario.name}</h3>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-3xl font-black ${isAuto ? "text-emerald-600" : "text-blue-600"}`}>
                                            {formatCurrentValue(scenario.metricSource, scenario.currentValue)}
                                        </span>
                                        <span className="text-xs font-medium text-slate-500">/ {formatTargetValue(scenario.metricSource, scenario.targetValue)} 目標</span>
                                    </div>

                                    {/* プログレスバー */}
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${isAuto ? "bg-emerald-500" : "bg-blue-500"}`}
                                            style={{ width: `${Math.min(100, (scenario.currentValue / (scenario.targetValue || 1)) * 100)}%` }}
                                        />
                                    </div>

                                    {/* ソース + 同期状態 */}
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 gap-1">
                                        <span className="truncate flex-1" title={getSourceLabel(scenario.metricSource)}>
                                            {isAuto ? "🔗 " : "✍️ "}
                                            {getSourceLabel(scenario.metricSource)}
                                        </span>
                                        {isAuto && (
                                            <span className="shrink-0">
                                                {isSyncing ? <Loader2 className="size-3 animate-spin inline" /> : <span className="text-emerald-500">タップで更新</span>}
                                            </span>
                                        )}
                                    </div>

                                    {/* メトリクスソース変更 */}
                                    <div className="pt-2 border-t border-slate-100">
                                        <select
                                            value={scenario.metricSource}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                const src = e.target.value;
                                                const needs = metricOptions.find(m => m.value === src)?.needsPeriod;
                                                updateMetric(scenario.id, src, needs ? (scenario.metricPeriodDays || 30) : null);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700"
                                        >
                                            <optgroup label="手動入力">
                                                {metricOptions.filter(m => m.group === "manual").map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="X から取得">
                                                {metricOptions.filter(m => m.group === "x").map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="プロラインから取得">
                                                {metricOptions.filter(m => m.group === "proline").map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </optgroup>
                                        </select>

                                        {/* 期間選択（該当ソースのみ） */}
                                        {isAuto && metricOptions.find(m => m.value === scenario.metricSource)?.needsPeriod && (
                                            <select
                                                value={scenario.metricPeriodDays || 30}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    updateMetric(scenario.id, scenario.metricSource, Number(e.target.value));
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 mt-1"
                                            >
                                                {PERIOD_OPTIONS.map(p => <option key={p} value={p}>直近 {p} 日</option>)}
                                            </select>
                                        )}

                                        {/* 手動入力の数値変更 */}
                                        {!isAuto && (
                                            <input
                                                type="number"
                                                defaultValue={scenario.currentValue}
                                                onBlur={(e) => {
                                                    const v = Number(e.target.value) || 0;
                                                    if (v !== scenario.currentValue) updateManualValue(scenario.id, v);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 mt-1"
                                                placeholder="現在値を入力"
                                            />
                                        )}
                                    </div>

                                    {conversionRate !== null && (
                                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded-r-md shadow-sm z-10 hidden md:block">
                                            ◀ {conversionRate}%
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {conversionRate !== null && (
                                <div className="md:hidden flex justify-center my-2 text-purple-500 font-bold text-sm">
                                    ▼ {conversionRate}% 遷移
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 新規シナリオ追加フォーム */}
            <Card className="bg-slate-50 border-dashed border-2 border-slate-300">
                <CardHeader className="py-4">
                    <CardTitle className="text-lg text-slate-900">＋ 新しいトラッキング項目を追加</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddScenario} className="space-y-4">
                        {/* 手動入力系のクイックプリセット */}
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">📋 クイック追加（手動入力系、名前だけセット）</label>
                            <div className="flex flex-wrap gap-1.5">
                                {MANUAL_PRESETS.map(preset => (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => {
                                            setNewName(preset.name);
                                            setNewMetricSource("manual");
                                        }}
                                        className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                                    >
                                        {preset.emoji} {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">項目名</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="例: LP訪問数、LINE登録数、フォロワー数"
                                    className="w-full h-10 border border-slate-300 bg-white px-3 py-2 text-sm rounded-md text-slate-900"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">目標数値</label>
                                <input
                                    type="number"
                                    value={newTarget}
                                    onChange={(e) => setNewTarget(e.target.value)}
                                    placeholder="例: 100"
                                    className="w-full h-10 border border-slate-300 bg-white px-3 py-2 text-sm rounded-md text-slate-900"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                                    📊 現在値の取得方法
                                </label>
                                <select
                                    value={newMetricSource}
                                    onChange={(e) => setNewMetricSource(e.target.value)}
                                    className="w-full h-10 border border-slate-300 bg-white px-3 py-2 text-sm rounded-md text-slate-900"
                                >
                                    <optgroup label="手動入力">
                                        {metricOptions.filter(m => m.group === "manual").map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="X から取得">
                                        {metricOptions.filter(m => m.group === "x").map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="プロラインから取得">
                                        {metricOptions.filter(m => m.group === "proline").map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                            {showPeriodSelect && (
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-1 block">⏱ 集計期間</label>
                                    <select
                                        value={newPeriod}
                                        onChange={(e) => setNewPeriod(Number(e.target.value))}
                                        className="w-full h-10 border border-slate-300 bg-white px-3 py-2 text-sm rounded-md text-slate-900"
                                    >
                                        {PERIOD_OPTIONS.map(p => <option key={p} value={p}>直近 {p} 日</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={!newName.trim()}>追加</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
