"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Search,
  Plus,
  Wallet,
  TrendingDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Receipt,
  Banknote,
  CreditCard,
  Smartphone,
  ArrowUpCircle,
  ArrowDownCircle,
  Scale,
  Stethoscope,
  Syringe,
  HeartPulse,
  Cross,
  Pill,
  Activity,
  ClipboardList,
  CalendarDays,
  Printer,
  X,
  Phone,
} from "lucide-react";

const ENTRY_TYPES = ["charge", "payment", "adjustment"] as const;
type EntryType = (typeof ENTRY_TYPES)[number];


const PAYMENT_METHODS = ["cash", "card", "online"] as const;
const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "Cash",
  card: "Card",
  online: "Online",
};

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  charge: "Charge",
  payment: "Payment",
  adjustment: "Adjustment",
};

const ENTRY_TYPE_COLORS: Record<EntryType, string> = {
  charge: "bg-amber-100 text-amber-700",
  payment: "bg-emerald-100 text-emerald-700",
  adjustment: "bg-violet-100 text-violet-700",
};

const ENTRY_TYPE_ICONS: Record<EntryType, typeof ArrowUpCircle> = {
  charge: ArrowUpCircle,
  payment: ArrowDownCircle,
  adjustment: Scale,
};

type LedgerEntry = {
  id: string;
  type: EntryType;
  amountCents: number;
  paymentMethod: string | null;
  note: string | null;
  appointmentTreatmentName: string | null;
  createdAt: string;
};

type LedgerSummary = { totalChargedCents: number; totalPaidCents: number; balanceDueCents: number };

type BillingPatientRow = {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  lastActivity: string | null;
  chargedCents: number;
  paidCents: number;
  balanceCents: number;
};

type BillingStats = {
  totalChargedCents: number;
  totalCollectedCents: number;
  outstandingDuesCents: number;
  patientsWithDuesCount: number;
};

type Location = { id: string; name: string };

const EMPTY_ENTRY_FORM = {
  type: "charge" as EntryType,
  amount: "",
  paymentMethod: PAYMENT_METHODS[0] as string,
  note: "",
};

type EntryFormState = typeof EMPTY_ENTRY_FORM;

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

const textareaClass = inputClass;

function centsToDisplay(cents: number) {
  const value = Number.isFinite(cents) ? cents : 0;
  return (value / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDateOnly(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}


function receiptNumberFor(entryId: string) {
  const digits = entryId.replace(/\D/g, "");
  const suffix = (digits || entryId).slice(-4).padStart(4, "0");
  return `RCP-2026-${suffix}`;
}


function balanceAfterEntry(entries: LedgerEntry[], entryId: string) {
  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let running = 0;
  for (const e of sorted) {
    running += e.amountCents;
    if (e.id === entryId) break;
  }
  return running;
}

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
];

const METHOD_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  online: Smartphone,
};

const ITEMS_PER_PAGE = 8;

export default function BillingPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"All" | "Due" | "Settled">("All");
  const [currentPage, setCurrentPage] = useState(1);

  const [stats, setStats] = useState<BillingStats | null>(null);
  const [rows, setRows] = useState<BillingPatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingTable, setLoadingTable] = useState(true);

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [selectedPatientPhone, setSelectedPatientPhone] = useState<string>("");
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryTargetPatientId, setEntryTargetPatientId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormState>(EMPTY_ENTRY_FORM);
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const [receiptEntryId, setReceiptEntryId] = useState<string | null>(null);

  // Debounce search - avoids firing a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    async function loadStaffLocation() {
      try {
        let locId = "";
        try {
          const savedLoc =
            localStorage.getItem("dms_location_id") ||
            localStorage.getItem("current_location_id") ||
            localStorage.getItem("locationId");
          if (savedLoc) locId = savedLoc;
        } catch (e) {}

        if (!locId) {
          const userRes = await axios.get("/api/user-details").catch(() => null);
          if (userRes?.data?.success && userRes.data.data?.user?.locationId) {
            locId = userRes.data.data.user.locationId;
          }
        }

        const [outletsRes, servicesRes, treatmentsRes, patientsRes] = await Promise.all([
          axios.get("/api/outlets").catch(() => null),
          axios.get("/api/services").catch(() => null),
          axios.get("/api/treatment").catch(() => null),
          axios.get("/api/patent").catch(() => null),
        ]);

        if (outletsRes?.data?.success && Array.isArray(outletsRes.data.data.locations) && outletsRes.data.data.locations.length > 0) {
          const list: Location[] = outletsRes.data.data.locations;
          setLocations(list);
          if (!locId) locId = list[0].id;
        }

        if (!locId) {
          if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
            locId = servicesRes.data.data.services[0].locationId;
          } else if (treatmentsRes?.data?.success && treatmentsRes.data.data.treatments?.length > 0) {
            locId = treatmentsRes.data.data.treatments[0].locationId;
          } else if (patientsRes?.data?.success && patientsRes.data.data.patients?.length > 0) {
            locId = patientsRes.data.data.patients[0].locationId;
          }
        }

        if (locId) {
          setLocationId(locId);
          try {
            localStorage.setItem("dms_location_id", locId);
          } catch (e) {}
        }
      } catch {
      }
    }
    loadStaffLocation();
  }, []);

  const loadStats = useCallback(async () => {
    if (!locationId) return;
    try {
      const { data: responseBody } = await axios.get(`/api/billing/stats?locationId=${locationId}`);
      if (responseBody?.success) setStats(responseBody.data.stats);
    } catch {
    }
  }, [locationId]);

  const loadPatients = useCallback(async () => {
    setLoadingTable(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const balanceFilterParam =
        balanceFilter === "Due" ? "due" : balanceFilter === "Settled" ? "settled" : "all";

      let responseBody = null;
      if (locationId) {
        const res = await axios.get("/api/billing/patentDetail", {
          params: {
            locationId,
            search: debouncedQuery || undefined,
            balanceFilter: balanceFilterParam,
            limit: ITEMS_PER_PAGE,
            offset,
          },
        }).catch(() => null);
        responseBody = res?.data;
      }

      if (responseBody?.success && Array.isArray(responseBody.data.patients) && responseBody.data.patients.length > 0) {
        setRows(responseBody.data.patients);
        setTotal(responseBody.data.pagination.total);
      } else {
        const res = await axios.get("/api/patent").catch(() => null);
        if (res?.data?.success && Array.isArray(res.data.data.patients)) {
          const rawPatients = res.data.data.patients;
          const outletPatients = locationId
            ? rawPatients.filter((p: any) => !p.locationId || p.locationId === locationId)
            : rawPatients;

          const mappedPromises = outletPatients.map(async (p: any) => {
            const ledgerRes = await axios.get(`/api/patent/${p.id}/ledger`).catch(() => null);
            if (ledgerRes?.data?.success && ledgerRes.data.data.summary) {
              const summary = ledgerRes.data.data.summary;
              return {
                patientId: p.id,
                patientName: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient",
                patientPhone: p.phone || "-",
                lastActivity: p.lastVisit ? new Date(p.lastVisit).toISOString() : null,
                chargedCents: summary.totalChargedCents ?? 0,
                paidCents: summary.totalPaidCents ?? 0,
                balanceCents: summary.balanceDueCents ?? 0,
              };
            }
            return {
              patientId: p.id,
              patientName: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient",
              patientPhone: p.phone || "-",
              lastActivity: p.lastVisit ? new Date(p.lastVisit).toISOString() : null,
              chargedCents: 0,
              paidCents: 0,
              balanceCents: 0,
            };
          });
          const mapped: BillingPatientRow[] = await Promise.all(mappedPromises);
          const filtered = mapped.filter((r) => {
            const matchesQuery = !debouncedQuery || r.patientName.toLowerCase().includes(debouncedQuery.toLowerCase()) || (r.patientPhone && r.patientPhone.includes(debouncedQuery));
            const matchesBalance = balanceFilter === "All" || (balanceFilter === "Due" && r.balanceCents > 0) || (balanceFilter === "Settled" && r.balanceCents <= 0);
            return matchesQuery && matchesBalance;
          });
          setRows(filtered.slice(offset, offset + ITEMS_PER_PAGE));
          setTotal(filtered.length);
        } else {
          setRows([]);
          setTotal(0);
        }
      }
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoadingTable(false);
    }
  }, [locationId, debouncedQuery, balanceFilter, currentPage]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  }

  async function loadLedgerFor(patientId: string, name: string, phone: string) {
    setSelectedPatientId(patientId);
    setSelectedPatientName(name);
    setSelectedPatientPhone(phone);
    setLoadingLedger(true);
    try {
      const { data: responseBody } = await axios.get(`/api/patent/${patientId}/ledger`);
      if (responseBody?.success) {
        setLedgerSummary(responseBody.data.summary);
        setLedgerEntries(responseBody.data.entries);
      }
    } catch {
      setLedgerSummary(null);
      setLedgerEntries([]);
    } finally {
      setLoadingLedger(false);
    }
  }

  const receiptContext = useMemo(() => {
    if (!receiptEntryId) return null;
    const entry = ledgerEntries.find((e) => e.id === receiptEntryId);
    if (!entry) return null;
    return { entry, patientName: selectedPatientName, patientPhone: selectedPatientPhone };
  }, [receiptEntryId, ledgerEntries, selectedPatientName, selectedPatientPhone]);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { icon: Receipt, label: "Total Charged", value: `NPR ${centsToDisplay(stats.totalChargedCents)}` },
      { icon: Wallet, label: "Total Collected", value: `NPR ${centsToDisplay(stats.totalCollectedCents)}` },
      { icon: TrendingDown, label: "Outstanding Dues", value: `NPR ${centsToDisplay(stats.outstandingDuesCents)}` },
      { icon: User, label: "Patients With Dues", value: String(stats.patientsWithDuesCount) },
    ];
  }, [stats]);

  function openEntryModal(patientId: string) {
    setEntryTargetPatientId(patientId);
    setEntryForm(EMPTY_ENTRY_FORM);
    setEntryError(null);
    setEntryModalOpen(true);
  }

  function update<K extends keyof EntryFormState>(key: K, value: EntryFormState[K]) {
    setEntryForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryTargetPatientId) return;
    setEntryError(null);

    const activeLocId = locationId || locations[0]?.id || "outlet-1";
    const amountNumber = Number(entryForm.amount) || 0;
    const amountCents = Math.round(amountNumber * 100);

    setSubmittingEntry(true);
    try {
      const { data: responseBody } = await axios.post(`/api/patent/${entryTargetPatientId}/ledger`, {
        locationId: activeLocId,
        type: entryForm.type,
        amountCents,
        paymentMethod: entryForm.type === "payment" ? entryForm.paymentMethod : undefined,
        note: entryForm.note || undefined,
      });

      if (!responseBody?.success) {
        setEntryError(responseBody?.error ?? "Something went wrong adding this entry.");
        return;
      }

      setEntryModalOpen(false);
      setEntryForm(EMPTY_ENTRY_FORM);


      await Promise.all([
        loadPatients(),
        loadStats(),
        selectedPatientId === entryTargetPatientId
          ? loadLedgerFor(entryTargetPatientId, selectedPatientName, selectedPatientPhone)
          : Promise.resolve(),
      ]);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setEntryError(err.response?.data?.error ?? "Something went wrong adding this entry.");
      } else {
        setEntryError("Something went wrong adding this entry.");
      }
    } finally {
      setSubmittingEntry(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
     

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-[0.85rem] font-medium text-slate-500">{stat.label}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                  <stat.icon className="h-4 w-4" strokeWidth={2} />
                </div>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search patient, phone..."
                  className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={balanceFilter}
                  onChange={(e) => {
                    setBalanceFilter(e.target.value as "All" | "Due" | "Settled");
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                >
                  <option value="All">All balances</option>
                  <option value="Due">Has dues</option>
                  <option value="Settled">Settled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-900/5">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[0.75rem] font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Last Activity</th>
                  <th className="px-5 py-3 font-medium">Charged</th>
                  <th className="px-5 py-3 font-medium">Paid</th>
                  <th className="px-5 py-3 font-medium">Balance</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/5 bg-white">
                {rows.map((r, i) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const hasDue = r.balanceCents > 0;
                  return (
                    <tr
                      key={r.patientId}
                      onClick={() => loadLedgerFor(r.patientId, r.patientName, r.patientPhone ?? "")}
                      className="cursor-pointer transition-colors hover:bg-[#7da3b3]/[0.06]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-semibold ${color}`}>
                            {getInitials(r.patientName)}
                          </div>
                          <p className="truncate text-[0.9rem] font-semibold text-slate-900">{r.patientName}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                          {r.patientPhone ?? "—"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                          {r.lastActivity ? formatDateTime(r.lastActivity) : "—"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[0.85rem] text-slate-700">NPR {centsToDisplay(r.chargedCents)}</td>
                      <td className="px-5 py-4 text-[0.85rem] text-slate-700">NPR {centsToDisplay(r.paidCents)}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.78rem] font-medium ${hasDue ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                            }`}
                        >
                          NPR {centsToDisplay(Math.abs(r.balanceCents))}
                          {hasDue ? " due" : r.balanceCents < 0 ? " credit" : " settled"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEntryModal(r.patientId);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 px-3 py-1.5 text-[0.78rem] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                            Add Entry
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loadingTable && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="bg-white py-16 text-center text-slate-500">
                      No patients match your filters.
                    </td>
                  </tr>
                )}
                {loadingTable && (
                  <tr>
                    <td colSpan={7} className="bg-white py-16 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {total > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
              <span className="text-[0.7rem] font-medium text-slate-500">
                Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{" "}
                <strong className="text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, total)}</strong> of{" "}
                <strong className="text-slate-800">{total}</strong> patients
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${currentPage === pageNum
                      ? "bg-[#7da3b3] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ledger detail side panel */}
      {selectedPatientId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div onClick={() => setSelectedPatientId(null)} className="absolute inset-0" aria-hidden />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedPatientId(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <button
                onClick={() => openEntryModal(selectedPatientId)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#7da3b3] px-4 py-2 text-[0.85rem] font-medium text-white transition-colors hover:bg-[#345263]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add Entry
              </button>
            </div>

            <div className="px-6 py-6">
              {/* Identity */}
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[1.3rem] font-semibold text-[#3f6274] ring-4 ring-white">
                  {getInitials(selectedPatientName)}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedPatientName}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-[0.85rem] text-slate-500">
                    <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                    {selectedPatientPhone || "—"}
                  </p>

                  {ledgerSummary && (
                    <span
                      className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-medium ${ledgerSummary.balanceDueCents > 0
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                        }`}
                    >
                      NPR {centsToDisplay(Math.abs(ledgerSummary.balanceDueCents))}
                      {ledgerSummary.balanceDueCents > 0
                        ? " due"
                        : ledgerSummary.balanceDueCents < 0
                          ? " credit"
                          : " settled"}
                    </span>
                  )}
                </div>
              </div>

              {/* Summary */}
              {ledgerSummary && (
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-900/5 bg-white p-4 shadow-sm">
                    <p className="flex items-center gap-1.5 text-[0.78rem] text-slate-400">
                      <Receipt className="h-3.5 w-3.5" strokeWidth={2} />
                      Total Charged
                    </p>
                    <p className="mt-1 text-[1.1rem] font-semibold text-slate-800">
                      NPR {centsToDisplay(ledgerSummary.totalChargedCents)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-900/5 bg-white p-4 shadow-sm">
                    <p className="flex items-center gap-1.5 text-[0.78rem] text-slate-400">
                      <Wallet className="h-3.5 w-3.5" strokeWidth={2} />
                      Total Paid
                    </p>
                    <p className="mt-1 text-[1.1rem] font-semibold text-slate-800">
                      NPR {centsToDisplay(ledgerSummary.totalPaidCents)}
                    </p>
                  </div>
                </div>
              )}

              {/* Ledger history */}
              <div className="mt-6 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                  Ledger History
                </p>

                {loadingLedger ? (
                  <p className="mt-4 text-[0.85rem] text-slate-500">Loading...</p>
                ) : ledgerEntries.length === 0 ? (
                  <p className="mt-4 text-[0.85rem] text-slate-500">No entries recorded yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {[...ledgerEntries]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .map((entry) => {
                        const TypeIcon = ENTRY_TYPE_ICONS[entry.type as EntryType];
                        const MethodIcon = entry.paymentMethod ? METHOD_ICONS[entry.paymentMethod] : null;
                        const isNegativeAdjustment = entry.type === "adjustment" && entry.amountCents < 0;
                        return (
                          <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-900/5 p-3">
                            <div className="flex items-start gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ENTRY_TYPE_COLORS[entry.type as EntryType]}`}>
                                <TypeIcon className="h-4 w-4" strokeWidth={2} />
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${ENTRY_TYPE_COLORS[entry.type as EntryType]}`}>
                                    {ENTRY_TYPE_LABELS[entry.type as EntryType]}
                                  </span>
                                  {entry.paymentMethod && (
                                    <span className="inline-flex items-center gap-1 text-[0.75rem] text-slate-500">
                                      {MethodIcon && <MethodIcon className="h-3 w-3" strokeWidth={2} />}
                                      {PAYMENT_METHOD_LABELS[entry.paymentMethod as (typeof PAYMENT_METHODS)[number]] ?? entry.paymentMethod}
                                    </span>
                                  )}
                                </div>
                                {entry.appointmentTreatmentName && (
                                  <p className="mt-1 text-[0.82rem] text-slate-700">{entry.appointmentTreatmentName}</p>
                                )}
                                {entry.note && <p className="mt-1 text-[0.8rem] text-slate-500">{entry.note}</p>}
                                <p className="mt-1 flex items-center gap-1 text-[0.75rem] text-slate-400">
                                  <CalendarDays className="h-3 w-3" strokeWidth={2} />
                                  {formatDateTime(entry.createdAt)}
                                </p>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <p className={`text-[0.9rem] font-semibold ${entry.type === "payment" || isNegativeAdjustment ? "text-emerald-600" : "text-slate-800"}`}>
                                {entry.amountCents < 0 ? "−" : "+"}
                                NPR {centsToDisplay(Math.abs(entry.amountCents))}
                              </p>
                              {entry.type === "payment" && (
                                <button
                                  type="button"
                                  onClick={() => setReceiptEntryId(entry.id)}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-900/10 px-2.5 py-1 text-[0.72rem] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                  <Printer className="h-3 w-3" strokeWidth={2} />
                                  Receipt
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add ledger entry modal */}
      {entryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div onClick={() => setEntryModalOpen(false)} className="absolute inset-0" aria-hidden />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-[1.05rem] font-semibold text-slate-900">Add Ledger Entry</h3>
            <p className="mt-1 text-[0.8rem] text-slate-500">
              {entryTargetPatientId === selectedPatientId
                ? selectedPatientName
                : rows.find((r) => r.patientId === entryTargetPatientId)?.patientName}
            </p>

            {entryError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[0.78rem] text-rose-700">
                {entryError}
              </div>
            )}

            <form onSubmit={handleAddEntry} className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                  <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                  Entry type
                </span>
                <select value={entryForm.type} onChange={(e) => update("type", e.target.value as EntryType)} className={inputClass}>
                  {ENTRY_TYPES.map((t, idx) => (
                    <option key={`${t}-${idx}`} value={t}>
                      {ENTRY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                  <Banknote className="h-3.5 w-3.5" strokeWidth={2} />
                  Amount (NPR)
                </span>
                <input
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  value={entryForm.amount}
                  onChange={(e) => update("amount", e.target.value)}
                  placeholder="1500"
                  className={inputClass}
                />
                {entryForm.type === "adjustment" && (
                  <p className="mt-1.5 text-[0.75rem] text-slate-400">
                    Treated as a discount (reduces balance).
                  </p>
                )}
              </label>

              {entryForm.type === "payment" && (
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <CreditCard className="h-3.5 w-3.5" strokeWidth={2} />
                    Payment method
                  </span>
                  <select value={entryForm.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)} className={inputClass}>
                    {PAYMENT_METHODS.map((m, idx) => (
                      <option key={`${m}-${idx}`} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                  <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                  Note
                </span>
                <textarea
                  rows={2}
                  value={entryForm.note}
                  onChange={(e) => update("note", e.target.value)}
                  placeholder="Optional reference or reason"
                  className={textareaClass}
                />
              </label>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submittingEntry}
                  className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263] disabled:opacity-60"
                >
                  {submittingEntry ? "Adding..." : "Add Entry"}
                </button>
                <button
                  type="button"
                  onClick={() => setEntryModalOpen(false)}
                  className="rounded-full px-5 py-2.5 text-[0.9rem] font-medium text-slate-500 transition-colors hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt modal - still fabricated, no real receipt system on the backend */}
      {receiptEntryId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4 print-receipt-overlay">
          <div onClick={() => setReceiptEntryId(null)} className="absolute inset-0 print-hide" aria-hidden />

          <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl print-receipt-card">
            <div className="print-hide flex items-center justify-between border-b border-slate-900/5 px-5 py-4">
              <h3 className="text-[0.95rem] font-semibold text-slate-900">Receipt</h3>
              <div className="flex items-center gap-2">
                {receiptContext && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#7da3b3] px-4 py-2 text-[0.82rem] font-medium text-white transition-colors hover:bg-[#345263]"
                  >
                    <Printer className="h-3.5 w-3.5" strokeWidth={2} />
                    Print
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setReceiptEntryId(null)}
                  aria-label="Close receipt"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>

            <div id="receipt-print-area" className="overflow-y-auto px-6 py-6">
              {!receiptContext ? (
                <div className="py-10 text-center text-[0.85rem] text-slate-500">
                  Couldn't find this payment entry. It may have been removed — close this and try again from the
                  ledger.
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[1.05rem] font-semibold text-[#345263]">
                        {locations.find((l) => l.id === locationId)?.name ?? "Clinic"}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                      <Receipt className="h-5 w-5" strokeWidth={2} />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-y border-dashed border-slate-300 py-3 text-[0.8rem]">
                    <span className="text-slate-500">Receipt No.</span>
                    <span className="font-medium text-slate-800">{receiptNumberFor(receiptContext.entry.id)}</span>
                  </div>

                  <div className="mt-4 space-y-2 text-[0.85rem]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Date</span>
                      <span className="font-medium text-slate-800">{formatDateOnly(receiptContext.entry.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Patient</span>
                      <span className="font-medium text-slate-800">{receiptContext.patientName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Phone</span>
                      <span className="font-medium text-slate-800">{receiptContext.patientPhone || "—"}</span>
                    </div>
                    {receiptContext.entry.paymentMethod && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Payment Method</span>
                        <span className="font-medium text-slate-800">
                          {PAYMENT_METHOD_LABELS[receiptContext.entry.paymentMethod as (typeof PAYMENT_METHODS)[number]] ??
                            receiptContext.entry.paymentMethod}
                        </span>
                      </div>
                    )}
                    {receiptContext.entry.note && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Reference</span>
                        <span className="font-medium text-slate-800">{receiptContext.entry.note}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.85rem] text-slate-600">Amount Paid</span>
                      <span className="text-[1.15rem] font-semibold text-slate-900">
                        NPR {centsToDisplay(Math.abs(receiptContext.entry.amountCents))}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[0.8rem]">
                    <span className="text-slate-500">Balance After Payment</span>
                    {(() => {
                      const bal = balanceAfterEntry(ledgerEntries, receiptContext.entry.id);
                      const due = bal > 0;
                      return (
                        <span className={`font-medium ${due ? "text-rose-600" : "text-emerald-600"}`}>
                          NPR {centsToDisplay(Math.abs(bal))} {due ? "due" : "settled"}
                        </span>
                      );
                    })()}
                  </div>

                  <p className="mt-6 border-t border-dashed border-slate-300 pt-4 text-center text-[0.75rem] text-slate-400">
                    Thank you for your visit.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-print-area,
          #receipt-print-area * {
            visibility: visible;
          }
          .print-receipt-overlay {
            position: static !important;
            inset: auto !important;
            background: none !important;
            padding: 0 !important;
            display: block !important;
          }
          .print-receipt-card {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          #receipt-print-area {
            position: static !important;
            overflow: visible !important;
            width: 100%;
            background: white;
            padding: 20px;
          }
          .print-hide {
            display: none !important;
          }
          @page {
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}