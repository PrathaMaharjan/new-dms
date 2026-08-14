"use client";

import { useMemo, useState } from "react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* NOTE: This is a frontend-only build. Every value below is generated
   sample data — swap `SAMPLE_MONTHS` (and the derived data below it)
   for a real `/api/...` call via your `@/lib/api` axios instance
   whenever the backend endpoint is ready. Shapes are kept close to
   the billing page's response shapes so wiring it up later is a
   drop-in swap.                                                      */
/* ------------------------------------------------------------------ */

type CostCategory = "Inventory" | "Wastage" | "Staff & Lab" | "Utilities";

const COST_CATEGORY_COLORS: Record<CostCategory, string> = {
    Inventory: "#345263",
    Wastage: "#e17a7a",
    "Staff & Lab": "#7da3b3",
    Utilities: "#c9a15a",
};

type MonthCost = {
    month: string; // "2026-01"
    revenueCents: number;
    costCents: number;
    breakdown: Record<CostCategory, number>;
};

function seededRandom(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function buildSampleMonths(): MonthCost[] {
    const months: MonthCost[] = [];
    const now = new Date(2026, 7, 1); // Aug 2026
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const seed = d.getFullYear() * 100 + d.getMonth();
        const revenueCents = Math.round((420000 + seededRandom(seed) * 180000) * 100) / 100 * 100;
        const inventory = Math.round(revenueCents * (0.18 + seededRandom(seed + 1) * 0.05));
        const wastage = Math.round(revenueCents * (0.02 + seededRandom(seed + 2) * 0.02));
        const staffLab = Math.round(revenueCents * (0.22 + seededRandom(seed + 3) * 0.04));
        const utilities = Math.round(revenueCents * (0.04 + seededRandom(seed + 4) * 0.015));
        const costCents = inventory + wastage + staffLab + utilities;
        months.push({
            month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            revenueCents,
            costCents,
            breakdown: {
                Inventory: inventory,
                Wastage: wastage,
                "Staff & Lab": staffLab,
                Utilities: utilities,
            },
        });
    }
    return months;
}

const SAMPLE_MONTHS = buildSampleMonths();

function centsToDisplay(cents: number) {
    const value = Number.isFinite(cents) ? cents : 0;
    return (value / 100).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

function formatMonthLabel(month: string) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

type Timeframe = "6m" | "1y" | "all";

const ITEMS_PER_PAGE = 6;

export default function ClinicCostAnalyticsPage() {
    const [timeframe, setTimeframe] = useState<Timeframe>("1y");
    const [tablePage, setTablePage] = useState(1);

    const visibleMonths = useMemo(() => {
        if (timeframe === "6m") return SAMPLE_MONTHS.slice(-6);
        if (timeframe === "1y") return SAMPLE_MONTHS.slice(-12);
        return SAMPLE_MONTHS;
    }, [timeframe]);

    const totals = useMemo(() => {
        const revenueCents = visibleMonths.reduce((s, m) => s + m.revenueCents, 0);
        const costCents = visibleMonths.reduce((s, m) => s + m.costCents, 0);
        const netCents = revenueCents - costCents;
        const costRatio = revenueCents > 0 ? (costCents / revenueCents) * 100 : 0;
        return { revenueCents, costCents, netCents, costRatio };
    }, [visibleMonths]);

    const trendData = useMemo(
        () =>
            visibleMonths.map((m) => ({
                label: formatMonthLabel(m.month),
                Cost: m.costCents / 100,
                Revenue: m.revenueCents / 100,
            })),
        [visibleMonths]
    );

    const categoryBreakdown = useMemo(() => {
        const totalsByCat: Record<CostCategory, number> = {
            Inventory: 0,
            Wastage: 0,
            "Staff & Lab": 0,
            Utilities: 0,
        };
        visibleMonths.forEach((m) => {
            (Object.keys(totalsByCat) as CostCategory[]).forEach((cat) => {
                totalsByCat[cat] += m.breakdown[cat];
            });
        });
        return (Object.keys(totalsByCat) as CostCategory[]).map((cat) => ({
            category: cat,
            amountCents: totalsByCat[cat],
        }));
    }, [visibleMonths]);

    const tableRows = useMemo(() => [...visibleMonths].reverse(), [visibleMonths]);
    const tableTotalPages = Math.max(1, Math.ceil(tableRows.length / ITEMS_PER_PAGE));
    const paginatedRows = tableRows.slice(
        (tablePage - 1) * ITEMS_PER_PAGE,
        tablePage * ITEMS_PER_PAGE
    );

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= tableTotalPages) setTablePage(page);
    };

    const stats = [
        { icon: Receipt, label: "Total Cost", value: `NPR ${centsToDisplay(totals.costCents)}` },
        { icon: Wallet, label: "Total Revenue", value: `NPR ${centsToDisplay(totals.revenueCents)}` },
        {
            icon: totals.netCents >= 0 ? TrendingUp : TrendingDown,
            label: "Net Position",
            value: `NPR ${centsToDisplay(totals.netCents)}`,
        },
        { icon: Percent, label: "Cost Ratio", value: `${totals.costRatio.toFixed(1)}%` },
    ];

    const categoryIcon: Record<CostCategory, typeof Boxes> = {
        Inventory: Boxes,
        Wastage: Trash2,
        "Staff & Lab": Users,
        Utilities: Zap,
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-20 flex w-full flex-col gap-4 bg-white px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10 shadow-sm">
                <div>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
                        Cost Analytics
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        What it costs to run the clinic, and how that compares to revenue.
                    </p>
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
                            <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                                {stat.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Charts row */}
                <div className="mt-8 grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#7da3b3]">
                                <BarChart3 className="h-4 w-4" strokeWidth={2} />
                            </span>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Cost vs Revenue
                            </h3>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                                </AreaChart>
                            </ResponsiveContainer>
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
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={categoryBreakdown} dataKey="amountCents" nameKey="category" innerRadius={45} outerRadius={72} paddingAngle={3}>
                                        {categoryBreakdown.map((entry) => (
                                            <Cell key={entry.category} fill={COST_CATEGORY_COLORS[entry.category]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `NPR ${centsToDisplay(Number(value ?? 0))}`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Category cards */}
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
                        {categoryBreakdown.map((c) => {
                            const Icon = categoryIcon[c.category];
                            const pct = totals.costCents > 0 ? (c.amountCents / totals.costCents) * 100 : 0;
                            return (
                                <div key={c.category}>
                                    <div className="mb-1 flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 truncate pr-2 font-semibold text-slate-700">
                                            <Icon className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                                            {c.category}
                                        </span>
                                        <span className="shrink-0 font-medium text-slate-400">
                                            NPR {centsToDisplay(c.amountCents)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: COST_CATEGORY_COLORS[c.category] }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

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
                            {tableRows.length} months
                        </span>
                    </div>

                    <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-900/5">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50">
                                    {["Month", "Revenue", "Inventory", "Wastage", "Staff & Lab", "Utilities", "Total Cost", "Net"].map((h, i) => (
                                        <th
                                            key={h}
                                            className={`px-4 py-3 text-[0.7rem] font-medium uppercase tracking-wide text-slate-500 ${i === 0 ? "text-left" : "text-right"}`}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/5">
                                {paginatedRows.map((row) => {
                                    const net = row.revenueCents - row.costCents;
                                    return (
                                        <tr key={row.month} className="bg-white transition-colors hover:bg-[#7da3b3]/[0.06]">
                                            <td className="px-4 py-3 font-semibold text-slate-800">{formatMonthLabel(row.month)}</td>
                                            <td className="px-4 py-3 text-right text-slate-700">NPR {centsToDisplay(row.revenueCents)}</td>
                                            <td className="px-4 py-3 text-right text-slate-500">NPR {centsToDisplay(row.breakdown.Inventory)}</td>
                                            <td className="px-4 py-3 text-right text-slate-500">NPR {centsToDisplay(row.breakdown.Wastage)}</td>
                                            <td className="px-4 py-3 text-right text-slate-500">NPR {centsToDisplay(row.breakdown["Staff & Lab"])}</td>
                                            <td className="px-4 py-3 text-right text-slate-500">NPR {centsToDisplay(row.breakdown.Utilities)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-700">NPR {centsToDisplay(row.costCents)}</td>
                                            <td className={`px-4 py-3 text-right font-bold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                NPR {centsToDisplay(net)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
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
                </div>
            </div>
        </div>
    );
}