"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { Download, CreditCard, X, ChevronRight, Check, Loader2, AlertCircle } from "lucide-react";

type LedgerEntry = {
  id: string;
  type: "charge" | "payment" | "adjustment";
  amountCents: number;
  status: "due" | "settled" | null;
  paymentMethod: string | null;
  note: string | null;
  appointmentTreatmentName: string | null;
  createdAt: string;
  balanceAfter: number;
};

type LedgerSummary = {
  totalChargedCents: number;
  totalPaidCents: number;
  balanceDueCents: number;
  outstandingCents: number; 
};

function centsToDisplay(cents: number) {
  return Math.abs(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function BillingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLedger() {
      setLoading(true);
      setError(null);
      try {
        const { data: responseBody } = await axios.get("/api/patient-portal/getledgerHistory");
        if (responseBody?.success) {
          setSummary(responseBody.data.summary);
          setEntries(responseBody.data.entries);
        } else {
          setError(responseBody?.error ?? "Something went wrong loading your billing information.");
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error ?? "Something went wrong loading your billing information.");
        } else {
          setError("Something went wrong loading your billing information.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadLedger();
  }, []);

  const thisYear = new Date().getFullYear();
  const chargesThisYear = entries.filter((e) => e.type === "charge" && new Date(e.createdAt).getFullYear() === thisYear);
  const billedThisYearCents = chargesThisYear.reduce((sum, e) => sum + e.amountCents, 0);
  const paymentsThisYear = entries.filter((e) => e.type === "payment" && new Date(e.createdAt).getFullYear() === thisYear);
  const settledThisYearCents = Math.abs(paymentsThisYear.reduce((sum, e) => sum + e.amountCents, 0));

  const chargeRows = [...entries].filter((e) => e.type === "charge").reverse();

  return (
    <div className="w-full font-sans text-slate-800">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#1e3240] sm:text-4xl">
            Billing & Invoices
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View your balance and access your billing history.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
            {error}
          </div>
        )}

        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_-15px_rgba(30,50,64,0.05)]">
            <div>
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                Outstanding
              </span>
              <h2 className="mt-2 text-3xl font-bold text-[#1e3240]">
  
                {loading ? "—" : `NPR ${centsToDisplay(summary?.outstandingCents ?? 0)}`}
              </h2>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              disabled={!summary || summary.outstandingCents <= 0} // CHANGED - was summary.balanceDueCents
              className="mt-6 w-full rounded-2xl bg-[#7da3b3] py-3 text-xs font-semibold text-white shadow-md shadow-[#7da3b3]/20 transition-all duration-200 hover:bg-[#6b92a2] hover:shadow-lg hover:shadow-[#7da3b3]/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay now
            </button>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_-15px_rgba(30,50,64,0.05)]">
            <div>
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                Billed This Year
              </span>
              <h2 className="mt-2 text-3xl font-bold text-[#1e3240]">
                {loading ? "—" : `NPR ${centsToDisplay(billedThisYearCents)}`}
              </h2>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {loading ? "" : `NPR ${centsToDisplay(settledThisYearCents)} settled across ${chargesThisYear.length} visits`}
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_-15px_rgba(30,50,64,0.05)]">
            <div>
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                Statements
              </span>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Download a full ledger statement for insurance or reimbursement claims.
              </p>
            </div>

            <button
              disabled
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 py-3 text-xs font-semibold text-slate-400 cursor-not-allowed"
              title="Coming soon"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span>Statement PDF</span>
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
            Ledger
          </h3>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_30px_-15px_rgba(30,50,64,0.05)]">
          <div className="grid grid-cols-12 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
            <div className="col-span-3 sm:col-span-2">Date</div>
            <div className="col-span-4 sm:col-span-5">Description</div>
            <div className="col-span-2 text-right">Charged</div>
            <div className="col-span-3 text-right">Due</div>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin text-[#7da3b3]" />
                Loading your ledger...
              </div>
            ) : chargeRows.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">No billing history yet.</div>
            ) : (
              chargeRows.map((row) => {
                const dueCents = row.status === "due" ? row.amountCents : 0;
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-12 items-center px-6 py-4 transition-colors hover:bg-slate-50/50"
                  >
                    <div className="col-span-3 text-xs font-medium text-slate-400 sm:col-span-2">
                      {formatDate(row.createdAt)}
                    </div>
                    <div className="col-span-4 sm:col-span-5">
                      <div className="text-sm font-semibold text-[#1e3240]">
                        {row.appointmentTreatmentName ?? "Charge"}
                      </div>
                      {row.note && <div className="text-xs text-slate-400">{row.note}</div>}
                    </div>
                    <div className="col-span-2 text-right text-xs font-semibold text-[#1e3240]">
                      {centsToDisplay(row.amountCents)}
                    </div>
                    <div
                      className={`col-span-3 text-right text-xs font-semibold ${
                        dueCents > 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {dueCents > 0 ? `NPR ${centsToDisplay(dueCents)} due` : "Paid"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-in fade-in"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-7 shadow-2xl backdrop-blur-xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-[#1e3240]">
                {/* CHANGED - was summary.balanceDueCents */}
                Pay NPR {summary ? centsToDisplay(summary.outstandingCents) : "0"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <div
                onClick={() => setSelectedMethod("khalti")}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200 ${
                  selectedMethod === "khalti"
                    ? "border-[#7da3b3] bg-sky-50/50 ring-2 ring-[#7da3b3]/20"
                    : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5c2d91] text-base font-bold text-white shadow-sm">
                    K
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1e3240]">Khalti</h3>
                    <p className="text-xs text-slate-500">Wallet, bank or connect IPS</p>
                  </div>
                </div>
                {selectedMethod === "khalti" && <Check className="h-5 w-5 text-[#7da3b3]" strokeWidth={2.5} />}
              </div>

              <div
                onClick={() => setSelectedMethod("esewa")}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200 ${
                  selectedMethod === "esewa"
                    ? "border-[#7da3b3] bg-sky-50/50 ring-2 ring-[#7da3b3]/20"
                    : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#60bb46] text-base font-bold text-white shadow-sm">
                    e
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1e3240]">eSewa</h3>
                    <p className="text-xs text-slate-500">Wallet or linked bank account</p>
                  </div>
                </div>
                {selectedMethod === "esewa" && <Check className="h-5 w-5 text-[#7da3b3]" strokeWidth={2.5} />}
              </div>

              <div
                onClick={() => setSelectedMethod("other")}
                className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200 ${
                  selectedMethod === "other"
                    ? "border-[#7da3b3] bg-sky-50/50 ring-2 ring-[#7da3b3]/20"
                    : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7da3b3] text-white shadow-sm">
                    <CreditCard className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1e3240]">Other (Card / Net Banking)</h3>
                    <p className="text-xs text-slate-500">SCT Card, Visa, or International payments</p>
                  </div>
                </div>
                {selectedMethod === "other" && <Check className="h-5 w-5 text-[#7da3b3]" strokeWidth={2.5} />}
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-500">
              You'll be redirected to complete payment, then returned here. A receipt is added to your ledger automatically.
            </div>

            <button
              disabled={!selectedMethod}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#7da3b3] text-sm font-semibold text-white shadow-md shadow-[#7da3b3]/20 transition-all duration-200 hover:bg-[#6b92a2] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <span>
                {selectedMethod
                  ? `Proceed with ${selectedMethod === "khalti" ? "Khalti" : selectedMethod === "esewa" ? "eSewa" : "Card Payment"}`
                  : "Choose a payment method"}
              </span>
              <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}