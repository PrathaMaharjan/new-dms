"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  Wallet,
  Calendar,
  Receipt,
  Loader2,
  AlertCircle,
  TrendingUp,
  Percent,
  Search,
  RefreshCw,
  Clock,
} from "lucide-react";

type CommissionEntry = {
  id: string;
  treatmentName: string;
  chargeAmountCents: number;
  commissionPercent: number;
  commissionAmountCents: number;
  earnedAt: string;
};

// Formats cents into a clean, full integer/amount (e.g. 4550 -> 4,550)
function formatFullAmount(cents: number) {
  const value = Number.isFinite(cents) ? cents : 0;
  return value.toLocaleString();
}

export default function MyEarningsPage() {
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadEarnings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const { data: responseBody } = await axios.get(
        `/api/commision/mine?${params.toString()}`
      );

      if (responseBody?.success) {
        setEntries(responseBody.data.entries ?? []);
        setTotalEarned(responseBody.data.totalEarnedCents ?? 0);
      } else {
        setError(responseBody?.error ?? "Failed to load earnings information.");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error ?? "Failed to load earnings information."
        );
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadEarnings();
  }, [loadEarnings]);

  // Filter entries locally based on treatment search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    return entries.filter((item) =>
      item.treatmentName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [entries, searchQuery]);

  // Calculations for KPI Cards
  const totalEntriesCount = entries.length;
  const avgCommission =
    totalEntriesCount > 0 ? Math.round(totalEarned / totalEntriesCount) : 0;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6 lg:p-10 text-slate-800">
      <div className="mx-auto max-w-[1300px] space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7da3b3] text-white shadow-xs">
                <Wallet className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#345263]">
                My Earnings
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Overview of your recorded treatment commissions and total earnings.
            </p>
          </div>

          <button
            onClick={loadEarnings}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700 shadow-2xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Summary Stats Bar */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Total Earned Card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                Total Earned
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-emerald-700">
                NPR {formatFullAmount(totalEarned)}
              </div>
              <p className="mt-1 text-[0.75rem] text-slate-400">
                {fromDate || toDate ? "Selected date range" : "Cumulative total"}
              </p>
            </div>
          </div>

          {/* Visits Count Card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                Completed Visits
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                {totalEntriesCount} {totalEntriesCount === 1 ? "entry" : "entries"}
              </div>
              <p className="mt-1 text-[0.75rem] text-slate-400">
                Fully paid commission records
              </p>
            </div>
          </div>

          {/* Average Commission Card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                Avg. Commission / Visit
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Percent className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                NPR {formatFullAmount(avgCommission)}
              </div>
              <p className="mt-1 text-[0.75rem] text-slate-400">
                Average payout per entry
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by treatment name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#7da3b3] focus:bg-white focus:ring-2 focus:ring-[#7da3b3]/20"
            />
          </div>

          {/* Date Picker Range */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-medium text-slate-700 outline-none transition focus:border-[#7da3b3] focus:bg-white"
              />
            </div>
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-[#7da3b3] focus:bg-white"
            />
            {(fromDate || toDate) && (
              <button
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="ml-1 text-xs font-semibold text-[#7da3b3] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Detailed Commission Entries List */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Commission History
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-xs text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
              <span>Fetching earnings...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
              <Receipt className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
              <p className="text-xs font-semibold text-slate-600">
                No commission entries found
              </p>
              <p className="max-w-xs text-[0.75rem] text-slate-400">
                Commissions are recorded automatically once a patient's bill for your treatment is settled.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 pl-6 pr-4">Treatment / Procedure</th>
                    <th className="py-3.5 px-4">Earned Date</th>
                    <th className="py-3.5 px-4 text-right">Charge Amount</th>
                    <th className="py-3.5 px-4 text-center">Rate</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Commission Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="group transition hover:bg-slate-50/50"
                    >
                      <td className="py-4 pl-6 pr-4 font-semibold text-slate-900">
                        {entry.treatmentName}
                      </td>
                      <td className="py-4 px-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {new Date(entry.earnedAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-600">
                        NPR {formatFullAmount(entry.chargeAmountCents)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[0.7rem] font-bold text-slate-600">
                          {entry.commissionPercent}%
                        </span>
                      </td>
                      <td className="py-4 pl-4 pr-6 text-right font-bold text-emerald-700">
                        +NPR {formatFullAmount(entry.commissionAmountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}