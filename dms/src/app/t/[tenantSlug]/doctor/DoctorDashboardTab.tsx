"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";

import {
  BarChart,
  Bar,
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
  CalendarCheck,
  CheckCircle2,
  CalendarClock,
  Users,
  Clock,
  User,
  Phone,
  Stethoscope,
  ArrowRight,
  StickyNote,
  History,
  TrendingUp,
  UserRoundCheck,
  PieChart as PieChartIcon,
  Loader2,
  AlertCircle,
  Wallet,
  Receipt,
  TrendingDown,
} from "lucide-react";
import { useWorkloadThresholds } from "@/lib/hooks/workload";
import { getWorkloadStatus, WORKLOAD_DISPLAY, WORKLOAD_ICON } from "@/lib/workload";
import CommissionStatCard from "./components/commission";

const STATUS_COLORS: Record<string, string> = {
  Confirmed: "#7da3b3",
  "Checked In": "#10b981",
  Completed: "#64748b",
  "No-Show": "#f43f5e",
  Cancelled: "#cbd5e1",
};

const STATUS_NAME_MAP: Record<string, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked In",
  completed: "Completed",
  no_show: "No-Show",
  cancelled: "Cancelled",
};

// ADDED - maps this component's display-friendly timeframe labels to the
// backend's real range vocabulary ("7d"/"1m"/"1y"), same values
// getAppointmentTrend/getDoctorDashboardFull actually expect.
const TIMEFRAME_TO_RANGE: Record<"7days" | "30days" | "1year", "7d" | "1m" | "1y"> = {
  "7days": "7d",
  "30days": "1m",
  "1year": "1y",
};

interface DoctorDashboardData {
  stats: {
    appointmentsToday: number;
    completedToday: number;
    upcomingThisWeek: number;
    activePatients: number;
  };
  todayStatus: { status: string; count: number }[];
  appointmentTrend: { label: string; count: number }[]; // CHANGED - was last7Days; now genuinely range-flexible, matching the backend field rename
  upNext: {
    id: string;
    patientName: string;
    patientPhone: string | null;
    treatmentName: string;
    startTime: string;
    notes: string | null;
  } | null;
  todaysSchedule: {
    id: string;
    patientName: string;
    treatmentName: string;
    startTime: string;
    status: string;
  }[];
  recentPatients: {
    patientId: string;
    patientName: string;
    treatmentName: string;
    date: string;
  }[];
}

const HARDCODED_BILLING_SNAPSHOT = {
  collectedTodayCents: 2650000,
  outstandingDuesCents: 7420000,
  patientsWithDues: 4,
};

function centsToDisplay(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function DoctorDashboardTab({
  onNavigate,
}: {
  onNavigate?: (
    tab: "schedule" | "patients" | "availability" | "settings",
  ) => void;
}) {

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState<string>("");
  const [activeLocId, setActiveLocId] = useState<string | null>(null);
  const [dashboardData, setDashboardData] =
    useState<DoctorDashboardData | null>(null);
  const { thresholds } = useWorkloadThresholds(activeLocId);

  // ADDED - lives here (not inside loadData) so the timeframe select can
  // read/write it directly, same as before.
const [appointmentTimeframe, setAppointmentTimeframe] = useState<
  "7days" | "30days" | "1year"
>("7days");

  const loadDoctorProfile = useCallback(async () => {
    try {
      const res = await axios.get("/api/user-details");
      if (res?.data?.success) {
        setDoctorName(res.data.data.user.name ?? "");
      }
    } catch (error) {
      console.error("Failed to load doctor profile:", error);
      setDoctorName("");
    }
  }, []);

  // CHANGED - now accepts a timeframe and passes the mapped range to the
  // backend call, instead of always fetching a fixed 7-day window.
  const loadData = useCallback(async (timeframe: "7days" | "30days" | "1year") => {
    try {
      setLoading(true);
      setErrorMsg(null);

      let locationId: string | null = null;

      try {
        const savedLoc =
          localStorage.getItem("dms_location_id") ||
          localStorage.getItem("current_location_id") ||
          localStorage.getItem("locationId");
        if (savedLoc) locationId = savedLoc;
      } catch (e) { }


      if (!locationId) {
        const [outletsRes, doctorRes, servicesRes, treatmentsRes, patientsRes, apptsRes] =
          await Promise.all([
            axios.get("/api/outlets").catch(() => null),
            axios.get("/api/doctor").catch(() => null),
            axios.get("/api/services").catch(() => null),
            axios.get("/api/treatment").catch(() => null),
            axios.get("/api/patent").catch(() => null),
            axios.get("/api/appoments").catch(() => null),
          ]);

        locationId =
          outletsRes?.data?.data?.locations?.[0]?.id ||
          outletsRes?.data?.data?.outlets?.[0]?.id ||
          (Array.isArray(outletsRes?.data?.data) ? outletsRes?.data?.data?.[0]?.id : null) ||
          doctorRes?.data?.data?.doctors?.[0]?.locationId ||
          servicesRes?.data?.data?.services?.[0]?.locationId ||
          treatmentsRes?.data?.data?.treatments?.[0]?.locationId ||
          patientsRes?.data?.data?.patients?.[0]?.locationId ||
          apptsRes?.data?.data?.appointments?.[0]?.locationId ||
          null;
      }

      if (locationId) {
        setActiveLocId(locationId);
        try {
          localStorage.setItem("dms_location_id", locationId);
        } catch (e) { }
      }

      if (!locationId) {
        setErrorMsg("No clinic location found. Please ensure a clinic location exists.");
        setLoading(false);
        return;
      }

      const res = await axios.get("/api/doctor/Dashboard/homePage/getAll", {
        params: {
          locationId,
          trendRange: TIMEFRAME_TO_RANGE[timeframe], // ADDED
        },
      });

      if (res?.data?.success && res.data.data?.dashboard) {
        setDashboardData(res.data.data.dashboard);
      } else {
        setErrorMsg(
          res?.data?.error || "Failed to load doctor dashboard data.",
        );
      }
    } catch (err: any) {
      console.error("Failed to load doctor dashboard data:", err);
      setErrorMsg(
        err?.response?.data?.error ||
        "Failed to load dashboard data from server.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // CHANGED - loadData now runs whenever appointmentTimeframe changes
  // (including the initial mount), instead of running once with no
  // timeframe argument.
  useEffect(() => {
    loadData(appointmentTimeframe);
  }, [appointmentTimeframe, loadData]);

  useEffect(() => {
    loadDoctorProfile();
  }, [loadDoctorProfile]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const stats = dashboardData?.stats || {
    appointmentsToday: 0,
    completedToday: 0,
    upcomingThisWeek: 0,
    activePatients: 0,
  };

  const statusBreakdown = useMemo(() => {
    if (!dashboardData?.todayStatus) return [];
    return dashboardData.todayStatus
      .map((s) => ({
        name: STATUS_NAME_MAP[s.status] || s.status,
        value: s.count,
      }))
      .filter((item) => item.value > 0);
  }, [dashboardData]);

  // CHANGED - completely replaces the old hardcoded-branches version.
  // Now just reads whatever the backend actually returned for the
  // currently-selected range - no fake arrays, no client-side switching.
  const weeklyTrend = useMemo(() => {
    if (!dashboardData?.appointmentTrend) return [];
    return dashboardData.appointmentTrend;
  }, [dashboardData]);

  const upNext = dashboardData?.upNext || null;
  const todaysSchedule = dashboardData?.todaysSchedule || [];
  const recentPatients = dashboardData?.recentPatients || [];

  return (
    <div className="w-full py-6">
      <div className="space-y-6 w-full">
        {errorMsg && (
          <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        <div className="flex w-full justify-start">
          {!loading &&
            (() => {
              const status = getWorkloadStatus(
                stats.appointmentsToday,
                thresholds,
              );
              const display = WORKLOAD_DISPLAY[status];
              const StatusIcon = WORKLOAD_ICON[status];

              return (
                <div
                  className={`flex items-center gap-3 rounded-xl  py-3 pl-4 pr-5 shadow-sm ${display.bgColor}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 ${display.textColor}`}
                  >
                    <StatusIcon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <p className="text-sm text-slate-700">
                    {greeting}
                    {doctorName ? `, ${doctorName}` : ", Doctor"}
                    <span className="text-slate-400"> &mdash; </span>
                    <span className={`font-semibold ${display.textColor}`}>
                      {display.label}
                    </span>
                    <span className="text-slate-500">
                      , {stats.appointmentsToday} appointments today
                    </span>
                  </p>
                </div>
              );
            })()}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2 shadow-lg backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
            <span>Loading dashboard...</span>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Appointments Today
                  </p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#7da3b3]">
                    <CalendarCheck className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.appointmentsToday}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Completed Today
                  </p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.completedToday}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Upcoming This Week
                  </p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/10 text-[#345263]">
                    <CalendarClock className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.upcomingThisWeek}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Active Patients
                  </p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <Users className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.activePatients}
                </p>
              </div>

              <CommissionStatCard />
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Weekly Trend */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-900/5 bg-white/90 p-6 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#7da3b3]">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Your Appointments (
                      {appointmentTimeframe === "7days"
                        ? "7 Days"
                        : appointmentTimeframe === "30days"
                          ? "30 Days"
                          : "1 Year"}
                      )
                    </h3>
                  </div>
                  <select
                    value={appointmentTimeframe}
                    onChange={(e) =>
                      setAppointmentTimeframe(e.target.value as any)
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-[#7da3b3]"
                  >
                    <option value="7days">7 Days</option>
                    <option value="30days">30 Days</option>
                    <option value="1year">1 Year</option>
                  </select>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={weeklyTrend}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#eef2f6"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "#f1f5f9" }}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="count"
                        name="Appointments"
                        fill="#7da3b3"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-6 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/10 text-[#345263]">
                    <PieChartIcon className="h-4 w-4" />
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Today's Status
                  </h3>
                </div>
                {statusBreakdown.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-400 text-center px-4">
                    No appointments scheduled for today yet.
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={72}
                          paddingAngle={3}
                        >
                          {statusBreakdown.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={STATUS_COLORS[entry.name] || "#94a3b8"}
                            />
                          ))}
                        </Pie>
                        <Tooltip
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
                )}
              </div>
            </div>

            {/* Up Next + Today's Schedule Row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Up Next */}
              <div className="rounded-2xl border border-[#7da3b3]/20 bg-gradient-to-br from-[#7da3b3]/10 via-white to-white p-6 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3] text-white">
                    <UserRoundCheck className="h-4 w-4" />
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Up Next
                  </h3>
                </div>

                {upNext ? (
                  <div>
                    <p className="text-lg font-bold text-slate-900">
                      {upNext.patientName}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-[#7da3b3]" />{" "}
                      {upNext.startTime}
                      <span className="text-slate-300">·</span>
                      <Stethoscope className="h-3.5 w-3.5 text-[#7da3b3]" />{" "}
                      {upNext.treatmentName}
                    </p>
                    {upNext.patientPhone && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />{" "}
                        {upNext.patientPhone}
                      </p>
                    )}
                    {upNext.notes ? (
                      <div className="mt-3 rounded-xl border border-[#7da3b3]/20 bg-white/70 p-3">
                        <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-500">
                          <StickyNote className="h-3 w-3" /> Notes
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {upNext.notes}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs italic text-slate-400">
                        No notes for this visit.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No more patients scheduled for today.
                  </div>
                )}
              </div>

              {/* Today's Schedule */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-900/5 bg-white/90 shadow-lg backdrop-blur-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#7da3b3]">
                      <Clock className="h-4 w-4" />
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Today's Schedule
                    </h3>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {todaysSchedule.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No appointments scheduled for today.
                    </div>
                  ) : (
                    todaysSchedule.map((a) => {
                      const statusLabel = STATUS_NAME_MAP[a.status] || a.status;
                      return (
                        <div key={a.id} className="flex items-center gap-3 p-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700 font-bold">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {a.patientName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {a.treatmentName}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold text-slate-700">
                              {a.startTime}
                            </p>
                            <span
                              className={`inline-block mt-0.5 rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${a.status === "completed"
                                  ? "bg-slate-100 text-slate-600"
                                  : a.status === "checked_in"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : a.status === "no_show"
                                      ? "bg-rose-50 text-rose-600"
                                      : a.status === "cancelled"
                                        ? "bg-slate-100 text-slate-400"
                                        : "bg-[#7da3b3]/10 text-[#3f6274]"
                                }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-1">
              {/* Recent Patients Seen */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-900/5 bg-white/90 shadow-lg backdrop-blur-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/10 text-[#345263]">
                      <History className="h-4 w-4" />
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Recent Patients Seen
                    </h3>
                  </div>
                  <button
                    onClick={() => onNavigate?.("patients")}
                    className="flex items-center gap-1 text-xs font-semibold text-[#7da3b3] hover:underline"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {recentPatients.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No recent patient visits yet.
                    </div>
                  ) : (
                    recentPatients.map((p, idx) => (
                      <button
                        key={`${p.patientId}-${p.date}-${idx}`}
                        onClick={() => onNavigate?.("patients")}
                        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50/60"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7da3b3]/10 text-[#3f6274] font-semibold text-xs">
                          {p.patientName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {p.patientName}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {p.treatmentName}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400">
                          {p.date}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}