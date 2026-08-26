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
    Clock,
    UserCheck,
    AlertTriangle,
    Inbox,
    Stethoscope,
    TrendingUp,
    PieChart as PieChartIcon,
    ArrowRight,
    Loader2,
    AlertCircle,
    User,
    Wallet,
    Receipt,
    TrendingDown,
} from "lucide-react";

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

interface FrontDeskDashboardData {
    stats: {
        appointmentsToday: number;
        pendingRequests: number;
        checkedIn: number;
        noShowsToday: number;
    };
    last7Days: { day: string; date: string; count: number }[];
    todayStatus: { status: string; count: number }[];
    todaysSchedule: {
        id: string;
        patientName: string;
        doctorName: string;
        treatmentName: string;
        startTime: string;
        status: string;
    }[];
    doctorLoad: {
        doctorId: string;
        doctorName: string;
        appointmentCount: number;
    }[];
}

function centsToDisplay(cents: number) {
    return (cents / 100).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

interface BillingSnapshot {
    totalCollectedCents: number;
    outstandingDuesCents: number;
    patientsWithDuesCount: number;
}

export default function DashboardTab({
    onNavigate,
}: {
    onNavigate?: (tab: "appointments" | "patients" | "availability" | "settings"| "billing") => void;
}) {
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [dashboardData, setDashboardData] = useState<FrontDeskDashboardData | null>(null);
    const [billingStats, setBillingStats] = useState<BillingSnapshot | null>(null);
    const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
    const [appointmentTimeframe, setAppointmentTimeframe] = useState<"7days" | "30days" | "1year">("7days");
    const [trendData, setTrendData] = useState<{ label: string; count: number }[]>([]);
    const [loadingTrend, setLoadingTrend] = useState(false);

    const loadTrend = useCallback(async (timeframe: "7days" | "30days" | "1year", locId?: string | null) => {
        const targetLocId = locId || activeLocationId;
        if (!targetLocId) return;
        try {
            setLoadingTrend(true);
            const res = await axios.get("/api/frontDesk/dashboard/get7dayStats", {
                params: { locationId: targetLocId, range: timeframe },
            });
            if (res.data?.success && res.data.data?.trend) {
                setTrendData(res.data.data.trend);
            }
        } catch (err) {
            console.error("Failed to load appointment trend:", err);
        } finally {
            setLoadingTrend(false);
        }
    }, [activeLocationId]);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setErrorMsg(null);

            let locationId: string | null = null;
            const userRes = await axios.get("/api/user-details").catch(() => null);
            if (userRes?.data?.success && userRes.data.data?.user?.locationId) {
                locationId = userRes.data.data.user.locationId;
            }

            if (!locationId) {
                const [servicesRes, treatmentsRes, patientsRes] = await Promise.all([
                    axios.get("/api/services").catch(() => null),
                    axios.get("/api/treatment").catch(() => null),
                    axios.get("/api/patent").catch(() => null),
                ]);

                if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
                    locationId = servicesRes.data.data.services[0].locationId;
                } else if (treatmentsRes?.data?.success && treatmentsRes.data.data.treatments?.length > 0) {
                    locationId = treatmentsRes.data.data.treatments[0].locationId;
                } else if (patientsRes?.data?.success && patientsRes.data.data.patients?.length > 0) {
                    locationId = patientsRes.data.data.patients[0].locationId;
                }
            }

            if (!locationId) {
                setErrorMsg("No clinic location found.");
                setLoading(false);
                return;
            }

            setActiveLocationId(locationId);

            const [res, billingRes] = await Promise.all([
                axios.get("/api/frontDesk/dashboard/getAll", { params: { locationId, range: appointmentTimeframe } }),
                axios.get("/api/billing/stats", { params: { locationId } }).catch(() => null),
            ]);

            if (res?.data?.success && res.data.data) {
                setDashboardData(res.data.data);
                const initialTrend = res.data.data.trend || res.data.data.last7Days || [];
                setTrendData(initialTrend);
            } else {
                setErrorMsg(res?.data?.error || "Failed to load dashboard data.");
            }

            if (billingRes?.data?.success && billingRes.data.data?.stats) {
                setBillingStats(billingRes.data.data.stats);
            }
        } catch (err: any) {
            console.error("[FrontDesk Dashboard] error:", err?.response?.data || err?.message);
            setErrorMsg(err?.response?.data?.error || "Failed to load dashboard data from server.");
        } finally {
            setLoading(false);
        }
    }, [appointmentTimeframe]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const statusBreakdown = useMemo(() => {
        if (!dashboardData?.todayStatus) return [];
        return dashboardData.todayStatus
            .map((s) => ({
                name: STATUS_NAME_MAP[s.status] || s.status,
                value: s.count,
            }))
            .filter((item) => item.value > 0);
    }, [dashboardData]);

    const weeklyTrend = useMemo(() => {
        if (trendData.length > 0) {
            return trendData;
        }
        if (!dashboardData?.last7Days) return [];
        return dashboardData.last7Days.map((d) => ({
            label: d.day,
            date: d.date,
            count: d.count,
        }));
    }, [trendData, dashboardData]);

    const doctorLoad = useMemo(() => {
        if (!dashboardData?.doctorLoad) return [];
        const doctors = dashboardData.doctorLoad;
        const maxCount = Math.max(1, ...doctors.map((d) => d.appointmentCount));
        return doctors.map((d) => ({
            id: d.doctorId,
            name: d.doctorName,
            count: d.appointmentCount,
            pct: Math.round((d.appointmentCount / maxCount) * 100),
        }));
    }, [dashboardData]);

    const todaysSchedule = useMemo(() => {
        if (!dashboardData?.todaysSchedule) return [];
        return dashboardData.todaysSchedule;
    }, [dashboardData]);

    const stats = dashboardData?.stats || {
        appointmentsToday: 0,
        pendingRequests: 0,
        checkedIn: 0,
        noShowsToday: 0,
    };

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

                {loading ? (
                    <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2 shadow-lg backdrop-blur-sm">
                        <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
                        <span>Loading dashboard...</span>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                                        Pending Requests
                                    </p>
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                        <Inbox className="h-4 w-4" />
                                    </span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-slate-900">{stats.pendingRequests}</p>
                            </div>

                            <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-lg backdrop-blur-sm">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        Checked In
                                    </p>
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                        <UserCheck className="h-4 w-4" />
                                    </span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-slate-900">{stats.checkedIn}</p>
                            </div>

                            <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-lg backdrop-blur-sm">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        No-Shows Today
                                    </p>
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                                        <AlertTriangle className="h-4 w-4" />
                                    </span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-slate-900">{stats.noShowsToday}</p>
                            </div>
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
                                        <div>
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Appointments ({appointmentTimeframe === "7days" ? "7 Days" : appointmentTimeframe === "30days" ? "30 Days" : "1 Year"})
                                            </h3>
                                        </div>
                                    </div>
                                    <select
                                        value={appointmentTimeframe}
                                        onChange={(e) => {
                                            const newTimeframe = e.target.value as "7days" | "30days" | "1year";
                                            setAppointmentTimeframe(newTimeframe);
                                            loadTrend(newTimeframe);
                                        }}
                                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-[#7da3b3] cursor-pointer"
                                    >
                                        <option value="7days">7 Days</option>
                                        <option value="30days">30 Days</option>
                                        <option value="1year">1 Year</option>
                                    </select>
                                </div>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={weeklyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
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
                                            <Bar dataKey="count" name="Appointments" fill="#7da3b3" radius={[6, 6, 0, 0]} />
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
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                            Today's Status
                                        </h3>
                                    </div>
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

                        {/* Schedule + Doctor Load Row */}
                        <div className="grid gap-4 lg:grid-cols-3">
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
                                    <button
                                        onClick={() => onNavigate?.("appointments")}
                                        className="flex items-center gap-1 text-xs font-semibold text-[#7da3b3] hover:underline"
                                    >
                                        View all <ArrowRight className="h-3 w-3" />
                                    </button>
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
                                                        <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                                                            <Stethoscope className="h-3 w-3 text-[#7da3b3]" /> {a.doctorName} ·{" "}
                                                            {a.treatmentName}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-xs font-semibold text-slate-700">{a.startTime}</p>
                                                        <span
                                                            className={`inline-block mt-0.5 rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${a.status === "checked_in"
                                                                ? "bg-emerald-50 text-emerald-700"
                                                                : a.status === "completed"
                                                                    ? "bg-slate-100 text-slate-600"
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

                            {/* Doctor Load Today */}
                            <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-lg backdrop-blur-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#345263]/10 text-[#345263]">
                                        <Stethoscope className="h-4 w-4" />
                                    </span>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Doctor Load Today
                                    </h3>
                                </div>

                                {doctorLoad.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400">No doctors found.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {doctorLoad.map((d) => (
                                            <div key={d.id}>
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="font-semibold text-slate-700 truncate pr-2">
                                                        {d.name}
                                                    </span>
                                                    <span className="text-slate-400 font-medium shrink-0">
                                                        {d.count} appt{d.count === 1 ? "" : "s"}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-[#7da3b3] transition-all"
                                                        style={{ width: `${d.count > 0 ? Math.max(d.pct, 8) : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Billing Snapshot — live from /api/billing/stats */}
                        <div className="rounded-2xl border border-slate-900/5 bg-white/90 shadow-lg backdrop-blur-sm overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-100 p-5">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#7da3b3]">
                                        <Wallet className="h-4 w-4" />
                                    </span>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Billing Snapshot
                                    </h3>
                                </div>
                                <button
                                    onClick={() => onNavigate?.("billing")}
                                    className="flex items-center gap-1 text-xs font-semibold text-[#7da3b3] hover:underline"
                                >
                                    View billing <ArrowRight className="h-3 w-3" />
                                </button>
                            </div>

                            <div className="grid gap-4 p-5 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                                            Total Collected
                                        </p>
                                        <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                                    </div>
                                    <p className="mt-1.5 text-lg font-bold text-slate-900">
                                        NPR {centsToDisplay(billingStats?.totalCollectedCents ?? 0)}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-rose-500">
                                            Outstanding Dues
                                        </p>
                                        <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                                    </div>
                                    <p className="mt-1.5 text-lg font-bold text-rose-700">
                                        NPR {centsToDisplay(billingStats?.outstandingDuesCents ?? 0)}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                                            Patients With Dues
                                        </p>
                                        <User className="h-3.5 w-3.5 text-slate-500" />
                                    </div>
                                    <p className="mt-1.5 text-lg font-bold text-slate-900">
                                        {billingStats?.patientsWithDuesCount ?? 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}