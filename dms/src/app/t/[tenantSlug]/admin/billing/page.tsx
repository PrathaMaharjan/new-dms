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
  Sparkles,
} from "lucide-react";

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  Cash: "#7da3b3",
  cash: "#7da3b3",
  Card: "#345263",
  card: "#345263",
  Wallet: "#10b981",
  wallet: "#10b981",
  Online: "#38bdf8",
  online: "#38bdf8",
};

type OutstandingPatient = {
  id: string;
  name: string;
  phone: string;
  chargedCents: number;
  paidCents: number;
  lastVisit: string; // display-ready label
};

/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

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

const LIST_GRID = "grid grid-cols-[1.8fr_1.1fr_1fr_0.9fr_0.9fr_0.9fr_1fr] items-center gap-4";

export default function ManagerBillingPage() {
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [outstandingPatientsList, setOutstandingPatientsList] = useState<OutstandingPatient[]>([]);
  const [adminStats, setAdminStats] = useState<{ chargedCents: number; collectedCents: number; outstandingCents: number; collectionRate: number } | null>(null);
  const [barchartData, setBarchartData] = useState<{ label: string; collected: number }[]>([]);
  const [piechartData, setPiechartData] = useState<{ method: string; amountCents: number }[]>([]);
  const [doctorRevenueData, setDoctorRevenueData] = useState<{ name: string; revenueCents: number; pct: number }[]>([]);
  const [adminOutletName, setAdminOutletName] = useState<string>("");
  const [collectionTimeframe, setCollectionTimeframe] = useState<"7d" | "1m" | "6m" | "1y" | "all">("7d");

  useEffect(() => {
    async function loadAdminLocationAndBilling() {
      try {
        const [outletsRes, servicesRes, treatmentsRes, patientsRes] = await Promise.all([
          axios.get("/api/outlets").catch(() => null),
          axios.get("/api/services").catch(() => null),
          axios.get("/api/treatment").catch(() => null),
          axios.get("/api/patent").catch(() => null),
        ]);

        let targetLocId = "";
        let targetName = "";
        if (outletsRes?.data?.success && Array.isArray(outletsRes.data.data.locations) && outletsRes.data.data.locations.length > 0) {
          targetLocId = outletsRes.data.data.locations[0].id;
          targetName = outletsRes.data.data.locations[0].name || outletsRes.data.data.locations[0].locationName || "";
        }

        if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
          targetLocId = servicesRes.data.data.services[0].locationId || targetLocId;
        } else if (treatmentsRes?.data?.success && treatmentsRes.data.data.treatments?.length > 0) {
          targetLocId = treatmentsRes.data.data.treatments[0].locationId || targetLocId;
        } else if (patientsRes?.data?.success && patientsRes.data.data.patients?.length > 0) {
          targetLocId = patientsRes.data.data.patients[0].locationId || targetLocId;
        }

        if (targetLocId) {
          setAdminOutletName(targetName);
          const rangeParam = collectionTimeframe;
          const [statsRes, chartRes, pieRes, doctorRes, topPatientsRes, patientsDetailRes] = await Promise.all([
            axios.get(`/api/admin-dashboard/billing?locationId=${targetLocId}`).catch(() => null),
            axios.get(`/api/admin-dashboard/billing/barchart?locationId=${targetLocId}&range=${rangeParam}`).catch(() => null),
            axios.get(`/api/admin-dashboard/billing/piecart?locationId=${targetLocId}`).catch(() => null),
            axios.get(`/api/admin-dashboard/billing/doctor-revenue?locationId=${targetLocId}`).catch(() => null),
            axios.get(`/api/admin-dashboard/billing/top-patent?locationId=${targetLocId}`).catch(() => null),
            axios.get(`/api/billing/patentDetail?locationId=${targetLocId}`).catch(() => null),
          ]);

          if (statsRes?.data?.success && statsRes.data.data.stats) {
            const s = statsRes.data.data.stats;
            setAdminStats({
              chargedCents: s.totalRevenueCents ?? 0,
              collectedCents: s.totalCollectedCents ?? 0,
              outstandingCents: s.outstandingDuesCents ?? 0,
              collectionRate: s.collectionRatePercent ?? 0,
            });
          }
          if (chartRes?.data?.success && Array.isArray(chartRes.data.data.chart)) {
            setBarchartData(
              chartRes.data.data.chart.map((item: any) => ({
                label: item.label,
                collected: (item.amountCents ?? 0) / 100,
              }))
            );
          }
          if (pieRes?.data?.success && Array.isArray(pieRes.data.data.breakdown)) {
            setPiechartData(pieRes.data.data.breakdown);
          }
          if (doctorRes?.data?.success && Array.isArray(doctorRes.data.data.doctors)) {
            const apiDocs = doctorRes.data.data.doctors;
            const maxRev = Math.max(1, ...apiDocs.map((d: any) => d.revenueCents ?? 0));
            setDoctorRevenueData(
              apiDocs.map((d: any) => ({
                name: d.doctorName || d.name || "Doctor",
                revenueCents: d.revenueCents ?? 0,
                pct: Math.round(((d.revenueCents ?? 0) / maxRev) * 100),
              }))
            );
          }

          const rawPatients = topPatientsRes?.data?.success && Array.isArray(topPatientsRes.data.data.patients)
            ? topPatientsRes.data.data.patients
            : (patientsDetailRes?.data?.success && Array.isArray(patientsDetailRes.data.data.patients) ? patientsDetailRes.data.data.patients : []);

          if (rawPatients.length > 0) {
            const mappedPatients: OutstandingPatient[] = rawPatients.map((p: any) => ({
              id: p.patientId || p.id,
              name: p.patientName || `${p.firstName || ""}`.trim(),
              phone: p.patientPhone || p.phone || "-",
              chargedCents: p.chargedCents ?? 0,
              paidCents: p.paidCents ?? 0,
              lastVisit: p.lastActivity ? new Date(p.lastActivity).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent",
            }));
            setOutstandingPatientsList(mappedPatients);
          }
        }
      } catch (err) {
      }
    }
    loadAdminLocationAndBilling();
  }, [collectionTimeframe]);

  const totals = useMemo(() => {
    return (
      adminStats ?? {
        chargedCents: 0,
        collectedCents: 0,
        outstandingCents: 0,
        collectionRate: 0,
      }
    );
  }, [adminStats]);

  const weeklyTrend = barchartData;
  const paymentBreakdown = piechartData;
  const doctorRevenue = doctorRevenueData;

  const filteredOutstanding = useMemo(() => {
    const q = query.trim().toLowerCase();
    return outstandingPatientsList
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q))
      .sort((a, b) => (b.chargedCents - b.paidCents) - (a.chargedCents - a.paidCents));
  }, [query, outstandingPatientsList]);

  const totalPages = Math.max(1, Math.ceil(filteredOutstanding.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOutstanding = filteredOutstanding.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const stats = [
    {
      icon: Receipt,
      label: "Total Revenue",
      value: `NPR ${centsToDisplay(totals.chargedCents)}`,
    },
    {
      icon: Wallet,
      label: "Total Collected",
      value: `NPR ${centsToDisplay(totals.collectedCents)}`,
    },
    {
      icon: TrendingDown,
      label: "Outstanding Dues",
      value: `NPR ${centsToDisplay(totals.outstandingCents)}`,
    },
    {
      icon: Percent,
      label: "Collection Rate",
      value: `${totals.collectionRate.toFixed(1)}%`,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">


      <div className="sticky top-0 z-20 flex w-full flex-col gap-4 bg-white px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10 shadow-sm">
        <div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
            Billing Overview
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
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
              {weeklyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminCollectionsColor" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#adminCollectionsColor)"
                      activeDot={{ r: 6, fill: "#345263", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  No collection data available.
                </div>
              )}
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
              {paymentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="amountCents"
                      nameKey="method"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {paymentBreakdown.map((entry) => (
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
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  No payment data available.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Revenue by doctor */}
        <div className="mt-8 rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/10 text-[#345263]">
              <Stethoscope className="h-4 w-4" strokeWidth={2} />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Revenue by Doctor
            </h3>
          </div>
          {doctorRevenue.length > 0 ? (
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctorRevenue.map((d) => (
                <div key={d.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate pr-2 font-semibold text-slate-700">{d.name}</span>
                    <span className="shrink-0 font-medium text-slate-400">
                      NPR {centsToDisplay(d.revenueCents)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#7da3b3] transition-all"
                      style={{ width: `${Math.max(d.pct, 8)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">
              No doctor revenue data available.
            </div>
          )}
        </div>

        {/* Top outstanding patients */}
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
              <span>Charged</span>
              <span>Paid</span>
              <span>Balance</span>
            </div>

            <div className="divide-y divide-slate-900/5">
              {paginatedOutstanding.map((p, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const balanceCents = p.chargedCents - p.paidCents;
                const isSettled = balanceCents <= 0;
                return (
                  <div
                    key={p.id}
                    className={`${LIST_GRID} flex-wrap gap-y-3 bg-white px-5 py-4 transition-colors hover:bg-[#7da3b3]/[0.06] max-sm:flex`}
                  >
                    <div className="flex min-w-[10rem] items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold ${color}`}>
                        {getInitials(p.name)}
                      </div>
                      <p className="truncate text-[0.9rem] font-semibold text-slate-900">{p.name}</p>
                    </div>
                    <div className="min-w-[8rem] text-[0.85rem] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        {p.phone}
                      </p>
                    </div>
                    <div className="min-w-[8rem] text-[0.8rem] text-slate-600 truncate">
                      {adminOutletName || "—"}
                    </div>
                    <div className="min-w-[6rem] text-[0.85rem] text-slate-600">{p.lastVisit}</div>
                    <div className="min-w-[6rem] text-[0.85rem] text-slate-700">
                      NPR {centsToDisplay(p.chargedCents)}
                    </div>
                    <div className="min-w-[6rem] text-[0.85rem] text-slate-700">
                      NPR {centsToDisplay(p.paidCents)}
                    </div>
                    <div className="min-w-[7rem]">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-medium ${isSettled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                          }`}
                      >
                        {isSettled
                          ? "NPR 0 settled"
                          : `NPR ${centsToDisplay(balanceCents)} due`}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredOutstanding.length === 0 && (
                <div className="bg-white py-16 text-center text-slate-500">
                  No outstanding balances match your filters.
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {filteredOutstanding.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
              <span className="text-[0.7rem] font-medium text-slate-500">
                Showing{" "}
                <strong className="text-slate-800">{startIndex + 1}</strong> to{" "}
                <strong className="text-slate-800">
                  {Math.min(startIndex + itemsPerPage, filteredOutstanding.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filteredOutstanding.length}</strong>
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