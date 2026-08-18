"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Percent, Loader2, AlertCircle } from "lucide-react";

// Formats full raw amount without decimals (e.g. 4550 -> 4,550)
function formatFullAmount(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return value.toLocaleString();
}

export default function CommissionStatCard() {
  const [totalEarned, setTotalEarned] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCommission() {
      setLoading(true);
      setError(null);

      try {
        const { data: responseBody } = await axios.get("/api/commision/mine");

        if (responseBody?.success) {
          setTotalEarned(responseBody.data?.totalEarnedCents ?? 0);
        } else {
          setError(responseBody?.error ?? "Failed to load commission.");
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(
            err.response?.data?.error ?? "Failed to load commission."
          );
        } else {
          setError("Failed to load commission.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCommission();
  }, []);

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Commission
        </span>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7da3b3]/10 text-[#345263]">
          <Percent className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-1 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
            Loading...
          </div>
        ) : error ? (
          <div
            className="flex items-center gap-1.5 py-1 text-xs text-rose-500"
            title={error}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Error loading</span>
          </div>
        ) : (
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              NPR {formatFullAmount(totalEarned ?? 0)}
            </div>

            <p className="mt-1 text-[0.75rem] text-slate-500">
              Total earned commissions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}