"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";

type UpcomingAppointment = {
  id: string;
  treatmentName: string;
  startTime: string;
  doctorName: string;
  locationName: string;
  canModify: boolean;
};
 
type myProfile ={
  name : string
}

type LedgerSummary = {
  totalChargedCents: number;
  totalPaidCents: number;
  balanceDueCents: number;
  outstandingCents: number;
};

type PrescriptionEntry = {
  date: string;
  prescription: string;
  doctorName: string;
  treatmentName: string;
  locationName: string;
};

type PastVisit = {
  id: string;
  treatmentName: string;
  startTime: string;
  doctorName: string;
};

function centsToDisplay(cents: number) {
  return Math.abs(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateBadge(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: d.getDate(),
  };
}

export default function PatientDashboard() {
  const router = useRouter();

  const [patientName, setPatientName] = useState<string>("");
  const [upcoming, setUpcoming] = useState<UpcomingAppointment | null>(null);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionEntry[]>([]);
  const [pastVisits, setPastVisits] = useState<PastVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const [upcomingRes, billingRes, prescriptionsRes, pastRes,patient] = await Promise.allSettled([
          axios.get("/api/patient-portal/appointments/upcoming"),
          axios.get("/api/patient-portal/getledgerHistory"),
          axios.get("/api/patient-portal/prescriptions"),
          axios.get("/api/patient-portal/appointments/past"),
          axios.get("/api/patient-portal/getMyProfile"),

        ]);

        if (upcomingRes.status === "fulfilled" && upcomingRes.value.data?.success) {
          setUpcoming(upcomingRes.value.data.data.appointment);
        }
        if (billingRes.status === "fulfilled" && billingRes.value.data?.success) {
          setSummary(billingRes.value.data.data.summary);
        }
        if (prescriptionsRes.status === "fulfilled" && prescriptionsRes.value.data?.success) {
          setPrescriptions(prescriptionsRes.value.data.data.prescriptions);
        }
        if (pastRes.status === "fulfilled" && pastRes.value.data?.success) {
          setPastVisits(pastRes.value.data.data.visits);
        }
        if (patient.status == "fulfilled"){
          setPatientName(patient.value.data.data?.visits)
        }
      } catch (err) {
        setError("Something went wrong loading your dashboard.");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const lastVisit = pastVisits[0];
  const latestPrescriptions = prescriptions.slice(0, 2);

  return (
    <div className="min-h-screen w-full bg-[#edf7fc] p-6 md:p-12 font-sans text-slate-800">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
          <h1 className="text-3xl font-bold tracking-tight text-[#163048] sm:text-4xl">
            {greeting}{patientName ? `, ${patientName}` : ""}
          </h1>
          {!loading && lastVisit && (
            <span className="text-xs font-medium text-slate-400">
              Last visit {new Date(lastVisit.startTime).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · Dr. {lastVisit.doctorName}
            </span>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
            {error}
          </div>
        )}
        {!loading && summary && summary.outstandingCents > 0 && (
          <div className="flex flex-col justify-between gap-6 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100/70 text-amber-700">
                <AlertCircle className="h-5 w-5" strokeWidth={2.2} />
              </div>

              <div>
                <div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-wider text-amber-700">
                  <span>NEEDS YOUR ATTENTION</span>
                </div>

                <h2 className="mt-1 text-2xl font-bold text-[#163048]">
                  NPR {centsToDisplay(summary.outstandingCents)}{" "}
                  <span className="text-lg font-normal text-slate-500">outstanding</span>
                </h2>
              </div>
            </div>

            <button
              onClick={() => router.push("/patientPortal/billing")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#7da3b3] px-6 py-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#6b92a2] cursor-pointer self-start sm:self-auto"
            >
              <span>Pay now</span>
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-sm md:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                  NEXT APPOINTMENT
                </span>
                <button
                  onClick={() => router.push("/patientPortal/appointments")}
                  className="text-xs font-semibold text-[#7da3b3] hover:text-[#6b92a2] cursor-pointer"
                >
                  All appointments
                </button>
              </div>

              {loading ? (
                <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : !upcoming ? (
                <p className="mt-6 text-xs text-slate-400">You have no upcoming appointments.</p>
              ) : (
                <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-[#edf7fc] px-4 py-3 text-center text-[#7da3b3]">
                      <span className="text-[0.65rem] font-bold uppercase tracking-widest">
                        {formatDateBadge(upcoming.startTime).month}
                      </span>
                      <span className="text-2xl font-bold text-[#163048]">{formatDateBadge(upcoming.startTime).day}</span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#163048]">{upcoming.treatmentName}</h3>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {new Date(upcoming.startTime).toLocaleString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-slate-400">
                        Dr. {upcoming.doctorName} · {upcoming.locationName}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <button
                      onClick={() => router.push("/patientPortal/appointments")}
                      disabled={!upcoming.canModify}
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reschedule
                    </button>
                    <span className="text-[0.65rem] text-slate-400">
                      {upcoming.canModify ? "Free up to 24h before" : "Too close to modify online"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-sm">
            <div>
              <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                ACCOUNT BALANCE
              </span>
              <h3 className="mt-4 text-3xl font-bold text-[#163048]">
                {loading ? "—" : `NPR ${centsToDisplay(summary?.outstandingCents ?? 0)}`}
              </h3>
            </div>

            <button
              onClick={() => router.push("/patientPortal/billing")}
              className="mt-6 w-full rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              View billing
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
              YOUR RECORDS
            </span>

            <div className="mt-4 divide-y divide-slate-100">
              <button
                onClick={() => router.push("/patientPortal/records")}
                className="flex w-full items-center justify-between py-3 text-left cursor-pointer"
              >
                <span className="text-xs font-bold text-[#163048]">Latest visit report</span>
                <span className="text-xs text-slate-400">
                  {lastVisit ? new Date(lastVisit.startTime).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </span>
              </button>

              <button
                onClick={() => router.push("/patientPortal/records")}
                className="flex w-full items-center justify-between py-3 text-left cursor-pointer"
              >
                <span className="text-xs font-bold text-[#163048]">Full medical history</span>
                <span className="text-xs text-slate-400">Download PDF</span>
              </button>

              {/* X-rays & photos - no backend concept exists for this
                  anywhere in the project (no file/imaging storage built).
                  Shown honestly as unavailable rather than a fake count. */}
              <div className="flex items-center justify-between py-3 opacity-50">
                <span className="text-xs font-bold text-[#163048]">X-rays & photos</span>
                <span className="text-xs text-slate-400">Not available yet</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
              CURRENT PRESCRIPTIONS
            </span>

            <div className="mt-4 space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : latestPrescriptions.length === 0 ? (
                <p className="text-xs text-slate-400">No prescriptions on record yet.</p>
              ) : (
                latestPrescriptions.map((rx, idx) => (
                  <div key={idx}>
                    <h4 className="text-xs font-bold text-[#163048]">{rx.treatmentName}</h4>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {rx.prescription} · Dr. {rx.doctorName}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}