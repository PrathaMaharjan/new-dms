"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
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
  ArrowRight,
  Activity,
  CalendarDays,
  Sparkles,
  UserPlus,
  Clock3,
  CalendarClock,
  HeartPulse,
  Cross,
  Pill,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  PackageX,
  X,
} from "lucide-react";

interface AdminStats {
  totalPatients: number;
  appointmentsToday: number;
  activeDoctors: number;
  pendingRequests: number;
}

interface TrendPoint {
  label: string;
  count: number;
}

interface TreatmentPopularityItem {
  name: string;
  value: number;
  color: string;
}

interface DoctorUtilizationItem {
  doctorId: string;
  name: string;
  bookedSlots: number;
  openSlots: number;
  percentBooked: number;
}

interface TodaysAppointmentItem {
  id: string;
  patientName: string;
  doctorName: string;
  treatmentName: string;
  startTime: string;
  status: string;
}

interface ActivityItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

interface LowStockItem {
  id: string;
  name: string;
  unit: string;
  currentQty: number;
  reorderLevel: number;
}

const PIE_COLORS = ["#7da3b3", "#10b981", "#6366f1", "#f59e0b", "#345263", "#ec4899", "#8b5cf6", "#06b6d4"];


const STATIC_LOW_STOCK_ITEMS: LowStockItem[] = [
  { id: "inv-1", name: "Dental Anesthetic Cartridges", unit: "cartridges", currentQty: 8, reorderLevel: 25 },
  { id: "inv-2", name: "Disposable Gloves (M)", unit: "boxes", currentQty: 3, reorderLevel: 10 },
  { id: "inv-3", name: "Composite Resin", unit: "syringes", currentQty: 5, reorderLevel: 15 },
  { id: "inv-4", name: "Sterilization Pouches", unit: "packs", currentQty: 2, reorderLevel: 8 },
];

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return { label: "Completed", class: "bg-[#7da3b3]/15 text-[#3f6274]" };
  if (s === "in_progress" || s === "in progress") return { label: "In Progress", class: "bg-emerald-100 text-emerald-700" };
  if (s === "checked_in" || s === "checked in") return { label: "Checked In", class: "bg-[#345263] text-white" };
  if (s === "confirmed") return { label: "Confirmed", class: "bg-sky-100 text-sky-700" };
  if (s === "requested" || s === "scheduled") return { label: "Pending", class: "bg-amber-100 text-amber-700" };
  if (s === "cancelled") return { label: "Cancelled", class: "bg-rose-100 text-rose-700" };
  return { label: status, class: "bg-slate-100 text-slate-700" };
}

function formatTime(timeStr: string) {
  if (!timeStr) return "";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
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

function getRelativeTime(timestamp: string | Date) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return String(timestamp);
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

export default function AdminDashboardPage() {
  const params = useParams<{ tenantSlug: string }>();
  const adminRoot = `/t/${params.tenantSlug}/admin`;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [timeframe, setTimeframe] = useState<"7d" | "14d" | "1m" | "1y">("14d");
  const [trendLoading, setTrendLoading] = useState(false);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [registrationData, setRegistrationData] = useState<TrendPoint[]>([]);
  const [treatmentPopularity, setTreatmentPopularity] = useState<TreatmentPopularityItem[]>([]);
  const [doctorUtilization, setDoctorUtilization] = useState<DoctorUtilizationItem[]>([]);
  const [todaysAppointments, setTodaysAppointments] = useState<TodaysAppointmentItem[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);


  const [lowStockItems] = useState<LowStockItem[]>(STATIC_LOW_STOCK_ITEMS);
  const [lowStockBannerDismissed, setLowStockBannerDismissed] = useState(false);
  const [lowStockExpanded, setLowStockExpanded] = useState(false);

  const [apptsPage, setApptsPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const totalApptsPages = Math.max(1, Math.ceil(todaysAppointments.length / ITEMS_PER_PAGE));
  const paginatedAppts = useMemo(() => {
    const start = (apptsPage - 1) * ITEMS_PER_PAGE;
    return todaysAppointments.slice(start, start + ITEMS_PER_PAGE);
  }, [todaysAppointments, apptsPage]);

  const totalActivityPages = Math.max(1, Math.ceil(activityFeed.length / ITEMS_PER_PAGE));
  const paginatedActivity = useMemo(() => {
    const start = (activityPage - 1) * ITEMS_PER_PAGE;
    return activityFeed.slice(start, start + ITEMS_PER_PAGE);
  }, [activityFeed, activityPage]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      let currentLocId = locationId;
      if (!currentLocId) {
        const [servicesRes, treatmentsRes, patientsRes] = await Promise.all([
          axios.get("/api/services").catch(() => null),
          axios.get("/api/treatment").catch(() => null),
          axios.get("/api/patent").catch(() => null),
        ]);

        if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
          currentLocId = servicesRes.data.data.services[0].locationId;
        } else if (treatmentsRes?.data?.success && treatmentsRes.data.data.treatments?.length > 0) {
          currentLocId = treatmentsRes.data.data.treatments[0].locationId;
        } else if (patientsRes?.data?.success && patientsRes.data.data.patients?.length > 0) {
          currentLocId = patientsRes.data.data.patients[0].locationId;
        }

        if (currentLocId) {
          setLocationId(currentLocId);
        }
      }

      if (!currentLocId) {
        setErrorMsg("No clinic location found for this account.");
        setLoading(false);
        return;
      }

      const [
        statsRes,
        trendRes,
        treatmentRes,
        utilizationRes,
        appointmentsRes,
        activityRes,
      ] = await Promise.all([
        axios.get("/api/admin-dashboard/stats", { params: { locationId: currentLocId } }).catch(() => null),
        axios.get("/api/admin-dashboard/patent-trend", { params: { locationId: currentLocId, range: timeframe } }).catch(() => null),
        axios.get("/api/admin-dashboard/treatmentPop", { params: { locationId: currentLocId } }).catch(() => null),
        axios.get("/api/admin-dashboard/doctor-utilization", { params: { locationId: currentLocId } }).catch(() => null),
        axios.get("/api/admin-dashboard/todays-appointments", { params: { locationId: currentLocId } }).catch(() => null),
        axios.get("/api/admin-dashboard/activity-feed", { params: { locationId: currentLocId, limit: 10 } }).catch(() => null),
      ]);

      if (statsRes?.data?.success && statsRes.data.data?.stats) {
        setStats(statsRes.data.data.stats);
      }
      if (trendRes?.data?.success && trendRes.data.data?.trend) {
        setRegistrationData(trendRes.data.data.trend);
      }
      if (treatmentRes?.data?.success && treatmentRes.data.data?.breakdown) {
        const formatted = treatmentRes.data.data.breakdown.map((item: any, idx: number) => ({
          name: item.treatmentName,
          value: item.count,
          color: PIE_COLORS[idx % PIE_COLORS.length],
        }));
        setTreatmentPopularity(formatted);
      }
      if (utilizationRes?.data?.success && utilizationRes.data.data?.doctors) {
        setDoctorUtilization(utilizationRes.data.data.doctors);
      }
      if (appointmentsRes?.data?.success && appointmentsRes.data.data?.appointments) {
        setTodaysAppointments(appointmentsRes.data.data.appointments);
      }
      if (activityRes?.data?.success && activityRes.data.data?.activities) {
        setActivityFeed(activityRes.data.data.activities);
      }
    } catch (err: any) {
      console.error("Failed to load admin dashboard data:", err);
      setErrorMsg(err?.response?.data?.error || "Failed to load dashboard data from server.");
    } finally {
      setLoading(false);
    }
  }, [locationId, timeframe]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleTimeframeChange = async (newRange: "7d" | "14d" | "1m" | "1y") => {
    setTimeframe(newRange);
    if (!locationId) return;

    try {
      setTrendLoading(true);
      const res = await axios.get("/api/admin-dashboard/patent-trend", {
        params: { locationId, range: newRange },
      });
      if (res?.data?.success && res.data.data?.trend) {
        setRegistrationData(res.data.data.trend);
      }
    } catch (err) {
      console.error("Failed to update patient trend range:", err);
    } finally {
      setTrendLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex items-center gap-3 text-[#345263]">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Loading admin dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">


      {/* Sticky Top Header */}
      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10 border-b border-slate-100">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl flex items-center gap-2.5">
            Dashboard
          </h1>
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#7da3b3]" /> Refresh
          </button>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10 space-y-6">
        {/* Error Banner if any */}
        {errorMsg && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

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
                    {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} running low on stock
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
                <p className="mt-0.5 text-xs text-amber-700">
                  {lowStockItems
                    .slice(0, 3)
                    .map((i) => i.name)
                    .join(", ")}
                  {lowStockItems.length > 3 ? `, and ${lowStockItems.length - 3} more` : ""} —
                  reorder soon to avoid disruption.
                </p>
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
                          {item.currentQty} / {item.reorderLevel} {item.unit}
                        </p>
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
          {/* Total Patients */}
          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Patients
              </p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <p className="text-2xl font-bold text-slate-900">
                {(stats?.totalPatients ?? 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Appointments Today */}
          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Appointments
              </p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <CalendarCheck className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <p className="text-2xl font-bold text-slate-900">
                {stats?.appointmentsToday ?? 0} <span className="text-xs font-medium text-slate-400">Today</span>
              </p>
            </div>
          </div>

          {/* Active Doctors */}
          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Doctors
              </p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Stethoscope className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <p className="text-2xl font-bold text-slate-900">
                {stats?.activeDoctors ?? 0} <span className="text-xs font-medium text-slate-400">Staff</span>
              </p>
            </div>
          </div>

          {/* Pending Requests */}
          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Pending Requests
              </p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Inbox className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <p className="text-2xl font-bold text-slate-900">
                {stats?.pendingRequests ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Main Charts Section */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* New Patient Registrations Trend (Chart) */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/15 text-[#3f6274]">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">New Patient Registrations Trend</h3>
                </div>
              </div>

              {/* Timeframe Selectors */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                {(["7d", "14d", "1m", "1y"] as const).map((tf) => {
                  const labels: Record<string, string> = {
                    "7d": "7 Days",
                    "14d": "14 Days",
                    "1m": "1 Month",
                    "1y": "1 Year",
                  };
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => handleTimeframeChange(tf)}
                      disabled={trendLoading}
                      className={`px-2.5 py-1 text-[0.7rem] font-semibold rounded-lg transition-colors ${timeframe === tf
                        ? "bg-white text-[#345263] shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                      {labels[tf]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-64 w-full pt-2 relative">
              {trendLoading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                  <Loader2 className="h-5 w-5 animate-spin text-[#7da3b3]" />
                </div>
              )}
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

          {/* Treatment Popularity (Chart) */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/15 text-[#345263]">
                <PieChartIcon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Treatment Popularity</h3>
              </div>
            </div>

            <div className="h-64 w-full">
              {treatmentPopularity.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No treatment data recorded.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={treatmentPopularity}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {treatmentPopularity.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", color: "#64748b" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Doctor Utilization Section */}
        <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/15 text-[#3f6274]">
                <Stethoscope className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Doctor Utilization & Open Slots</h3>
              </div>
            </div>
            <Link
              href={`${adminRoot}/doctors`}
              className="flex items-center gap-1 text-xs font-semibold text-[#7da3b3] hover:underline"
            >
              Manage Doctors <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {doctorUtilization.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No clinical doctors found for this location.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              {doctorUtilization.map((doc) => (
                <div key={doc.doctorId || doc.name} className="p-4 rounded-xl border border-slate-100 bg-[#f4fafc]/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{doc.name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold ${doc.percentBooked >= 90
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : doc.percentBooked >= 60
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-sky-50 text-sky-700 border border-sky-200"
                        }`}
                    >
                      {doc.percentBooked}% Booked
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[0.7rem] text-slate-500 font-medium">
                      <span>{doc.bookedSlots} Booked Slots</span>
                      <span>{doc.openSlots} Open Slots</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden flex">
                      <div
                        className="h-full bg-[#7da3b3] rounded-full transition-all"
                        style={{ width: `${Math.min(doc.percentBooked, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Grid: Today's Appointments Table + Activity Feed */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Today's Appointments (Across All Doctors Table) */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/15 text-[#3f6274]">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Today's Appointments Across Doctors</h3>
                </div>
              </div>
              <Link
                href={`${adminRoot}/appointments`}
                className="flex items-center gap-1 text-xs font-semibold text-[#7da3b3] hover:underline"
              >
                View All Appointments <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {todaysAppointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No appointments scheduled for today.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                        <th className="pb-3 pr-4">Patient</th>
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
                          <tr key={apt.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 pr-4 font-bold text-slate-900">{apt.patientName}</td>
                            <td className="py-3 px-4 text-slate-600 font-medium">{apt.doctorName}</td>
                            <td className="py-3 px-4 text-slate-500">{apt.treatmentName}</td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{formatTime(apt.startTime)}</td>
                            <td className="py-3 pl-4 text-right">
                              <span className={`px-2.5 py-1 rounded-full text-[0.65rem] font-bold ${badge.class}`}>
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

          {/* Sidebar Widget: Recent Activity Feed */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#7da3b3]" /> Recent Activity Feed
            </h3>

            {activityFeed.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No recent activity logged yet.
              </div>
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
                          <p className="text-[0.75rem] text-slate-500 line-clamp-2 mt-0.5">{act.description}</p>
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