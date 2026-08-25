"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Clock,
  Coffee,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Calendar,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface SlotSegment {
  start: string;
  end: string;
  type: "free" | "booked" | "break";
}

interface DoctorTimeline {
  id: string;
  name: string;
  specialization: string | null;
  status: "available" | "on_leave" | "not_scheduled";
  shiftStart: string | null;
  shiftEnd: string | null;
  openSlots: number;
  segments: SlotSegment[];
}

const SPECIALIZATION_MAP_FRONTEND: Record<string, string> = {
  general_dentistry: "General Dentistry",
  orthodontics: "Orthodontics",
  endodontics: "Endodontics",
  periodontics: "Periodontics",
  oral_surgery: "Oral Surgery",
  pediatric_dentistry: "Pediatric Dentistry",
  prosthodontics: "Prosthodontics",
};

function formatTime12h(timeStr: string | null): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const minutes = isNaN(m) ? "00" : m.toString().padStart(2, "0");
  return `${h12}:${minutes} ${period}`;
}

function computeSegmentsAndBreak(
  shiftStart: string,
  shiftEnd: string,
  appts: any[] = [],
  breakStart?: string | null,
  breakEnd?: string | null,
  bufferMinutes: number = 30
) {
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const toStr = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}:00`;
  };

  const startMins = toMins(shiftStart);
  const endMins = toMins(shiftEnd);
  if (endMins <= startMins) return { openSlots: 0, segments: [] };

  type Interval = { startMins: number; endMins: number; type: "booked" | "break" };
  const busyList: Interval[] = [];

  if (breakStart && breakEnd) {
    busyList.push({
      startMins: toMins(breakStart),
      endMins: toMins(breakEnd),
      type: "break",
    });
  } else if (breakStart === undefined) {
    const mid = Math.floor((startMins + endMins) / 2);
    busyList.push({
      startMins: mid - 30,
      endMins: mid + 30,
      type: "break",
    });
  }

  for (const a of appts) {
    if (a.startTime && a.endTime) {
      const s = toMins(a.startTime);
      const e = toMins(a.endTime) + bufferMinutes;
      if (s >= startMins && s <= endMins) {
        busyList.push({ startMins: s, endMins: Math.min(e, endMins), type: "booked" });
      }
    }
  }

  busyList.sort((a, b) => a.startMins - b.startMins);

  const segments: { start: string; end: string; type: "free" | "booked" | "break" }[] = [];
  let cursor = startMins;

  for (const b of busyList) {
    if (b.startMins > cursor) {
      segments.push({ start: toStr(cursor), end: toStr(b.startMins), type: "free" });
    }
    segments.push({ start: toStr(b.startMins), end: toStr(b.endMins), type: b.type });
    if (b.endMins > cursor) cursor = b.endMins;
  }

  if (cursor < endMins) {
    segments.push({ start: toStr(cursor), end: toStr(endMins), type: "free" });
  }

  const freeMinutes = segments
    .filter((s) => s.type === "free")
    .reduce((sum, s) => sum + (toMins(s.end) - toMins(s.start)), 0);

  const openSlots = Math.floor(freeMinutes / 30);

  return { openSlots, segments };
}

export default function DoctorAvailabilityTab() {
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [doctors, setDoctors] = useState<DoctorTimeline[]>([]);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    let locId = locationId;

    if (!locId) {
      // Try to read from localStorage if available
      try {
        const savedLoc = localStorage.getItem("dms_location_id") || localStorage.getItem("current_location_id");
        if (savedLoc) locId = savedLoc;
      } catch (e) {}
    }

    if (!locId) {
      const [servicesRes, treatmentsRes, patientsRes, outletsRes, docsRes] = await Promise.all([
        axios.get("/api/services").catch(() => null),
        axios.get("/api/treatment").catch(() => null),
        axios.get("/api/patent").catch(() => null),
        axios.get("/api/outlets").catch(() => null),
        axios.get("/api/doctor/doctoroption").catch(() => null),
      ]);

      locId =
        servicesRes?.data?.data?.services?.[0]?.locationId ||
        treatmentsRes?.data?.data?.treatments?.[0]?.locationId ||
        patientsRes?.data?.data?.patients?.[0]?.locationId ||
        outletsRes?.data?.data?.locations?.[0]?.id ||
        outletsRes?.data?.data?.outlets?.[0]?.id ||
        docsRes?.data?.data?.doctors?.[0]?.locationId ||
        "";

      if (!locId) {
        try {
          const savedLoc = localStorage.getItem("dms_location_id") || localStorage.getItem("current_location_id");
          if (savedLoc) locId = savedLoc;
        } catch (e) {}
      }

      if (locId) {
        setLocationId(locId);
        try {
          localStorage.setItem("dms_location_id", locId);
        } catch (e) {}
      }
    }

    if (!locId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let res = await axios
        .get("/api/doctor/schedule-status", {
          params: { locationId: locId, date: selectedDate },
        })
        .catch(() => null);

      if (!res?.data?.success || !Array.isArray(res.data.data?.doctors) || res.data.data.doctors.length === 0) {
        res = await axios
          .get("/api/doctor/schedule-status", {
            params: { date: selectedDate },
          })
          .catch(() => null);
      }

      let docList: DoctorTimeline[] = res?.data?.success && Array.isArray(res.data.data?.doctors) ? res.data.data.doctors : [];

      if (docList.length === 0) {
        const [docsRes, apptsRes] = await Promise.all([
          axios.get("/api/doctor").catch(() => null),
          axios.get("/api/appoments", { params: { locationId: locId } }).catch(() => null),
        ]);

        const rawDoctors = docsRes?.data?.data?.doctors || [];
        const rawAppts = apptsRes?.data?.data?.appointments || [];

        if (Array.isArray(rawDoctors) && rawDoctors.length > 0) {
          const dayOfWeek = new Date(`${selectedDate}T00:00:00`).getDay();

          docList = await Promise.all(
            rawDoctors.map(async (d: any) => {
              const detailRes = await axios.get(`/api/doctor/${d.id}`).catch(() => null);
              const schedArr = detailRes?.data?.data?.doctor?.schedule || [];
              const daySched = Array.isArray(schedArr)
                ? schedArr.find((s: any) => s.dayOfWeek === dayOfWeek)
                : null;

              if (!daySched || daySched.isOnLeave) {
                return {
                  id: d.id,
                  name: d.name || d.fullName || "Doctor",
                  specialization: d.specialization || "General Dentistry",
                  status: daySched?.isOnLeave ? ("on_leave" as const) : ("not_scheduled" as const),
                  shiftStart: null,
                  shiftEnd: null,
                  openSlots: 0,
                  segments: [],
                };
              }

              const startTime = daySched.startTime ? (daySched.startTime.length === 5 ? `${daySched.startTime}:00` : daySched.startTime) : "09:00:00";
              const endTime = daySched.endTime ? (daySched.endTime.length === 5 ? `${daySched.endTime}:00` : daySched.endTime) : "17:00:00";

              const docAppts = Array.isArray(rawAppts)
                ? rawAppts.filter((a: any) => {
                    if (a.providerId !== d.id) return false;
                    const aDate = a.startTime
                      ? new Date(a.startTime).toISOString().slice(0, 10)
                      : a.date || a.appointmentDate;
                    return aDate === selectedDate;
                  })
                : [];

              const { openSlots, segments } = computeSegmentsAndBreak(
                startTime,
                endTime,
                docAppts,
                daySched.breakStartTime,
                daySched.breakEndTime,
                typeof daySched.bufferTime === "number" ? daySched.bufferTime : 30
              );

              return {
                id: d.id,
                name: d.name || d.fullName || "Doctor",
                specialization: d.specialization || "General Dentistry",
                status: "available" as const,
                shiftStart: startTime,
                shiftEnd: endTime,
                openSlots,
                segments,
              };
            })
          );
        }
      }

      setDoctors(docList);
    } catch (err) {
      console.error("Failed to fetch doctor schedule timeline:", err);
    } finally {
      setLoading(false);
    }
  }, [locationId, selectedDate]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const toggleExpand = (id: string) => {
    setExpandedDocId((prev) => (prev === id ? null : id));
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case "available":
        return { text: "Available", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "on_leave":
        return { text: "On Leave", className: "bg-rose-50 text-rose-700 border-rose-200" };
      case "not_scheduled":
      default:
        return { text: "Not Scheduled", className: "bg-slate-100 text-slate-600 border-slate-200" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Date Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-[#7da3b3]/20 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">

        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-medium text-slate-800 outline-none"
            />
          </div>

          <button
            onClick={fetchTimeline}
            disabled={loading}
            className="flex items-center gap-1.5 p-2 bg-[#7da3b3]/15 text-[#3f6274] hover:bg-[#7da3b3]/30 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            title="Refresh availability"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Header Info Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-[#7da3b3]/20 bg-[#f4fafc] p-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">

        </div>
        <div className="flex items-center gap-4 text-[0.7rem] font-semibold">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Free
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Booked
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Break
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-300" /> Off Scheduled
          </span>
        </div>
      </div>

      {/* Doctors Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-900/5 bg-white p-16 text-center text-xs text-slate-400 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
          <span>Fetching doctor availability...</span>
        </div>
      ) : doctors.length === 0 ? (
        <div className="rounded-2xl border border-slate-900/5 bg-white p-12 text-center text-xs text-slate-400 shadow-sm">
          No doctors found for this location or date.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {doctors.map((doc) => {
            const isExpanded = expandedDocId === doc.id;
            const statusInfo = formatStatus(doc.status);
            const specialtyName =
              SPECIALIZATION_MAP_FRONTEND[doc.specialization || ""] ||
              doc.specialization ||
              "General Dentistry";

            return (
              <div
                key={doc.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition-all hover:border-[#7da3b3]/30"
              >
                <div>
                  {/* Top Row: Name & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{doc.name}</h3>
                      <p className="text-xs text-slate-400">{specialtyName}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${statusInfo.className}`}
                    >
                      {statusInfo.text}
                    </span>
                  </div>

                  {/* Hours & Free Slot Count */}
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {doc.shiftStart && doc.shiftEnd
                        ? `${formatTime12h(doc.shiftStart)} - ${formatTime12h(doc.shiftEnd)}`
                        : "Not Scheduled Today"}
                    </div>
                    <span
                      className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-lg ${doc.openSlots > 0
                        ? "text-[#6b92a2] bg-[#7da3b3]/15"
                        : "text-slate-400 bg-slate-100"
                        }`}
                    >
                      {doc.openSlots} open {doc.openSlots === 1 ? "slot" : "slots"}
                    </span>
                  </div>

                  {/* Shift Timeline Bar */}
                  {doc.shiftStart && doc.shiftEnd && doc.segments.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-[0.65rem] font-bold text-slate-400">
                        <span>{formatTime12h(doc.shiftStart)}</span>
                        <span>Shift Timeline</span>
                        <span>{formatTime12h(doc.shiftEnd)}</span>
                      </div>
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        {doc.segments.map((seg, i) => (
                          <div
                            key={i}
                            className={`h-full ${seg.type === "free"
                              ? "bg-emerald-400"
                              : seg.type === "booked"
                                ? "bg-sky-400"
                                : "bg-amber-400"
                              }`}
                            style={{ width: `${100 / doc.segments.length}%` }}
                            title={`${formatTime12h(seg.start)} - ${formatTime12h(seg.end)}: ${seg.type}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Toggle for Segment Details */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(doc.id)}
                    className="flex w-full items-center justify-between text-xs font-semibold text-[#7da3b3] hover:text-[#345263] transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <Coffee className="h-3.5 w-3.5" />
                      View Full Schedule
                    </span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {/* Expanded Slot List */}
                  {isExpanded && (
                    <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-xl bg-[#f4fafc] p-3 text-xs border border-[#7da3b3]/20">
                      {doc.status === "on_leave" ? (
                        <p className="text-slate-500 italic">Doctor is on leave today.</p>
                      ) : doc.status === "not_scheduled" || doc.segments.length === 0 ? (
                        <p className="text-slate-500 italic">No scheduled shifts for this date.</p>
                      ) : (
                        doc.segments.map((seg, i) => (
                          <div
                            key={i}
                            className={`flex items-center justify-between p-2 rounded-lg border ${seg.type === "free"
                              ? "bg-white border-emerald-200"
                              : seg.type === "booked"
                                ? "bg-white border-sky-200"
                                : "bg-white border-amber-200"
                              }`}
                          >
                            <span className="font-medium text-slate-800">
                              {formatTime12h(seg.start)} - {formatTime12h(seg.end)}
                            </span>
                            <span
                              className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-md ${seg.type === "free"
                                ? "text-emerald-700 bg-emerald-50"
                                : seg.type === "booked"
                                  ? "text-sky-700 bg-sky-50"
                                  : "text-amber-700 bg-amber-50"
                                }`}
                            >
                              {seg.type === "free" && <CheckCircle2 className="h-3 w-3" />}
                              {seg.type === "booked" && <XCircle className="h-3 w-3" />}
                              {seg.type === "break" && <Coffee className="h-3 w-3" />}
                              {seg.type === "free"
                                ? "Free"
                                : seg.type === "booked"
                                  ? "Booked"
                                  : "Break"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}