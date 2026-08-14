"use client";

import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Search,
  Wallet,
  Receipt,
  TrendingUp,
  TrendingDown,
  Landmark,
  Building2,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  PieChart as PieChartIcon,
  BarChart3,
  Phone,
  Cross,
  HeartPulse,
  Activity,
  Percent,
  Calendar,
} from "lucide-react";

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  Cash: "#7da3b3",
  Card: "#345263",
  Wallet: "#10b981",
  QR: "#8b5cf6",
  Bank: "#f59e0b",
  cash: "#7da3b3",
  card: "#345263",
  wallet: "#10b981",
  qr: "#8b5cf6",
  bank: "#f59e0b",
};

function centsToDisplay(cents: number) {
  const value = Number.isFinite(cents) ? cents : 0;
  return (value / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
];

const LIST_GRID = "grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1.1fr] items-center gap-4";

export default function ManagerBillingPage() {
  const [outletFilter, setOutletFilter] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [outletsList, setOutletsList] = useState<{ id: string; name: string }[]>([]);
  const [collectionTimeframe, setCollectionTimeframe] = useState<"7d" | "1m" | "6m" | "1y" | "all">("7d");

  const [stats, setStats] = useState({
    totalRevenueCents: 0,
    totalCollectedCents: 0,
    outstandingDuesCents: 0,
    collectionRatePercent: 0,
  });
  const [collectionsChart, setCollectionsChart] = useState<{ label: string; amountCents: number }[]>([]);
  const [paymentMethodMix, setPaymentMethodMix] = useState<{ method: string; amountCents: number }[]>([]);
  const [outletPerformance, setOutletPerformance] = useState<{
    locationId: string;
    outletName: string;
    chargedCents: number;
    collectedCents: number;
    outstandingCents: number;
    collectionRatePercent: number;
  }[]>([]);
  const [doctorRevenue, setDoctorRevenue] = useState<{ doctorId: string; doctorName: string; revenueCents: number }[]>([]);
  const [outstandingPatients, setOutstandingPatients] = useState<{
    patientId: string;
    patientName: string;
    patientPhone: string | null;
    outletName: string;
    lastActivity: Date | string | null;
    chargedCents: number;
    paidCents: number;
    balanceCents: number;
  }[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);

  useEffect(() => {
    async function fetchOutlets() {
      try {
        const res = await axios.get("/api/outlets");
        if (res.data?.success && Array.isArray(res.data?.data?.locations)) {
          const seen = new Set<string>();
          const mappedOutlets: { id: string; name: string }[] = [];
          res.data.data.locations.forEach((loc: any) => {
            if (loc.id && !seen.has(loc.id)) {
              seen.add(loc.id);
              mappedOutlets.push({
                id: loc.id,
                name: loc.name || loc.locationName || "Outlet",
              });
            }
          });
          setOutletsList(mappedOutlets);
          if (mappedOutlets.length > 0) {
            setOutletFilter((prev) => (prev === "all" || !prev ? mappedOutlets[0].id : prev));
          }
        }
      } catch (err) { }
    }
    fetchOutlets();
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      try {
        const params = new URLSearchParams();
        if (outletFilter !== "all") {
          params.set("locationId", outletFilter);
        }
        params.set("chartRange", collectionTimeframe);
        if (query.trim()) {
          params.set("search", query.trim());
        }
        params.set("limit", String(itemsPerPage));
        params.set("offset", String((currentPage - 1) * itemsPerPage));

        const res = await axios.get(`/api/org/billing/getAll?${params.toString()}`);
        if (isMounted && res.data?.success && res.data?.data?.dashboard) {
          const d = res.data.data.dashboard;
          setStats(
            d.billingStats || {
              totalRevenueCents: 0,
              totalCollectedCents: 0,
              outstandingDuesCents: 0,
              collectionRatePercent: 0,
            }
          );
          setCollectionsChart(d.collectionsChart || []);
          setPaymentMethodMix(d.paymentMethodMix || []);
          setOutletPerformance(d.outletPerformance || []);
          setDoctorRevenue(d.revenueByDoctor || []);
          setOutstandingPatients(d.topOutstanding?.patients || []);
          setTotalOutstanding(d.topOutstanding?.pagination?.total || 0);
        }
      } catch (err) { }
    }
    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [outletFilter, collectionTimeframe, query, currentPage]);

  const chartData = useMemo(() => {
    return collectionsChart.map((item) => ({
      label: item.label,
      collected: item.amountCents / 100,
    }));
  }, [collectionsChart]);

  const maxDoctorRevenue = useMemo(() => {
    return Math.max(1, ...doctorRevenue.map((d) => d.revenueCents));
  }, [doctorRevenue]);

  const totalPages = Math.max(1, Math.ceil(totalOutstanding / itemsPerPage));

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const statCards = [
    {
      icon: Receipt,
      label: "Total Revenue",
      value: `NPR ${centsToDisplay(stats.totalRevenueCents)}`,
    },
    {
      icon: Wallet,
      label: "Total Collected",
      value: `NPR ${centsToDisplay(stats.totalCollectedCents)}`,
    },
    {
      icon: TrendingDown,
      label: "Outstanding Dues",
      value: `NPR ${centsToDisplay(stats.outstandingDuesCents)}`,
    },
    {
      icon: Percent,
      label: "Collection Rate",
      value: `${stats.collectionRatePercent.toFixed(1)}%`,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">


      <div className="sticky top-0 z-20 bg-white px-6 py-6 lg:px-10 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
              Billing Overview
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                strokeWidth={2}
              />
              <select
                value={collectionTimeframe}
                onChange={(e) => setCollectionTimeframe(e.target.value as any)}
                className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-[#7da3b3] shadow-sm"
              >
                <option value="7d">Last 7 Days</option>
                <option value="1m">Last 1 Month</option>
                <option value="6m">Last 6 Months</option>
                <option value="1y">Last 1 Year</option>
                <option value="all">All Time (Overall Business)</option>
              </select>
            </div>

            <div className="relative">
              <Building2
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                strokeWidth={2}
              />
              <select
                value={outletFilter}
                onChange={(e) => {
                  setOutletFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-[#7da3b3] shadow-sm"
              >
                {outletsList.map((o, idx) => (
                  <option key={`${o.id}-${idx}`} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
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

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#7da3b3]">
                  <BarChart3 className="h-4 w-4" strokeWidth={2} />
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Collections — {
                    collectionTimeframe === "7d"
                      ? "Last 7 Days"
                      : collectionTimeframe === "1m"
                        ? "Last 1 Month"
                        : collectionTimeframe === "6m"
                          ? "Last 6 Months"
                          : collectionTimeframe === "1y"
                            ? "Last 1 Year"
                            : "All Time (Overall Business)"
                  }
                </h3>
              </div>
              <select
                value={collectionTimeframe}
                onChange={(e) => setCollectionTimeframe(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-[#7da3b3]"
              >
                <option value="7d">7 Days</option>
                <option value="1m">1 Month</option>
                <option value="6m">6 Months</option>
                <option value="1y">1 Year</option>
                <option value="all">All Time (Overall Business)</option>
              </select>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orgCollectionsColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7da3b3" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7da3b3" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
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
                  <Tooltip
                    cursor={{ stroke: "#7da3b3", strokeWidth: 1, strokeDasharray: "4 4" }}
                    formatter={(value) => {
                      const amount = Number(value ?? 0);
                      return [`NPR ${amount.toLocaleString()}`, "Collected"];
                    }}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #cbd5e1",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                      fontSize: 12,
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Collected"
                    stroke="#345263"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#orgCollectionsColor)"
                    activeDot={{ r: 6, fill: "#345263", stroke: "#ffffff", strokeWidth: 2 }}
                  />
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
                Payment Method Mix
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodMix}
                    dataKey="amountCents"
                    nameKey="method"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {paymentMethodMix.map((entry) => (
                      <Cell
                        key={entry.method}
                        fill={PAYMENT_METHOD_COLORS[entry.method] || "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const amount = Number(value ?? 0);
                      return `NPR ${centsToDisplay(amount)}`;
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: "#64748b" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-900/5 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#7da3b3]">
                <Building2 className="h-4 w-4" strokeWidth={2} />
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Outlet Performance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 text-[0.72rem] font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Outlet</th>
                    <th className="px-5 py-3 font-medium">Charged</th>
                    <th className="px-5 py-3 font-medium">Collected</th>
                    <th className="px-5 py-3 font-medium">Outstanding</th>
                    <th className="px-5 py-3 font-medium">Collection Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/5">
                  {outletPerformance.map((o) => (
                    <tr key={o.locationId} className="text-[0.85rem]">
                      <td className="px-5 py-4 font-semibold text-slate-800">{o.outletName}</td>
                      <td className="px-5 py-4 text-slate-700">NPR {centsToDisplay(o.chargedCents)}</td>
                      <td className="px-5 py-4 text-slate-700">NPR {centsToDisplay(o.collectedCents)}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-[0.75rem] font-medium text-rose-700">
                          NPR {centsToDisplay(o.outstandingCents)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[0.75rem] font-medium text-emerald-700">
                          {o.collectionRatePercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {outletPerformance.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        No outlet performance data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/10 text-[#345263]">
                <Stethoscope className="h-4 w-4" strokeWidth={2} />
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Revenue by Doctor
              </h3>
            </div>
            <div className="space-y-4">
              {doctorRevenue.map((d) => {
                const pct = Math.round((d.revenueCents / maxDoctorRevenue) * 100);
                return (
                  <div key={d.doctorId || d.doctorName}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate pr-2 font-semibold text-slate-700">{d.doctorName}</span>
                      <span className="shrink-0 font-medium text-slate-400">
                        NPR {centsToDisplay(d.revenueCents)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#7da3b3] transition-all"
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {doctorRevenue.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">No doctor revenue recorded.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <TrendingUp className="h-4 w-4 rotate-180" strokeWidth={2} />
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Top Outstanding Patients
              </h3>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search patient, phone..."
                className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.85rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
              />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-900/5">
            <div className={`${LIST_GRID} hidden bg-slate-50 px-5 py-3 text-[0.72rem] font-medium uppercase tracking-wide text-slate-500 sm:grid`}>
              <span>Patient</span>
              <span>Phone</span>
              <span>Outlet</span>
              <span>Last Visit</span>
              <span>Amount Due</span>
              <span className="text-right">Status</span>
            </div>

            <div className="divide-y divide-slate-900/5">
              {outstandingPatients.map((p, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const lastVisitDisplay = p.lastActivity
                  ? new Date(p.lastActivity).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "-";
                return (
                  <div
                    key={p.patientId}
                    className={`${LIST_GRID} flex-wrap gap-y-3 bg-white px-5 py-4 transition-colors hover:bg-[#7da3b3]/[0.06] max-sm:flex`}
                  >
                    <div className="flex min-w-[10rem] items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold ${color}`}>
                        {getInitials(p.patientName)}
                      </div>
                      <p className="truncate text-[0.9rem] font-semibold text-slate-900">{p.patientName}</p>
                    </div>
                    <div className="min-w-[8rem] text-[0.85rem] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        {p.patientPhone || "-"}
                      </p>
                    </div>
                    <div className="min-w-[8rem] text-[0.8rem] text-slate-600 truncate">
                      {p.outletName ?? "—"}
                    </div>
                    <div className="min-w-[6rem] text-[0.85rem] text-slate-600">{lastVisitDisplay}</div>
                    <div className="text-[0.85rem] font-semibold text-slate-800">
                      NPR {centsToDisplay(p.balanceCents)}
                    </div>
                    <div className="flex justify-end">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[0.72rem] font-medium text-rose-700">
                        Due
                      </span>
                    </div>
                  </div>
                );
              })}

              {outstandingPatients.length === 0 && (
                <div className="bg-white py-16 text-center text-slate-500">
                  No outstanding balances match your filters.
                </div>
              )}
            </div>
          </div>

          {totalOutstanding > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
              <span className="text-[0.7rem] font-medium text-slate-500">
                Showing{" "}
                <strong className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</strong> to{" "}
                <strong className="text-slate-800">
                  {Math.min(currentPage * itemsPerPage, totalOutstanding)}
                </strong>{" "}
                of <strong className="text-slate-800">{totalOutstanding}</strong>
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${currentPage === pageNum
                        ? "bg-[#7da3b3] text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
