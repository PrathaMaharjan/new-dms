"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Clock,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Calendar,
  Sun,
  Coffee,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Stethoscope,
} from "lucide-react";

interface ScheduleDay {
  dayOfWeek: number;
  dayName: string;
  isOnLeave: boolean;
  startTime: string;
  endTime: string;
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
  isOnLeave: index === 0 || index === 6, // Weekend default off
  startTime: "09:00",
  endTime: "17:00",
}));

export default function DoctorScheduleTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationId, setLocationId] = useState<string>("");
  const [doctorId, setDoctorId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Fetch user details first (matching DoctorSettingsTab)
      const userRes = await axios.get("/api/user-details").catch(() => null);
      const u = userRes?.data?.success ? userRes.data.data?.user : null;

      // 2. Standard location & doctor list resolution matching all other doctor pages
      const [servicesRes, treatmentsRes, patientsRes, outletsRes, listRes] = await Promise.all([
        axios.get("/api/services").catch(() => null),
        axios.get("/api/treatment").catch(() => null),
        axios.get("/api/patent").catch(() => null),
        axios.get("/api/outlets").catch(() => null),
        axios.get("/api/doctor").catch(() => null),
      ]);

      let locId =
        servicesRes?.data?.data?.services?.[0]?.locationId ||
        treatmentsRes?.data?.data?.treatments?.[0]?.locationId ||
        patientsRes?.data?.data?.patients?.[0]?.locationId ||
        outletsRes?.data?.data?.locations?.[0]?.id ||
        outletsRes?.data?.data?.outlets?.[0]?.id ||
        listRes?.data?.data?.doctors?.[0]?.locationId ||
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

   
      let targetDocId = "";
      let fetchedSchedule: any[] | null = null;

      if (listRes?.data?.success && Array.isArray(listRes.data.data?.doctors) && listRes.data.data.doctors.length > 0) {
        const doctors = listRes.data.data.doctors;
        const matchingDoc = doctors.find((doc: any) => doc.id === u?.id || doc.email === u?.email) || doctors[0];
        if (matchingDoc?.id) {
          targetDocId = matchingDoc.id;
          const docDetailRes = await axios.get(`/api/doctor/${matchingDoc.id}`).catch(() => null);
          if (docDetailRes?.data?.success && Array.isArray(docDetailRes.data.data?.doctor?.schedule)) {
            fetchedSchedule = docDetailRes.data.data.doctor.schedule;
          }
        }
      }

      if (targetDocId) {
        setDoctorId(targetDocId);
      }

      if (fetchedSchedule && Array.isArray(fetchedSchedule) && fetchedSchedule.length > 0) {
        const mergedSchedule = DEFAULT_SCHEDULE.map((defaultDay) => {
          const existing = fetchedSchedule.find((s: any) => s.dayOfWeek === defaultDay.dayOfWeek);
          if (existing) {
            return {
              ...defaultDay,
              isOnLeave: Boolean(existing.isOnLeave),
              startTime: existing.startTime ? existing.startTime.slice(0, 5) : "09:00",
              endTime: existing.endTime ? existing.endTime.slice(0, 5) : "17:00",
            };
          }
          return defaultDay;
        });
        setSchedule(mergedSchedule);
      }
    } catch (err) {
      console.error("Failed to load doctor schedule:", err);
      setErrorMsg("Failed to load schedule from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleLeave = (dayOfWeek: number) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, isOnLeave: !day.isOnLeave } : day
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

  const handleSaveSchedule = async () => {
    let activeLocId = locationId;

    if (!activeLocId) {
      try {
        const savedLoc = localStorage.getItem("dms_location_id") || localStorage.getItem("current_location_id");
        if (savedLoc) activeLocId = savedLoc;
      } catch (e) {}
    }

    if (!activeLocId) {
      const outletsRes = await axios.get("/api/outlets").catch(() => null);
      activeLocId = outletsRes?.data?.data?.locations?.[0]?.id || outletsRes?.data?.data?.outlets?.[0]?.id || "";
      if (activeLocId) setLocationId(activeLocId);
    }

    if (!activeLocId) {
      setErrorMsg("Could not determine clinic location. Please refresh and try again.");
      return;
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
          return {
            dayOfWeek: day.dayOfWeek,
            isOnLeave: day.isOnLeave,
            startTime: day.isOnLeave ? undefined : (sTime && sTime.length === 5 ? `${sTime}:00` : sTime || "09:00:00"),
            endTime: day.isOnLeave ? undefined : (eTime && eTime.length === 5 ? `${eTime}:00` : eTime || "17:00:00"),
          };
        }),
      };

      let res = await axios.patch("/api/doctor/me/schedule", payload).catch((err) => err.response || null);

      let targetId = doctorId;
      if (!targetId) {
        const listRes = await axios.get("/api/doctor").catch(() => null);
        const uRes = await axios.get("/api/user-details").catch(() => null);
        const u = uRes?.data?.success ? uRes.data.data?.user : null;
        if (listRes?.data?.success && listRes.data.data?.doctors?.length > 0) {
          const matching = listRes.data.data.doctors.find((doc: any) => doc.id === u?.id || doc.email === u?.email) || listRes.data.data.doctors[0];
          targetId = matching?.id || "";
        }
      }

      if ((!res?.data?.success || res?.status === 404 || res?.status === 401 || res?.data?.error) && targetId) {
        const patchRes = await axios.patch(`/api/doctor/${targetId}/schedule`, payload).catch((err) => err.response || null);
        if (patchRes?.data?.success) {
          res = patchRes;
        }
      }

      if (res?.data?.success) {
        setSuccessMsg("Weekly schedule saved successfully to database!");
      } else {
        setErrorMsg(res?.data?.error || "Failed to save schedule.");
      }
    } catch (err: any) {
      console.error("Failed to save schedule:", err);
      setErrorMsg(err.response?.data?.error || "An error occurred while saving schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Alert Messages */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
            ×
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-900/5 bg-white p-16 text-center text-xs text-slate-400 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
          <span>Loading your schedule...</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#7da3b3]/20 bg-white/90 p-6 shadow-sm backdrop-blur-sm space-y-6">
          {/* Date Selector & Schedule Notice */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-[#7da3b3]/20 bg-[#f4fafc] p-4 text-xs text-slate-700">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 shrink-0 text-[#7da3b3]" />
              <div>
                <span className="font-bold text-slate-900">Select Date to Edit:</span> Pick any date to set or adjust its working schedule.
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white border border-[#7da3b3]/30 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-slate-400 font-medium">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#7da3b3]" /> Weekly Working Hours
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure your shift times and off-days for each day of the week.
              </p>
            </div>
            <button
              onClick={handleSaveSchedule}
              disabled={saving}
              className="flex items-center gap-2 bg-[#7da3b3] hover:bg-[#345263] text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-sm transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Schedule
            </button>
          </div>

          {/* Days Grid */}
          <div className="grid gap-3">
            {schedule.map((day) => {
              const selectedDayOfWeek = new Date(selectedDate + "T00:00:00").getDay();
              const isSelectedDay = selectedDayOfWeek === day.dayOfWeek;

              return (
                <div
                  key={day.dayOfWeek}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${isSelectedDay
                    ? "ring-2 ring-[#7da3b3] bg-[#7da3b3]/10 border-[#7da3b3]"
                    : day.isOnLeave
                      ? "bg-slate-50/70 border-slate-200/80"
                      : "bg-[#f4fafc]/60 border-[#7da3b3]/20 hover:border-[#7da3b3]/40"
                    }`}
                >
                  {/* Left: Day Name & Toggle */}
                  <div className="flex items-center justify-between sm:justify-start gap-4 min-w-[200px]">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${isSelectedDay
                          ? "bg-[#7da3b3] text-white"
                          : day.isOnLeave
                            ? "bg-slate-200 text-slate-500"
                            : "bg-[#7da3b3]/20 text-[#3f6274]"
                          }`}
                      >
                        {day.dayName.substring(0, 3)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          {day.dayName}
                          {isSelectedDay && (
                            <span className="text-[0.65rem] font-bold bg-[#7da3b3] text-white px-2 py-0.5 rounded-full">
                              Selected Date
                            </span>
                          )}
                        </h4>
                        <p className="text-[0.75rem] text-slate-400">
                          {day.isOnLeave ? "Day Off / On Leave" : "Working Day"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleLeave(day.dayOfWeek)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${!day.isOnLeave ? "bg-[#7da3b3]" : "bg-slate-300"
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${!day.isOnLeave ? "translate-x-5" : "translate-x-0"
                          }`}
                      />
                    </button>
                  </div>

                  {/* Right: Working Hours Time Pickers or Off Badge */}
                  {!day.isOnLeave ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-white border border-[#7da3b3]/30 rounded-xl px-3 py-2 text-xs shadow-sm">
                        <span className="text-slate-400 font-medium">Start</span>
                        <input
                          type="time"
                          value={day.startTime}
                          onChange={(e) =>
                            handleTimeChange(day.dayOfWeek, "startTime", e.target.value)
                          }
                          className="bg-transparent font-semibold text-slate-800 outline-none"
                        />
                      </div>

                      <ArrowRight className="h-4 w-4 text-[#7da3b3] shrink-0" />

                      <div className="flex items-center gap-2 bg-white border border-[#7da3b3]/30 rounded-xl px-3 py-2 text-xs shadow-sm">
                        <span className="text-slate-400 font-medium">End</span>
                        <input
                          type="time"
                          value={day.endTime}
                          onChange={(e) =>
                            handleTimeChange(day.dayOfWeek, "endTime", e.target.value)
                          }
                          className="bg-transparent font-semibold text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 bg-slate-200/60 border border-slate-200">
                      <XCircle className="h-3.5 w-3.5 text-slate-400" /> Not Working
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}