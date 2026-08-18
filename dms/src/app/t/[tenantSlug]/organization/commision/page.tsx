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
  Building2,
  Grid3x3,
  Users,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Percent,
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
  const [activeTab, setActiveTab] = useState<"all" | "tiers" | "matrix" | "earnings">("all");

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
  const matrixItemsPerPage = 8; // Adjust items per page for the Rate Matrix table

  // ---------- All Doctor Commissions Pagination ----------
  const [doctorEarnings, setDoctorEarnings] = useState<DoctorEarningsRow[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [earningsPage, setEarningsPage] = useState(1);
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

  // Paginated Treatments for Rate Matrix Table
  const paginatedTreatments = useMemo(() => {
    const startIdx = (matrixPage - 1) * matrixItemsPerPage;
    return treatmentList.slice(startIdx, startIdx + matrixItemsPerPage);
  }, [treatmentList, matrixPage, matrixItemsPerPage]);

  const totalMatrixPages = Math.ceil(treatmentList.length / matrixItemsPerPage);

  // Paginated Doctor Earnings Data
  const paginatedEarnings = useMemo(() => {
    const startIdx = (earningsPage - 1) * earningsItemsPerPage;
    return doctorEarnings.slice(startIdx, startIdx + earningsItemsPerPage);
  }, [doctorEarnings, earningsPage, earningsItemsPerPage]);

  const totalEarningsPages = Math.ceil(doctorEarnings.length / earningsItemsPerPage);

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
    <div className="relative h-screen w-full overflow-y-auto bg-slate-50/70 text-slate-800 antialiased scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* ---------- Header Bar ---------- */}
      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md px-6 py-4 lg:px-10">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7da3b3] text-white shadow-xs">
                  <Percent className="h-4 w-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[#345263] sm:text-2xl">
                  Commission Management
                </h1>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Configure doctor tiers, percentage matrices, and evaluate total commissions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Outlet selector */}
              <div className="relative flex-1 sm:flex-none">
                <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={outletFilter}
                  onChange={(e) => setOutletFilter(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-9 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 focus:border-[#7da3b3] focus:outline-none focus:ring-2 focus:ring-[#7da3b3]/20 sm:w-56"
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

          {/* Navigation Tabs */}
          <div className="mt-5 flex border-b border-slate-100 gap-1 overflow-x-auto pt-1 text-xs font-medium text-slate-500 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 transition ${
                activeTab === "all"
                  ? "border-[#7da3b3] font-semibold text-[#345263]"
                  : "border-transparent hover:text-slate-800"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("tiers")}
              className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 transition ${
                activeTab === "tiers"
                  ? "border-[#7da3b3] font-semibold text-[#345263]"
                  : "border-transparent hover:text-slate-800"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Tiers ({tiers.length})
            </button>
            <button
              onClick={() => setActiveTab("matrix")}
              className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 transition ${
                activeTab === "matrix"
                  ? "border-[#7da3b3] font-semibold text-[#345263]"
                  : "border-transparent hover:text-slate-800"
              }`}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              Rate Matrix
            </button>
            <button
              onClick={() => setActiveTab("earnings")}
              className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 transition ${
                activeTab === "earnings"
                  ? "border-[#7da3b3] font-semibold text-[#345263]"
                  : "border-transparent hover:text-slate-800"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Doctor Earnings
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Main Content Container ---------- */}
      <div className="mx-auto max-w-[1400px] px-6 py-6 lg:px-10 pb-20">
        {/* Feedback Messages */}
        {successMsg && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800 shadow-2xs backdrop-blur-xs">
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
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-xs text-rose-800 shadow-2xs backdrop-blur-xs">
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
        {(activeTab === "all" || activeTab === "tiers") && (
          <div className="rounded-2xl border border-slate-200/70 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7da3b3]/10 text-[#345263]">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Commission Tiers</h2>
                  <p className="text-[0.75rem] text-slate-500">Define doctor seniority tiers based on experience.</p>
                </div>
              </div>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#7da3b3] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#6b92a2] focus:outline-none focus:ring-2 focus:ring-[#7da3b3]/30 active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Tier
              </button>
            </div>

            {tiersLoading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
                Loading tiers...
              </div>
            ) : tiers.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-xs font-medium text-slate-500">No commission tiers defined yet.</p>
                <p className="mt-1 text-[0.75rem] text-slate-400">Create experience tiers to unlock the commission rate matrix.</p>
              </div>
            ) : (
              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="group relative flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition duration-150 hover:border-[#7da3b3]/40 hover:bg-white hover:shadow-xs"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{tier.name}</h3>
                      <span className="mt-1 inline-flex items-center rounded-md bg-slate-200/60 px-2 py-0.5 text-[0.7rem] font-medium text-slate-600">
                        {formatYearsRange(tier.minYears, tier.maxYears)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(tier)}
                        title="Edit Tier"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTier(tier)}
                        disabled={deletingId === tier.id}
                        title="Delete Tier"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        {deletingId === tier.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------- Section 2: Commission Rate Matrix Table & Pagination ---------- */}
        {(activeTab === "all" || activeTab === "matrix") && (
          <div className={`${activeTab === "all" ? "mt-6" : ""} rounded-2xl border border-slate-200/70 bg-white shadow-xs`}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7da3b3]/10 text-[#345263]">
                <Grid3x3 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Commission Rate Matrix</h2>
                <p className="text-[0.75rem] text-slate-500">Specify commission percentages per treatment and experience tier.</p>
              </div>
            </div>

            {matrixLoading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
                Loading rate matrix...
              </div>
            ) : treatmentList.length === 0 || tierList.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                {tierList.length === 0
                  ? "Add at least one tier above to construct the matrix grid."
                  : "No treatments registered for the selected outlet."}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto overflow-y-auto max-h-[500px] p-4 sm:p-6 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-white z-10 shadow-xs">
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
                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                  <span>
                    Showing {treatmentList.length === 0 ? 0 : (matrixPage - 1) * matrixItemsPerPage + 1} to{" "}
                    {Math.min(matrixPage * matrixItemsPerPage, treatmentList.length)} of {treatmentList.length} treatments
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setMatrixPage((p) => Math.max(1, p - 1))}
                      disabled={matrixPage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 font-medium text-slate-700">
                      {matrixPage} / {totalMatrixPages || 1}
                    </span>
                    <button
                      onClick={() => setMatrixPage((p) => Math.min(totalMatrixPages, p + 1))}
                      disabled={matrixPage >= totalMatrixPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ---------- Section 3: Doctor Earnings & Pagination ---------- */}
        {(activeTab === "all" || activeTab === "earnings") && (
          <div className={`${activeTab === "all" ? "mt-6" : ""} rounded-2xl border border-slate-200/70 bg-white shadow-xs`}>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7da3b3]/10 text-[#345263]">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Doctor Earnings</h2>
                  <p className="text-[0.75rem] text-slate-500">Calculated payouts based on active commission logic.</p>
                </div>
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 shadow-2xs outline-none transition focus:border-[#7da3b3]"
                  />
                </div>
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-700 shadow-2xs outline-none transition focus:border-[#7da3b3]"
                />
              </div>
            </div>

            {earningsLoading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
                Loading earnings data...
              </div>
            ) : doctorEarnings.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No recorded commission activities match the date criteria.
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100 p-2 max-h-[400px] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {paginatedEarnings.map((doc) => {
                    const percentage = Math.max((doc.totalEarnedCents / maxEarned) * 100, doc.totalEarnedCents > 0 ? 2 : 0);
                    return (
                      <div key={doc.doctorId} className="p-4 transition hover:bg-slate-50/50 rounded-xl">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[0.7rem] font-bold text-slate-600">
                              {doc.doctorName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-900">{doc.doctorName}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900">
                              NPR {centsToDisplay(doc.totalEarnedCents)}
                            </span>
                            <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-[0.7rem] font-medium text-slate-500">
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
                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                  <span>
                    Showing {doctorEarnings.length === 0 ? 0 : (earningsPage - 1) * earningsItemsPerPage + 1} to{" "}
                    {Math.min(earningsPage * earningsItemsPerPage, doctorEarnings.length)} of {doctorEarnings.length} doctors
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEarningsPage((p) => Math.max(1, p - 1))}
                      disabled={earningsPage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 font-medium text-slate-700">
                      {earningsPage} / {totalEarningsPages || 1}
                    </span>
                    <button
                      onClick={() => setEarningsPage((p) => Math.min(totalEarningsPages, p + 1))}
                      disabled={earningsPage >= totalEarningsPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ---------- Modal Dialog ---------- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div onClick={() => setModalOpen(false)} className="absolute inset-0" aria-hidden />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingTier ? "Edit Commission Tier" : "Add New Tier"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Tier Name
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Junior, Senior, Specialist"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-[#7da3b3] focus:bg-white focus:ring-2 focus:ring-[#7da3b3]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Min Experience (Years)
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.minYears}
                    onChange={(e) => setForm({ ...form, minYears: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-[#7da3b3] focus:bg-white focus:ring-2 focus:ring-[#7da3b3]/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Max Experience (Years)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.maxYears}
                    onChange={(e) => setForm({ ...form, maxYears: e.target.value })}
                    placeholder="No upper limit"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 outline-none transition focus:border-[#7da3b3] focus:bg-white focus:ring-2 focus:ring-[#7da3b3]/20"
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
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#7da3b3] px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#6b92a2] disabled:opacity-60"
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