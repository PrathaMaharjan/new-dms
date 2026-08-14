"use client";

import React, { useState, useMemo } from "react";
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Receipt,
    BarChart3,
    RefreshCw,
    CalendarRange,
    ChevronLeft,
    ChevronRight,
    Store,
    ChevronDown,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

interface PeriodRow {
    revenue: number;
    purchaseExpense: number;
    wastageExpense: number;
    manualExpense: number;
    grossProfit: number;
    netProfit: number;
}

interface MonthRow extends PeriodRow {
    month: string;
}

interface YearRow extends PeriodRow {
    year: string;
}

interface Outlet {
    id: string;
    name: string;
}

type ViewMode = "monthly" | "yearly" | "overall";

const MONTH_KEYS = [
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
];

const SEED_OUTLETS: Outlet[] = [
    { id: "outlet-1", name: "Thamel Branch" },
    { id: "outlet-2", name: "Lakeside Branch" },
];

// Base raw figures per outlet, aligned index-for-index with MONTH_KEYS
const RAW_BY_OUTLET: Record<string, { revenue: number; purchaseExpense: number; wastageExpense: number; manualExpense: number }[]> = {
    "outlet-1": [
        { revenue: 420000, purchaseExpense: 165000, wastageExpense: 12000, manualExpense: 38000 },
        { revenue: 455000, purchaseExpense: 172000, wastageExpense: 9500, manualExpense: 41000 },
        { revenue: 468000, purchaseExpense: 178000, wastageExpense: 11000, manualExpense: 39500 },
        { revenue: 512000, purchaseExpense: 195000, wastageExpense: 14200, manualExpense: 52000 },
        { revenue: 398000, purchaseExpense: 158000, wastageExpense: 8800, manualExpense: 36000 },
        { revenue: 431000, purchaseExpense: 166000, wastageExpense: 10500, manualExpense: 40500 },
        { revenue: 447000, purchaseExpense: 171000, wastageExpense: 9800, manualExpense: 42000 },
        { revenue: 489000, purchaseExpense: 184000, wastageExpense: 13500, manualExpense: 45000 },
        { revenue: 502000, purchaseExpense: 189000, wastageExpense: 12800, manualExpense: 47000 },
        { revenue: 476000, purchaseExpense: 180000, wastageExpense: 11200, manualExpense: 43500 },
        { revenue: 518000, purchaseExpense: 197000, wastageExpense: 14800, manualExpense: 49000 },
        { revenue: 541000, purchaseExpense: 204000, wastageExpense: 15600, manualExpense: 51500 },
    ],
    "outlet-2": [
        { revenue: 268000, purchaseExpense: 104000, wastageExpense: 7200, manualExpense: 23000 },
        { revenue: 281000, purchaseExpense: 108000, wastageExpense: 6800, manualExpense: 25500 },
        { revenue: 295000, purchaseExpense: 112000, wastageExpense: 7500, manualExpense: 24000 },
        { revenue: 322000, purchaseExpense: 122000, wastageExpense: 9100, manualExpense: 31000 },
        { revenue: 251000, purchaseExpense: 98000, wastageExpense: 5600, manualExpense: 21500 },
        { revenue: 274000, purchaseExpense: 105000, wastageExpense: 6700, manualExpense: 24500 },
        { revenue: 288000, purchaseExpense: 109000, wastageExpense: 6300, manualExpense: 25800 },
        { revenue: 309000, purchaseExpense: 116000, wastageExpense: 8400, manualExpense: 27500 },
        { revenue: 317000, purchaseExpense: 119000, wastageExpense: 7900, manualExpense: 28800 },
        { revenue: 301000, purchaseExpense: 113000, wastageExpense: 7100, manualExpense: 26500 },
        { revenue: 330000, purchaseExpense: 124000, wastageExpense: 9300, manualExpense: 29800 },
        { revenue: 347000, purchaseExpense: 130000, wastageExpense: 9900, manualExpense: 31200 },
    ],
};

function toPeriodRow(raw: { revenue: number; purchaseExpense: number; wastageExpense: number; manualExpense: number }): PeriodRow {
    const netProfit = raw.revenue - raw.purchaseExpense - raw.wastageExpense - raw.manualExpense;
    const grossProfit = raw.revenue - raw.purchaseExpense;
    return { ...raw, grossProfit, netProfit };
}

function getMonthsForOutlet(outletId: string): MonthRow[] {
    if (outletId === "all") {
        return MONTH_KEYS.map((month, i) => {
            const outletRows = Object.values(RAW_BY_OUTLET).map((rows) => rows[i]);
            const summed = outletRows.reduce(
                (acc, r) => ({
                    revenue: acc.revenue + r.revenue,
                    purchaseExpense: acc.purchaseExpense + r.purchaseExpense,
                    wastageExpense: acc.wastageExpense + r.wastageExpense,
                    manualExpense: acc.manualExpense + r.manualExpense,
                }),
                { revenue: 0, purchaseExpense: 0, wastageExpense: 0, manualExpense: 0 }
            );
            return { month, ...toPeriodRow(summed) };
        });
    }
    const rows = RAW_BY_OUTLET[outletId] ?? [];
    return MONTH_KEYS.map((month, i) => ({ month, ...toPeriodRow(rows[i]) }));
}

function getYearsFromMonths(months: MonthRow[]): YearRow[] {
    const byYear = new Map<string, { revenue: number; purchaseExpense: number; wastageExpense: number; manualExpense: number }>();
    months.forEach((m) => {
        const year = m.month.slice(0, 4);
        const existing = byYear.get(year) ?? { revenue: 0, purchaseExpense: 0, wastageExpense: 0, manualExpense: 0 };
        byYear.set(year, {
            revenue: existing.revenue + m.revenue,
            purchaseExpense: existing.purchaseExpense + m.purchaseExpense,
            wastageExpense: existing.wastageExpense + m.wastageExpense,
            manualExpense: existing.manualExpense + m.manualExpense,
        });
    });
    return Array.from(byYear.entries()).map(([year, raw]) => ({ year, ...toPeriodRow(raw) }));
}

function getOverallFromMonths(months: MonthRow[]): PeriodRow {
    const raw = months.reduce(
        (acc, m) => ({
            revenue: acc.revenue + m.revenue,
            purchaseExpense: acc.purchaseExpense + m.purchaseExpense,
            wastageExpense: acc.wastageExpense + m.wastageExpense,
            manualExpense: acc.manualExpense + m.manualExpense,
        }),
        { revenue: 0, purchaseExpense: 0, wastageExpense: 0, manualExpense: 0 }
    );
    return toPeriodRow(raw);
}

function formatMonthLabel(month: string): string {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
    });
}

const VIEW_MODES: { value: ViewMode; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "overall", label: "Overall Business" },
];

const ITEMS_PER_PAGE = 8;

export default function ProfitAndExpenseReport() {
    const [viewMode, setViewMode] = useState<ViewMode>("monthly");

    const [outlets] = useState<Outlet[]>(SEED_OUTLETS);
    const [activeOutletId, setActiveOutletId] = useState<string>("all");
    const [outletDropdownOpen, setOutletDropdownOpen] = useState(false);
    const activeOutlet = outlets.find((o) => o.id === activeOutletId);

    const [startMonth, setStartMonth] = useState<string>("");
    const [endMonth, setEndMonth] = useState<string>("");

    const [tablePage, setTablePage] = useState(1);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const allMonthsForOutlet = useMemo(() => getMonthsForOutlet(activeOutletId), [activeOutletId]);

    const months = useMemo(() => {
        return allMonthsForOutlet.filter((m) => {
            const afterStart = !startMonth || m.month >= startMonth;
            const beforeEnd = !endMonth || m.month <= endMonth;
            return afterStart && beforeEnd;
        });
    }, [allMonthsForOutlet, startMonth, endMonth]);

    const years = useMemo(() => getYearsFromMonths(months), [months]);
    const overall = useMemo(() => getOverallFromMonths(months), [months]);

    function handleOutletSelect(id: string) {
        setActiveOutletId(id);
        setOutletDropdownOpen(false);
    }

    function handleRefresh() {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 500);
    }

    const chartData = useMemo(() => {
        if (viewMode === "overall") {
            const totalExp = overall.purchaseExpense + overall.wastageExpense + overall.manualExpense;
            return [
                {
                    label: "Overall",
                    Revenue: overall.revenue,
                    Expense: totalExp,
                    "Net Profit": overall.netProfit,
                },
            ];
        }
        if (viewMode === "monthly") {
            return months.map((m) => {
                const totalExp = m.purchaseExpense + m.wastageExpense + m.manualExpense;
                return {
                    label: formatMonthLabel(m.month),
                    Revenue: m.revenue,
                    Expense: totalExp,
                    "Net Profit": m.netProfit,
                };
            });
        }
        return years.map((y) => {
            const totalExp = y.purchaseExpense + y.wastageExpense + y.manualExpense;
            return {
                label: y.year,
                Revenue: y.revenue,
                Expense: totalExp,
                "Net Profit": y.netProfit,
            };
        });
    }, [viewMode, months, years, overall]);

    const tableRows = useMemo(() => {
        if (viewMode === "overall") {
            const totalExpense = overall.purchaseExpense + overall.wastageExpense + overall.manualExpense;
            return [
                {
                    label: "Overall All-Time",
                    revenue: overall.revenue,
                    purchaseExpense: overall.purchaseExpense,
                    wastageExpense: overall.wastageExpense,
                    manualExpense: overall.manualExpense,
                    totalExpense,
                    netProfit: overall.netProfit,
                },
            ];
        }
        if (viewMode === "monthly") {
            const rows = months.map((m) => {
                const totalExpense = m.purchaseExpense + m.wastageExpense + m.manualExpense;
                return {
                    label: formatMonthLabel(m.month),
                    revenue: m.revenue,
                    purchaseExpense: m.purchaseExpense,
                    wastageExpense: m.wastageExpense,
                    manualExpense: m.manualExpense,
                    totalExpense,
                    netProfit: m.netProfit,
                };
            });
            return [...rows].reverse();
        }
        const rows = years.map((y) => {
            const totalExpense = y.purchaseExpense + y.wastageExpense + y.manualExpense;
            return {
                label: y.year,
                revenue: y.revenue,
                purchaseExpense: y.purchaseExpense,
                wastageExpense: y.wastageExpense,
                manualExpense: y.manualExpense,
                totalExpense,
                netProfit: y.netProfit,
            };
        });
        return [...rows].reverse();
    }, [viewMode, months, years, overall]);

    const tableTotalPages = Math.max(1, Math.ceil(tableRows.length / ITEMS_PER_PAGE));
    const paginatedRows = tableRows.slice((tablePage - 1) * ITEMS_PER_PAGE, tablePage * ITEMS_PER_PAGE);

    function changeViewMode(mode: ViewMode) {
        setViewMode(mode);
        setTablePage(1);
    }

    const overallTotalExpense = overall.purchaseExpense + overall.wastageExpense + overall.manualExpense;
    const overallNetProfit = overall.netProfit;
    const isProfitPositive = overallNetProfit >= 0;

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
            <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
                        Profit &amp; Expense Report
                    </h1>

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
                                    <div className="py-1">
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
                                                {o.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 rounded-full border border-slate-900/10 bg-slate-50/60 p-1">
                            {VIEW_MODES.map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => changeViewMode(m.value)}
                                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${viewMode === m.value
                                            ? "bg-[#3f6274] text-white shadow-sm"
                                            : "text-slate-500 hover:text-[#345263]"
                                        }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
                {/* Range controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-[0.9rem] font-semibold text-[#345263]">
                        <CalendarRange className="h-4 w-4 text-slate-400" strokeWidth={2} />
                        Date Range
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="month"
                            value={startMonth}
                            onChange={(e) => {
                                setStartMonth(e.target.value);
                                setTablePage(1);
                            }}
                            className="rounded-full border border-slate-900/10 bg-white px-3.5 py-2 text-[0.8rem] text-slate-700 outline-none focus:border-[#7da3b3]"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                            type="month"
                            value={endMonth}
                            onChange={(e) => {
                                setEndMonth(e.target.value);
                                setTablePage(1);
                            }}
                            className="rounded-full border border-slate-900/10 bg-white px-3.5 py-2 text-[0.8rem] text-slate-700 outline-none focus:border-[#7da3b3]"
                        />
                    </div>
                </div>

                {/* Stat cards */}
                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between">
                            <p className="text-[0.85rem] font-medium text-slate-500">Revenue</p>
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                <Wallet className="h-4 w-4" strokeWidth={2} />
                            </div>
                        </div>
                        <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                            Rs. {overall.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                            Rs. {overallTotalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="mt-1 text-[0.75rem] text-slate-400">Restocks + Wastage + Manual Expenses</p>
                    </div>

                    <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between">
                            <p className="text-[0.85rem] font-medium text-slate-500">Net Profit</p>
                            <div
                                className={`flex h-9 w-9 items-center justify-center rounded-full ${isProfitPositive ? "bg-[#7da3b3]/15 text-[#3f6274]" : "bg-rose-50 text-rose-600"
                                    }`}
                            >
                                {isProfitPositive ? (
                                    <TrendingUp className="h-4 w-4" strokeWidth={2} />
                                ) : (
                                    <TrendingDown className="h-4 w-4" strokeWidth={2} />
                                )}
                            </div>
                        </div>
                        <p
                            className={`mt-4 text-3xl font-semibold tracking-tight ${isProfitPositive ? "text-slate-900" : "text-rose-600"
                                }`}
                        >
                            Rs. {overallNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {/* Trend chart */}
                <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                <BarChart3 className="h-4 w-4" strokeWidth={2} />
                            </div>
                            <span className="text-[0.9rem] font-semibold text-[#345263]">Revenue vs Expense</span>
                            <span className="text-xs text-slate-400">
                                — {viewMode === "monthly" ? "By month" : viewMode === "yearly" ? "By year" : "All-time"}
                            </span>
                        </div>

                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-[#3f6274] disabled:opacity-50"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                            Refresh
                        </button>
                    </div>

                    {chartData.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
                            <BarChart3 className="h-8 w-8 opacity-20" />
                            <p className="text-xs font-medium">No data for this range.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#ffffff",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                    }}
                                    formatter={tooltipFormatter}
                                />
                                <Legend wrapperStyle={{ fontSize: "12px" }} />
                                <Bar dataKey="Revenue" fill="#3f6274" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Net Profit" fill="#7da3b3" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Detail table */}
                <div className="mt-8 space-y-4 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[0.9rem] font-semibold text-[#345263]">
                            <Receipt className="h-4 w-4 text-slate-400" strokeWidth={2} />
                            Breakdown
                        </div>
                        {tableRows.length > 0 && (
                            <span className="text-xs font-medium text-slate-400">
                                {tableRows.length} {viewMode === "monthly" ? "months" : viewMode === "yearly" ? "years" : "record"}
                            </span>
                        )}
                    </div>

                    {tableRows.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-400">No data for this range.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] border-collapse text-left">
                                <thead>
                                    <tr className="border-y border-slate-900/5 bg-slate-50/60">
                                        {["Period", "Revenue", "Purchase Exp.", "Wastage Exp.", "Manual Exp.", "Total Expense", "Net Profit"].map(
                                            (h, i) => (
                                                <th
                                                    key={h}
                                                    className={`px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-widest text-slate-500 ${i === 0 ? "text-left" : "text-right"
                                                        }`}
                                                >
                                                    {h}
                                                </th>
                                            )
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRows.map((row) => (
                                        <tr
                                            key={row.label}
                                            className="border-b border-slate-900/5 transition-colors last:border-b-0 hover:bg-[#7da3b3]/[0.04]"
                                        >
                                            <td className="px-4 py-3.5 text-[0.85rem] font-semibold text-slate-900">{row.label}</td>
                                            <td className="px-4 py-3.5 text-right text-[0.85rem] text-slate-700">
                                                Rs. {row.revenue.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3.5 text-right text-[0.85rem] text-slate-500">
                                                Rs. {row.purchaseExpense.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3.5 text-right text-[0.85rem] text-slate-500">
                                                Rs. {row.wastageExpense.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3.5 text-right text-[0.85rem] text-slate-500">
                                                Rs. {row.manualExpense.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3.5 text-right text-[0.85rem] font-semibold text-slate-700">
                                                Rs. {row.totalExpense.toFixed(2)}
                                            </td>
                                            <td
                                                className={`px-4 py-3.5 text-right text-[0.85rem] font-bold ${row.netProfit >= 0 ? "text-[#3f6274]" : "text-rose-600"
                                                    }`}
                                            >
                                                Rs. {row.netProfit.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tableRows.length > 0 && (
                        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:flex-row">
                            <span className="hidden text-sm text-slate-500 sm:block" />

                            <div className="flex w-full items-center justify-between gap-6 sm:w-auto">
                                <span className="text-[0.7rem] font-medium uppercase tracking-wider text-slate-400">
                                    Page {tablePage} of {tableTotalPages}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setTablePage((p) => Math.max(p - 1, 1))}
                                        disabled={tablePage === 1}
                                        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        title="Previous Page"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    {Array.from({ length: tableTotalPages }, (_, i) => i + 1).map((pageNum) => (
                                        <button
                                            key={pageNum}
                                            onClick={() => setTablePage(pageNum)}
                                            className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${tablePage === pageNum
                                                    ? "bg-[#7da3b3] text-white shadow-sm"
                                                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setTablePage((p) => Math.min(p + 1, tableTotalPages))}
                                        disabled={tablePage === tableTotalPages}
                                        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        title="Next Page"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}