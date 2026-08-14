"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from "recharts";
import {
    Building2,
    Server,
    Shield,
    Database,
    Globe,
    Layers,
    TrendingUp,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    CheckCircle2,
    XCircle,
    Clock3,
    Ban,
    Activity,
    UserPlus,
    Sparkles,
    RefreshCw,
    CreditCard,
} from "lucide-react";

type OrgStatus = "Active" | "Trial" | "Suspended" | "Cancelled";

type DashboardStats = {
    totalOrganizations: number;
    activeOrgs: number;
};

type ApiDashboardOrgRow = {
    id?: string;
    name?: string;
    slug?: string;
    status?: string;
    createdAt?: string;
};

type Organization = {
    id: string;
    name: string;
    slug: string;
    status: OrgStatus;
    outlets: number;
    users: number;
    mrrCents: number;
    createdAt: string;
    ownerEmail: string;
    ownerPhone: string;
};

const STATUS_STYLES: Record<OrgStatus, { class: string; icon: typeof CheckCircle2 }> = {
    Active: { class: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    Trial: { class: "bg-sky-100 text-sky-700", icon: Clock3 },
    Suspended: { class: "bg-amber-100 text-amber-700", icon: Ban },
    Cancelled: { class: "bg-rose-100 text-rose-700", icon: XCircle },
};



const STATIC_ORGS: Organization[] = [
    { id: "org-1", name: "Chitwan Dental Home", slug: "chitwan-dental", status: "Active", outlets: 2, users: 14, mrrCents: 4900000, createdAt: "2025-11-02", ownerEmail: "admin@chitwandental.com", ownerPhone: "9801234567" },
    { id: "org-2", name: "Smile Care Nepal", slug: "smile-care-np", status: "Active", outlets: 1, users: 6, mrrCents: 2500000, createdAt: "2025-12-14", ownerEmail: "owner@smilecare.np", ownerPhone: "9802345678" },
    { id: "org-3", name: "Bright Teeth Clinic", slug: "bright-teeth", status: "Trial", outlets: 1, users: 3, mrrCents: 0, createdAt: "2026-01-20", ownerEmail: "hello@brightteeth.com", ownerPhone: "9803456789" },
    { id: "org-4", name: "Everest Dental Group", slug: "everest-dental", status: "Active", outlets: 5, users: 42, mrrCents: 12000000, createdAt: "2025-08-10", ownerEmail: "it@everestdental.com", ownerPhone: "9804567890" },
    { id: "org-5", name: "Pokhara Smile Studio", slug: "pokhara-smile", status: "Suspended", outlets: 1, users: 5, mrrCents: 0, createdAt: "2025-10-05", ownerEmail: "contact@pokharasmile.com", ownerPhone: "9805678901" },
    { id: "org-6", name: "Lalitpur Ortho Care", slug: "lalitpur-ortho", status: "Active", outlets: 2, users: 11, mrrCents: 4900000, createdAt: "2025-09-18", ownerEmail: "admin@lalitpurortho.com", ownerPhone: "9806789012" },
    { id: "org-7", name: "Kathmandu Dental Arts", slug: "kathmandu-arts", status: "Cancelled", outlets: 1, users: 2, mrrCents: 0, createdAt: "2025-07-22", ownerEmail: "info@ktmdentalarts.com", ownerPhone: "9807890123" },
    { id: "org-8", name: "Butwal Family Dental", slug: "butwal-family", status: "Active", outlets: 1, users: 7, mrrCents: 2500000, createdAt: "2026-02-01", ownerEmail: "owner@butwalfamily.com", ownerPhone: "9808901234" },
    { id: "org-9", name: "Biratnagar Dental Care", slug: "biratnagar-care", status: "Trial", outlets: 1, users: 2, mrrCents: 0, createdAt: "2026-03-05", ownerEmail: "hello@biratnagarcare.com", ownerPhone: "9809012345" },
    { id: "org-10", name: "Dharan Ortho & Dental", slug: "dharan-ortho", status: "Active", outlets: 3, users: 19, mrrCents: 4900000, createdAt: "2025-06-30", ownerEmail: "admin@dharanortho.com", ownerPhone: "9800123456" },
];

// Static per-year growth trend data — swap for a fetched trend once an API exists.
const STATIC_GROWTH_BY_YEAR: Record<string, { label: string; count: number }[]> = {
    "2026": [
        { label: "Jan", count: 2 },
        { label: "Feb", count: 3 },
        { label: "Mar", count: 1 },
        { label: "Apr", count: 4 },
        { label: "May", count: 2 },
        { label: "Jun", count: 5 },
        { label: "Jul", count: 3 },
        { label: "Aug", count: 2 },
    ],
    "2025": [
        { label: "Jan", count: 0 },
        { label: "Feb", count: 1 },
        { label: "Mar", count: 1 },
        { label: "Apr", count: 2 },
        { label: "May", count: 1 },
        { label: "Jun", count: 3 },
        { label: "Jul", count: 2 },
        { label: "Aug", count: 4 },
        { label: "Sep", count: 3 },
        { label: "Oct", count: 2 },
        { label: "Nov", count: 3 },
        { label: "Dec", count: 2 },
    ],
    "2024": [
        { label: "Jan", count: 0 },
        { label: "Feb", count: 0 },
        { label: "Mar", count: 1 },
        { label: "Apr", count: 0 },
        { label: "May", count: 1 },
        { label: "Jun", count: 1 },
        { label: "Jul", count: 0 },
        { label: "Aug", count: 2 },
        { label: "Sep", count: 1 },
        { label: "Oct", count: 1 },
        { label: "Nov", count: 0 },
        { label: "Dec", count: 1 },
    ],
};

// Years that actually have static data — used only to know which years show a filled chart.
// The picker itself is not limited to this list; any year can be selected.
const YEARS_WITH_DATA = Object.keys(STATIC_GROWTH_BY_YEAR)
    .map(Number)
    .sort((a, b) => b - a);

const CURRENT_YEAR = new Date().getFullYear();
// Reasonable bounds for the year picker (earliest org + a few years of runway forward).
const MIN_YEAR = 2020;
const MAX_YEAR = CURRENT_YEAR + 1;

const STATIC_ACTIVITY = [
    { type: "org_created", title: "New organization onboarded", description: "Biratnagar Dental Care signed up and started a trial", timestamp: "2026-08-05T08:10:00" },
    { type: "plan_upgraded", title: "Account upgraded", description: "Butwal Family Dental increased their outlet count", timestamp: "2026-08-04T15:40:00" },
    { type: "org_suspended", title: "Organization suspended", description: "Pokhara Smile Studio suspended for non-payment", timestamp: "2026-08-03T11:05:00" },
    { type: "org_created", title: "New organization onboarded", description: "Bright Teeth Clinic started a 14-day trial", timestamp: "2026-08-01T09:20:00" },
    { type: "outlet_added", title: "New outlet added", description: "Everest Dental Group added a 5th outlet in Chitwan", timestamp: "2026-07-30T13:15:00" },
    { type: "org_cancelled", title: "Subscription cancelled", description: "Kathmandu Dental Arts cancelled their subscription", timestamp: "2026-07-27T17:00:00" },
];

function getActivityIcon(type: string) {
    switch (type) {
        case "org_created":
            return { icon: UserPlus, iconBg: "bg-[#7da3b3]/20 text-[#3f6274]" };
        case "plan_upgraded":
            return { icon: Sparkles, iconBg: "bg-violet-100 text-violet-700" };
        case "org_suspended":
            return { icon: Ban, iconBg: "bg-amber-100 text-amber-700" };
        case "org_cancelled":
            return { icon: XCircle, iconBg: "bg-rose-100 text-rose-700" };
        case "outlet_added":
            return { icon: Building2, iconBg: "bg-emerald-100 text-emerald-700" };
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
    return (n / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const STATUSES: OrgStatus[] = ["Active", "Trial", "Suspended", "Cancelled"];
const ITEMS_PER_PAGE = 6;

export default function SuperAdminDashboardPage() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ totalOrganizations: 0, activeOrgs: 0 });
    const [growthData, setGrowthData] = useState<{ label: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | OrgStatus>("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [activityPage, setActivityPage] = useState(1);

    // Growth chart year is now a free-form number, not limited to the years that have static data.
    const [growthYear, setGrowthYear] = useState<number>(YEARS_WITH_DATA[0] ?? CURRENT_YEAR);

    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [orgStatuses, setOrgStatuses] = useState<Record<string, OrgStatus>>({});

    function mapApiStatusToUi(status: string): OrgStatus {
        if (status === "active") return "Active";
        if (status === "suspended") return "Suspended";
        if (status === "cancelled") return "Cancelled";
        return "Trial";
    }

    const loadDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            setErrorMsg(null);

            const [statsRes, orgsRes] = await Promise.all([
                axios.get("/api/superadmin/dashboard/stats").catch(() => null),
                axios.get("/api/superadmin/orgnization").catch(() => null),
            ]);

            if (statsRes?.data?.success && statsRes.data.data?.stats) {
                setDashboardStats(statsRes.data.data.stats);
            }

            if (orgsRes?.data?.success && Array.isArray(orgsRes.data.data?.organizations)) {
                const mappedOrgs: Organization[] = (orgsRes.data.data.organizations as ApiDashboardOrgRow[]).map((o, idx: number) => ({
                    id: o.id ?? String(idx),
                    name: o.name ?? "Organization",
                    slug: o.slug ?? "-",
                    status: mapApiStatusToUi(o.status ?? "trial"),
                    outlets: 0,
                    users: 0,
                    mrrCents: 0,
                    createdAt: o.createdAt ?? "",
                    ownerEmail: "—",
                    ownerPhone: "—",
                }));
                setOrganizations(mappedOrgs);
                setOrgStatuses(Object.fromEntries(mappedOrgs.map((o) => [o.id, o.status])));
            } else {
                setOrganizations([]);
                setOrgStatuses({});
            }
        } catch (err: unknown) {
            console.error("Failed to load superadmin dashboard:", err);
            if (axios.isAxiosError(err)) {
                setErrorMsg(err.response?.data?.error ?? "Failed to load dashboard data.");
            } else {
                setErrorMsg("Failed to load dashboard data.");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const loadGrowth = useCallback(async (year: number) => {
        try {
            const res = await axios.get("/api/superadmin/dashboard/growth", { params: { year } }).catch(() => null);
            if (res?.data?.success && Array.isArray(res.data.data?.growth)) {
                setGrowthData(res.data.data.growth);
                return;
            }
        } catch (err) {
            console.error("Failed to load growth data:", err);
        }

        setGrowthData(STATIC_GROWTH_BY_YEAR[String(year)] ?? []);
    }, []);

    useEffect(() => {
        queueMicrotask(() => {
            void loadDashboardData();
        });
    }, [loadDashboardData]);

    useEffect(() => {
        queueMicrotask(() => {
            void loadGrowth(growthYear);
        });
    }, [growthYear, loadGrowth]);

    function goToYear(year: number) {
        const clamped = Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
        setGrowthYear(clamped);
    }

    const stats = useMemo(() => {
        const total = dashboardStats.totalOrganizations || organizations.length;
        const active = dashboardStats.activeOrgs || organizations.filter((o) => orgStatuses[o.id] === "Active").length;
        const trial = organizations.filter((o) => orgStatuses[o.id] === "Trial").length;
        const mrr = organizations.reduce((sum, o) => sum + o.mrrCents, 0);
        return { total, active, trial, mrr };
    }, [dashboardStats, organizations, orgStatuses]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return organizations.filter((o) => {
            const matchesQuery =
                !q ||
                o.name.toLowerCase().includes(q) ||
                o.slug.toLowerCase().includes(q) ||
                o.ownerEmail.toLowerCase().includes(q);
            const matchesStatus = statusFilter === "All" || orgStatuses[o.id] === statusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [organizations, query, statusFilter, orgStatuses]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedOrgs = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const totalActivityPages = Math.max(1, Math.ceil(STATIC_ACTIVITY.length / ITEMS_PER_PAGE));
    const paginatedActivity = STATIC_ACTIVITY.slice(
        (activityPage - 1) * ITEMS_PER_PAGE,
        activityPage * ITEMS_PER_PAGE
    );

    function handlePageChange(newPage: number) {
        if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
    }

    function updateStatus(id: string, status: OrgStatus) {
        setOrgStatuses((prev) => ({ ...prev, [id]: status }));
        setOpenMenuId(null);
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-50">


            {/* Sticky Top Header */}
            <div className="sticky top-0 z-20 w-full border-b border-slate-100 bg-white px-6 py-6 lg:px-10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
                        Superadmin
                    </h1>

                    <button
                        onClick={() => {
                            void loadDashboardData();
                            void loadGrowth(growthYear);
                        }}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
                    >
                        <RefreshCw className="h-3.5 w-3.5 text-[#7da3b3]" /> Refresh
                    </button>
                </div>
            </div>

            <div className="relative mx-auto max-w-[1600px] space-y-6 px-6 pb-10 pt-6 lg:px-10">
                {errorMsg && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                        {errorMsg}
                    </div>
                )}

                {/* Top 4 Stats Cards */}
                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Organizations</p>
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                <Building2 className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold text-slate-900">{loading ? "—" : stats.total}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Orgs</p>
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                <CheckCircle2 className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold text-slate-900">{loading ? "—" : stats.active}</p>
                    </div>


                    {/* 
          <div className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total MRR</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <CreditCard className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              NPR {centsToDisplay(stats.mrr)}
            </p>
          </div> */}
                </div>

                {/* Organization Growth Chart */}
                <div className="space-y-4 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/15 text-[#3f6274]">
                                <TrendingUp className="h-4 w-4" />
                            </span>
                            <h3 className="text-sm font-bold text-slate-900">Organization Growth </h3>
                        </div>


                        <div className="flex items-center gap-1 self-start rounded-xl bg-slate-100 p-1 sm:self-auto">
                            <button
                                type="button"
                                onClick={() => goToYear(growthYear - 1)}
                                disabled={growthYear <= MIN_YEAR}
                                aria-label="Previous year"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>

                            <select
                                value={growthYear}
                                onChange={(e) => goToYear(Number(e.target.value))}
                                aria-label="Select year"
                                className="appearance-none rounded-lg bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-[#345263] shadow-sm outline-none"
                            >
                                {Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i).map((yr) => (
                                    <option key={yr} value={yr}>
                                        {yr}

                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={() => goToYear(growthYear + 1)}
                                disabled={growthYear >= MAX_YEAR}
                                aria-label="Next year"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="relative h-64 w-full pt-2">
                        {growthData.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs text-slate-400">
                                No growth data available for {growthYear}.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="orgGradient" x1="0" y1="0" x2="0" y2="1">
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
                                    <Area type="monotone" dataKey="count" name="New Organizations" stroke="#7da3b3" strokeWidth={2.5} fillOpacity={1} fill="url(#orgGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Organizations Table
        <div className="overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search organizations..."
                  className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as "All" | OrgStatus);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                >
                  <option value="All">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-900/5 bg-slate-50/60">
                  <th className="px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Organization</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Outlets</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Users</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">MRR</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Created</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-6 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrgs.map((o) => {
                  const status = orgStatuses[o.id];
                  const StatusIcon = STATUS_STYLES[status].icon;
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-slate-900/5 transition-colors last:border-b-0 hover:bg-[#7da3b3]/[0.04]"
                    >
                      <td className="px-6 py-4">
                        <p className="text-[0.9rem] font-semibold text-slate-900">{o.name}</p>
                        <p className="text-[0.75rem] text-slate-400">/{o.slug}</p>
                      </td>
                      <td className="px-4 py-4 text-[0.85rem] text-slate-600">{o.outlets}</td>
                      <td className="px-4 py-4 text-[0.85rem] text-slate-600">{o.users}</td>
                      <td className="px-4 py-4 text-[0.85rem] text-slate-600">
                        {o.mrrCents > 0 ? `NPR ${centsToDisplay(o.mrrCents)}` : "—"}
                      </td>
                      <td className="px-4 py-4 text-[0.85rem] text-slate-600">
                        {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${STATUS_STYLES[status].class}`}>
                          <StatusIcon className="h-3 w-3" strokeWidth={2} />
                          {status}
                        </span>
                      </td>
                      <td className="relative px-6 py-4">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => setOpenMenuId((prev) => (prev === o.id ? null : o.id))}
                            aria-label="Organization actions"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            <MoreVertical className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>

                        {openMenuId === o.id && (
                          <div className="absolute right-6 top-12 z-10 w-40 rounded-xl border border-slate-900/10 bg-white py-1.5 shadow-lg">
                            {STATUSES.filter((s) => s !== status).map((s) => (
                              <button
                                key={s}
                                onClick={() => updateStatus(o.id, s)}
                                className="block w-full px-4 py-2 text-left text-[0.8rem] text-slate-600 hover:bg-slate-50"
                              >
                                Mark as {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {paginatedOrgs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                      No organizations match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs">
              <span className="text-[0.7rem] font-medium text-slate-500">
                Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{" "}
                <strong className="text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)}</strong> of{" "}
                <strong className="text-slate-800">{filtered.length}</strong> organizations
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
        </div> */}

                {/* Recent Activity Feed
        <div className="space-y-4 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Activity className="h-4 w-4 text-[#7da3b3]" /> Recent Platform Activity
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedActivity.map((act, index) => {
              const { icon: Icon, iconBg } = getActivityIcon(act.type);
              return (
                <div key={`${act.type}-${index}`} className="flex gap-3 rounded-xl border border-slate-100 bg-[#f4fafc]/60 p-3 text-xs">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{act.title}</p>
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
        </div> */}
            </div>
        </div>
    );
}