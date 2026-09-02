"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { FileText, Download, Pill, ChevronRight, Loader2, AlertCircle } from "lucide-react";

type PrescriptionEntry = {
  date: string;
  prescription: string;
  doctorName: string;
  treatmentName: string;
  locationName: string;
};

export default function Page() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloadingLatest, setDownloadingLatest] = useState(false);
  const [downloadingHistory, setDownloadingHistory] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrescriptions() {
      setLoading(true);
      setError(null);
      try {
        const { data: responseBody } = await axios.get("/api/patient-portal/prescriptions");
        if (responseBody?.success) {
          setPrescriptions(responseBody.data.prescriptions);
        } else {
          setError(responseBody?.error ?? "Something went wrong loading your prescriptions.");
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error ?? "Something went wrong loading your prescriptions.");
        } else {
          setError("Something went wrong loading your prescriptions.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadPrescriptions();
  }, []);
  async function handleDownload(
    endpoint: string,
    filename: string,
    setDownloading: (v: boolean) => void
  ) {
    setDownloadError(null);
    setDownloading(true);
    try {
      const response = await axios.get(endpoint, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setDownloadError(err.response?.data?.error ?? "Something went wrong generating your report.");
      } else {
        setDownloadError("Something went wrong generating your report.");
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="w-full font-sans text-slate-800">
      <div className="mx-auto max-w-4xl">
        {/* Header Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#1e3240] sm:text-4xl">
            Medical Records
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Access your visit summaries, complete dental history, and past prescriptions.
          </p>
        </div>

        {downloadError && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
            {downloadError}
          </div>
        )}

        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_-15px_rgba(30,50,64,0.05)] transition-all duration-200 hover:shadow-[0_20px_40px_-15px_rgba(30,50,64,0.1)]">
            <div>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf7fc] text-[#7da3b3]">
                <FileText className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <h2 className="text-xl font-semibold text-[#1e3240]">Visit reports</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Every completed visit generates a report with findings, treatments, and aftercare notes. Download anytime for your records.
              </p>
            </div>

            <button
              onClick={() => handleDownload("/api/patient-portal/reports/latest", "visit-report.pdf", setDownloadingLatest)}
              disabled={downloadingLatest}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 py-3 text-xs font-semibold text-slate-700 transition-colors duration-200 hover:border-[#7da3b3]/40 hover:bg-[#7da3b3] hover:text-white cursor-pointer disabled:opacity-60"
            >
              {downloadingLatest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
              ) : (
                <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
              )}
              <span>{downloadingLatest ? "Preparing..." : "Latest Report PDF"}</span>
            </button>
          </div>

          <div className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_-15px_rgba(30,50,64,0.05)] transition-all duration-200 hover:shadow-[0_20px_40px_-15px_rgba(30,50,64,0.1)]">
            <div>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf7fc] text-[#7da3b3]">
                <FileText className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <h2 className="text-xl font-semibold text-[#1e3240]">Full medical history</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Consolidated dental history including charting, treatments, allergies, medications, and radiographs.
              </p>
            </div>

            <button
              onClick={() => handleDownload("/api/patient-portal/reports/history", "medical-history.pdf", setDownloadingHistory)}
              disabled={downloadingHistory}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 py-3 text-xs font-semibold text-slate-700 transition-colors duration-200 hover:border-[#7da3b3]/40 hover:bg-[#7da3b3] hover:text-white cursor-pointer disabled:opacity-60"
            >
              {downloadingHistory ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
              ) : (
                <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
              )}
              <span>{downloadingHistory ? "Preparing..." : "History PDF"}</span>
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Pill className="h-4 w-4 text-[#7da3b3]" strokeWidth={2.2} />
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Prescription History</h3>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_30px_-15px_rgba(30,50,64,0.05)]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-xs text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-[#7da3b3]" />
              Loading your prescriptions...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-10 text-xs text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
              {error}
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">No prescriptions on record yet.</div>
          ) : (
            prescriptions.map((item, idx) => (
              <div
                key={idx}
                className="group flex flex-col justify-between border-b border-slate-100 p-5 transition-colors duration-150 last:border-b-0 hover:bg-slate-50/60 sm:flex-row sm:items-center"
              >
                <div className="mb-1 w-32 flex-shrink-0 text-xs font-medium text-slate-400 sm:mb-0">
                  {new Date(item.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </div>

                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-[#1e3240] transition-colors group-hover:text-[#7da3b3]">
                    {item.treatmentName}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.prescription} · Dr. {item.doctorName} · {item.locationName}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-end sm:mt-0">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-all duration-200 group-hover:bg-sky-50 group-hover:text-[#7da3b3]">
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}