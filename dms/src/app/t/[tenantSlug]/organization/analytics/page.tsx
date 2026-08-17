"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Receipt,
    BarChart3,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Store,
    ChevronDown,
    Loader2,
    Calendar,
} from "lucide-react";
import {
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
} from "recharts";

interface Outlet {
    id: string;
    name: string;
}

type Timeframe = "6m" | "1y" | "all";
type ChartView = "comparison" | "net";

interface BreakdownRow {
    label: string;
    revenueCents: number;
    purchaseExpCents: number;
    wastageExpCents: number;
    manualExpCents: number;
    totalExpenseCents: number;
    netProfitCents: number;
}

interface OwnerStats {
    revenueCents: number;
    totalExpenseCents: number;
    netProfitCents: number;
}

interface ChartPoint {
    label: string;
    revenueCents: number;
    expenseCents: number;
    netCents: number;
}

const ITEMS_PER_PAGE = 8;

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
    { value: "6m", label: "6 Months" },
    { value: "1y", label: "1 Year" },
    { value: "all", label: "All Time (Overall Business)" },
];

const CHART_VIEWS: { value: ChartView; label: string }[] = [
    { value: "comparison", label: "Revenue vs Expense" },
    { value: "net", label: "Net Profit" },
];

// Net Profit bar is a consistent yellow; profit/loss is shown via a small arrow indicator instead of bar color
const NET_COLOR = "#eab308";
const PROFIT_COLOR = "#10b981";
const LOSS_COLOR = "#e11d48";

function centsToDisplay(cents: number) {
    const value = Number.isFinite(cents) ? cents : 0;
    return (value / 100).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

// Small triangle marker above/below the Net Profit bar showing profit (up, green) or loss (down, red)
function NetProfitIndicator(props: any) {
    const { x, y, width, value } = props;
    if (x == null || y == null || width == null) return null;
    const positive = value >= 0;
    const cx = x + width / 2;
    const cy = positive ? y - 8 : y + 8;
    return (
        <g transform={`translate(${cx}, ${cy})`}>
            {positive ? (
                <path d="M0,-5 L5,4 L-5,4 Z" fill={PROFIT_COLOR} />
            ) : (
                <path d="M0,5 L5,-4 L-5,-4 Z" fill={LOSS_COLOR} />
            )}
        </g>
    );
}

export default function ProfitAndExpenseReport() {
    const [timeframe, setTimeframe] = useState<Timeframe>("1y");
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [activeOutletId, setActiveOutletId] = useState<string>("all");
    const [outletDropdownOpen, setOutletDropdownOpen] = useState(false);
    const [chartView, setChartView] = useState<ChartView>("comparison");

    const [tablePage, setTablePage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [stats, setStats] = useState<OwnerStats>({
        revenueCents: 0,
        totalExpenseCents: 0,
        netProfitCents: 0,
    });
    const [chartData, setChartData] = useState<{ label: string; Revenue: number; Expense: number; "Net Profit": number }[]>([]);
    const [breakdownRows, setBreakdownRows] = useState<BreakdownRow[]>([]);
    const [totalBreakdownRows, setTotalBreakdownRows] = useState(0);

    const activeOutlet = outlets.find((o) => o.id === activeOutletId);

    // Fetch outlets on mount
    useEffect(() => {
        async function fetchOutlets() {
            try {
                const res = await axios.get("/api/outlets");
                if (res.data?.success && Array.isArray(res.data?.data?.locations)) {
                    const seen = new Set<string>();
                    const mapped: Outlet[] = [];
                    res.data.data.locations.forEach((loc: any) => {
                        if (loc.id && !seen.has(loc.id)) {
                            seen.add(loc.id);
                            mapped.push({ id: loc.id, name: loc.name || loc.locationName || "Outlet" });
                        }
                    });
                    setOutlets(mapped);
                }
            } catch (err) {
                console.error("Failed to load outlets:", err);
            }
        }
        fetchOutlets();
    }, []);

    const fetchOwnerDashboard = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const params = new URLSearchParams();
            params.set("range", timeframe);
            if (activeOutletId && activeOutletId !== "all") {
                params.set("locationId", activeOutletId);
            }
            params.set("offset", String((tablePage - 1) * ITEMS_PER_PAGE));

            const res = await axios.get(`/api/analytics/owner/getll?${params.toString()}`);
            if (res.data?.success && res.data?.data) {
                const data = res.data.data;
                if (data.stats) {
                    setStats(data.stats);
                }
                if (Array.isArray(data.chart)) {
                    setChartData(
                        data.chart.map((pt: ChartPoint) => ({
                            label: pt.label,
                            Revenue: (pt.revenueCents ?? 0) / 100,
                            Expense: (pt.expenseCents ?? 0) / 100,
                            "Net Profit": (pt.netCents ?? 0) / 100,
                        }))
                    );
                }
                if (data.breakdown && Array.isArray(data.breakdown.rows)) {
                    setBreakdownRows(data.breakdown.rows);
                    setTotalBreakdownRows(data.breakdown.pagination?.total ?? data.breakdown.rows.length);
                }
            }
        } catch (err: any) {
            console.error("Failed to load owner analytics:", err);
            setErrorMsg(err.response?.data?.error || "Failed to load owner analytics.");
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [timeframe, activeOutletId, tablePage]);

    useEffect(() => {
        fetchOwnerDashboard();
    }, [fetchOwnerDashboard]);

    function handleOutletSelect(id: string) {
        setActiveOutletId(id);
        setTablePage(1);
        setOutletDropdownOpen(false);
    }

    function handleRefresh() {
        setIsRefreshing(true);
        fetchOwnerDashboard();
    }

    function handleTimeframeChange(tf: Timeframe) {
        setTimeframe(tf);
        setTablePage(1);
    }

    const tableTotalPages = Math.max(1, Math.ceil(totalBreakdownRows / ITEMS_PER_PAGE));

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= tableTotalPages) {
            setTablePage(page);
        }
    };

    const isProfitPositive = stats.netProfitCents >= 0;
    const profitMargin = stats.revenueCents > 0 ? (stats.netProfitCents / stats.revenueCents) * 100 : 0;

    const tooltipFormatter = (value: any, name: any) => {
        if (typeof value === "number") {
            return [`Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, name];
        }
        return [value, name];
    };

    return (
        <div
            className="relative min-h-screen bg-slate-50"
            onClick={() => outletDropdownOpen && setOutletDropdownOpen(false)}
        >
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10 border-b border-slate-900/5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
                            Profit &amp; Expense Report
                        </h1>

                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Outlet Scope Selector */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => setOutletDropdownOpen((prev) => !prev)}
                                className="flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-4 py-2.5 text-[0.85rem] font-medium text-[#345263] shadow-sm transition-colors hover:border-[#7da3b3]"
                            >
                                <Store className="h-4 w-4 shrink-0 text-[#3f6274]" strokeWidth={2} />
                                <span className="max-w-[180px] truncate">
                                    {activeOutletId === "all" ? "All Outlets (Overall Business)" : activeOutlet?.name ?? "Select Outlet"}
                                </span>
                                <ChevronDown
                                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${outletDropdownOpen ? "rotate-180" : ""
                                        }`}
                                />
                            </button>

                            {outletDropdownOpen && (
                                <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-xl">
                                    <div className="border-b border-slate-100 px-4 py-2.5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            Select Outlet Scope
                                        </p>
                                    </div>
                                    <div className="py-1 max-h-60 overflow-y-auto">
                                        <button
                                            onClick={() => handleOutletSelect("all")}
                                            className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[0.85rem] transition-colors ${activeOutletId === "all"
                                                ? "bg-[#7da3b3]/10 font-semibold text-[#3f6274]"
                                                : "text-slate-700 hover:bg-slate-50"
                                                }`}
                                        >
                                            <span
                                                className={`h-2 w-2 shrink-0 rounded-full ${activeOutletId === "all" ? "bg-[#7da3b3]" : "bg-slate-200"
                                                    }`}
                                            />
                                            All Outlets (Overall Business)
                                        </button>
                                        {outlets.map((o) => (
                                            <button
                                                key={o.id}
                                                onClick={() => handleOutletSelect(o.id)}
                                                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[0.85rem] transition-colors ${activeOutletId === o.id
                                                    ? "bg-[#7da3b3]/10 font-semibold text-[#3f6274]"
                                                    : "text-slate-700 hover:bg-slate-50"
                                                    }`}
                                            >
                                                <span
                                                    className={`h-2 w-2 shrink-0 rounded-full ${activeOutletId === o.id ? "bg-[#7da3b3]" : "bg-slate-200"
                                                        }`}
                                                />
                                                <span className="truncate">{o.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Timeframe Toggle */}
                        <div className="flex items-center gap-1 rounded-full border border-slate-900/10 bg-slate-50/60 p-1">
                            {TIMEFRAMES.map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => handleTimeframeChange(m.value)}
                                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${timeframe === m.value
                                        ? "bg-[#3f6274] text-white shadow-sm"
                                        : "text-slate-500 hover:text-[#345263]"
                                        }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-[#3f6274]" : ""}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
                {errorMsg && (
                    <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {errorMsg}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-28">
                        <Loader2 className="h-8 w-8 animate-spin text-[#3f6274]" />
                        <p className="mt-3 text-sm text-slate-500">Loading organization analytics...</p>
                    </div>
                ) : (
                    <>
                        {/* Stat cards */}
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <p className="text-[0.85rem] font-medium text-slate-500">Revenue</p>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                        <Wallet className="h-4 w-4" strokeWidth={2} />
                                    </div>
                                </div>
                                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                                    Rs. {centsToDisplay(stats.revenueCents)}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <p className="text-[0.85rem] font-medium text-slate-500">Total Expense</p>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                                        <Receipt className="h-4 w-4" strokeWidth={2} />
                                    </div>
                                </div>
                                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                                    Rs. {centsToDisplay(stats.totalExpenseCents)}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <p className="text-[0.85rem] font-medium text-slate-500">Net Profit</p>
                                    <div
                                        className={`flex h-9 w-9 items-center justify-center rounded-full ${isProfitPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                            }`}
                                    >
                                        {isProfitPositive ? (
                                            <TrendingUp className="h-4 w-4" strokeWidth={2} />
                                        ) : (
                                            <TrendingDown className="h-4 w-4" strokeWidth={2} />
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 flex items-baseline gap-2">
                                    <p
                                        className={`text-3xl font-semibold tracking-tight ${isProfitPositive ? "text-emerald-600" : "text-rose-600"
                                            }`}
                                    >
                                        Rs. {centsToDisplay(stats.netProfitCents)}
                                    </p>

                                </div>
                            </div>
                        </div>

                        {/* Chart Card — toggle between Revenue vs Expense and Net Profit views */}
                        <div className="mt-8 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Performance Overview
                                    </p>
                                    <h3 className="mt-1 text-base font-semibold text-slate-800">
                                        {chartView === "comparison" ? "Revenue vs Total Expense" : "Net Profit Over Time"}
                                    </h3>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    {/* Legend, changes based on active view */}
                                    <div className="flex items-center gap-3 text-[0.7rem] font-medium text-slate-500">
                                        {chartView === "net" && (
                                            <>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NET_COLOR }} />
                                                    Net Profit
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3 text-emerald-500" strokeWidth={2.5} />
                                                    Profit
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <TrendingDown className="h-3 w-3 text-rose-500" strokeWidth={2.5} />
                                                    Loss
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {/* View toggle */}
                                    <div className="flex items-center gap-1 rounded-full border border-slate-900/10 bg-slate-50/60 p-1">
                                        {CHART_VIEWS.map((v) => (
                                            <button
                                                key={v.value}
                                                onClick={() => setChartView(v.value)}
                                                className={`rounded-full px-3 py-1.5 text-[0.72rem] font-semibold transition-all ${chartView === v.value
                                                    ? "bg-[#3f6274] text-white shadow-sm"
                                                    : "text-slate-500 hover:text-[#345263]"
                                                    }`}
                                            >
                                                {v.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="h-72 w-full">
                                {chartData.length === 0 ? (
                                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                        No chart data available for this range.
                                    </div>
                                ) : chartView === "comparison" ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11, fill: "#64748b" }}
                                                axisLine={{ stroke: "#e2e8f0" }}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: "#64748b" }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                                            />
                                            <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                                            <Tooltip
                                                formatter={tooltipFormatter}
                                                contentStyle={{
                                                    borderRadius: 14,
                                                    border: "1px solid #cbd5e1",
                                                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                                                    fontSize: 12,
                                                    backgroundColor: "#ffffff",
                                                }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                                            <Bar dataKey="Revenue" fill="#7da3b3" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                            <Bar dataKey="Expense" fill="#e17a7a" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11, fill: "#64748b" }}
                                                axisLine={{ stroke: "#e2e8f0" }}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: "#64748b" }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                                            />
                                            <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                                            <Tooltip
                                                formatter={tooltipFormatter}
                                                contentStyle={{
                                                    borderRadius: 14,
                                                    border: "1px solid #cbd5e1",
                                                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                                                    fontSize: 12,
                                                    backgroundColor: "#ffffff",
                                                }}
                                            />
                                            {/* Net Profit bar — consistent yellow, with a small up/down arrow showing profit vs loss */}
                                            <Bar
                                                dataKey="Net Profit"
                                                fill={NET_COLOR}
                                                radius={[4, 4, 0, 0]}
                                                maxBarSize={40}
                                                label={<NetProfitIndicator />}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Breakdown Table */}
                        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/5 p-6">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Detailed Breakdown
                                    </p>
                                    <h3 className="mt-1 text-base font-semibold text-slate-800">
                                        Period-by-Period Income Statement
                                    </h3>
                                </div>
                                <span className="text-[0.7rem] font-medium text-slate-400">
                                    {totalBreakdownRows} periods total
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[850px] border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-slate-900/5 bg-slate-50/60">
                                            <th className="px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Period
                                            </th>
                                            <th className="px-4 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Revenue
                                            </th>
                                            <th className="px-4 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Purchase Exp
                                            </th>
                                            <th className="px-4 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Wastage Exp
                                            </th>
                                            <th className="px-4 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Manual Exp
                                            </th>
                                            <th className="px-4 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Total Expense
                                            </th>
                                            <th className="px-6 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Net Profit
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {breakdownRows.map((row) => {
                                            const isRowProfitPositive = row.netProfitCents >= 0;
                                            return (
                                                <tr
                                                    key={row.label}
                                                    className="border-b border-slate-900/5 transition-colors last:border-b-0 hover:bg-[#7da3b3]/[0.04]"
                                                >
                                                    <td className="px-6 py-4 text-[0.9rem] font-semibold text-slate-900">
                                                        {row.label}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-[0.88rem] font-medium text-slate-800">
                                                        Rs. {centsToDisplay(row.revenueCents)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-[0.88rem] text-slate-600">
                                                        Rs. {centsToDisplay(row.purchaseExpCents)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-[0.88rem] text-slate-600">
                                                        Rs. {centsToDisplay(row.wastageExpCents)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-[0.88rem] text-slate-600">
                                                        Rs. {centsToDisplay(row.manualExpCents)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-[0.88rem] font-semibold text-rose-600">
                                                        Rs. {centsToDisplay(row.totalExpenseCents)}
                                                    </td>
                                                    <td
                                                        className={`px-6 py-4 text-right text-[0.9rem] font-bold ${isRowProfitPositive ? "text-emerald-600" : "text-rose-600"
                                                            }`}
                                                    >
                                                        <span className="inline-flex items-center gap-1 justify-end">
                                                            {isRowProfitPositive ? (
                                                                <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                                                            ) : (
                                                                <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                                                            )}
                                                            Rs. {centsToDisplay(row.netProfitCents)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {breakdownRows.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                                                    No financial breakdown recorded.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalBreakdownRows > 0 && (
                                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs">
                                    <span className="text-[0.7rem] font-medium text-slate-500">
                                        Page <strong className="text-slate-800">{tablePage}</strong> of{" "}
                                        <strong className="text-slate-800">{tableTotalPages}</strong>
                                    </span>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handlePageChange(tablePage - 1)}
                                            disabled={tablePage === 1}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </button>

                                        {Array.from({ length: tableTotalPages }, (_, i) => i + 1).map((pageNum) => (
                                            <button
                                                key={pageNum}
                                                onClick={() => handlePageChange(pageNum)}
                                                className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${tablePage === pageNum
                                                    ? "bg-[#7da3b3] text-white shadow-sm"
                                                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => handlePageChange(tablePage + 1)}
                                            disabled={tablePage === tableTotalPages}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}