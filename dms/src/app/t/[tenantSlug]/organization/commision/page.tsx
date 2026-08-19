"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Grid3x3,
  Users,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Percent,
  MapPin,
  Search,
} from "lucide-react";

type Tier = { id: string; name: string; minYears: number; maxYears: number | null };
type RateMatrixRow = { treatmentId: string; treatmentName: string; tierId: string; tierName: string; commissionPercent: number | null };
type DoctorEarningsRow = { doctorId: string; doctorName: string; totalEarnedCents: number; entryCount: number };
function centsToDisplay(cents: number) {
  const value = Number.isFinite(cents) ? cents : 0;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const EMPTY_FORM = { name: "", minYears: "", maxYears: "" };

export default function CommissionManagementPage() {
  const [outletsList, setOutletsList] = useState<{ id: string; name: string }[]>([]);
  const [outletFilter, setOutletFilter] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ---------- Tiers ----------
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---------- Rate Matrix Pagination ----------
  const [matrixRows, setMatrixRows] = useState<RateMatrixRow[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixSearch, setMatrixSearch] = useState("");
  const matrixItemsPerPage = 8; // Adjust items per page for the Rate Matrix table

  // ---------- All Doctor Commissions Pagination ----------
  const [doctorEarnings, setDoctorEarnings] = useState<DoctorEarningsRow[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [earningsPage, setEarningsPage] = useState(1);
  const [earningsSearch, setEarningsSearch] = useState("");
  const earningsItemsPerPage = 5; // Adjust items per page for Doctor Earnings

  // ---------- Load outlets (Deduplicated) ----------
  useEffect(() => {
    async function loadOutlets() {
      try {
        const { data: responseBody } = await axios.get("/api/outlets");
        if (responseBody?.success) {
          const list: { id: string; name: string }[] = responseBody.data?.locations ?? [];

          const uniqueList = Array.from(
            new Map(list.map((item) => [item.id, item])).values()
          );

          setOutletsList(uniqueList);
          if (uniqueList.length > 0) setOutletFilter(uniqueList[0].id);
        }
      } catch {
        // outlet selector stays empty on failure
      }
    }
    loadOutlets();
  }, []);

  // ---------- Load tiers ----------
  const loadTiers = useCallback(async () => {
    setTiersLoading(true);
    try {
      const { data: responseBody } = await axios.get("/api/commision/tier");
      if (responseBody?.success) setTiers(responseBody.data?.tiers ?? []);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Something went wrong loading tiers.");
    } finally {
      setTiersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

  // ---------- Load rate matrix ----------
  const loadMatrix = useCallback(async () => {
    if (!outletFilter) return;
    setMatrixLoading(true);
    try {
      const { data: responseBody } = await axios.get(`/api/commision//treatment?locationId=${outletFilter}`);
      if (responseBody?.success) setMatrixRows(responseBody.data?.matrix ?? []);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Something went wrong loading the rate matrix.");
    } finally {
      setMatrixLoading(false);
    }
  }, [outletFilter]);

  useEffect(() => {
    loadMatrix();
    setMatrixPage(1); // Reset matrix pagination on location change
  }, [loadMatrix]);

  // ---------- Load doctor earnings ----------
  const loadEarnings = useCallback(async () => {
    if (!outletFilter) return;
    setEarningsLoading(true);
    try {
      const params = new URLSearchParams({ locationId: outletFilter });
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const { data: responseBody } = await axios.get(`/api/commision/getAll?${params.toString()}`);
      if (responseBody?.success) setDoctorEarnings(responseBody.data?.doctors ?? []);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Something went wrong loading doctor earnings.");
    } finally {
      setEarningsLoading(false);
    }
  }, [outletFilter, fromDate, toDate]);

  useEffect(() => {
    loadEarnings();
    setEarningsPage(1); // Reset doctor earnings pagination on filter/location change
  }, [loadEarnings]);

  // ---------- Tier form handlers ----------
  function openCreateModal() {
    setEditingTier(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(tier: Tier) {
    setEditingTier(tier);
    setForm({ name: tier.name, minYears: String(tier.minYears), maxYears: tier.maxYears === null ? "" : String(tier.maxYears) });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const minYears = Number(form.minYears);
    const maxYears = form.maxYears.trim() === "" ? undefined : Number(form.maxYears);

    setSubmitting(true);
    try {
      const responsePromise = editingTier
        ? axios.patch(`/api/commision/tier/${editingTier.id}`, { name: form.name, minYears, maxYears })
        : axios.post("/api/commision/tier", { name: form.name, minYears, maxYears });

      const { data: responseBody } = await responsePromise;
      if (!responseBody?.success) {
        setFormError(responseBody?.error ?? "Something went wrong.");
        return;
      }
      setSuccessMsg(editingTier ? `"${form.name}" updated successfully.` : `"${form.name}" created successfully.`);
      setModalOpen(false);
      await Promise.all([loadTiers(), loadMatrix()]);
    } catch (err) {
      if (axios.isAxiosError(err)) setFormError(err.response?.data?.error ?? "Something went wrong.");
      else setFormError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteTier(tier: Tier) {
    setDeletingId(tier.id);
    setError(null);
    try {
      const { data: responseBody } = await axios.delete(`/api/commision/tier/${tier.id}`);
      if (!responseBody?.success) {
        setError(responseBody?.error ?? "Something went wrong deleting this tier.");
        return;
      }
      setSuccessMsg(`"${tier.name}" removed.`);
      setTiers((prev) => prev.filter((t) => t.id !== tier.id));
      await loadMatrix();
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Something went wrong deleting this tier.");
    } finally {
      setDeletingId(null);
    }
  }

  function formatYearsRange(minYears: number, maxYears: number | null) {
    if (maxYears === null) return `${minYears}+ yrs exp`;
    if (minYears === maxYears) return `${minYears} yr exp`;
    return `${minYears}\u2013${maxYears} yrs exp`;
  }

  // ---------- Rate Matrix pivot ----------
  const { treatmentList, tierList, cellMap } = useMemo(() => {
    const treatmentsMap = new Map<string, string>();
    const tiersMap = new Map<string, string>();
    const cells = new Map<string, number | null>();

    for (const row of matrixRows) {
      treatmentsMap.set(row.treatmentId, row.treatmentName);
      tiersMap.set(row.tierId, row.tierName);
      cells.set(`${row.treatmentId}-${row.tierId}`, row.commissionPercent);
    }

    return {
      treatmentList: Array.from(treatmentsMap, ([id, name]) => ({ id, name })),
      tierList: Array.from(tiersMap, ([id, name]) => ({ id, name })),
      cellMap: cells,
    };
  }, [matrixRows]);

  // Search-filtered treatments for the Rate Matrix
  const filteredTreatmentList = useMemo(() => {
    const q = matrixSearch.trim().toLowerCase();
    if (!q) return treatmentList;
    return treatmentList.filter((t) => t.name.toLowerCase().includes(q));
  }, [treatmentList, matrixSearch]);

  // Paginated Treatments for Rate Matrix Table
  const paginatedTreatments = useMemo(() => {
    const startIdx = (matrixPage - 1) * matrixItemsPerPage;
    return filteredTreatmentList.slice(startIdx, startIdx + matrixItemsPerPage);
  }, [filteredTreatmentList, matrixPage, matrixItemsPerPage]);

  const totalMatrixPages = Math.max(1, Math.ceil(filteredTreatmentList.length / matrixItemsPerPage));

  // Search-filtered doctor earnings
  const filteredDoctorEarnings = useMemo(() => {
    const q = earningsSearch.trim().toLowerCase();
    if (!q) return doctorEarnings;
    return doctorEarnings.filter((d) => d.doctorName.toLowerCase().includes(q));
  }, [doctorEarnings, earningsSearch]);

  // Paginated Doctor Earnings Data
  const paginatedEarnings = useMemo(() => {
    const startIdx = (earningsPage - 1) * earningsItemsPerPage;
    return filteredDoctorEarnings.slice(startIdx, startIdx + earningsItemsPerPage);
  }, [filteredDoctorEarnings, earningsPage, earningsItemsPerPage]);

  const totalEarningsPages = Math.max(1, Math.ceil(filteredDoctorEarnings.length / earningsItemsPerPage));

  function getCellValue(treatmentId: string, tierId: string): string {
    const key = `${treatmentId}-${tierId}`;
    if (key in cellDrafts) return cellDrafts[key];
    const stored = cellMap.get(key);
    return stored === null || stored === undefined ? "" : String(stored);
  }

  function handleCellChange(treatmentId: string, tierId: string, value: string) {
    setCellDrafts((prev) => ({ ...prev, [`${treatmentId}-${tierId}`]: value }));
  }

  async function handleCellBlur(treatmentId: string, tierId: string) {
    const key = `${treatmentId}-${tierId}`;
    const draft = cellDrafts[key];
    if (draft === undefined || draft.trim() === "") return;

    const commissionPercent = Number(draft);
    if (isNaN(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      setError("Commission must be a percentage between 0 and 100.");
      setCellDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    setSavingCell(key);
    try {
      const { data: responseBody } = await axios.post("/api/commision/treatment", { treatmentId, tierId, commissionPercent });
      if (!responseBody?.success) {
        setError(responseBody?.error ?? "Something went wrong saving this rate.");
        return;
      }
      setMatrixRows((prev) =>
        prev.map((r) => (r.treatmentId === treatmentId && r.tierId === tierId ? { ...r, commissionPercent } : r))
      );
      setCellDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error ?? "Something went wrong saving this rate.");
    } finally {
      setSavingCell(null);
    }
  }

  const maxEarned = Math.max(1, ...doctorEarnings.map((d) => d.totalEarnedCents));

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">

      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">

              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
                Commission Management
              </h1>
            </div>
          
          </div>

          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] font-medium text-[#345263] outline-none focus:border-[#7da3b3]"
            >
              {outletsList.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* ---------- Main Content Container ---------- */}
      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        {/* Feedback Messages */}
        {successMsg && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-[0.85rem] text-emerald-800 shadow-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="rounded-md p-1 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-[0.85rem] text-rose-800 shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span className="font-medium">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="rounded-md p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ---------- Section 1: Commission Tiers ---------- */}
        <div className="rounded-2xl border border-slate-900/5 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-900/5 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                <Layers className="h-4 w-4" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[0.95rem] font-semibold text-slate-900">Commission Tiers</h2>
                <p className="text-[0.8rem] text-slate-500">Define doctor seniority tiers based on experience.</p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#749fb1] px-4 py-2.5 text-[0.85rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Add Tier
            </button>
          </div>

          {tiersLoading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-[0.85rem] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
              Loading tiers...
            </div>
          ) : tiers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[0.9rem] font-medium text-slate-500">No commission tiers defined yet.</p>
              <p className="mt-1 text-[0.8rem] text-slate-400">Create experience tiers to unlock the commission rate matrix.</p>
            </div>
          ) : (
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className="group relative flex items-center justify-between rounded-2xl border border-slate-900/5 bg-slate-50/50 p-4 transition-all hover:-translate-y-0.5 hover:border-[#7da3b3]/30 hover:shadow-lg"
                >
                  <div>
                    <h3 className="text-[0.95rem] font-semibold text-slate-900">{tier.name}</h3>
                    <span className="mt-1 inline-flex items-center rounded-full bg-[#7da3b3]/10 px-2.5 py-1 text-[0.75rem] font-medium text-[#3f6274]">
                      {formatYearsRange(tier.minYears, tier.maxYears)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(tier)}
                      title="Edit Tier"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-[#3f6274]"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => handleDeleteTier(tier)}
                      disabled={deletingId === tier.id}
                      title="Delete Tier"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                    >
                      {deletingId === tier.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Section 2: Commission Rate Matrix Table & Pagination ---------- */}
        <div className="mt-6 rounded-2xl border border-slate-900/5 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-900/5 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                <Grid3x3 className="h-4 w-4" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[0.95rem] font-semibold text-slate-900">Commission Rate Matrix</h2>
                <p className="text-[0.8rem] text-slate-500">Specify commission percentages per treatment and experience tier.</p>
              </div>
            </div>

            {/* Treatment Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
              <input
                value={matrixSearch}
                onChange={(e) => {
                  setMatrixSearch(e.target.value);
                  setMatrixPage(1);
                }}
                placeholder="Search treatments..."
                className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.85rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
              />
            </div>
          </div>

          {matrixLoading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-[0.85rem] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
              Loading rate matrix...
            </div>
          ) : treatmentList.length === 0 || tierList.length === 0 ? (
            <div className="p-12 text-center text-[0.85rem] text-slate-400">
              {tierList.length === 0
                ? "Add at least one tier above to construct the matrix grid."
                : "No treatments registered for the selected outlet."}
            </div>
          ) : filteredTreatmentList.length === 0 ? (
            <div className="p-12 text-center text-[0.85rem] text-slate-400">
              No treatments match "{matrixSearch}".
            </div>
          ) : (
            <>
              <div className="overflow-x-auto overflow-y-auto max-h-[500px] p-4 sm:p-6 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full border-collapse text-left text-[0.85rem]">
                  <thead className="sticky top-0 bg-white z-10 shadow-sm">
                    <tr className="border-b border-slate-200 text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                      <th className="bg-slate-50/80 pb-3 pl-4 pr-6 pt-2 font-bold text-slate-600 rounded-l-lg">
                        Treatment / Procedure
                      </th>
                      {tierList.map((tier) => (
                        <th key={tier.id} className="bg-slate-50/80 pb-3 px-4 pt-2 text-center font-bold text-slate-600 last:rounded-r-lg">
                          {tier.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTreatments.map((treatment) => (
                      <tr key={treatment.id} className="group hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 pl-4 pr-6 font-medium text-slate-800">
                          {treatment.name}
                        </td>
                        {tierList.map((tier) => {
                          const cellKey = `${treatment.id}-${tier.id}`;
                          const val = getCellValue(treatment.id, tier.id);
                          return (
                            <td key={tier.id} className="py-2.5 px-3 text-center">
                              <div className="relative inline-flex items-center justify-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={val}
                                  onChange={(e) => handleCellChange(treatment.id, tier.id, e.target.value)}
                                  onBlur={() => handleCellBlur(treatment.id, tier.id)}
                                  placeholder="0"
                                  className={`w-16 rounded-xl border py-1.5 pl-2.5 pr-5 text-center text-xs font-semibold outline-none transition ${
                                    val !== ""
                                      ? "border-slate-200 bg-white text-slate-900 shadow-2xs focus:border-[#7da3b3] focus:ring-2 focus:ring-[#7da3b3]/20"
                                      : "border-dashed border-slate-200 bg-slate-50/60 text-slate-400 focus:border-[#7da3b3] focus:bg-white"
                                  }`}
                                />
                                <span className="pointer-events-none absolute right-2 text-[0.7rem] font-medium text-slate-400">
                                  %
                                </span>
                                {savingCell === cellKey && (
                                  <Loader2 className="absolute -right-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[#7da3b3]" />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Controls */}
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-[0.8rem] text-slate-500">
                <span>
                  Showing {filteredTreatmentList.length === 0 ? 0 : (matrixPage - 1) * matrixItemsPerPage + 1} to{" "}
                  {Math.min(matrixPage * matrixItemsPerPage, filteredTreatmentList.length)} of {filteredTreatmentList.length} treatments
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMatrixPage((p) => Math.max(1, p - 1))}
                    disabled={matrixPage === 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 font-medium text-slate-700">
                    {matrixPage} / {totalMatrixPages}
                  </span>
                  <button
                    onClick={() => setMatrixPage((p) => Math.min(totalMatrixPages, p + 1))}
                    disabled={matrixPage >= totalMatrixPages}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ---------- Section 3: Doctor Earnings & Pagination ---------- */}
        <div className="mt-6 rounded-2xl border border-slate-900/5 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-900/5 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                <Users className="h-4 w-4" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[0.95rem] font-semibold text-slate-900">Doctor Earnings</h2>
                <p className="text-[0.8rem] text-slate-500">Calculated payouts based on active commission logic.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Doctor Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <input
                  value={earningsSearch}
                  onChange={(e) => {
                    setEarningsSearch(e.target.value);
                    setEarningsPage(1);
                  }}
                  placeholder="Search doctors..."
                  className="w-48 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.85rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-full border border-slate-900/10 bg-white py-1.5 pl-8 pr-3 text-[0.8rem] text-slate-700 outline-none transition focus:border-[#7da3b3]"
                  />
                </div>
                <span className="text-[0.8rem] text-slate-400">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-full border border-slate-900/10 bg-white py-1.5 px-3 text-[0.8rem] text-slate-700 outline-none transition focus:border-[#7da3b3]"
                />
              </div>
            </div>
          </div>

          {earningsLoading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-[0.85rem] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
              Loading earnings data...
            </div>
          ) : doctorEarnings.length === 0 ? (
            <div className="p-12 text-center text-[0.85rem] text-slate-400">
              No recorded commission activities match the date criteria.
            </div>
          ) : filteredDoctorEarnings.length === 0 ? (
            <div className="p-12 text-center text-[0.85rem] text-slate-400">
              No doctors match "{earningsSearch}".
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 p-2 max-h-[400px] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {paginatedEarnings.map((doc) => {
                  const percentage = Math.max((doc.totalEarnedCents / maxEarned) * 100, doc.totalEarnedCents > 0 ? 2 : 0);
                  return (
                    <div key={doc.doctorId} className="p-4 transition-colors hover:bg-slate-50/50 rounded-2xl">
                      <div className="flex items-center justify-between text-[0.85rem]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[0.75rem] font-semibold text-[#3f6274]">
                            {doc.doctorName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{doc.doctorName}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">
                            NPR {centsToDisplay(doc.totalEarnedCents)}
                          </span>
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[0.7rem] font-medium text-slate-500">
                            {doc.entryCount} {doc.entryCount === 1 ? "entry" : "entries"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#7da3b3] transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Doctor Data Pagination Controls */}
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-[0.8rem] text-slate-500">
                <span>
                  Showing {filteredDoctorEarnings.length === 0 ? 0 : (earningsPage - 1) * earningsItemsPerPage + 1} to{" "}
                  {Math.min(earningsPage * earningsItemsPerPage, filteredDoctorEarnings.length)} of {filteredDoctorEarnings.length} doctors
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEarningsPage((p) => Math.max(1, p - 1))}
                    disabled={earningsPage === 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 font-medium text-slate-700">
                    {earningsPage} / {totalEarningsPages}
                  </span>
                  <button
                    onClick={() => setEarningsPage((p) => Math.min(totalEarningsPages, p + 1))}
                    disabled={earningsPage >= totalEarningsPages}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---------- Modal Dialog ---------- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div onClick={() => setModalOpen(false)} className="absolute inset-0" aria-hidden />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-[1.05rem] font-semibold text-slate-900">
                {editingTier ? "Edit Commission Tier" : "Add New Tier"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[0.85rem] text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-[0.8rem] font-medium text-slate-600">
                  Tier Name
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Junior, Senior, Specialist"
                  className="w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[0.8rem] font-medium text-slate-600">
                    Min Experience (Years)
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.minYears}
                    onChange={(e) => setForm({ ...form, minYears: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.8rem] font-medium text-slate-600">
                    Max Experience (Years)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.maxYears}
                    onChange={(e) => setForm({ ...form, maxYears: e.target.value })}
                    placeholder="No upper limit"
                    className="w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]"
                  />
                </div>
              </div>
              <p className="text-[0.7rem] text-slate-400">
                Leave "Max Experience" blank to indicate an open-ended experience tier (e.g., 5+ years).
              </p>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-full px-4 py-2.5 text-[0.85rem] font-medium text-slate-500 transition-colors hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#749fb1] px-5 py-2.5 text-[0.85rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263] disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? "Saving..." : editingTier ? "Save Changes" : "Create Tier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}