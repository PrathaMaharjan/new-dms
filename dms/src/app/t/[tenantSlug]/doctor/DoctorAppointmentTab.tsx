"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Calendar,
  Clock,
  User,
  Search,
  CheckCircle2,
  Stethoscope,
  CalendarDays,
  UserCheck,
  Phone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export interface DoctorAppointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientAge?: number | null;
  service: string;
  date: string;
  time: string;
  rawStartTime: string;
  status: "Confirmed" | "In Progress" | "Completed" | "Cancelled";
  attendance: "Pending" | "Checked In" | "No Show";
  rawStatus?: string;
  notes?: string;
}

function formatTimeDisplay(isoString: string) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { date: "-", time: "-" };
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: `${formattedHours}:${minutes} ${ampm}`,
  };
}

function getTodayStr() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
    } catch (e) {}
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
      } catch (e) {}
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
  } catch (err) {}
}

export default function DoctorAppointmentsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPeriod, setFilterPeriod] = useState<
    "all" | "today" | "upcoming" | "checked_in" | "completed"
  >("all");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState<string | null>(null);

  const todayStr = getTodayStr();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);


      let currentLocId = locationId;
      let myUserId: string | null = null;

      const userRes = await axios.get("/api/user-details").catch(() => null);
      if (userRes?.data?.success && userRes.data.data?.user) {
        myUserId = userRes.data.data.user.id || null;
        if (!currentLocId && userRes.data.data.user.locationId) {
          currentLocId = userRes.data.data.user.locationId;
          setLocationId(currentLocId);
        }
      }

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

      if (currentLocId) {

        const apptsRes = await axios.get("/api/appoments", {
          params: {
            locationId: currentLocId,
            ...(myUserId ? { doctorId: myUserId } : {}),
          },
        });

        if (apptsRes.data?.success && apptsRes.data.data.appointments) {
          const mapped: DoctorAppointment[] = apptsRes.data.data.appointments.map(
            (a: any) => {
              const { date, time } = formatTimeDisplay(a.startTime);
              let status: DoctorAppointment["status"] = "Confirmed";
              let attendance: DoctorAppointment["attendance"] = "Pending";

              if (a.status === "completed") {
                status = "Completed";
                attendance = "Checked In";
              } else if (a.status === "checked_in") {
                status = "Confirmed";
                attendance = "Checked In";
              } else if (a.status === "no_show") {
                status = "Confirmed";
                attendance = "No Show";
              } else if (a.status === "cancelled") {
                status = "Cancelled";
                attendance = "Pending";
              }

              return {
                id: a.id,
                patientName: a.patientName || "Patient",
                patientPhone: a.patientPhone || "-",
                patientAge: a.patientAge != null ? Number(a.patientAge) : null,
                service: a.treatmentName || "General Service",
                date,
                time,
                rawStartTime: a.startTime,
                status,
                attendance,
                rawStatus: a.status,
                notes: a.notes || "",
              };
            }
          );

          setAppointments(mapped);
        }
      } else {
        setErrorMsg("Location ID could not be identified for this session.");
      }
    } catch (err: any) {
      console.error("Failed to load doctor appointments:", err);
      setErrorMsg(err.response?.data?.error || "Failed to fetch appointments from server.");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkAttendance = async (
    id: string,
    statusValue: string
  ) => {

    setAppointments((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          let status: DoctorAppointment["status"] = "Confirmed";
          let attendance: DoctorAppointment["attendance"] = "Pending";

          if (statusValue === "completed") {
            status = "Completed";
            attendance = "Checked In";
          } else if (statusValue === "checked_in") {
            status = "Confirmed";
            attendance = "Checked In";
          } else if (statusValue === "no_show") {
            status = "Confirmed";
            attendance = "No Show";
          } else if (statusValue === "cancelled") {
            status = "Cancelled";
            attendance = "Pending";
          }

          return {
            ...item,
            rawStatus: statusValue,
            status,
            attendance,
          };
        }
        return item;
      })
    );

    try {
      setUpdatingId(id);
      const res = await axios.patch(`/api/appoments/${id}/status`, {
        status: statusValue,
      });
      if (res.data?.success) {
        if (statusValue === "completed") {
          const targetAppt = appointments.find((a) => a.id === id);
          await deductInventoryForCompletedAppointment({
            treatmentName: targetAppt?.service,
            locationId: locationId || undefined,
          });
        }
        await loadData();
      } else {
        alert(res.data?.error || "Failed to update attendance status.");
        await loadData();
      }
    } catch (err: any) {
      console.error("Attendance update error:", err);
      alert(err.response?.data?.error || "Failed to update attendance status.");
      await loadData();
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleAppointmentExpansion = (appointmentId: string) => {
    setExpandedAppointmentId((prev) => (prev === appointmentId ? null : appointmentId));
  };

  const handleCompleteAppointment = async (id: string) => {
    try {
      setUpdatingId(id);
      const targetAppt = appointments.find((a) => a.id === id);
      const res = await axios.patch(`/api/appoments/${id}/status`, {
        status: "completed",
      });
      if (res.data?.success) {
        await deductInventoryForCompletedAppointment({
          treatmentName: targetAppt?.service,
          locationId: locationId || undefined,
        });
        await loadData();
      } else {
        alert(res.data?.error || "Failed to complete appointment.");
      }
    } catch (err: any) {
      console.error("Completion error:", err);
      alert(err.response?.data?.error || "Failed to complete appointment.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUndoCompletion = async (id: string) => {
    try {
      setUpdatingId(id);
      const res = await axios.patch(`/api/appoments/${id}/status`, {
        status: "checked_in",
      });
      if (res.data?.success) {
        await loadData();
      } else {
        alert(res.data?.error || "Failed to undo completion.");
      }
    } catch (err: any) {
      console.error("Undo completion error:", err);
      alert(err.response?.data?.error || "Failed to undo completion.");
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = {
    today: appointments.filter((a) => a.date === todayStr).length,
    upcoming: appointments.filter(
      (a) => a.date >= todayStr && a.status !== "Completed"
    ).length,
    checkedIn: appointments.filter(
      (a) => a.attendance === "Checked In" && a.status !== "Completed"
    ).length,
    completed: appointments.filter((a) => a.status === "Completed").length,
  };

  const filteredAppointments = appointments.filter((appt) => {
    const matchesSearch =
      appt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appt.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appt.patientPhone.includes(searchQuery) ||
      appt.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterPeriod === "today") return appt.date === todayStr;
    if (filterPeriod === "upcoming")
      return appt.date >= todayStr && appt.status !== "Completed";
    if (filterPeriod === "checked_in")
      return appt.attendance === "Checked In" && appt.status !== "Completed";
    if (filterPeriod === "completed") return appt.status === "Completed";
    return true;
  });

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAppointments = filteredAppointments.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="w-full space-y-6 text-slate-800">
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700">
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

      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Today&apos;s Visits
            </span>
            <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.today}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Upcoming
            </span>
            <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {stats.upcoming}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Checked-In
            </span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {stats.checkedIn}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Completed
            </span>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {stats.completed}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by patient name, phone, service, or ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#7da3b3] focus:bg-white transition-all"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
          {(["all", "today", "upcoming", "checked_in", "completed"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => {
                  setFilterPeriod(tab);
                  setCurrentPage(1);
                }}
                className={`rounded-md px-3 py-1.5 font-semibold capitalize transition-all ${filterPeriod === tab
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                {tab.replace("-", " ")}
              </button>
            )
          )}
        </div>
      </div>

      {/* Tabular Appointments List */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-900/5 bg-white/90 shadow-lg backdrop-blur-sm flex flex-col justify-between">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
            <span>Loading appointments from database...</span>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[1080px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="p-4 pl-6">Patient Name</th>
                  <th className="p-4">Age</th>
                  <th className="p-4">Phone Number</th>
                  <th className="p-4">Service</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Attendance</th>
                  <th className="p-4 pr-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center">
                      <Stethoscope className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-600">
                        No appointments found
                      </p>
                      <p className="text-[0.75rem] text-slate-400 mt-0.5">
                        Try tweaking your search term or tab filter.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedAppointments.map((item) => {
                    const isExpanded = expandedAppointmentId === item.id;

                    return (
                      <Fragment key={item.id}>
                        <tr
                          className={`cursor-pointer hover:bg-slate-50/50 transition-colors ${item.status === "Completed" ? "bg-slate-50/40" : ""
                            }`}
                          onClick={() => toggleAppointmentExpansion(item.id)}
                        >
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-sky-50 flex items-center justify-center text-[#7da3b3] font-bold shrink-0 border border-sky-100">
                                <User className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 text-xs">
                                  {item.patientName}
                                </p>

                              </div>
                            </div>
                          </td>

                          <td className="p-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                            {item.patientAge != null && item.patientAge >= 0 ? `${item.patientAge} yrs` : "-"}
                          </td>

                          <td className="p-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {item.patientPhone}
                            </div>
                          </td>

                          <td className="p-4 text-xs font-medium text-slate-800">
                            <span className="inline-block bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                              {item.service}
                            </span>
                          </td>

                          <td className="p-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {item.date}
                            </div>
                          </td>

                          <td className="p-4 text-xs font-semibold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {item.time}
                            </div>
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.65rem] font-bold ${item.status === "Completed"
                                  ? "bg-slate-100 text-slate-600 border border-slate-200"
                                  : "bg-sky-50 text-sky-700 border border-sky-200"
                                }`}
                            >
                              {item.status}
                            </span>
                          </td>

                          {/* Attendance Column */}
                          <td className="p-4 text-center whitespace-nowrap">
                            <select
                              onClick={(e) => e.stopPropagation()}
                              disabled={updatingId === item.id}
                              value={
                                item.rawStatus ||
                                (item.status === "Completed"
                                  ? "completed"
                                  : item.status === "Cancelled"
                                    ? "cancelled"
                                    : item.attendance === "Checked In"
                                      ? "checked_in"
                                      : item.attendance === "No Show"
                                        ? "no_show"
                                        : "confirmed")
                              }
                              onChange={(e) =>
                                handleMarkAttendance(
                                  item.id,
                                  e.target.value
                                )
                              }
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none transition-all cursor-pointer disabled:opacity-50 ${item.attendance === "Checked In" || item.status === "Completed"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : item.attendance === "No Show" || item.status === "Cancelled"
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                              <option value="confirmed">Confirmed (Pending)</option>
                              <option value="checked_in">Checked In</option>
                              <option value="no_show">No Show</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>

                          {/* Action Column */}
                          <td className="p-4 pr-6 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1.5">
                              {item.status !== "Completed" ? (
                                item.attendance === "Checked In" ? (
                                  <button
                                    disabled={updatingId === item.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCompleteAppointment(item.id);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#7da3b3] px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {updatingId === item.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    )}
                                    Complete
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400 font-medium italic">
                                    Check in first
                                  </span>
                                )
                              ) : (
                                <button
                                  disabled={updatingId === item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUndoCompletion(item.id);
                                  }}
                                  title="Click to undo completion"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Done
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/40">
                            <td colSpan={9} className="px-6 pb-4">
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                <p className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
                                  Appointment Notes
                                </p>
                                <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap break-words">
                                  {item.notes?.trim() || "No notes added for this appointment."}
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && filteredAppointments.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-xs">
            <span className="text-[0.7rem] text-slate-500 font-medium">
              Showing{" "}
              <strong className="text-slate-800">
                {filteredAppointments.length > 0 ? startIndex + 1 : 0}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-800">
                {Math.min(startIndex + itemsPerPage, filteredAppointments.length)}
              </strong>{" "}
              of <strong className="text-slate-800">{filteredAppointments.length}</strong>
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
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
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}