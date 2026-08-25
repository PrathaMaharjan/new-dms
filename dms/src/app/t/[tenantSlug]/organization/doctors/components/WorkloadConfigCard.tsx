"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Sliders, Sparkles, AlertTriangle, Flame, Save, Loader2, CheckCircle2, AlertCircle, ChevronDown, X } from "lucide-react";

export default function WorkloadConfigCard() {
  const [open, setOpen] = useState(false);
  const [healthyMax, setHealthyMax] = useState<number>(15);
  const [busyMax, setBusyMax] = useState<number>(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadThresholds() {
      try {
        setLoading(true);
        const { data } = await axios.get("/api/workload");
        if (data?.success) {
          setHealthyMax(data.data.workloadHealthyMax ?? 15);
          setBusyMax(data.data.workloadBusyMax ?? 20);
        }
      } catch (err) {
        console.error("Failed to load workload thresholds:", err);
      } finally {
        setLoading(false);
      }
    }
    loadThresholds();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (busyMax <= healthyMax) {
      setMsg({ type: "error", text: "Busy threshold must be strictly greater than Healthy threshold." });
      return;
    }

    try {
      setSaving(true);
      const { data } = await axios.patch("/api/workload", {
        workloadHealthyMax: Number(healthyMax),
        workloadBusyMax: Number(busyMax),
      });

      if (data?.success) {
        window.dispatchEvent(new CustomEvent("workload_updated", { detail: {} }));
        setMsg({ type: "success", text: "Organization workload thresholds updated!" });
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg({ type: "error", text: data?.error || "Failed to update workload thresholds." });
      }
    } catch (err: any) {
      console.error("Failed to save workload settings:", err);
      setMsg({
        type: "error",
        text: err?.response?.data?.error || "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-5 py-2.5 text-[0.9rem] font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
      >
        <Sliders className="h-4 w-4 text-[#7da3b3]" strokeWidth={2} />
        <span>Add Workload</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7da3b3]/10 text-[#345263]">
                <Sliders className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Workload Thresholds</h4>
                <p className="text-[0.75rem] text-slate-400">Set appointment limits for pace indicators</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[0.7rem]">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold border border-emerald-100">
              <Sparkles className="h-3 w-3" /> Healthy ≤ {healthyMax}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 font-semibold border border-amber-100">
              <AlertTriangle className="h-3 w-3" /> Busy ≤ {busyMax}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 font-semibold border border-rose-100">
              <Flame className="h-3 w-3" /> Heavy &gt; {busyMax}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
              Loading workload settings...
            </div>
          ) : (
            <form onSubmit={handleSave} className="mt-4 space-y-3">
              {msg && (
                <div
                  className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium ${
                    msg.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {msg.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  )}
                  <span>{msg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Healthy Pace Max (Appts/Day)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={healthyMax}
                  onChange={(e) => setHealthyMax(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#7da3b3]"
                  required
                />
                <p className="mt-1 text-[0.7rem] text-slate-400">
                  0 to {healthyMax} appointments shows Healthy pace.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Busy Pace Max (Appts/Day)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={busyMax}
                  onChange={(e) => setBusyMax(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#7da3b3]"
                  required
                />
                <p className="mt-1 text-[0.7rem] text-slate-400">
                  {healthyMax + 1} to {busyMax} appointments shows Busy pace.
                </p>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#749fb1] px-5 py-2.5 text-[0.9rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263] disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" strokeWidth={2} />
                      Save Thresholds
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
