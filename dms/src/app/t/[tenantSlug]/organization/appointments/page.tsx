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
  SquarePen,
  IdCard,
  Clock,
  User,
  Phone,
  Stethoscope,
  Cross,
  MapPin,
  HeartPulse,
  Pill,
  Activity,
  CalendarDays,
  ClipboardList,
  Trash2,
  CheckCircle2,
  XCircle,
  Hourglass,
  BadgeCheck,
  Loader2,
  AlertCircle,
  RefreshCw,
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

const OUTLETS_DEFAULT: { id: string; name: string }[] = [];

interface DoctorOption {
  id: string;
  name: string;
}

interface TreatmentOption {
  id: string;
  name: string;
}

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
  locationId: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

const textareaClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

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

function statusToApiValue(status: Status): string {
  switch (status) {
    case "Scheduled":
      return "requested";
    case "Confirmed":
      return "confirmed";
    case "Completed":
      return "completed";
    case "Cancelled":
      return "cancelled";
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

const LIST_GRID = "grid grid-cols-[2fr_1.2fr_1fr_0.9fr_1fr_5rem] items-center gap-4";

async function deductInventoryForCompletedAppointment(params: {
  treatmentId?: string;
  treatmentName?: string;
  locationId?: string;
}) {
  let locId = params.locationId;
  if (!locId || locId === "all") {
    try {
      const outletsRes = await axios.get("/api/outlets").catch(() => null);
      if (outletsRes?.data?.success && Array.isArray(outletsRes.data.data?.locations) && outletsRes.data.data.locations.length > 0) {
        locId = outletsRes.data.data.locations[0]?.id;
      }
    } catch (e) { }
  }

  if (!locId) return;

  try {
    let recipeItems: { materialId: string; quantity: number }[] = [];

    const [treatRes, itemRes] = await Promise.all([
      axios.get(`/api/treatment?locationId=${locId}&limit=100`).catch(() => null),
      axios.get(`/api/inventory/item?locationId=${locId}`).catch(() => null),
    ]);

    const treatmentsList: any[] = treatRes?.data?.success && Array.isArray(treatRes.data.data?.treatments)
      ? treatRes.data.data.treatments
      : [];

    const inventoryItemsList: any[] = itemRes?.data?.success && Array.isArray(itemRes.data.data?.items)
      ? itemRes.data.data.items
      : [];

    const normName = (params.treatmentName || "").trim().toLowerCase();
    const matchingTreatment = treatmentsList.find(
      (t: any) =>
        (params.treatmentId && t.id === params.treatmentId) ||
        (normName && t.name?.trim().toLowerCase() === normName)
    );

    const targetTreatmentId = matchingTreatment?.id || params.treatmentId;

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("dms_service_recipes_v1");
        const stored = raw ? JSON.parse(raw) : {};

        if (targetTreatmentId && stored[targetTreatmentId]?.items?.length > 0) {
          recipeItems = stored[targetTreatmentId].items;
        } else {
          for (const key of Object.keys(stored)) {
            const recipe = stored[key];
            if (!recipe || !Array.isArray(recipe.items) || recipe.items.length === 0) continue;
            const foundT = treatmentsList.find((t: any) => t.id === key);
            if (
              key === targetTreatmentId ||
              (foundT && normName && foundT.name?.trim().toLowerCase() === normName)
            ) {
              recipeItems = recipe.items;
              break;
            }
          }
        }
      } catch (e) { }
    }

    if (recipeItems.length === 0 && matchingTreatment && Array.isArray(matchingTreatment.supplies)) {
      recipeItems = matchingTreatment.supplies.map((s: any) => ({
        materialId: s.itemId || s.materialId,
        quantity: s.quantityRequired || s.quantity || 1,
      }));
    }

    for (const item of recipeItems) {
      const targetInvItem = inventoryItemsList.find(
        (inv: any) => inv.id === item.materialId
      );

      const targetItemId = targetInvItem?.id || item.materialId;
      const targetLocId = targetInvItem?.locationId || locId;

      if (targetItemId && Number(item.quantity) > 0) {
        await axios
          .post(`/api/inventory/item/${targetItemId}/movement`, {
            locationId: targetLocId,
            quantity: -Math.abs(Math.round(Number(item.quantity))),
            type: "used",
            note: `Automated deduction for completed appointment (${params.treatmentName || "Service"})`,
          })
          .catch(() => null);
      }
    }
  } catch (err) { }
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorsList, setDoctorsList] = useState<DoctorOption[]>([]);
  const [treatmentsList, setTreatmentsList] = useState<TreatmentOption[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [dateFilter, setDateFilter] = useState<"All" | "Today" | "Upcoming">("All");
  const [outletsList, setOutletsList] = useState<{ id: string; name: string }[]>(OUTLETS_DEFAULT);
  const [outletFilter, setOutletFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    patientName: "",
    patientPhone: "",
    treatmentId: "",
    doctorId: "",
    date: "",
    time: "",
    status: "Scheduled" as Status,
    notes: "",
  });
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [profileTab, setProfileTab] = useState<"detail" | "notes">("detail");
  const todayStr = getTodayStr();

  // Fetches ALL outlets' appointments once, tags each with its locationId,
  // and lets the outlet filter run entirely client-side (mirrors the patients page).
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const outletsRes = await axios.get("/api/outlets").catch(() => null);
      let mappedOutletsList: { id: string; name: string }[] = [];
      if (outletsRes?.data?.success && outletsRes.data.data?.locations) {
        const seenOutlets = new Set<string>();
        outletsRes.data.data.locations.forEach((l: any) => {
          if (l.id && !seenOutlets.has(l.id)) {
            seenOutlets.add(l.id);
            mappedOutletsList.push({ id: l.id, name: l.name });
          }
        });
        setOutletsList(mappedOutletsList);
        if (mappedOutletsList.length > 0) {
          setOutletFilter((prev) => (prev === "all" || !prev ? mappedOutletsList[0].id : prev));
        }
      }

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

      if (!currentLocId && mappedOutletsList.length === 0) {
        setErrorMsg("Location ID could not be identified for this session.");
        setLoading(false);
        return;
      }

      let docs: DoctorOption[] = [];
      let doctorsRes = await axios
        .get("/api/doctor", { params: { locationId: currentLocId } })
        .catch(() => null);
      if (!doctorsRes?.data?.success || !doctorsRes.data.data.doctors?.length) {
        doctorsRes = await axios.get("/api/doctor").catch(() => null);
      }
      if (doctorsRes?.data?.success && doctorsRes.data.data.doctors) {
        const seenDocs = new Set<string>();
        doctorsRes.data.data.doctors.forEach((d: any) => {
          if (d.id && !seenDocs.has(d.id)) {
            seenDocs.add(d.id);
            docs.push({ id: d.id, name: d.name });
          }
        });
        setDoctorsList(docs);
      }

      const treatmentsRes = await axios.get("/api/treatment").catch(() => null);
      let treatments: TreatmentOption[] = [];
      if (treatmentsRes?.data?.success && treatmentsRes.data.data.treatments) {
        const seenTreatments = new Set<string>();
        treatmentsRes.data.data.treatments.forEach((t: any) => {
          if (t.id && !seenTreatments.has(t.id)) {
            seenTreatments.add(t.id);
            treatments.push({ id: t.id, name: t.name });
          }
        });
        setTreatmentsList(treatments);
      }

      // Always pull appointments for EVERY outlet, tagging each with its
      // source locationId so filtering can happen client-side without refetching.
      const targetIds =
        mappedOutletsList.length > 0 ? mappedOutletsList.map((o) => o.id) : [currentLocId as string];

      const responses = await Promise.all(
        targetIds.map((id: string) =>
          axios
            .get("/api/appoments", { params: { locationId: id } })
            .then((res) => ({ id, res }))
            .catch(() => null)
        )
      );

      let rawAppts: { raw: any; locationId: string }[] = [];
      responses.forEach((entry) => {
        if (entry?.res?.data?.success && entry.res.data.data?.appointments) {
          entry.res.data.data.appointments.forEach((raw: any) => {
            rawAppts.push({ raw, locationId: raw.locationId || entry.id });
          });
        }
      });

      if (rawAppts.length > 0) {
        const mapped: Appointment[] = rawAppts.map(({ raw: a, locationId: locId }) => {
          const { date, time } = splitIsoStartTime(a.startTime);

          const docObj = docs.find(
            (d) =>
              (a.providerId && d.id === a.providerId) ||
              (a.providerName && d.name.toLowerCase() === a.providerName.toLowerCase())
          );

          return {
            id: a.id,
            appointmentId: a.appointmentCode || `APT-${String(a.id).slice(-4)}`,
            patientName: a.patientName || "Patient",
            patientPhone: a.patientPhone || "-",
            treatment: a.treatmentName || "General Service",
            treatmentId: a.treatmentId,
            doctor: a.providerName || docObj?.name || "Unassigned",
            doctorId: a.providerId || docObj?.id || "",
            date,
            time,
            status: mapApiStatus(a.status),
            rawStatus: a.status,
            notes: a.notes || "",
            createdDate: a.createdAt
              ? new Date(a.createdAt).toISOString().slice(0, 16).replace("T", " ")
              : undefined,
            locationId: locId,
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
    // outletFilter intentionally excluded — filtering now happens client-side
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  function openProfile(a: Appointment) {
    setSelected(a);
    setProfileTab("detail");
  }

  function openEditModal(a: Appointment) {
    setEditingId(a.id);
    setEditForm({
      patientName: a.patientName,
      patientPhone: a.patientPhone,
      treatmentId: a.treatmentId || treatmentsList[0]?.id || "",
      doctorId: a.doctorId,
      date: a.date,
      time: a.time,
      status: a.status,
      notes: a.notes || "",
    });
  }

  function requestDelete(a: Appointment) {
    setDeleteTarget(a);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const a = deleteTarget;
    try {
      setDeletingId(a.id);

      await axios.delete(`/api/appoments/${a.id}`);
      setSelected((prev) => (prev?.id === a.id ? null : prev));
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      console.error("Delete error:", err);
      alert(err.response?.data?.error || "Failed to delete appointment.");
    } finally {
      setDeletingId(null);
    }
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
        const matchesOutlet = outletFilter === "all" || a.locationId === outletFilter;
        return matchesQuery && matchesStatus && matchesDate && matchesOutlet;
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [appointments, query, statusFilter, dateFilter, outletFilter, todayStr]);

  const stats = useMemo(() => {
    // Stats should reflect the currently selected outlet too
    const scoped =
      outletFilter === "all" ? appointments : appointments.filter((a) => a.locationId === outletFilter);
    const todayCount = scoped.filter((a) => a.date === todayStr).length;
    const confirmedToday = scoped.filter(
      (a) => a.date === todayStr && a.status === "Confirmed"
    ).length;
    const completed = scoped.filter((a) => a.status === "Completed").length;
    const cancelled = scoped.filter((a) => a.status === "Cancelled").length;
    return [
      { icon: CalendarClock, label: "Total Appointments", value: String(scoped.length) },
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
  }, [appointments, outletFilter, todayStr]);

  function updateEdit<K extends keyof typeof editForm>(key: K, value: (typeof editForm)[K]) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        patientName: editForm.patientName,
        patientPhone: editForm.patientPhone,
        treatmentId: editForm.treatmentId || undefined,
        providerId: editForm.doctorId || undefined,
        date: editForm.date,
        time: editForm.time,
        status: statusToApiValue(editForm.status),
        notes: editForm.notes,
      };

      const res = await axios.patch(`/api/appoments/${editingId}`, payload);
      if (res.data?.success === false) {
        alert(res.data?.error || "Failed to save appointment.");
        return;
      }

      if (editForm.status === "Completed") {
        const currentAppt = appointments.find((a) => a.id === editingId);
        await deductInventoryForCompletedAppointment({
          treatmentId: editForm.treatmentId || currentAppt?.treatmentId,
          treatmentName: currentAppt?.treatment,
          locationId: currentAppt?.locationId || outletFilter,
        });
      }

      await loadData();
      setEditingId(null);
    } catch (err: any) {
      console.error("Save appointment error:", err);
      alert(err.response?.data?.error || "Failed to save appointment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">


      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
            Appointments
          </h1>

          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] font-medium text-[#345263] outline-none focus:border-[#7da3b3]"
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patient, treatment, doctor..."
                className="w-64 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "All" | Status)}
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
                onChange={(e) => setDateFilter(e.target.value as "All" | "Today" | "Upcoming")}
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
              <span>Name</span>
              <span>Doctor</span>
              <span>Date</span>
              <span>Time</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 bg-white p-12 text-center text-xs text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
                <span>Loading appointments from database...</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-900/5">
                {filtered.map((a, idx) => {
                  const StatusIcon = STATUS_ICONS[a.status];
                  const statusColor = STATUS_COLORS[a.status];
                  const avatarColor = avatarColorFor(a.patientName);

                  return (
                    <div
                      key={`${a.id}-${idx}`}
                      onClick={() => openProfile(a)}
                      className={`${LIST_GRID} group cursor-pointer flex-wrap gap-y-3 bg-white px-5 py-4 transition-colors hover:bg-[#7da3b3]/[0.06] max-sm:flex`}
                    >
                      <div className="flex min-w-[10rem] items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-semibold ${avatarColor}`}
                        >
                          {getInitials(a.patientName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[0.95rem] font-semibold text-slate-900">{a.patientName}</p>
                          <p className="truncate text-[0.8rem] text-slate-500">{a.treatment}</p>
                        </div>
                      </div>

                      <div className="min-w-[8rem] text-[0.85rem] text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                          {a.doctor}
                        </p>
                      </div>

                      <div className="min-w-[7rem] text-[0.85rem] text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                          {formatDateLabel(a.date, todayStr)}
                        </p>
                      </div>

                      <div className="min-w-[6rem] text-[0.85rem] text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                          {formatTimeLabel(a.time)}
                        </p>
                      </div>

                      <span
                        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-medium ${statusColor}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" strokeWidth={2} />
                        {a.status}
                      </span>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(a);
                          }}
                          aria-label="Edit appointment"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <SquarePen className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDelete(a);
                          }}
                          disabled={deletingId === a.id}
                          aria-label="Delete appointment"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="bg-white py-16 text-center text-slate-500">
                    No appointments match your filters.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div onClick={() => setEditingId(null)} className="absolute inset-0" aria-hidden />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setEditingId(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <h2 className="text-[0.95rem] font-semibold text-slate-900">Edit Appointment</h2>
            </div>

            <div className="px-6 py-6">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <User className="h-3.5 w-3.5" strokeWidth={2} />
                      Patient name
                    </span>
                    <input
                      required
                      type="text"
                      value={editForm.patientName}
                      onChange={(e) => updateEdit("patientName", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                      Phone number
                    </span>
                    <input
                      required
                      type="tel"
                      value={editForm.patientPhone}
                      onChange={(e) => updateEdit("patientPhone", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Stethoscope className="h-3.5 w-3.5" strokeWidth={2} />
                      Treatment
                    </span>
                    <select
                      value={editForm.treatmentId}
                      onChange={(e) => updateEdit("treatmentId", e.target.value)}
                      className={inputClass}
                    >
                      {treatmentsList.map((t, idx) => (
                        <option key={`${t.id}-${idx}`} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <User className="h-3.5 w-3.5" strokeWidth={2} />
                      Doctor
                    </span>
                    <select
                      value={editForm.doctorId}
                      onChange={(e) => updateEdit("doctorId", e.target.value)}
                      className={inputClass}
                    >
                      <option value="" disabled>
                        Select doctor
                      </option>
                      {doctorsList.map((d, idx) => (
                        <option key={`${d.id}-${idx}`} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                      Date
                    </span>
                    <input
                      required
                      type="date"
                      value={editForm.date}
                      onChange={(e) => updateEdit("date", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Time
                    </span>
                    <input
                      required
                      type="time"
                      value={editForm.time}
                      onChange={(e) => updateEdit("time", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
                    Status
                  </span>
                  <select
                    value={editForm.status}
                    onChange={(e) => updateEdit("status", e.target.value as Status)}
                    className={inputClass}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                    Notes
                  </span>
                  <textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={(e) => updateEdit("notes", e.target.value)}
                    className={textareaClass}
                  />
                </label>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263] disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={submitting}
                    className="rounded-full px-5 py-2.5 text-[0.9rem] font-medium text-slate-500 transition-colors hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
              <button
                onClick={() => requestDelete(selected)}
                disabled={deletingId === selected.id}
                aria-label="Delete appointment"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete
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

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div onClick={() => setDeleteTarget(null)} className="absolute inset-0" aria-hidden />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <Trash2 className="h-5 w-5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 text-[1.05rem] font-semibold text-slate-900">Delete appointment?</h3>
            <p className="mt-1.5 text-[0.85rem] leading-relaxed text-slate-500">
              This will remove <span className="font-medium text-slate-700">{deleteTarget.patientName}</span>'s
              appointment from your schedule. This can't be undone from here.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingId === deleteTarget.id}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
              >
                {deletingId === deleteTarget.id ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId === deleteTarget.id}
                className="flex-1 rounded-full border border-slate-900/10 px-4 py-2.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}