"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Search,
  CalendarClock,
  CalendarCheck2,
  CalendarX2,
  Filter,
  ChevronLeft,
  ChevronRight,
  IdCard,
  Clock,
  User,
  Phone,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Hourglass,
  BadgeCheck,
  Loader2,
  AlertCircle,
  RefreshCw,
  Stethoscope,
} from "lucide-react";

const STATUSES = ["Scheduled", "Confirmed", "Completed", "Cancelled"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_ICONS: Record<Status, typeof Hourglass> = {
  Scheduled: Hourglass,
  Confirmed: BadgeCheck,
  Completed: CheckCircle2,
  Cancelled: XCircle,
};

const STATUS_COLORS: Record<Status, string> = {
  Scheduled: "bg-amber-100 text-amber-700",
  Confirmed: "bg-sky-100 text-sky-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-rose-100 text-rose-700",
};

type Appointment = {
  id: string;
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  treatment: string;
  treatmentId?: string;
  doctor: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: Status;
  rawStatus: string;
  notes?: string;
  createdDate?: string;
};

function getTodayStr() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function splitIsoStartTime(isoString: string) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { date: getTodayStr(), time: "09:00" };
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

function mapApiStatus(rawStatus: string | undefined): Status {
  switch (rawStatus) {
    case "completed":
      return "Completed";
    case "cancelled":
    case "no_show":
      return "Cancelled";
    case "confirmed":
    case "checked_in":
      return "Confirmed";
    case "pending":
    default:
      return "Scheduled";
  }
}

function formatDateLabel(dateStr: string, todayStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const label = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return dateStr === todayStr
    ? `Today, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : label;
}

function formatTimeLabel(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

const ITEMS_PER_PAGE = 8;

const AVATAR_PALETTE = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
];

function avatarColorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[hash];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const LIST_GRID = "grid grid-cols-[1.4fr_1.1fr_1.3fr_1.1fr_1fr_0.8fr_0.9fr] items-center gap-4";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [dateFilter, setDateFilter] = useState<"All" | "Today" | "Upcoming">("All");

  const [selected, setSelected] = useState<Appointment | null>(null);
  const [profileTab, setProfileTab] = useState<"detail" | "notes">("detail");
  const [currentPage, setCurrentPage] = useState(1);
  const todayStr = getTodayStr();

  const loadData = useCallback(async () => {
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

        if (currentLocId) setLocationId(currentLocId);
      }

      const params: Record<string, any> = {};
      if (currentLocId) params.locationId = currentLocId;

      const apptsRes = await axios.get("/api/appoments", { params });

      if (apptsRes.data?.success && apptsRes.data.data?.appointments) {
        const dbAppts = apptsRes.data.data.appointments;
        const mapped: Appointment[] = dbAppts.map((a: any) => {
          const { date, time } = splitIsoStartTime(a.startTime);

          return {
            id: a.id,
            appointmentId: a.appointmentCode || `APT-${String(a.id).slice(-4)}`,
            patientName: a.patientName || "Patient",
            patientPhone: a.patientPhone || "-",
            treatment: a.treatmentName || "General Service",
            treatmentId: a.treatmentId,
            doctor: a.providerName || "Unassigned",
            doctorId: a.providerId || "",
            date,
            time,
            status: mapApiStatus(a.status),
            rawStatus: a.status,
            notes: a.notes || "",
            createdDate: a.createdAt
              ? new Date(a.createdAt).toISOString().slice(0, 16).replace("T", " ")
              : undefined,
          };
        });

        setAppointments(mapped);
      } else {
        setAppointments([]);
      }
    } catch (err: any) {
      console.error("Failed to load appointments:", err);
      setErrorMsg(err.response?.data?.error || "Failed to fetch appointments from server.");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openProfile(a: Appointment) {
    setSelected(a);
    setProfileTab("detail");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments
      .filter((a) => {
        const matchesQuery =
          !q ||
          a.patientName.toLowerCase().includes(q) ||
          a.treatment.toLowerCase().includes(q) ||
          a.doctor.toLowerCase().includes(q);
        const matchesStatus = statusFilter === "All" || a.status === statusFilter;
        const matchesDate =
          dateFilter === "All" ||
          (dateFilter === "Today" && a.date === todayStr) ||
          (dateFilter === "Upcoming" && a.date >= todayStr);
        return matchesQuery && matchesStatus && matchesDate;
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [appointments, query, statusFilter, dateFilter, todayStr]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedAppointments = useMemo(
    () => filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE),
    [filtered, startIndex]
  );

  const stats = useMemo(() => {
    const todayCount = appointments.filter((a) => a.date === todayStr).length;
    const confirmedToday = appointments.filter(
      (a) => a.date === todayStr && a.status === "Confirmed"
    ).length;
    const completed = appointments.filter((a) => a.status === "Completed").length;
    const cancelled = appointments.filter((a) => a.status === "Cancelled").length;
    return [
      { icon: CalendarClock, label: "Total Appointments", value: String(appointments.length) },
      {
        icon: CalendarDays,
        label: "Today's Appointments",
        value: String(todayCount),
        trend: `${confirmedToday} confirmed`,
      },
      { icon: CalendarCheck2, label: "Completed", value: String(completed) },
      {
        icon: CalendarX2,
        label: "Cancelled",
        value: String(cancelled),
        trend: cancelled > 0 ? "Needs follow-up" : "None this week",
      },
    ];
  }, [appointments, todayStr]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
          Appointments
        </h1>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        {errorMsg && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="flex items-center gap-1 font-semibold text-rose-600 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

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
              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</p>
              {"trend" in stat && stat.trend && (
                <p className="mt-1 text-xs text-slate-400">{stat.trend}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search patient, treatment, doctor..."
                className="w-64 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "All" | Status);
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

            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as "All" | "Today" | "Upcoming");
                  setCurrentPage(1);
                }}
                className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
              >
                <option value="All">All dates</option>
                <option value="Today">Today</option>
                <option value="Upcoming">Upcoming</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-900/5">
            <div
              className={`${LIST_GRID} hidden bg-slate-50 px-5 py-3 text-[0.75rem] font-medium uppercase tracking-wide text-slate-500 sm:grid`}
            >
              <span>Patient</span>
              <span>Phone</span>
              <span>Service</span>
              <span>Doctor</span>
              <span>Date</span>
              <span>Time</span>
              <span>Status</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 bg-white p-12 text-center text-xs text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
                <span>Loading appointments from database...</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-900/5">
                {paginatedAppointments.map((a, idx) => {
                  const StatusIcon = STATUS_ICONS[a.status];
                  const statusColor = STATUS_COLORS[a.status];
                  const avatarColor = avatarColorFor(a.patientName);

                  return (
                    <div
                      key={`${a.id}-${idx}`}
                      onClick={() => openProfile(a)}
                      className={`${LIST_GRID} group cursor-pointer flex-wrap gap-y-3 bg-white px-5 py-4 transition-colors hover:bg-[#7da3b3]/[0.06] max-sm:flex`}
                    >
                      {/* Patient Name */}
                      <div className="flex min-w-[10rem] items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-semibold ${avatarColor}`}
                        >
                          {getInitials(a.patientName)}
                        </div>
                        <p className="truncate text-[0.92rem] font-semibold text-slate-900">{a.patientName}</p>
                      </div>

                      {/* Phone */}
                      <div className="min-w-[7rem] text-[0.85rem] text-slate-600">
                        <p className="flex items-center gap-1.5 font-medium text-slate-700">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                          <span className="truncate">{a.patientPhone && a.patientPhone !== "-" ? a.patientPhone : "—"}</span>
                        </p>
                      </div>

                      {/* Service / Treatment */}
                      <div className="min-w-[8rem] text-[0.85rem] text-slate-700">
                        <p className="flex items-center gap-1.5 font-medium">
                          <Stethoscope className="h-3.5 w-3.5 shrink-0 text-[#3f6274]" strokeWidth={2} />
                          <span className="truncate">{a.treatment}</span>
                        </p>
                      </div>

                      {/* Doctor */}
                      <div className="min-w-[8rem] text-[0.85rem] text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                          <span className="truncate">{a.doctor}</span>
                        </p>
                      </div>

                      {/* Date */}
                      <div className="min-w-[7rem] text-[0.85rem] text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                          {formatDateLabel(a.date, todayStr)}
                        </p>
                      </div>

                      {/* Time */}
                      <div className="min-w-[6rem] text-[0.85rem] text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                          {formatTimeLabel(a.time)}
                        </p>
                      </div>

                      {/* Status */}
                      <span
                        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-medium ${statusColor}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" strokeWidth={2} />
                        {a.status}
                      </span>
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="bg-white py-16 text-center text-slate-500">
                    No appointments match your filters.
                  </div>
                )}

                {filtered.length > 0 && (
                  <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-xs">
                    <span className="text-[0.7rem] text-slate-500 font-medium">
                      Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{" "}
                      <strong className="text-slate-800">
                        {Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)}
                      </strong>{" "}
                      of <strong className="text-slate-800">{filtered.length}</strong>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={safeCurrentPage === 1}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${safeCurrentPage === pageNum
                            ? "bg-[#7da3b3] text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                            }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={safeCurrentPage === totalPages}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail side panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div onClick={() => setSelected(null)} className="absolute inset-0" aria-hidden />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-[1.15rem] font-semibold ring-4 ring-white ${avatarColorFor(
                    selected.patientName
                  )}`}
                >
                  {getInitials(selected.patientName)}
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selected.patientName}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.85rem] text-slate-500">
                    <span>{selected.treatment}</span>
                    <span className="text-slate-300">|</span>
                    <span>{formatDateLabel(selected.date, todayStr)}</span>
                    <span className="text-slate-300">|</span>
                    <span className="font-medium text-slate-700">{formatTimeLabel(selected.time)}</span>
                  </div>

                  <span
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-medium ${STATUS_COLORS[selected.status]}`}
                  >
                    {(() => {
                      const StatusIcon = STATUS_ICONS[selected.status];
                      return <StatusIcon className="h-3.5 w-3.5" strokeWidth={2} />;
                    })()}
                    {selected.status}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-6 border-b border-slate-900/10">
                {(
                  [
                    { key: "detail", label: "Detail Information" },
                    { key: "notes", label: "Notes" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setProfileTab(tab.key)}
                    className={`-mb-px border-b-2 px-1 pb-3 text-[0.85rem] font-medium transition-colors ${profileTab === tab.key
                      ? "border-[#3f6274] text-[#3f6274]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {profileTab === "detail" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                    Appointment Information
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-y-4 text-[0.85rem]">
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <IdCard className="h-3.5 w-3.5" strokeWidth={2} />
                        Appointment ID
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{selected.appointmentId}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <User className="h-3.5 w-3.5" strokeWidth={2} />
                        Doctor
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{selected.doctor}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                        Phone
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{selected.patientPhone}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                        Created Date
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{selected.createdDate ?? "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {profileTab === "notes" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                    Notes
                  </p>
                  {selected.notes ? (
                    <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-600">{selected.notes}</p>
                  ) : (
                    <p className="mt-3 text-[0.85rem] text-slate-500">No notes recorded yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}