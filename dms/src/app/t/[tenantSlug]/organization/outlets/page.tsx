"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Search,
  Plus,
  Building2,
  MapPin,
  Filter,
  ChevronLeft,
  ChevronRight,
  SquarePen,
  IdCard,
  Clock,
  Phone,
  Mail,
  User,
  Trash2,
  Stethoscope,
  Syringe,
  HeartPulse,
  Cross,
  Pill,
  Activity,
  ClipboardList,
  BadgeCheck,
  Building,
  Globe,
  Loader2,
} from "lucide-react";

const STATUSES = ["Active", "Inactive"] as const;
type OutletStatus = (typeof STATUSES)[number];

const STATUS_COLORS: Record<OutletStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-500",
};

type Outlet = {
  id: string;
  outletId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  manager: string;
  managerId?: string;
  status: OutletStatus;
  openingTime: string;
  closingTime: string;
  createdDate: string;
  notes?: string;
};

function apiLocationToOutlet(loc: any): Outlet {
  return {
    id: loc.id,
    outletId: `OUT-${String(loc.id).slice(0, 4).toUpperCase()}`,
    name: loc.name || "Untitled Outlet",
    address: loc.address || "",
    city: loc.city || "",
    phone: loc.phone || "",
    email: loc.email || "",
    manager: loc.managerName || "Unassigned",
    managerId: loc.managerId || "",
    status: loc.isActive !== false ? "Active" : "Inactive",
    openingTime: loc.openingTime || "09:00",
    closingTime: loc.closingTime || "18:00",
    createdDate: loc.createdAt ? new Date(loc.createdAt).toISOString().slice(0, 10) : "",
    notes: loc.notes || "",
  };
}

const EMPTY_FORM = {
  name: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  managerId: "",
  status: "Active" as OutletStatus,
  openingTime: "09:00",
  closingTime: "18:00",
  notes: "",
};

type FormState = typeof EMPTY_FORM;

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

const textareaClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

function outletToForm(o: Outlet): FormState {
  return {
    name: o.name,
    address: o.address,
    city: o.city,
    phone: o.phone,
    email: o.email,
    managerId: o.managerId || "",
    status: o.status,
    openingTime: o.openingTime,
    closingTime: o.closingTime,
    notes: o.notes ?? "",
  };
}

function formatTimeLabel(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateLabel(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
}

export default function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | OutletStatus>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Outlet | null>(null);
  const [managers, setManagers] = useState<{ id: string; name: string; email: string }[]>([]);

  const loadOutlets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/outlets");
      if (res.data?.success && res.data.data?.locations) {
        const seen = new Set<string>();
        const mapped: Outlet[] = [];
        res.data.data.locations.forEach((loc: any) => {
          if (loc.id && !seen.has(loc.id)) {
            seen.add(loc.id);
            mapped.push(apiLocationToOutlet(loc));
          }
        });
        setOutlets(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadManagers = useCallback(async () => {
    try {
      const res = await axios.get("/api/outlets/managers");
      if (res.data?.success && res.data.data?.managers) {
        const seen = new Set<string>();
        const unique = res.data.data.managers.filter((m: any) => {
          if (!m.id || seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        setManagers(unique);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadOutlets();
    loadManagers();
  }, [loadOutlets, loadManagers]);

  function openAddModal() {
    setModalMode("add");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  async function openEditModal(o: Outlet) {
    setModalMode("edit");
    setEditingId(o.id);
    setForm(outletToForm(o));
    setModalOpen(true);
    try {
      const res = await axios.get(`/api/outlets/${o.id}`);
      if (res.data?.success && res.data.data?.location) {
        const fetched = apiLocationToOutlet(res.data.data.location);
        setForm(outletToForm(fetched));
      }
    } catch (err) {
      console.error("Error fetching location details:", err);
    }
  }

  async function openProfile(o: Outlet) {
    setSelectedOutlet(o);
    try {
      const res = await axios.get(`/api/outlets/${o.id}`);
      if (res.data?.success && res.data.data?.location) {
        const fetched = apiLocationToOutlet(res.data.data.location);
        setSelectedOutlet(fetched);
      }
    } catch (err) {
      console.error("Error fetching location details:", err);
    }
  }

  function requestDelete(o: Outlet) {
    setDeleteTarget(o);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await axios.delete(`/api/outlets/${deleteTarget.id}`);
      if (res.data?.success === false) {
        alert(res.data?.error || "Failed to delete outlet.");
        return;
      }
      if (selectedOutlet?.id === deleteTarget.id) {
        setSelectedOutlet(null);
      }
      await loadOutlets();
    } catch (err: any) {
      console.error("Delete error:", err);
      alert(err.response?.data?.error || "Failed to delete outlet.");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function toggleStatus(o: Outlet) {
    try {
      await axios.patch(`/api/outlets/${o.id}`, {
        isActive: o.status !== "Active",
      });
      await loadOutlets();
    } catch (err) {
      console.error(err);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        address: form.address,
        city: form.city,
        phone: form.phone,
        email: form.email,
        openingTime: form.openingTime,
        closingTime: form.closingTime,
        notes: form.notes,
        isActive: form.status === "Active",
        managerId: form.managerId || null,
      };

      if (modalMode === "edit" && editingId) {
        const res = await axios.patch(`/api/outlets/${editingId}`, payload);
        if (res.data?.success === false) {
          alert(res.data?.error || "Failed to update outlet.");
          return;
        }
      } else {
        const res = await axios.post("/api/outlets", payload);
        if (res.data?.success === false) {
          alert(res.data?.error || "Failed to add outlet.");
          return;
        }
      }
      await loadOutlets();
      setForm(EMPTY_FORM);
      setEditingId(null);
      setModalOpen(false);
    } catch (err: any) {
      console.error("Submit outlet error:", err);
      alert(err.response?.data?.error || "Failed to save outlet.");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return outlets.filter((o) => {
      const matchesQuery =
        !q ||
        o.name.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        o.manager.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || o.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [outlets, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOutlets = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const stats = useMemo(() => {
    const active = outlets.filter((o) => o.status === "Active").length;
    const cities = new Set(outlets.map((o) => o.city)).size;
    return [
      { icon: Building2, label: "Total Outlets", value: String(outlets.length) },
      { icon: BadgeCheck, label: "Active Outlets", value: String(active) },
      { icon: Globe, label: "Cities Covered", value: String(cities) },
    ];
  }, [outlets]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">


      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
          Outlets
        </h1>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <p className="text-[0.85rem] font-medium text-slate-500">{stat.label}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                  <stat.icon className="h-4 w-4" strokeWidth={2} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                {stat.value}
              </p>
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
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search outlets..."
                  className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as "All" | OutletStatus);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                >
                  <option value="All">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-full bg-[#749fb1] px-5 py-2.5 text-[0.9rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263]"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add Outlet
            </button>
          </div>

          {/* Table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-900/5">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[0.75rem] font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Outlet</th>
                  <th className="px-5 py-3 font-medium">Address</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Manager</th>
                  <th className="px-5 py-3 font-medium">Hours</th>
                  <th className="px-5 py-3 font-medium">Created Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/5 bg-white">
                {paginatedOutlets.map((o, idx) => (
                  <tr
                    key={`${o.id}-${idx}`}
                    onClick={() => openProfile(o)}
                    className="cursor-pointer transition-colors hover:bg-[#7da3b3]/[0.06]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7da3b3]/15 text-[#345263]">
                          <Building2 className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <div>
                          <p className="text-[0.9rem] font-semibold text-slate-900">{o.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                        <span>
                          {o.address}, {o.city}
                        </span>
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        {o.phone || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        {o.manager}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        {formatTimeLabel(o.openingTime)} - {formatTimeLabel(o.closingTime)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        {formatDateLabel(o.createdDate)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStatus(o);
                        }}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-opacity hover:opacity-80 ${STATUS_COLORS[o.status]}`}
                      >
                        {o.status}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(o);
                          }}
                          aria-label="Edit outlet"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <SquarePen className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDelete(o);
                          }}
                          aria-label="Delete outlet"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="bg-white py-16 text-center text-slate-500">
                      No outlets match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
              <span className="text-[0.7rem] text-slate-500 font-medium">
                Showing{" "}
                <strong className="text-slate-800">{startIndex + 1}</strong>{" "}
                to{" "}
                <strong className="text-slate-800">
                  {Math.min(startIndex + itemsPerPage, filtered.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filtered.length}</strong> outlets
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
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div
            onClick={() => setModalOpen(false)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setModalOpen(false)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <h2 className="text-[0.95rem] font-semibold text-slate-900">
                {modalMode === "edit" ? "Edit Outlet" : "Add Outlet"}
              </h2>
            </div>

            <div className="px-6 py-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Building className="h-3.5 w-3.5" strokeWidth={2} />
                    Outlet name
                  </span>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Chitwan Dental Home - Bharatpur"
                    className={inputClass}
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                      Address
                    </span>
                    <input
                      required
                      type="text"
                      value={form.address}
                      onChange={(e) => update("address", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                      City
                    </span>
                    <input
                      required
                      type="text"
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                      Phone
                    </span>
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                      Email
                    </span>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <User className="h-3.5 w-3.5" strokeWidth={2} />
                      Branch Manager
                    </span>
                    <select
                      value={form.managerId}
                      onChange={(e) => update("managerId", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select Branch Manager</option>
                      {managers.map((m, idx) => (
                        <option key={`${m.id}-${idx}`} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
                      Status
                    </span>
                    <select
                      value={form.status}
                      onChange={(e) => update("status", e.target.value as OutletStatus)}
                      className={inputClass}
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Opening time
                    </span>
                    <input
                      type="time"
                      value={form.openingTime}
                      onChange={(e) => update("openingTime", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Closing time
                    </span>
                    <input
                      type="time"
                      value={form.closingTime}
                      onChange={(e) => update("closingTime", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>



                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263]"
                  >
                    {modalMode === "edit" ? "Save Changes" : "Add Outlet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-full px-5 py-2.5 text-[0.9rem] font-medium text-slate-500 transition-colors hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Outlet detail side panel */}
      {selectedOutlet && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div
            onClick={() => setSelectedOutlet(null)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedOutlet(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(selectedOutlet)}
                  aria-label="Edit outlet"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />
                  Edit
                </button>
                <button
                  onClick={() => requestDelete(selectedOutlet)}
                  aria-label="Delete outlet"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-rose-500 transition-colors hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Delete
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274] ring-4 ring-white">
                  <Building2 className="h-8 w-8" strokeWidth={1.8} />
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedOutlet.name}</h2>
                  <button
                    type="button"
                    onClick={() => toggleStatus(selectedOutlet)}
                    className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-opacity hover:opacity-80 ${STATUS_COLORS[selectedOutlet.status]}`}
                  >
                    {selectedOutlet.status}
                  </button>


                  <div className="mt-3 space-y-1 text-[0.85rem] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedOutlet.address}, {selectedOutlet.city}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedOutlet.phone}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedOutlet.email}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                  Outlet Information
                </p>
                <div className="mt-4 grid grid-cols-2 gap-y-4 text-[0.85rem]">
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <IdCard className="h-3.5 w-3.5" strokeWidth={2} />
                      Outlet ID
                    </p>
                    <p className="mt-1 font-medium text-slate-800">{selectedOutlet.outletId}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <User className="h-3.5 w-3.5" strokeWidth={2} />
                      Manager
                    </p>
                    <p className="mt-1 font-medium text-slate-800">{selectedOutlet.manager}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Operating Hours
                    </p>
                    <p className="mt-1 font-medium text-slate-800">
                      {formatTimeLabel(selectedOutlet.openingTime)} - {formatTimeLabel(selectedOutlet.closingTime)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Created Date
                    </p>
                    <p className="mt-1 font-medium text-slate-800">
                      {formatDateLabel(selectedOutlet.createdDate)}
                    </p>
                  </div>
                </div>

                {selectedOutlet.notes && (
                  <div className="mt-6 border-t border-slate-900/5 pt-5">
                    <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                      Notes
                    </p>
                    <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-600">
                      {selectedOutlet.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div
            onClick={() => setDeleteTarget(null)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <Trash2 className="h-5 w-5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 text-[1.05rem] font-semibold text-slate-900">
              Do you want to remove {deleteTarget.name}?
            </h3>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-rose-600"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-full border border-slate-900/10 px-4 py-2.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}