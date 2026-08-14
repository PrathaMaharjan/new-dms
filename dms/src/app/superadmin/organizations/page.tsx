"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Search,
  Plus,
  Building2,
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
  BadgeCheck,
  Globe,
  MapPin,
  Layers,
  ImagePlus,
  X,
} from "lucide-react";

const STATUSES = ["Active", "Suspended", "Cancelled"] as const;
type OrgStatus = (typeof STATUSES)[number];

type ApiOrgStatus = "active" | "suspended" | "cancelled";

const STATUS_COLORS: Record<OrgStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
  Suspended: "bg-amber-100 text-amber-700 hover:bg-amber-200",
  Cancelled: "bg-rose-100 text-rose-700 hover:bg-rose-200",
};

type Organization = {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  status: OrgStatus;
  email: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  outletCount: number;
  createdDate: string;
  picture: string | null;
};


const EMPTY_FORM = {
  name: "",
  slug: "",
  status: "Active" as OrgStatus,
  email: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  phone: "",
  picture: null as string | null,
};

type FormState = typeof EMPTY_FORM;

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

function orgToForm(o: Organization): FormState {
  return {
    name: o.name,
    slug: o.slug,
    status: o.status,
    email: o.email,
    ownerName: o.ownerName,
    ownerEmail: o.ownerEmail,
    ownerPassword: "",
    phone: o.phone,
    picture: o.picture ?? null,
  };
}

function mapApiStatusToUi(status: string): OrgStatus {
  if (status === "active") return "Active";
  if (status === "suspended") return "Suspended";
  return "Cancelled";
}

function mapUiStatusToApi(status: OrgStatus): ApiOrgStatus {
  if (status === "Active") return "active";
  if (status === "Suspended") return "suspended";
  return "cancelled";
}

type ApiOrgRow = {
  id: string;
  name?: string;
  slug?: string;
  status?: string;
  email?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  outletCount?: number;
  createdAt?: string;
  photoUrl?: string | null;
};

function mapApiOrgToUi(raw: ApiOrgRow, index: number): Organization {
  const ownerEmail = raw.ownerEmail || raw.email || "";
  return {
    id: raw.id,
    orgId: `ORG-${String(raw.id ?? index).slice(-6).toUpperCase()}`,
    name: raw.name ?? "Organization",
    slug: raw.slug ?? "-",
    status: mapApiStatusToUi(raw.status ?? "cancelled"),
    email: raw.email || ownerEmail || "—",
    ownerName: raw.ownerName || "—",
    ownerEmail: ownerEmail || "—",
    phone: raw.ownerPhone || "—",
    outletCount: typeof raw.outletCount === "number" ? raw.outletCount : 0,
    createdDate: raw.createdAt ?? "",
    picture: raw.photoUrl ?? null,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDateLabel(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | OrgStatus>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);

  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);

  async function loadOrganizations() {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await axios.get("/api/superadmin/orgnization", {
        params: { limit: 100 },
      }).catch(() => null);
      if (res?.data?.success && Array.isArray(res.data.data?.organizations)) {
        const mapped = (res.data.data.organizations as ApiOrgRow[]).map((o, idx) => mapApiOrgToUi(o, idx));
        setOrgs(mapped);
      } else {
        setOrgs([]);
      }
    } catch (err: unknown) {
      console.error("Failed to load organizations:", err);
      if (axios.isAxiosError(err)) {
        setErrorMsg(err.response?.data?.error ?? "Failed to load organizations.");
      } else {
        setErrorMsg("Failed to load organizations.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrganizations();
    });
  }, []);

  function openAddModal() {
    setModalMode("add");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setModalOpen(true);
  }

  function openEditModal(o: Organization) {
    setModalMode("edit");
    setEditingId(o.id);
    setForm(orgToForm(o));
    setSlugTouched(true);
    setModalOpen(true);
  }

  function openProfile(o: Organization) {
    setSelectedOrg(o);
  }

  function requestDelete(o: Organization) {
    setDeleteTarget(o);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      const res = await axios.patch(`/api/superadmin/orgnization/${deleteTarget.id}/status`, {
        status: "cancelled",
      });

      if (!res.data?.success) {
        setErrorMsg(res.data?.error ?? "Failed to update organization status.");
        return;
      }

      await loadOrganizations();
      setSelectedOrg((prev) => (prev?.id === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
    } catch (err: unknown) {
      console.error("Failed to cancel organization:", err);
      if (axios.isAxiosError(err)) {
        setErrorMsg(err.response?.data?.error ?? "Failed to cancel organization.");
      } else {
        setErrorMsg("Failed to cancel organization.");
      }
    }
  }

  async function toggleStatus(o: Organization) {
    const nextStatus: ApiOrgStatus = o.status === "Active" ? "suspended" : "active";

    try {
      const res = await axios.patch(`/api/superadmin/orgnization/${o.id}/status`, {
        status: nextStatus,
      });

      if (!res.data?.success) {
        setErrorMsg(res.data?.error ?? "Failed to update organization status.");
        return;
      }

      const mappedStatus = mapApiStatusToUi(res.data.data?.status ?? nextStatus);
      setOrgs((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: mappedStatus } : x)));
      setSelectedOrg((prev) => (prev && prev.id === o.id ? { ...prev, status: mappedStatus } : prev));
    } catch (err: unknown) {
      console.error("Failed to toggle status:", err);
      if (axios.isAxiosError(err)) {
        setErrorMsg(err.response?.data?.error ?? "Failed to update organization status.");
      } else {
        setErrorMsg("Failed to update organization status.");
      }
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !slugTouched) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  }

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      update("picture", dataUrl);
    } catch {
      // ignore read errors silently, user can retry
    } finally {
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    try {
      if (modalMode === "edit" && editingId) {
        const payload = {
          name: form.name.trim() || undefined,
          slug: form.slug.trim() || undefined,
          email: form.email.trim() || undefined,
          photoKey: form.picture ?? undefined,
          status: mapUiStatusToApi(form.status),
          ownerName: form.ownerName.trim() || undefined,
          ownerEmail: form.ownerEmail.trim() || undefined,
          ownerPhone: form.phone.trim() || undefined,
        };

        const { data: responseBody } = await axios.patch(
          `/api/superadmin/orgnization/${editingId}`,
          payload
        );

        if (!responseBody?.success) {
          setErrorMsg(responseBody?.error ?? "Failed to update organization.");
          return;
        }
      } else {
        if (!form.ownerPassword.trim()) {
          setErrorMsg("Owner temporary password is required.");
          return;
        }
        if (form.ownerPassword.trim().length < 8) {
          setErrorMsg("Owner password must be at least 8 characters long.");
          return;
        }

        const payload = {
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          email: form.email.trim() || undefined,
          photoKey: form.picture ?? undefined,
          status: mapUiStatusToApi(form.status),
          ownerName: form.ownerName.trim(),
          ownerEmail: form.ownerEmail.trim(),
          ownerPhone: form.phone.trim() || undefined,
          password: form.ownerPassword,
        };

        const { data: responseBody } = await axios.post("/api/superadmin/orgnization", payload);

        if (!responseBody?.success) {
          setErrorMsg(responseBody?.error ?? "Failed to create organization.");
          return;
        }

        setCurrentPage(1);
      }

      await loadOrganizations();
      setForm(EMPTY_FORM);
      setEditingId(null);
      setSlugTouched(false);
      setModalOpen(false);
    } catch (err: unknown) {
      console.error("Failed to save organization:", err);
      if (axios.isAxiosError(err)) {
        setErrorMsg(err.response?.data?.error ?? "Failed to save organization.");
      } else {
        setErrorMsg("Failed to save organization.");
      }
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orgs.filter((o) => {
      const matchesQuery =
        !q ||
        o.name.toLowerCase().includes(q) ||
        o.ownerName.toLowerCase().includes(q) ||
        o.ownerEmail.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || o.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [orgs, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrgs = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const stats = useMemo(() => {
    const active = orgs.filter((o) => o.status === "Active").length;
    const totalOutlets = orgs.reduce((s, o) => s + o.outletCount, 0);
    return [
      { icon: Building2, label: "Total Organizations", value: String(orgs.length) },
      { icon: BadgeCheck, label: "Active", value: String(active) },
      { icon: Layers, label: "Total Outlets", value: String(totalOutlets) },
    ];
  }, [orgs]);

  return (
    <div className="relative min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
          Organizations
        </h1>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Stats */}
        <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-1 lg:grid-cols-3">
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
                  placeholder="Search organizations..."
                  className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as "All" | OrgStatus);
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
              Add Organization
            </button>
          </div>

          {/* Table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-900/5">
            <table className="w-full min-w-[1000px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[0.75rem] font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Organization</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Outlets</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/5 bg-white">
                {loading && (
                  <tr>
                    <td colSpan={8} className="bg-white py-16 text-center text-slate-500">
                      Loading organizations...
                    </td>
                  </tr>
                )}

                {!loading && paginatedOrgs.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => openProfile(o)}
                    className="cursor-pointer transition-colors hover:bg-[#7da3b3]/[0.06]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#7da3b3]/15 text-[#345263]">
                          {o.picture ? (
                            <img
                              src={o.picture}
                              alt={o.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Building2 className="h-4 w-4" strokeWidth={2} />
                          )}
                        </div>
                        <div>
                          <p className="text-[0.9rem] font-semibold text-slate-900">{o.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        {o.ownerName}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        {o.email}
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
                        <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        {o.outletCount}
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
                        title="Click to toggle status"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStatus(o);
                        }}
                        className={`inline-flex cursor-pointer items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${STATUS_COLORS[o.status]}`}
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
                          aria-label="Edit organization"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <SquarePen className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDelete(o);
                          }}
                          aria-label="Delete organization"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="bg-white py-16 text-center text-slate-500">
                      No organizations match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
              <span className="text-[0.7rem] font-medium text-slate-500">
                Showing{" "}
                <strong className="text-slate-800">{startIndex + 1}</strong>{" "}
                to{" "}
                <strong className="text-slate-800">
                  {Math.min(startIndex + itemsPerPage, filtered.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filtered.length}</strong> organizations
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
                {modalMode === "edit" ? "Edit Organization" : "Add Organization"}
              </h2>
            </div>

            <div className="px-6 py-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <ImagePlus className="h-3.5 w-3.5" strokeWidth={2} />
                    Organization picture
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#7da3b3]/15 text-[#345263]">
                      {form.picture ? (
                        <img
                          src={form.picture}
                          alt="Organization preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Building2 className="h-6 w-6" strokeWidth={2} />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-900/10 bg-white px-4 py-2 text-[0.8rem] font-medium text-slate-600 transition-colors hover:bg-slate-100">
                        <ImagePlus className="h-3.5 w-3.5" strokeWidth={2} />
                        {form.picture ? "Change picture" : "Upload picture"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePictureChange}
                          className="hidden"
                        />
                      </label>
                      {form.picture && (
                        <button
                          type="button"
                          onClick={() => update("picture", null)}
                          className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[0.8rem] font-medium text-rose-500 transition-colors hover:bg-rose-50"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Building2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Organization name
                  </span>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Everest Smile Studio"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Globe className="h-3.5 w-3.5" strokeWidth={2} />
                    Slug
                  </span>
                  <input


                    required
                    type="text"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      update("slug", slugify(e.target.value));
                    }}
                    placeholder="everest-smile"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                    Organization email
                  </span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="hello@everestsmile.com"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
                    Status
                  </span>
                  <select
                    value={form.status}
                    onChange={(e) => update("status", e.target.value as OrgStatus)}
                    className={inputClass}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <User className="h-3.5 w-3.5" strokeWidth={2} />
                    Owner name
                  </span>
                  <input
                    required={modalMode === "add"}
                    type="text"
                    value={form.ownerName}
                    onChange={(e) => update("ownerName", e.target.value)}
                    placeholder="Dr. Sarita Lama"
                    className={inputClass}
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                      Owner email
                    </span>
                    <input
                      required={modalMode === "add"}
                      type="email"
                      value={form.ownerEmail}
                      onChange={(e) => update("ownerEmail", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                      Phone
                    </span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>

                {modalMode === "add" && (
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <IdCard className="h-3.5 w-3.5" strokeWidth={2} />
                      Owner temporary password
                    </span>
                    <input
                      required
                      minLength={8}
                      type="password"
                      value={form.ownerPassword}
                      onChange={(e) => update("ownerPassword", e.target.value)}
                      placeholder="At least 8 characters"
                      className={inputClass}
                    />
                  </label>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263]"
                  >
                    {modalMode === "edit" ? "Save Changes" : "Add Organization"}
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

      {/* Organization detail side panel */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div
            onClick={() => setSelectedOrg(null)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedOrg(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(selectedOrg)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />
                  Edit
                </button>
                <button
                  onClick={() => requestDelete(selectedOrg)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-rose-500 transition-colors hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Delete
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7da3b3]/15 text-[#3f6274] ring-4 ring-white">
                  {selectedOrg.picture ? (
                    <img
                      src={selectedOrg.picture}
                      alt={selectedOrg.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-8 w-8" strokeWidth={1.8} />
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedOrg.name}</h2>
                  <p className="mt-1 flex items-center gap-1 text-[0.82rem] text-slate-500">
                    <Globe className="h-3.5 w-3.5" strokeWidth={2} />
                    {selectedOrg.email}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      title="Click to toggle status"
                      onClick={() => toggleStatus(selectedOrg)}
                      className={`inline-flex cursor-pointer items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${STATUS_COLORS[selectedOrg.status]}`}
                    >
                      {selectedOrg.status}
                    </button>
                  </div>

                  <div className="mt-3 space-y-1 text-[0.85rem] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedOrg.ownerName}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedOrg.ownerEmail}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedOrg.phone || "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                  Organization Information
                </p>
                <div className="mt-4 grid grid-cols-2 gap-y-4 text-[0.85rem]">
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <IdCard className="h-3.5 w-3.5" strokeWidth={2} />
                      Org ID
                    </p>
                    <p className="mt-1 font-medium text-slate-800">{selectedOrg.orgId}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                      Outlets
                    </p>
                    <p className="mt-1 font-medium text-slate-800">{selectedOrg.outletCount}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Created
                    </p>
                    <p className="mt-1 font-medium text-slate-800">
                      {formatDateLabel(selectedOrg.createdDate)}
                    </p>
                  </div>
                </div>
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
            <p className="mt-1.5 text-[0.85rem] leading-relaxed text-slate-500">
              This will mark the organization as cancelled. You can reactivate it later.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-rose-600"
              >
                Mark Cancelled
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