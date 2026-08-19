"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  Percent,
  Calendar,
  Receipt,
  Loader2,
  AlertCircle,
  TrendingUp,
  Wallet,
  Search,
  RefreshCw,
  Clock,
  ChevronLeft,
  ChevronRight,
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

export default function MyCommissionPage() {
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [totalCommission, setTotalCommission] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  const loadCommission = useCallback(async () => {
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
        setTotalCommission(responseBody.data.totalEarnedCents ?? 0);
      } else {
        setError(responseBody?.error ?? "Failed to load commission information.");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error ?? "Failed to load commission information."
        );
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadCommission();
  }, [loadCommission]);

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
    totalEntriesCount > 0 ? Math.round(totalCommission / totalEntriesCount) : 0;

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="w-full space-y-6 text-slate-800">
    

      {/* Error Alert */}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadCommission()}
            className="flex items-center gap-1 font-semibold text-rose-600 hover:underline"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* Top Stat Cards Grid (matches Appointments tab styling) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Commission
            </span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            NPR {formatFullAmount(totalCommission)}
          </p>
          <p className="mt-0.5 text-[0.7rem] text-slate-400">
            {fromDate || toDate ? "Selected date range" : "Cumulative total"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Commission Entries
            </span>
            <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalEntriesCount} {totalEntriesCount === 1 ? "entry" : "entries"}
          </p>
          <p className="mt-0.5 text-[0.7rem] text-slate-400">
            Fully paid commission records
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Avg. Commission / Visit
            </span>
            <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            NPR {formatFullAmount(avgCommission)}
          </p>
          <p className="mt-0.5 text-[0.7rem] text-slate-400">
            Average payout per entry
          </p>
        </div>
      </div>

      {/* Search and Filters (matches Appointments tab styling) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by treatment name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#7da3b3] focus:bg-white transition-all"
          />
        </div>

        {/* Date Picker Range */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-medium text-slate-700 outline-none transition focus:border-[#7da3b3] focus:bg-white"
            />
          </div>
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-[#7da3b3] focus:bg-white"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
                setCurrentPage(1);
              }}
              className="ml-1 text-xs font-semibold text-[#7da3b3] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabular Commission Entries List (matches Appointments tab styling) */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-900/5 bg-white/90 shadow-lg backdrop-blur-sm flex flex-col justify-between">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
            <span>Loading commission data from database...</span>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="p-4 pl-6">Treatment / Procedure</th>
                  <th className="p-4">Earned Date</th>
                  <th className="p-4 text-right">Charge Amount</th>
                  <th className="p-4 text-center">Rate</th>
                  <th className="p-4 pr-6 text-right">Commission Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <Receipt className="mx-auto h-8 w-8 text-slate-300 mb-2" strokeWidth={1.5} />
                      <p className="text-xs font-semibold text-slate-600">
                        No commission entries found
                      </p>
                      <p className="text-[0.75rem] text-slate-400 mt-0.5 max-w-xs mx-auto">
                        Commissions are recorded automatically once a patient's bill for your treatment is settled.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="group transition-colors hover:bg-slate-50/50"
                    >
                      <td className="p-4 pl-6 font-semibold text-slate-900 text-xs">
                        <span className="inline-block bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                          {entry.treatmentName}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-medium text-slate-700 whitespace-nowrap">
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
                      <td className="p-4 text-right text-xs font-medium text-slate-600 whitespace-nowrap">
                        NPR {formatFullAmount(entry.chargeAmountCents)}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[0.7rem] font-bold text-slate-600">
                          {entry.commissionPercent}%
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right text-xs font-bold text-emerald-700 whitespace-nowrap">
                        +NPR {formatFullAmount(entry.commissionAmountCents)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && filteredEntries.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-xs">
            <span className="text-[0.7rem] text-slate-500 font-medium">
              Showing{" "}
              <strong className="text-slate-800">
                {filteredEntries.length > 0 ? startIndex + 1 : 0}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-800">
                {Math.min(startIndex + itemsPerPage, filteredEntries.length)}
              </strong>{" "}
              of <strong className="text-slate-800">{filteredEntries.length}</strong>
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
                  className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${
                    currentPage === pageNum
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