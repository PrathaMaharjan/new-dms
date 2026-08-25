"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import axios from "axios";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  Users,
  CalendarCheck,
  Stethoscope,
  Inbox,
  TrendingUp,
  PieChart as PieChartIcon,
  Activity,
  CalendarDays,
  Sparkles,
  UserPlus,
  Clock3,
  CalendarClock,
  HeartPulse,
  Cross,
  Pill,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  Banknote,
  PackageX,
  X,
} from "lucide-react";

const PIE_COLORS = ["#7da3b3", "#10b981", "#6366f1", "#f59e0b", "#345263", "#ec4899", "#8b5cf6", "#06b6d4"];

type OutletStats = {
  outletId: string;
  totalPatients: number;
  appointmentsToday: number;
  activeDoctors: number;
  pendingRequests: number;
  revenueThisMonth: number;
};

type TrendPoint = { label: string; count: number };

type TreatmentItem = { name: string; value: number; color?: string };

type AppointmentItem = {
  id: string;
  outletId: string;
  patientName: string;
  doctorName: string;
  treatmentName: string;
  startTime: string;
  status: string;
};

type ActivityItem = {
  outletId: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
};

type LowStockItem = {
  id: string;
  name: string;
  unit: string;
  currentQty: number;
  reorderLevel: number;
  outletName: string;
};

const SOFT_DELETED_INVENTORY_KEY = "dms_soft_deleted_inventory_item_ids_v1";

function getSoftDeletedInventoryIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SOFT_DELETED_INVENTORY_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return { label: "Completed", class: "bg-[#7da3b3]/15 text-[#3f6274]" };
  if (s === "checked_in") return { label: "Checked In", class: "bg-[#345263] text-white" };
  if (s === "confirmed") return { label: "Confirmed", class: "bg-sky-100 text-sky-700" };
  if (s === "requested") return { label: "Pending", class: "bg-amber-100 text-amber-700" };
  if (s === "cancelled") return { label: "Cancelled", class: "bg-rose-100 text-rose-700" };
  return { label: status, class: "bg-slate-100 text-slate-700" };
}

function formatTime(timeStr: string) {
  if (!timeStr) return "-";
  const parts = timeStr.split("T");
  const timePart = parts.length > 1 ? parts[1].slice(0, 5) : parts[0].slice(0, 5);
  const [hStr, mStr] = timePart.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function getActivityIcon(type: string) {
  switch (type) {
    case "appointment_booked":
      return { icon: CalendarCheck, iconBg: "bg-emerald-100 text-emerald-700" };
    case "patient_registered":
      return { icon: UserPlus, iconBg: "bg-[#7da3b3]/20 text-[#3f6274]" };
    case "treatment_added":
      return { icon: Sparkles, iconBg: "bg-violet-100 text-violet-700" };
    case "schedule_updated":
      return { icon: Clock3, iconBg: "bg-amber-100 text-amber-700" };
    default:
      return { icon: Activity, iconBg: "bg-slate-100 text-slate-700" };
  }
}

function getRelativeTime(timestamp: string) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

function centsToDisplay(n: number) {
  return (n / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const ITEMS_PER_PAGE = 5;

export default function OrganizationDashboardPage() {
  const params = useParams<{ tenantSlug: string }>();
  const adminRoot = `/t/${params.tenantSlug}/admin`;

  const [outletFilter, setOutletFilter] = useState("all");
  const [timeframe, setTimeframe] = useState<"7d" | "14d" | "1m" | "1y">("14d");

  const [apptsPage, setApptsPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [outletsList, setOutletsList] = useState<{ id: string; name: string }[]>([]);

  const [stats, setStats] = useState({
    totalPatients: 0,
    appointmentsToday: 0,
    activeDoctors: 0,
    pendingRequests: 0,
  });

  const [registrationData, setRegistrationData] = useState<TrendPoint[]>([]);
  const [treatmentPopularity, setTreatmentPopularity] = useState<{ name: string; value: number; color: string }[]>([]);
  const [todaysAppointments, setTodaysAppointments] = useState<AppointmentItem[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [outletPerformance, setOutletPerformance] = useState<OutletStats[]>([]);

  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [lowStockBannerDismissed, setLowStockBannerDismissed] = useState(false);
  const [lowStockExpanded, setLowStockExpanded] = useState(false);

  useEffect(() => {
    async function fetchOutlets() {
      try {
        const res = await axios.get("/api/outlets");
        if (res.data?.success && Array.isArray(res.data?.data?.locations)) {
          const seen = new Set<string>();
          const mapped: { id: string; name: string }[] = [];
          res.data.data.locations.forEach((loc: any) => {
            if (loc.id && !seen.has(loc.id)) {
              seen.add(loc.id);
              mapped.push({
                id: loc.id,
                name: loc.name || loc.locationName || "Outlet",
              });
            }
          });
          setOutletsList(mapped);
        }
      } catch (err) { }
    }
    fetchOutlets();
  }, []);

  const loadDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const activeOutlets =
        outletFilter && outletFilter !== "all"
          ? outletsList.filter((o) => o.id === outletFilter)
          : outletsList;

      let aggPatients = 0;
      let aggApptsToday = 0;
      let aggActiveDoctors = 0;
      let aggPending = 0;

      const trendMap = new Map<string, number>();
      const trendLabelsOrder: string[] = [];

      const treatmentMap = new Map<string, number>();
      const combinedAppts: AppointmentItem[] = [];
      const combinedActivities: ActivityItem[] = [];
      const perfMap = new Map<string, OutletStats>();
      const combinedLowStock: LowStockItem[] = [];
      const deletedIds = getSoftDeletedInventoryIds();

      const outletsToFetch = outletsList.length > 0 ? outletsList : activeOutlets;

      await Promise.all(
        outletsToFetch.map(async (loc) => {
          const isLocActive = activeOutlets.length === 0 || activeOutlets.some((o) => o.id === loc.id);
          try {
            const [statsRes, trendRes, treatRes, apptsRes, actRes, billingRes, lowRes, invItemRes] = await Promise.all([
              axios.get(`/api/admin-dashboard/stats?locationId=${loc.id}`).catch(() => null),
              isLocActive ? axios.get(`/api/admin-dashboard/patent-trend?locationId=${loc.id}&range=${timeframe}`).catch(() => null) : null,
              isLocActive ? axios.get(`/api/admin-dashboard/treatmentPop?locationId=${loc.id}`).catch(() => null) : null,
              isLocActive ? axios.get(`/api/admin-dashboard/todays-appointments?locationId=${loc.id}`).catch(() => null) : null,
              isLocActive ? axios.get(`/api/admin-dashboard/activity-feed?locationId=${loc.id}&limit=10`).catch(() => null) : null,
              axios.get(`/api/admin-dashboard/billing?locationId=${loc.id}`).catch(() => null),
              isLocActive ? axios.get(`/api/inventory/low-stock?locationId=${loc.id}`).catch(() => null) : null,
              isLocActive ? axios.get(`/api/inventory/item?locationId=${loc.id}`).catch(() => null) : null,
            ]);

            const seenLowIds = new Set<string>();

            if (isLocActive && lowRes?.data?.success && Array.isArray(lowRes.data.data?.items)) {
              lowRes.data.data.items.forEach((it: any) => {
                if (!deletedIds.has(it.id) && !seenLowIds.has(it.id)) {
                  seenLowIds.add(it.id);
                  combinedLowStock.push({
                    id: it.id,
                    name: it.name,
                    unit: it.unit || "boxes",
                    currentQty: it.currentStock ?? 0,
                    reorderLevel: it.reorderThreshold ?? 0,
                    outletName: loc.name,
                  });
                }
              });
            }

            if (isLocActive && invItemRes?.data?.success && Array.isArray(invItemRes.data.data?.items)) {
              invItemRes.data.data.items.forEach((it: any) => {
                const stock = it.currentStock ?? 0;
                const threshold = it.reorderThreshold ?? 0;
                if (stock <= threshold && !deletedIds.has(it.id) && !seenLowIds.has(it.id)) {
                  seenLowIds.add(it.id);
                  combinedLowStock.push({
                    id: it.id,
                    name: it.name,
                    unit: it.unit || "boxes",
                    currentQty: stock,
                    reorderLevel: threshold,
                    outletName: loc.name,
                  });
                }
              });
            }

            if (statsRes?.data?.success && statsRes.data.data.stats) {
              const s = statsRes.data.data.stats;
              const rev = billingRes?.data?.success && billingRes.data.data.stats ? (billingRes.data.data.stats.totalCollectedCents ?? billingRes.data.data.stats.totalRevenueCents ?? 0) : 0;
              perfMap.set(loc.id, {
                outletId: loc.id,
                totalPatients: s.totalPatients ?? 0,
                appointmentsToday: s.appointmentsToday ?? 0,
                activeDoctors: s.activeDoctors ?? 0,
                pendingRequests: s.pendingRequests ?? 0,
                revenueThisMonth: rev,
              });

              if (isLocActive) {
                aggPatients += s.totalPatients ?? 0;
                aggApptsToday += s.appointmentsToday ?? 0;
                aggActiveDoctors += s.activeDoctors ?? 0;
                aggPending += s.pendingRequests ?? 0;
              }
            }

            if (isLocActive && trendRes?.data?.success && Array.isArray(trendRes.data.data.trend)) {
              trendRes.data.data.trend.forEach((item: any) => {
                if (!trendMap.has(item.label)) {
                  trendLabelsOrder.push(item.label);
                }
                trendMap.set(item.label, (trendMap.get(item.label) || 0) + (item.count ?? 0));
              });
            }

            if (isLocActive && treatRes?.data?.success && Array.isArray(treatRes.data.data.breakdown)) {
              treatRes.data.data.breakdown.forEach((t: any) => {
                const name = t.treatmentName || t.name;
                const val = t.count ?? t.value ?? 0;
                if (name && val > 0) {
                  treatmentMap.set(name, (treatmentMap.get(name) || 0) + val);
                }
              });
            }

            if (isLocActive && apptsRes?.data?.success && Array.isArray(apptsRes.data.data.appointments)) {
              apptsRes.data.data.appointments.forEach((a: any) => {
                combinedAppts.push({
                  id: a.id || String(Math.random()),
                  outletId: loc.id,
                  patientName: a.patientName || "Patient",
                  doctorName: a.doctorName || "Doctor",
                  treatmentName: a.treatmentName || "General Service",
                  startTime: a.startTime || "-",
                  status: a.status || "confirmed",
                });
              });
            }

            if (isLocActive && actRes?.data?.success && Array.isArray(actRes.data.data.activities)) {
              actRes.data.data.activities.forEach((act: any) => {
                combinedActivities.push({
                  outletId: loc.id,
                  type: act.type || "default",
                  title: act.title || "Activity Logged",
                  description: act.description || "",
                  timestamp: act.timestamp || new Date().toISOString(),
                });
              });
            }
          } catch (err) { }
        })
      );

      setStats({
        totalPatients: aggPatients,
        appointmentsToday: aggApptsToday,
        activeDoctors: aggActiveDoctors,
        pendingRequests: aggPending,
      });

      setRegistrationData(
        trendLabelsOrder.map((lbl) => ({
          label: lbl,
          count: trendMap.get(lbl) || 0,
        }))
      );

      const treatArray = Array.from(treatmentMap.entries()).map(([name, value], idx) => ({
        name,
        value,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }));
      setTreatmentPopularity(treatArray);

      setTodaysAppointments(combinedAppts);

      combinedActivities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setActivityFeed(combinedActivities);

      setOutletPerformance(Array.from(perfMap.values()));
      setLowStockItems(combinedLowStock);
    } catch (err) {
    } finally {
      setIsRefreshing(false);
    }
  }, [outletFilter, timeframe, outletsList]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const maxRevenue = Math.max(...outletPerformance.map((s) => s.revenueThisMonth), 1);

  const totalApptsPages = Math.max(1, Math.ceil(todaysAppointments.length / ITEMS_PER_PAGE));
  const paginatedAppts = todaysAppointments.slice(
    (apptsPage - 1) * ITEMS_PER_PAGE,
    apptsPage * ITEMS_PER_PAGE
  );

  const totalActivityPages = Math.max(1, Math.ceil(activityFeed.length / ITEMS_PER_PAGE));
  const paginatedActivity = activityFeed.slice(
    (activityPage - 1) * ITEMS_PER_PAGE,
    activityPage * ITEMS_PER_PAGE
  );

  function outletName(id: string) {
    return outletsList.find((o) => o.id === id)?.name ?? id;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">


      {/* Sticky Top Header */}
      <div className="sticky top-0 z-20 w-full border-b border-slate-100 bg-white px-6 py-6 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
            Organization Dashboard
          </h1>

          <div className="flex items-center gap-3">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <select
                value={outletFilter}
                onChange={(e) => {
                  setOutletFilter(e.target.value);
                  setApptsPage(1);
                  setActivityPage(1);
                }}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-[0.85rem] font-medium text-[#345263] shadow-sm outline-none focus:border-[#7da3b3]"
              >
                <option value="all">All Outlets</option>
                {outletsList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadDashboardData()}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#7da3b3] ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1600px] space-y-6 px-6 pb-10 pt-6 lg:px-10">
        {/* Low Stock Inventory Banner (static placeholder data) */}
        {!lowStockBannerDismissed && lowStockItems.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <PackageX className="h-4.5 w-4.5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-amber-900">
                    {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} running low across outlets
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setLowStockExpanded((v) => !v)}
                      className="text-xs font-semibold text-amber-700 hover:underline"
                    >
                      {lowStockExpanded ? "Hide details" : "View details"}
                    </button>
                    <button
                      onClick={() => setLowStockBannerDismissed(true)}
                      aria-label="Dismiss low stock banner"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {lowStockExpanded && (
              <div className="border-t border-amber-200 bg-white/60 px-4 py-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {lowStockItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`${adminRoot}/inventory?item=${item.id}`}
                      className="flex items-center justify-between rounded-xl border border-amber-100 bg-white px-3 py-2 transition-colors hover:border-amber-300 hover:bg-amber-50/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{item.name}</p>
                        <p className="text-[0.7rem] text-slate-500">
                          {item.currentQty} {item.unit}
                        </p>
                        <p className="truncate text-[0.65rem] text-slate-400">{item.outletName}</p>
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[0.65rem] font-bold text-rose-600">
                        Low
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top 4 Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Patients</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{stats.totalPatients.toLocaleString()}</p>
          </div>

          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Appointments</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <CalendarCheck className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {stats.appointmentsToday} <span className="text-xs font-medium text-slate-400">Today</span>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Doctors</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Stethoscope className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {stats.activeDoctors} <span className="text-xs font-medium text-slate-400">Staff</span>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Requests</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Inbox className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{stats.pendingRequests}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm lg:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/15 text-[#3f6274]">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">New Patient Registrations Trend</h3>
              </div>

              <div className="flex items-center gap-1 self-start rounded-xl bg-slate-100 p-1 sm:self-auto">
                {(["7d", "14d", "1m", "1y"] as const).map((tf) => {
                  const labels: Record<string, string> = { "7d": "7 Days", "14d": "14 Days", "1m": "1 Month", "1y": "1 Year" };
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold transition-colors ${timeframe === tf ? "bg-white text-[#345263] shadow-sm" : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                      {labels[tf]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative h-64 w-full pt-2">
              {registrationData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No registration data available for this timeframe.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={registrationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="patientGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7da3b3" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#7da3b3" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                        fontSize: "12px",
                      }}
                    />
                    <Area type="monotone" dataKey="count" name="New Patients" stroke="#7da3b3" strokeWidth={2.5} fillOpacity={1} fill="url(#patientGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm lg:col-span-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/15 text-[#345263]">
                <PieChartIcon className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Treatment Popularity</h3>
            </div>

            <div className="h-64 w-full">
              {treatmentPopularity.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No treatment data recorded.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={treatmentPopularity} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={3}>
                      {treatmentPopularity.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", color: "#64748b" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Outlet Performance */}
        <div className="space-y-4 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/15 text-[#3f6274]">
              <Building2 className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Outlet Performance This Month</h3>
          </div>

          {outletPerformance.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No outlets in this selection.</div>
          ) : (
            <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {outletPerformance.map((o) => (
                <div key={o.outletId} className="space-y-3 rounded-xl border border-slate-100 bg-[#f4fafc]/60 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="truncate text-xs font-bold text-slate-900">{outletName(o.outletId)}</h4>
                  </div>

                  <div className="flex items-center justify-between text-[0.7rem] font-medium text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {o.totalPatients} patients
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarCheck className="h-3 w-3" /> {o.appointmentsToday} today
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[0.7rem] font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <Banknote className="h-3 w-3" /> NPR {centsToDisplay(o.revenueThisMonth)}
                      </span>
                      <span>{o.activeDoctors} doctors</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#7da3b3] transition-all"
                        style={{ width: `${Math.min((o.revenueThisMonth / maxRevenue) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm lg:col-span-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/15 text-[#3f6274]">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Today's Appointments Across Outlets</h3>
              </div>
            </div>

            {todaysAppointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No appointments scheduled for today.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                        <th className="pb-3 pr-4">Patient</th>
                        <th className="pb-3 px-4">Outlet</th>
                        <th className="pb-3 px-4">Doctor</th>
                        <th className="pb-3 px-4">Service</th>
                        <th className="pb-3 px-4">Time</th>
                        <th className="pb-3 pl-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {paginatedAppts.map((apt) => {
                        const badge = getStatusBadge(apt.status);
                        return (
                          <tr key={apt.id} className="transition-colors hover:bg-slate-50/60">
                            <td className="py-3 pr-4 font-bold text-slate-900">{apt.patientName}</td>
                            <td className="py-3 px-4 text-slate-500">{outletName(apt.outletId)}</td>
                            <td className="py-3 px-4 font-medium text-slate-600">{apt.doctorName}</td>
                            <td className="py-3 px-4 text-slate-500">{apt.treatmentName}</td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{formatTime(apt.startTime)}</td>
                            <td className="py-3 pl-4 text-right">
                              <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold ${badge.class}`}>
                                {badge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Page {apptsPage} of {totalApptsPages}</span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={apptsPage <= 1}
                      onClick={() => setApptsPage((p) => Math.max(1, p - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      disabled={apptsPage >= totalApptsPages}
                      onClick={() => setApptsPage((p) => Math.min(totalApptsPages, p + 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm lg:col-span-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Activity className="h-4 w-4 text-[#7da3b3]" /> Recent Activity Feed
            </h3>

            {activityFeed.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No recent activity logged yet.</div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedActivity.map((act, index) => {
                    const { icon: Icon, iconBg } = getActivityIcon(act.type);
                    return (
                      <div key={`${act.type}-${index}`} className="flex gap-3 text-xs">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">{act.title}</p>
                          <p className="mt-0.5 text-[0.7rem] text-slate-400">{outletName(act.outletId)}</p>
                          <p className="mt-0.5 line-clamp-2 text-[0.75rem] text-slate-500">{act.description}</p>
                          <span className="text-[0.65rem] text-slate-400">{getRelativeTime(act.timestamp)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Page {activityPage} of {totalActivityPages}</span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={activityPage <= 1}
                      onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      disabled={activityPage >= totalActivityPages}
                      onClick={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}