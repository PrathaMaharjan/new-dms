"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  Clock,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Coffee,
  XCircle,
  ArrowRight,
  User,
  Copy,
  Calendar,
  Sparkles,
  Timer,
  X,
} from "lucide-react";

export interface ScheduleDay {
  dayOfWeek: number;
  dayName: string;
  isOnLeave: boolean;
  startTime: string;
  endTime: string;
  hasBreak?: boolean;
  breakStartTime?: string;
  breakEndTime?: string;
  bufferTime?: number;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_SCHEDULE: ScheduleDay[] = DAY_NAMES.map((name, index) => ({
  dayOfWeek: index,
  dayName: name,
  isOnLeave: index === 0 || index === 6,
  startTime: "09:00",
  endTime: "17:00",
  hasBreak: false,
  breakStartTime: "13:00",
  breakEndTime: "14:00",
  bufferTime: 30,
}));

function calculateBreakDuration(start?: string, end?: string): string {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return "";
  const diffMins = eh * 60 + em - (sh * 60 + sm);
  if (diffMins <= 0) return "";
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours > 0 && mins > 0) return `${hours} hr ${mins} min`;
  if (hours > 0) return `${hours} hr`;
  return `${mins} min`;
}

interface DoctorScheduleEditorProps {
  doctorId?: string;
  doctorName?: string;
  locationId?: string;
  showDoctorSelector?: boolean;
  compact?: boolean;
  onSaveSuccess?: () => void;
}

export default function DoctorScheduleEditor({
  doctorId: initialDoctorId,
  doctorName: initialDoctorName,
  locationId: initialLocationId,
  showDoctorSelector = false,
  compact = false,
  onSaveSuccess,
}: DoctorScheduleEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doctorsList, setDoctorsList] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(() => {
    if (initialDoctorId) return initialDoctorId;
    if (showDoctorSelector && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dms_selected_doctor_schedule_id");
        if (saved) return saved;
      } catch (e) {}
    }
    return "";
  });
  const [currentDoctorName, setCurrentDoctorName] = useState<string>(initialDoctorName || "");
  const [selectedLocationId, setSelectedLocationId] = useState<string>(initialLocationId || "");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE);
  const [bufferMinutes, setBufferMinutes] = useState<number>(30);
  const [showBufferSettings, setShowBufferSettings] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Sync if initialDoctorId changes
  useEffect(() => {
    if (initialDoctorId && initialDoctorId !== selectedDoctorId) {
      setSelectedDoctorId(initialDoctorId);
    }
  }, [initialDoctorId, selectedDoctorId]);

  // Sync if initialDoctorName changes
  useEffect(() => {
    if (initialDoctorName && initialDoctorName !== currentDoctorName) {
      setCurrentDoctorName(initialDoctorName);
    }
  }, [initialDoctorName, currentDoctorName]);

  // Sync if initialLocationId changes
  useEffect(() => {
    if (initialLocationId && initialLocationId !== selectedLocationId) {
      setSelectedLocationId(initialLocationId);
    }
  }, [initialLocationId, selectedLocationId]);

  // Initialize context: locationId & doctor list
  useEffect(() => {
    async function initContext() {
      try {
        let locId = selectedLocationId || initialLocationId;
        if (!locId) {
          try {
            const savedLoc = localStorage.getItem("dms_location_id") || localStorage.getItem("current_location_id");
            if (savedLoc) locId = savedLoc;
          } catch (e) {}
        }

        if (!locId) {
          const outletsRes = await axios.get("/api/outlets").catch(() => null);
          locId =
            outletsRes?.data?.data?.locations?.[0]?.id ||
            outletsRes?.data?.data?.outlets?.[0]?.id ||
            "";
        }

        if (locId && isMountedRef.current) {
          setSelectedLocationId(locId);
          try {
            localStorage.setItem("dms_location_id", locId);
          } catch (e) {}
        }

        // When showDoctorSelector is true, load full doctor list for dropdown
        if (showDoctorSelector) {
          const docRes = await axios.get("/api/doctor", {
            params: locId ? { locationId: locId } : undefined,
          }).catch(() => null);

          if (docRes?.data?.success && Array.isArray(docRes.data.data?.doctors) && isMountedRef.current) {
            const docs = docRes.data.data.doctors;
            setDoctorsList(docs);

            if (!initialDoctorId) {
              let targetId = selectedDoctorId;
              if (!targetId || !docs.some((d: any) => d.id === targetId)) {
                const userRes = await axios.get("/api/user-details").catch(() => null);
                const u = userRes?.data?.success ? userRes.data.data?.user : null;
                const matchingDoc = docs.find((d: any) => d.id === u?.id || d.email === u?.email) || docs[0];
                if (matchingDoc) {
                  targetId = matchingDoc.id;
                  setCurrentDoctorName(matchingDoc.name);
                }
              }

              if (targetId && isMountedRef.current) {
                setSelectedDoctorId(targetId);
                try {
                  localStorage.setItem("dms_selected_doctor_schedule_id", targetId);
                } catch (e) {}
              }
            }
          }
        } else {
          // In single doctor view (Doctor's My Availability page), strictly resolve logged-in doctor
          if (!initialDoctorId) {
            const userRes = await axios.get("/api/user-details").catch(() => null);
            const u = userRes?.data?.success ? userRes.data.data?.user : null;
            if (u?.id && isMountedRef.current) {
              setSelectedDoctorId(u.id);
              if (u.name) setCurrentDoctorName(u.name);
            }
          }
        }
      } catch (err) {
        console.error("Failed to initialize doctor schedule context:", err);
      }
    }

    initContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDoctorId, initialLocationId, showDoctorSelector]);

  // Fetch schedule for the active doctor
  const loadDoctorSchedule = useCallback(async (docId: string) => {
    if (!docId) {
      if (isMountedRef.current) setLoading(false);
      return;
    }

    try {
      if (isMountedRef.current) {
        setLoading(true);
        setErrorMsg(null);
      }

      // Try doctor/[id] first, or doctor/me fallback
      let res = await axios.get(`/api/doctor/${docId}`).catch(() => null);
      if (!res?.data?.success) {
        res = await axios.get("/api/doctor/me/schedule").catch(() => null);
      }

      const fetched = res?.data?.data?.doctor?.schedule || res?.data?.data?.schedule;
      if (res?.data?.data?.doctor?.name && isMountedRef.current) {
        setCurrentDoctorName(res.data.data.doctor.name);
      }

      if (Array.isArray(fetched) && fetched.length > 0 && isMountedRef.current) {
        let detectedBuffer = 30;
        const targetDayWithBuffer =
          fetched.find(
            (s: any) =>
              !s.isOnLeave &&
              (typeof s.bufferTime === "number" || typeof s.bufferMinutes === "number"),
          ) ||
          fetched.find(
            (s: any) =>
              typeof s.bufferTime === "number" || typeof s.bufferMinutes === "number",
          );
        if (targetDayWithBuffer) {
          detectedBuffer =
            typeof targetDayWithBuffer.bufferTime === "number"
              ? targetDayWithBuffer.bufferTime
              : targetDayWithBuffer.bufferMinutes;
        }
        setBufferMinutes(detectedBuffer);

        const merged = DEFAULT_SCHEDULE.map((defaultDay) => {
          const existing = fetched.find((s: any) => s.dayOfWeek === defaultDay.dayOfWeek);
          if (existing) {
            const sTime = existing.startTime ? existing.startTime.slice(0, 5) : "09:00";
            const eTime = existing.endTime ? existing.endTime.slice(0, 5) : "17:00";
            const bStart = existing.breakStartTime ? existing.breakStartTime.slice(0, 5) : "";
            const bEnd = existing.breakEndTime ? existing.breakEndTime.slice(0, 5) : "";
            const hasBreak = Boolean(!existing.isOnLeave && bStart && bEnd);

            return {
              ...defaultDay,
              isOnLeave: Boolean(existing.isOnLeave),
              startTime: sTime,
              endTime: eTime,
              hasBreak,
              breakStartTime: bStart || "13:00",
              breakEndTime: bEnd || "14:00",
              bufferTime: detectedBuffer,
            };
          }
          return defaultDay;
        });
        setSchedule(merged);
      } else if (isMountedRef.current) {
        setSchedule(DEFAULT_SCHEDULE);
      }
    } catch (err) {
      console.error("Failed to load doctor schedule:", err);
      if (isMountedRef.current) {
        setErrorMsg("Failed to load schedule for this doctor.");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedDoctorId) {
      loadDoctorSchedule(selectedDoctorId);
    }
  }, [selectedDoctorId, loadDoctorSchedule]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctorId(id);
    const doc = doctorsList.find((d) => d.id === id);
    if (doc) setCurrentDoctorName(doc.name);
    try {
      localStorage.setItem("dms_selected_doctor_schedule_id", id);
    } catch (e) {}
  };

  const handleToggleLeave = (dayOfWeek: number) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, isOnLeave: !day.isOnLeave } : day
      )
    );
  };

  const handleToggleBreak = (dayOfWeek: number) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              hasBreak: !day.hasBreak,
              breakStartTime: day.breakStartTime || "13:00",
              breakEndTime: day.breakEndTime || "14:00",
            }
          : day
      )
    );
  };

  const handleTimeChange = (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

  const handleBreakTimeChange = (
    dayOfWeek: number,
    field: "breakStartTime" | "breakEndTime",
    value: string
  ) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

  const handleBufferTimeChange = (minutes: number) => {
    const clamped = Math.max(0, Math.min(180, isNaN(minutes) ? 0 : minutes));
    setBufferMinutes(clamped);
  };

  const handleQuickBreakPreset = (
    dayOfWeek: number,
    start: string,
    end: string
  ) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              hasBreak: true,
              breakStartTime: start,
              breakEndTime: end,
            }
          : day
      )
    );
  };

  const handleApplyToAllWorkingDays = (sourceDayOfWeek: number) => {
    const source = schedule.find((d) => d.dayOfWeek === sourceDayOfWeek);
    if (!source) return;

    setSchedule((prev) =>
      prev.map((day) => {
        if (day.isOnLeave) return day;
        return {
          ...day,
          startTime: source.startTime,
          endTime: source.endTime,
          hasBreak: source.hasBreak,
          breakStartTime: source.breakStartTime,
          breakEndTime: source.breakEndTime,
        };
      })
    );

    setSuccessMsg(
      `Applied ${source.dayName}'s shift hours and lunch break to all active working days!`
    );
    setTimeout(() => {
      if (isMountedRef.current) setSuccessMsg(null);
    }, 3000);
  };

  const handleSaveSchedule = async () => {
    if (!selectedDoctorId) {
      setErrorMsg("Please select a doctor to configure.");
      return;
    }

    let activeLocId = selectedLocationId;
    if (!activeLocId) {
      try {
        const savedLoc = localStorage.getItem("dms_location_id") || localStorage.getItem("current_location_id");
        if (savedLoc) activeLocId = savedLoc;
      } catch (e) {}
    }

    if (!activeLocId) {
      const outletsRes = await axios.get("/api/outlets").catch(() => null);
      activeLocId = outletsRes?.data?.data?.locations?.[0]?.id || outletsRes?.data?.data?.outlets?.[0]?.id || "";
      if (activeLocId) setSelectedLocationId(activeLocId);
    }

    if (!activeLocId) {
      setErrorMsg("Clinic location could not be determined. Please refresh and try again.");
      return;
    }

    // Validation for breaks
    for (const day of schedule) {
      if (!day.isOnLeave && day.hasBreak) {
        if (!day.breakStartTime || !day.breakEndTime) {
          setErrorMsg(`Please set both break start and end time for ${day.dayName}, or uncheck lunch break.`);
          return;
        }
        if (day.breakStartTime >= day.breakEndTime) {
          setErrorMsg(`For ${day.dayName}, break end time must be after break start time.`);
          return;
        }
        if (day.breakStartTime < day.startTime || day.breakEndTime > day.endTime) {
          setErrorMsg(`For ${day.dayName}, lunch break must be within shift hours (${day.startTime} - ${day.endTime}).`);
          return;
        }
      }
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        locationId: activeLocId,
        schedule: schedule.map((day) => {
          const sTime = day.startTime?.trim();
          const eTime = day.endTime?.trim();
          const bStart = !day.isOnLeave && day.hasBreak && day.breakStartTime ? day.breakStartTime.trim() : null;
          const bEnd = !day.isOnLeave && day.hasBreak && day.breakEndTime ? day.breakEndTime.trim() : null;

          return {
            dayOfWeek: day.dayOfWeek,
            isOnLeave: day.isOnLeave,
            startTime: day.isOnLeave
              ? undefined
              : sTime && sTime.length === 5
                ? `${sTime}:00`
                : sTime || "09:00:00",
            endTime: day.isOnLeave
              ? undefined
              : eTime && eTime.length === 5
                ? `${eTime}:00`
                : eTime || "17:00:00",
            breakStartTime: bStart && bStart.length === 5 ? `${bStart}:00` : bStart,
            breakEndTime: bEnd && bEnd.length === 5 ? `${bEnd}:00` : bEnd,
            bufferTime: bufferMinutes,
            bufferMinutes: bufferMinutes,
          };
        }),
      };

      // Call doctor schedule endpoint
      let res = await axios.patch(`/api/doctor/${selectedDoctorId}/schedule`, payload).catch((err) => err.response || null);

      if (!res?.data?.success) {
        // Fallback to me endpoint
        const meRes = await axios.patch("/api/doctor/me/schedule", payload).catch((err) => err.response || null);
        if (meRes?.data?.success) {
          res = meRes;
        }
      }

      if (res?.data?.success) {
        setSuccessMsg("Weekly schedule, lunch breaks, and appointment buffer time saved successfully!");
        window.dispatchEvent(new CustomEvent("doctor_schedule_updated", { detail: { doctorId: selectedDoctorId } }));
        if (onSaveSuccess) onSaveSuccess();

        // Immediately reload from server to ensure state consistency
        await loadDoctorSchedule(selectedDoctorId);

        setTimeout(() => {
          if (isMountedRef.current) setSuccessMsg(null);
        }, 3500);
      } else {
        setErrorMsg(res?.data?.error || "Failed to save schedule.");
      }
    } catch (err: any) {
      console.error("Failed to save doctor schedule:", err);
      setErrorMsg(err.response?.data?.error || "An error occurred while saving schedule.");
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

  const activeDocName =
    currentDoctorName ||
    initialDoctorName ||
    doctorsList.find((d) => d.id === selectedDoctorId)?.name ||
    "Doctor";

  return (
    <div className={`w-full ${compact ? "space-y-4" : "space-y-6"}`}>
      {/* Notifications */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600 font-bold cursor-pointer">
            ×
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600 font-bold cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* Header controls (Doctor Selector + Buffer Time Button + Save button) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7da3b3]/15 text-[#345263]">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              Working Hours & Lunch Breaks
            </h3>
            <p className="text-[0.75rem] text-slate-500">
              Set shift times, lunch breaks, and off days for {activeDocName}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {showDoctorSelector && doctorsList.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedDoctorId}
                onChange={(e) => handleDoctorChange(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
              >
                {doctorsList.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Buffer Time Toggle Button */}
          <button
            type="button"
            onClick={() => setShowBufferSettings((prev) => !prev)}
            title="Click to configure appointment buffer time"
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer border ${
              showBufferSettings
                ? "bg-[#7da3b3] text-white border-[#7da3b3] shadow-sm ring-2 ring-[#7da3b3]/30"
                : "bg-[#7da3b3]/10 text-[#345263] border-[#7da3b3]/30 hover:bg-[#7da3b3]/20 hover:border-[#7da3b3]/50"
            }`}
          >
            <Timer className={`h-3.5 w-3.5 ${showBufferSettings ? "text-white" : "text-[#7da3b3]"}`} />
            <span>Buffer Time</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold ${
                showBufferSettings
                  ? "bg-white/25 text-white"
                  : "bg-[#7da3b3]/20 text-[#345263]"
              }`}
            >
              {bufferMinutes === 0 ? "0m" : `${bufferMinutes}m`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={saving || loading}
            className="flex items-center gap-2 rounded-full bg-[#7da3b3] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#345263] disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Save Schedule
              </>
            )}
          </button>
        </div>
      </div>

      {/* Buffer Time Panel (Shown when clicking the Buffer Time button) */}
      {showBufferSettings && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#7da3b3]/40 bg-gradient-to-r from-[#f4fafc] to-white shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7da3b3]/15 text-[#345263] shadow-xs">
              <Timer className="h-5 w-5 text-[#7da3b3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900">
                  Appointment Buffer Time
                </h4>
                <span className="inline-flex items-center rounded-full bg-[#7da3b3]/15 px-2 py-0.5 text-[0.68rem] font-bold text-[#345263] border border-[#7da3b3]/30">
                  {bufferMinutes === 0 ? "No buffer (0 min)" : `+${bufferMinutes} min buffer`}
                </span>
              </div>
              <p className="text-[0.72rem] text-slate-500">
                Rest or preparation time automatically added between consecutive appointments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="flex flex-wrap items-center gap-1.5">
              {[0, 10, 15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleBufferTimeChange(mins)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    bufferMinutes === mins
                      ? "bg-[#7da3b3] text-white border-[#7da3b3] shadow-xs ring-2 ring-[#7da3b3]/30"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-[#7da3b3]/10 hover:text-[#345263] hover:border-[#7da3b3]/30"
                  }`}
                >
                  {mins === 0 ? "None" : `${mins}m`}
                </button>
              ))}

              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-xs">
                <input
                  type="number"
                  min="0"
                  max="180"
                  step="5"
                  value={bufferMinutes}
                  onChange={(e) => handleBufferTimeChange(parseInt(e.target.value, 10))}
                  className="w-10 bg-transparent text-right font-bold text-slate-800 outline-none text-xs"
                />
                <span className="text-[0.7rem] text-slate-400 font-medium">min</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBufferSettings(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer ml-1"
              title="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Date highlighter info bar */}
      {!compact && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-[#7da3b3]/20 bg-[#f4fafc] p-3 text-xs text-slate-700">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-[#7da3b3]" />
            <span>
              <strong className="font-semibold text-slate-800">Date Preview:</strong> Select a date to highlight its scheduled shift and lunch break below.
            </span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-[#7da3b3]/30 rounded-lg px-2.5 py-1 font-semibold text-slate-800 text-xs shadow-sm outline-none cursor-pointer"
          />
        </div>
      )}

      {/* Main schedule content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white p-12 text-center text-xs text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
          <span>Loading schedule...</span>
        </div>
      ) : (
        <div className="grid gap-3">
          {schedule.map((day) => {
            const selectedDayOfWeek = new Date(selectedDate + "T00:00:00").getDay();
            const isSelectedDay = !compact && selectedDayOfWeek === day.dayOfWeek;
            const breakDuration = day.hasBreak ? calculateBreakDuration(day.breakStartTime, day.breakEndTime) : "";

            return (
              <div
                key={day.dayOfWeek}
                className={`flex flex-col gap-3 p-3.5 rounded-xl border transition-all ${
                  isSelectedDay
                    ? "ring-2 ring-[#7da3b3] bg-[#7da3b3]/5 border-[#7da3b3]"
                    : day.isOnLeave
                    ? "bg-slate-50/70 border-slate-200/80"
                    : "bg-white border-slate-200/90 shadow-sm"
                }`}
              >
                {/* Row Header: Day, Toggle Leave, Shift Start/End */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                          isSelectedDay
                            ? "bg-[#7da3b3] text-white"
                            : day.isOnLeave
                            ? "bg-slate-200 text-slate-500"
                            : "bg-[#7da3b3]/15 text-[#345263]"
                        }`}
                      >
                        {day.dayName.substring(0, 3)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {day.dayName}
                          {isSelectedDay && (
                            <span className="text-[0.6rem] font-bold bg-[#7da3b3] text-white px-1.5 py-0.5 rounded-full">
                              Selected Date
                            </span>
                          )}
                        </h4>
                        <p className="text-[0.7rem] text-slate-400">
                          {day.isOnLeave ? "Day Off / Leave" : "Working Day"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleLeave(day.dayOfWeek)}
                      title={day.isOnLeave ? "Click to set as Working Day" : "Click to set as Day Off"}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        !day.isOnLeave ? "bg-[#7da3b3]" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          !day.isOnLeave ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {!day.isOnLeave ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                        <span className="text-slate-400 font-medium text-[0.7rem]">Shift:</span>
                        <input
                          type="time"
                          value={day.startTime}
                          onChange={(e) =>
                            handleTimeChange(day.dayOfWeek, "startTime", e.target.value)
                          }
                          className="bg-transparent font-semibold text-slate-800 outline-none text-xs cursor-pointer"
                        />
                      </div>

                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />

                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                        <span className="text-slate-400 font-medium text-[0.7rem]">To:</span>
                        <input
                          type="time"
                          value={day.endTime}
                          onChange={(e) =>
                            handleTimeChange(day.dayOfWeek, "endTime", e.target.value)
                          }
                          className="bg-transparent font-semibold text-slate-800 outline-none text-xs cursor-pointer"
                        />
                      </div>

                      {/* Copy to all button */}
                      <button
                        type="button"
                        onClick={() => handleApplyToAllWorkingDays(day.dayOfWeek)}
                        title="Apply this day's shift hours and break to all working days"
                        className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-[#7da3b3] hover:text-[#345263] bg-[#7da3b3]/10 hover:bg-[#7da3b3]/20 px-2 py-1 rounded-lg transition-colors ml-auto sm:ml-2 cursor-pointer"
                      >
                        <Copy className="h-3 w-3" /> Apply to all
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 bg-slate-100 border border-slate-200">
                      <XCircle className="h-3.5 w-3.5" /> Off Day
                    </span>
                  )}
                </div>

                {/* Lunch Break Subsection */}
                {!day.isOnLeave && (
                  <div className="mt-1 rounded-lg border border-amber-200/80 bg-amber-50/40 p-2.5 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(day.hasBreak)}
                          onChange={() => handleToggleBreak(day.dayOfWeek)}
                          className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                        />
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                          <Coffee className="h-3.5 w-3.5 text-amber-600" />
                          Add Lunch Break
                        </span>
                        {day.hasBreak && breakDuration && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-0.5 text-[0.65rem] font-bold text-amber-800 border border-amber-200">
                            <Sparkles className="h-2.5 w-2.5 text-amber-600" /> {breakDuration}
                          </span>
                        )}
                      </label>

                      {day.hasBreak ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-lg px-2 py-0.5 shadow-sm">
                            <span className="text-amber-700 font-medium text-[0.65rem]">Start:</span>
                            <input
                              type="time"
                              value={day.breakStartTime || "13:00"}
                              onChange={(e) =>
                                handleBreakTimeChange(day.dayOfWeek, "breakStartTime", e.target.value)
                              }
                              className="bg-transparent font-bold text-slate-800 outline-none text-xs cursor-pointer"
                            />
                          </div>

                          <span className="text-slate-400">-</span>

                          <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-lg px-2 py-0.5 shadow-sm">
                            <span className="text-amber-700 font-medium text-[0.65rem]">End:</span>
                            <input
                              type="time"
                              value={day.breakEndTime || "14:00"}
                              onChange={(e) =>
                                handleBreakTimeChange(day.dayOfWeek, "breakEndTime", e.target.value)
                              }
                              className="bg-transparent font-bold text-slate-800 outline-none text-xs cursor-pointer"
                            />
                          </div>

                          {/* Quick presets */}
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => handleQuickBreakPreset(day.dayOfWeek, "12:00", "13:00")}
                              className={`px-1.5 py-0.5 rounded text-[0.65rem] font-medium border transition-colors cursor-pointer ${
                                day.breakStartTime === "12:00" && day.breakEndTime === "13:00"
                                  ? "bg-amber-600 text-white border-amber-600"
                                  : "bg-white text-amber-800 border-amber-200 hover:bg-amber-100"
                              }`}
                            >
                              12-1 PM
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickBreakPreset(day.dayOfWeek, "13:00", "14:00")}
                              className={`px-1.5 py-0.5 rounded text-[0.65rem] font-medium border transition-colors cursor-pointer ${
                                day.breakStartTime === "13:00" && day.breakEndTime === "14:00"
                                  ? "bg-amber-600 text-white border-amber-600"
                                  : "bg-white text-amber-800 border-amber-200 hover:bg-amber-100"
                              }`}
                            >
                              1-2 PM
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickBreakPreset(day.dayOfWeek, "14:00", "15:00")}
                              className={`px-1.5 py-0.5 rounded text-[0.65rem] font-medium border transition-colors cursor-pointer ${
                                day.breakStartTime === "14:00" && day.breakEndTime === "15:00"
                                  ? "bg-amber-600 text-white border-amber-600"
                                  : "bg-white text-amber-800 border-amber-200 hover:bg-amber-100"
                              }`}
                            >
                              2-3 PM
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[0.7rem] text-slate-400 italic">
                          No lunch break set (Continuous shift)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
