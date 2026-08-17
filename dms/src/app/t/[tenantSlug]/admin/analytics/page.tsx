"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
    ComposedChart,
    Area,
    Line,
    LineChart,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import {
    Wallet,
    Receipt,
    TrendingUp,
    TrendingDown,
    Percent,
    BarChart3,
    PieChart as PieChartIcon,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Boxes,
    Trash2,
    Users,
    Zap,
    Tag,
    Loader2,
} from "lucide-react";

type Timeframe = "6m" | "1y" | "all";
type ChartView = "comparison" | "net";

const ITEMS_PER_PAGE = 6;

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
    Inventory: "#345263",
    Wastage: "#e17a7a",
    "Staff & Lab": "#7da3b3",
    Utilities: "#c9a15a",
    Rent: "#8b5cf6",
    Supplies: "#10b981",
    Maintenance: "#f59e0b",
};

const PALETTE = ["#345263", "#7da3b3", "#e17a7a", "#c9a15a", "#8b5cf6", "#10b981", "#f59e0b", "#06b6d4", "#ec4899"];

const CHART_VIEWS: { value: ChartView; label: string }[] = [
    { value: "comparison", label: "Cost vs Revenue" },
    { value: "net", label: "Net Position" },
];

// Net Position color — consistent yellow, matching across both charts
const NET_COLOR = "#eab308";
const PROFIT_COLOR = "#10b981";
const LOSS_COLOR = "#e11d48";

function getCategoryColor(categoryName: string, index: number): string {
    if (DEFAULT_CATEGORY_COLORS[categoryName]) {
        return DEFAULT_CATEGORY_COLORS[categoryName];
    }
    return PALETTE[index % PALETTE.length];
}

// Yellow dot on the Net Position line, with a small green/red triangle showing profit vs loss for that period
function NetDot(props: any) {
    const { cx, cy, value } = props;
    if (cx == null || cy == null) return null;
    const positive = value >= 0;
    return (
        <g>
            <circle cx={cx} cy={cy} r={5} fill={NET_COLOR} stroke="#ffffff" strokeWidth={2} />
            <path
                d={
                    positive
                        ? `M${cx},${cy - 11} L${cx + 4},${cy - 4} L${cx - 4},${cy - 4} Z`
                        : `M${cx},${cy + 11} L${cx + 4},${cy + 4} L${cx - 4},${cy + 4} Z`
                }
                fill={positive ? PROFIT_COLOR : LOSS_COLOR}
            />
        </g>
    );
}

function centsToDisplay(cents: number) {
    const value = Number.isFinite(cents) ? cents : 0;
    return (value / 100).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

interface MonthlyBreakdownRow {
    label: string;
    revenueCents: number;
    categoryCosts: Record<string, number>;
    totalCostCents: number;
    netCents: number;
}

interface CostBreakdownRow {
    categoryName: string;
    costCents: number;
    percentOfMax?: number;
}

interface SummaryData {
    totalCostCents: number;
    totalRevenueCents: number;
    netPositionCents: number;
    costRatioPercent: number;
}

export default function ClinicCostAnalyticsPage() {
    const [timeframe, setTimeframe] = useState<Timeframe>("1y");
    const [tablePage, setTablePage] = useState(1);
    const [activeLocationId, setActiveLocationId] = useState<string>("");
    const [chartView, setChartView] = useState<ChartView>("comparison");

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [summary, setSummary] = useState<SummaryData>({
        totalCostCents: 0,
        totalRevenueCents: 0,
        netPositionCents: 0,
        costRatioPercent: 0,
    });
    const [trendData, setTrendData] = useState<{ label: string; Cost: number; Revenue: number; Net: number }[]>([]);
    const [costBreakdown, setCostBreakdown] = useState<CostBreakdownRow[]>([]);
    const [monthlyRows, setMonthlyRows] = useState<MonthlyBreakdownRow[]>([]);
    const [totalTableRows, setTotalTableRows] = useState(0);

    // Fetch outlets on mount to get location context
    useEffect(() => {
        async function fetchOutlets() {
            try {
                const res = await axios.get("/api/outlets");
                if (res.data?.success && Array.isArray(res.data?.data?.locations) && res.data.data.locations.length > 0) {
                    setActiveLocationId(res.data.data.locations[0].id);
                }
            } catch (err) {
                console.error("Failed to load outlets:", err);
            }
        }
        fetchOutlets();
    }, []);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const params = new URLSearchParams();
            params.set("range", timeframe);
            if (activeLocationId) {
                params.set("locationId", activeLocationId);
            }
            params.set("offset", String((tablePage - 1) * ITEMS_PER_PAGE));

            const res = await axios.get(`/api/analytics/getAll?${params.toString()}`);
            if (res.data?.success && res.data?.data) {
                const data = res.data.data;
                if (data.summary) {
                    setSummary(data.summary);
                }
                if (Array.isArray(data.costRevenueTrend)) {
                    setTrendData(
                        data.costRevenueTrend.map((t: any) => {
                            const revenue = (t.revenueCents ?? 0) / 100;
                            const cost = (t.costCents ?? 0) / 100;
                            return {
                                label: t.label,
                                Cost: cost,
                                Revenue: revenue,
                                Net: (t.netCents ?? (t.revenueCents ?? 0) - (t.costCents ?? 0)) / 100,
                            };
                        })
                    );
                }
                if (Array.isArray(data.costBreakdown)) {
                    setCostBreakdown(
                        data.costBreakdown.map((c: any) => ({
                            categoryName: c.categoryName,
                            costCents: c.costCents ?? c.amountCents ?? 0,
                            percentOfMax: c.percentOfMax ?? 0,
                        }))
                    );
                }
                if (data.monthlyBreakdown && Array.isArray(data.monthlyBreakdown.rows)) {
                    setMonthlyRows(data.monthlyBreakdown.rows);
                    setTotalTableRows(data.monthlyBreakdown.pagination?.total ?? data.monthlyBreakdown.rows.length);
                }
            }
        } catch (err: any) {
            console.error("Failed to load financial analytics:", err);
            setErrorMsg(err.response?.data?.error || "Failed to load financial analytics.");
        } finally {
            setLoading(false);
        }
    }, [timeframe, activeLocationId, tablePage]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const tableTotalPages = Math.max(1, Math.ceil(totalTableRows / ITEMS_PER_PAGE));

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= tableTotalPages) setTablePage(page);
    };

    const stats = [
        { icon: Receipt, label: "Total Cost", value: `NPR ${centsToDisplay(summary.totalCostCents)}` },
        { icon: Wallet, label: "Total Revenue", value: `NPR ${centsToDisplay(summary.totalRevenueCents)}` },
        {
            icon: summary.netPositionCents >= 0 ? TrendingUp : TrendingDown,
            label: "Net Position",
            value: `NPR ${centsToDisplay(summary.netPositionCents)}`,
            isPositive: summary.netPositionCents >= 0,
        },
        { icon: Percent, label: "Cost Ratio", value: `${(summary.costRatioPercent ?? 0).toFixed(1)}%` },
    ];

    const categoryIcon = (category: string) => {
        switch (category) {
            case "Inventory":
                return Boxes;
            case "Wastage":
                return Trash2;
            case "Staff & Lab":
                return Users;
            case "Utilities":
                return Zap;
            default:
                return Tag;
        }
    };

    // Dynamically collect unique category column names for the monthly breakdown table
    const tableCategories = useMemo(() => {
        const set = new Set<string>();
        costBreakdown.forEach((c) => set.add(c.categoryName));
        monthlyRows.forEach((r) => {
            if (r.categoryCosts) {
                Object.keys(r.categoryCosts).forEach((k) => set.add(k));
            }
        });
        return Array.from(set);
    }, [costBreakdown, monthlyRows]);

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-20 flex w-full flex-col gap-4 bg-white px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10 border-b border-slate-900/5 shadow-sm">
                <div>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
                        Cost Analytics
                    </h1>

                </div>

                <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                    <select
                        value={timeframe}
                        onChange={(e) => {
                            setTimeframe(e.target.value as Timeframe);
                            setTablePage(1);
                        }}
                        className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-[#7da3b3] shadow-sm"
                    >
                        <option value="6m">Last 6 Months</option>
                        <option value="1y">Last 1 Year</option>
                        <option value="all">All Time (Overall Business)</option>
                    </select>
                </div>
            </div>

            <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
                {errorMsg && (
                    <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {errorMsg}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-28">
                        <Loader2 className="h-8 w-8 animate-spin text-[#3f6274]" />
                        <p className="mt-3 text-sm text-slate-500">Loading cost analytics...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {stats.map((stat) => (
                                <div key={stat.label} className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <p className="text-[0.85rem] font-medium text-slate-500">{stat.label}</p>
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                            <stat.icon className="h-4 w-4" strokeWidth={2} />
                                        </div>
                                    </div>
                                    <p className={`mt-4 text-2xl font-semibold tracking-tight sm:text-3xl ${stat.isPositive !== undefined ? (stat.isPositive ? "text-emerald-700" : "text-rose-700") : "text-slate-900"}`}>
                                        {stat.value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Charts row */}
                        <div className="mt-8 grid gap-4 lg:grid-cols-3">
                            {/* Chart Card — toggle between Cost vs Revenue and Net Position views */}
                            <div className="lg:col-span-2 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#7da3b3]">
                                            <BarChart3 className="h-4 w-4" strokeWidth={2} />
                                        </span>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                            {chartView === "comparison" ? "Cost vs Revenue" : "Net Position"}
                                        </h3>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        {chartView === "net" && (
                                            <div className="flex items-center gap-3 text-[0.7rem] font-medium text-slate-500">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NET_COLOR }} />
                                                    Net Position
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3 text-emerald-500" strokeWidth={2.5} />
                                                    Profit
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <TrendingDown className="h-3 w-3 text-rose-500" strokeWidth={2.5} />
                                                    Loss
                                                </span>
                                            </div>
                                        )}

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
                                <div className="h-64">
                                    {trendData.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                            No trend data available for this range.
                                        </div>
                                    ) : chartView === "comparison" ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="costColor" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#e17a7a" stopOpacity={0.35} />
                                                        <stop offset="95%" stopColor="#e17a7a" stopOpacity={0.02} />
                                                    </linearGradient>
                                                    <linearGradient id="revenueColor" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#7da3b3" stopOpacity={0.35} />
                                                        <stop offset="95%" stopColor="#7da3b3" stopOpacity={0.02} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                                                <YAxis
                                                    tick={{ fontSize: 11, fill: "#64748b" }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                                                />
                                                <ReferenceLine y={0} stroke="#cbd5e1" />
                                                <Tooltip
                                                    formatter={(value, name) => [`NPR ${Number(value ?? 0).toLocaleString()}`, name]}
                                                    contentStyle={{
                                                        borderRadius: 14,
                                                        border: "1px solid #cbd5e1",
                                                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                                                        fontSize: 12,
                                                        backgroundColor: "#ffffff",
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                                <Area type="monotone" dataKey="Revenue" stroke="#345263" strokeWidth={2.5} fillOpacity={1} fill="url(#revenueColor)" activeDot={{ r: 6, fill: "#345263", stroke: "#fff", strokeWidth: 2 }} />
                                                <Area type="monotone" dataKey="Cost" stroke="#e17a7a" strokeWidth={2.5} fillOpacity={1} fill="url(#costColor)" activeDot={{ r: 6, fill: "#e17a7a", stroke: "#fff", strokeWidth: 2 }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={trendData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                                                <YAxis
                                                    tick={{ fontSize: 11, fill: "#64748b" }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                                                />
                                                <ReferenceLine y={0} stroke="#cbd5e1" />
                                                <Tooltip
                                                    formatter={(value, name) => [`NPR ${Number(value ?? 0).toLocaleString()}`, name]}
                                                    contentStyle={{
                                                        borderRadius: 14,
                                                        border: "1px solid #cbd5e1",
                                                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                                                        fontSize: 12,
                                                        backgroundColor: "#ffffff",
                                                    }}
                                                />
                                                {/* Net Position line — consistent yellow, with a per-point green/red triangle showing profit vs loss */}
                                                <Line
                                                    type="monotone"
                                                    dataKey="Net"
                                                    name="Net Position"
                                                    stroke={NET_COLOR}
                                                    strokeWidth={2.5}
                                                    dot={<NetDot />}
                                                    activeDot={{ r: 7, fill: NET_COLOR, stroke: "#fff", strokeWidth: 2 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/10 text-[#345263]">
                                        <PieChartIcon className="h-4 w-4" strokeWidth={2} />
                                    </span>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Cost by Category
                                    </h3>
                                </div>
                                <div className="h-64">
                                    {costBreakdown.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                            No cost data recorded.
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={costBreakdown} dataKey="costCents" nameKey="categoryName" innerRadius={45} outerRadius={72} paddingAngle={3}>
                                                    {costBreakdown.map((entry, idx) => (
                                                        <Cell key={entry.categoryName} fill={getCategoryColor(entry.categoryName, idx)} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => `NPR ${centsToDisplay(Number(value ?? 0))}`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                                                <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Category cards */}
                        {costBreakdown.length > 0 && (
                            <div className="mt-8 rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/10 text-[#345263]">
                                        <Receipt className="h-4 w-4" strokeWidth={2} />
                                    </span>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Cost Breakdown by Category
                                    </h3>
                                </div>
                                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                                    {costBreakdown.map((c, idx) => {
                                        const Icon = categoryIcon(c.categoryName);
                                        const pct = summary.totalCostCents > 0
                                            ? (c.costCents / summary.totalCostCents) * 100
                                            : (c.percentOfMax ?? 0);
                                        const color = getCategoryColor(c.categoryName, idx);
                                        return (
                                            <div key={c.categoryName}>
                                                <div className="mb-1 flex items-center justify-between text-xs">
                                                    <span className="flex items-center gap-1.5 truncate pr-2 font-semibold text-slate-700">
                                                        <Icon className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                                                        {c.categoryName}
                                                    </span>
                                                    <span className="shrink-0 font-medium text-slate-400">
                                                        NPR {centsToDisplay(c.costCents)} ({pct.toFixed(1)}%)
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Monthly breakdown table */}
                        <div className="mt-8 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#7da3b3]">
                                        <BarChart3 className="h-4 w-4" strokeWidth={2} />
                                    </span>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Monthly Breakdown
                                    </h3>
                                </div>
                                <span className="text-[0.7rem] font-medium text-slate-400">
                                    {totalTableRows} months total
                                </span>
                            </div>

                            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-900/5">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="px-4 py-3 text-left text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
                                                Month
                                            </th>
                                            <th className="px-4 py-3 text-right text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
                                                Revenue
                                            </th>
                                            {tableCategories.map((cat) => (
                                                <th key={cat} className="px-4 py-3 text-right text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
                                                    {cat}
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-right text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
                                                Total Cost
                                            </th>
                                            <th className="px-4 py-3 text-right text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
                                                Net Position
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-900/5">
                                        {monthlyRows.map((row) => {
                                            const net = row.netCents;
                                            const isNetPositive = net >= 0;
                                            return (
                                                <tr key={row.label} className="bg-white transition-colors hover:bg-[#7da3b3]/[0.06]">
                                                    <td className="px-4 py-3 font-semibold text-slate-800">{row.label}</td>
                                                    <td className="px-4 py-3 text-right text-slate-700">NPR {centsToDisplay(row.revenueCents)}</td>
                                                    {tableCategories.map((cat) => (
                                                        <td key={cat} className="px-4 py-3 text-right text-slate-500">
                                                            NPR {centsToDisplay(row.categoryCosts?.[cat] ?? 0)}
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-3 text-right font-semibold text-slate-700">NPR {centsToDisplay(row.totalCostCents)}</td>
                                                    <td className={`px-4 py-3 text-right font-bold ${isNetPositive ? "text-emerald-600" : "text-rose-600"}`}>
                                                        <span className="inline-flex items-center gap-1 justify-end">
                                                            {isNetPositive ? (
                                                                <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                                                            ) : (
                                                                <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                                                            )}
                                                            NPR {centsToDisplay(net)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {monthlyRows.length === 0 && (
                                            <tr>
                                                <td colSpan={tableCategories.length + 3} className="px-6 py-12 text-center text-slate-400">
                                                    No monthly records found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalTableRows > 0 && (
                                <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
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
                                                    ? "bg-[#749fb1] text-white shadow-sm"
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