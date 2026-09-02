"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, Clock, FileText, X, Check, Loader2, AlertCircle } from "lucide-react";

type UpcomingAppointment = {
  id: string;
  treatmentName: string;
  startTime: string;
  doctorName: string;
  locationName: string;
  canModify: boolean;
};

type PastVisit = {
  id: string;
  treatmentName: string;
  startTime: string;
  doctorName: string;
};

type AvailableDay = { day: string; date: string; fullDate: string };
type AvailableSlot = { time: string; label: string };

function formatDateBadge(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: d.getDate(),
  };
}

function formatAppointmentLine(iso: string, doctorName: string, locationName: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${time} · ${doctorName} · ${locationName}`;
}

function formatVisitDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function AppointmentsPage() {
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  // CHANGED - real days (today onward), not hardcoded display strings
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const [upcoming, setUpcoming] = useState<UpcomingAppointment | null>(null);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  const [pastVisits, setPastVisits] = useState<PastVisit[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUpcoming() {
      setLoadingUpcoming(true);
      try {
        const { data: responseBody } = await axios.get("/api/patient-portal/upcoming");
        if (responseBody?.success) {
          setUpcoming(responseBody.data.appointment);
        } else {
          setError(responseBody?.error ?? "Something went wrong loading your appointment.");
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error ?? "Something went wrong loading your appointment.");
        } else {
          setError("Something went wrong loading your appointment.");
        }
      } finally {
        setLoadingUpcoming(false);
      }
    }
    loadUpcoming();
  }, []);

  useEffect(() => {
    async function loadPastVisits() {
      setLoadingPast(true);
      try {
        const { data: responseBody } = await axios.get("/api/patient-portal/past");
        if (responseBody?.success) {
          setPastVisits(responseBody.data.visits);
        }
      } catch {
        // Past visits section just shows empty rather than blocking the whole page
      } finally {
        setLoadingPast(false);
      }
    }
    loadPastVisits();
  }, []);

  // ADDED - builds the next 7 real calendar days (starting tomorrow),
  // once, when the component mounts.
  useEffect(() => {
    const days: AvailableDay[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        day: d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
        date: String(d.getDate()),
        fullDate: d.toISOString().slice(0, 10),
      });
    }
    setAvailableDays(days);
  }, []);

  async function handleCancel() {
    if (!upcoming) return;
    setError(null);
    setCancelling(true);
    try {
      const { data: responseBody } = await axios.post(`/api/patient-portal/appointments/${upcoming.id}/cancel`);
      if (!responseBody?.success) {
        setError(responseBody?.error ?? "Something went wrong cancelling your appointment.");
        return;
      }
      setUpcoming(null);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Something went wrong cancelling your appointment.");
      } else {
        setError("Something went wrong cancelling your appointment.");
      }
    } finally {
      setCancelling(false);
    }
  }

  async function handleDownloadReport(appointmentId: string) {
    setError(null);
    setDownloadingReportId(appointmentId);
    try {
      const response = await axios.get(`/api/patient-portal/reports/latest`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "visit-report.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Something went wrong generating your report.");
      } else {
        setError("Something went wrong generating your report.");
      }
    } finally {
      setDownloadingReportId(null);
    }
  }

  // ADDED - fetches real available slots for THIS doctor, on THIS day,
  // the moment a day is picked in the modal.
  async function handleSelectDay(fullDate: string, displayKey: string) {
    setSelectedDay(displayKey);
    setSelectedTime("");
    setAvailableSlots([]);
    if (!upcoming) return;

    setLoadingSlots(true);
    try {
      const { data: responseBody } = await axios.get(
        `/api/patient-portal/appointments/${upcoming.id}/available-slots`,
        { params: { date: fullDate } }
      );
      if (responseBody?.success) {
        setAvailableSlots(responseBody.data.slots);
      }
    } catch {
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  // ADDED - the actual reschedule submission, replacing the modal's old
  // no-op close-only confirm button.
  async function handleConfirmReschedule() {
    if (!upcoming || !selectedTime) return;
    const selectedDayInfo = availableDays.find((d) => `${d.day} ${d.date}` === selectedDay);
    if (!selectedDayInfo) return;

    setRescheduleError(null);
    setRescheduling(true);
    try {
      const newStartTime = `${selectedDayInfo.fullDate}T${selectedTime}:00`;
      const { data: responseBody } = await axios.post(
        `/api/patient-portal/appointments/${upcoming.id}/reschedule`,
        { newStartTime }
      );
      if (!responseBody?.success) {
        setRescheduleError(responseBody?.error ?? "Something went wrong rescheduling your appointment.");
        return;
      }
      setIsRescheduleOpen(false);
      setSelectedDay("");
      setSelectedTime("");
      // Reload the upcoming appointment to reflect the new time/status
      const refreshed = await axios.get("/api/patient-portal/appointments/upcoming");
      if (refreshed.data?.success) setUpcoming(refreshed.data.data.appointment);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setRescheduleError(err.response?.data?.error ?? "Something went wrong rescheduling your appointment.");
      } else {
        setRescheduleError("Something went wrong rescheduling your appointment.");
      }
    } finally {
      setRescheduling(false);
    }
  }

  function openRescheduleModal() {
    setSelectedDay("");
    setSelectedTime("");
    setAvailableSlots([]);
    setRescheduleError(null);
    setIsRescheduleOpen(true);
  }

  return (
    <div className="w-full font-sans text-slate-800">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#1e3240] sm:text-4xl">
            Appointments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your scheduled visits and review clinical notes from past treatments.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
            {error}
          </div>
        )}

        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#7da3b3]" strokeWidth={2.2} />
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
            Upcoming
          </h2>
        </div>

        {loadingUpcoming ? (
          <div className="mb-10 flex items-center justify-center gap-2 rounded-3xl border border-slate-200/80 bg-white p-8 text-xs text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-[#7da3b3]" />
            Loading your appointment...
          </div>
        ) : !upcoming ? (
          <div className="mb-10 rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-xs text-slate-400">
            You have no upcoming appointments.
          </div>
        ) : (
          <div className="mb-10 flex flex-col justify-between gap-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_-15px_rgba(30,50,64,0.05)] sm:flex-row sm:items-center">
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center justify-center rounded-2xl bg-[#edf7fc] px-4 py-3 text-center text-[#7da3b3]">
                <span className="text-[0.65rem] font-bold uppercase tracking-widest">
                  {formatDateBadge(upcoming.startTime).month}
                </span>
                <span className="text-2xl font-bold text-[#1e3240]">{formatDateBadge(upcoming.startTime).day}</span>
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#1e3240]">{upcoming.treatmentName}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatAppointmentLine(upcoming.startTime, upcoming.doctorName, upcoming.locationName)}
                </p>
                {!upcoming.canModify && (
                  <p className="mt-1 text-[0.7rem] text-amber-600">
                    Too close to reschedule or cancel online — please call the clinic.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={openRescheduleModal}
                disabled={!upcoming.canModify}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-2.5 text-xs font-semibold text-slate-700 transition-all duration-200 hover:border-[#7da3b3]/40 hover:bg-[#7da3b3] hover:text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-50/60 disabled:hover:text-slate-700"
              >
                Reschedule
              </button>
              <button
                onClick={handleCancel}
                disabled={!upcoming.canModify || cancelling}
                className="px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-rose-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-slate-400"
              >
                {cancelling ? "Cancelling..." : "Cancel"}
              </button>
            </div>
          </div>
        )}

        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#7da3b3]" strokeWidth={2.2} />
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
            Past Visits
          </h2>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_30px_-15px_rgba(30,50,64,0.05)]">
          <div className="divide-y divide-slate-100">
            {loadingPast ? (
              <div className="flex items-center justify-center gap-2 p-8 text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin text-[#7da3b3]" />
                Loading your visit history...
              </div>
            ) : pastVisits.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No past visits on record yet.</div>
            ) : (
              pastVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="flex flex-col justify-between p-6 transition-colors duration-150 hover:bg-slate-50/50 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-8">
                    <div className="w-28 text-xs font-medium text-slate-400">{formatVisitDate(visit.startTime)}</div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1e3240]">{visit.treatmentName}</h4>
                      <p className="text-xs text-slate-400">{visit.doctorName}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 sm:mt-0">
                    <button
                      onClick={() => handleDownloadReport(visit.id)}
                      disabled={downloadingReportId === visit.id}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7da3b3] transition-colors hover:text-[#6b92a2] cursor-pointer disabled:opacity-60"
                    >
                      {downloadingReportId === visit.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" strokeWidth={2.2} />
                      )}
                      <span>{downloadingReportId === visit.id ? "Preparing..." : "Visit report PDF"}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reschedule Modal - CHANGED - now fetches real available days/slots
          and actually submits the reschedule request */}
      {isRescheduleOpen && upcoming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsRescheduleOpen(false)}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-in fade-in"
          />

          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-7 shadow-2xl backdrop-blur-xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-[#1e3240]">
                  Reschedule {upcoming.treatmentName}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Currently{" "}
                  {new Date(upcoming.startTime).toLocaleString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  with {upcoming.doctorName}.
                </p>
              </div>
              <button
                onClick={() => setIsRescheduleOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>

            {rescheduleError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                {rescheduleError}
              </div>
            )}

            <div className="mt-6">
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                Pick a day
              </span>
              <div className="mt-2.5 flex justify-between gap-2">
                {availableDays.map((item) => {
                  const key = `${item.day} ${item.date}`;
                  const isSelected = selectedDay === key;

                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectDay(item.fullDate, key)}
                      className={`flex flex-1 flex-col items-center rounded-2xl border py-3 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-[#7da3b3] bg-[#7da3b3] text-white shadow-md shadow-[#7da3b3]/20"
                          : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <span className="text-[0.65rem] font-semibold tracking-wider">{item.day}</span>
                      <span className="mt-0.5 text-base font-bold">{item.date}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                Available times
              </span>
              <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                {!selectedDay ? (
                  <p className="col-span-3 py-4 text-center text-xs text-slate-400">Pick a day to see open times.</p>
                ) : loadingSlots ? (
                  <div className="col-span-3 flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking availability...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="col-span-3 py-4 text-center text-xs text-slate-400">No open times on this day.</p>
                ) : (
                  availableSlots.map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`rounded-2xl border py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "border-[#7da3b3] bg-sky-50 text-[#7da3b3] ring-2 ring-[#7da3b3]/20"
                            : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsRescheduleOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                Keep current time
              </button>
              <button
                onClick={handleConfirmReschedule}
                disabled={!selectedTime || rescheduling}
                className="flex items-center gap-2 rounded-2xl bg-[#7da3b3] px-6 py-3 text-xs font-semibold text-white shadow-md shadow-[#7da3b3]/20 transition-colors hover:bg-[#6b92a2] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {rescheduling
                    ? "Submitting..."
                    : selectedTime
                    ? `Confirm ${availableSlots.find((s) => s.time === selectedTime)?.label ?? selectedTime}`
                    : "Select a time"}
                </span>
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}