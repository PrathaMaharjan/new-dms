"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Search,
  Plus,
  Users,
  UserCheck,
  UserX,
  Filter,
  ChevronLeft,
  ChevronRight,
  SquarePen,
  IdCard,
  Clock,
  MapPin,
  Mail,
  Phone,
  Cake,
  VenusAndMars,
  CalendarDays,
  ShieldCheck,
  Trash2,
  Stethoscope,
  Syringe,
  HeartPulse,
  Cross,
  Pill,
  Activity,
  Briefcase,
  AlertCircle,
  ClipboardList,
  BadgeCheck,
  ImagePlus,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

const ROLES = ["Front Desk", "Manager"] as const;
type Role = string;

const SHIFTS = ["Morning", "Afternoon", "Evening", "Full Day"];
const STATUSES = ["Active", "Inactive"] as const;
type StaffStatus = (typeof STATUSES)[number];
const GENDERS = ["Female", "Male", "Other"];

const ROLE_COLORS: Record<string, string> = {
  "Front Desk": "bg-amber-100 text-amber-700",
  Manager: "bg-purple-100 text-purple-700",
  Doctor: "bg-sky-100 text-sky-700",
  Clinical: "bg-sky-100 text-sky-700",
};

const STATUS_COLORS: Record<StaffStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-500",
};

import axios from "axios";
import { useEffect } from "react";
import { uploadConfig } from "@/lib/cloudinary/storage";

const OUTLETS_DEFAULT: { id: string; name: string }[] = [];

type Staff = {
  id: string;
  staffId: string;
  name: string;
  role: Role;
  email: string;
  phone: string;
  shift: string;
  status: StaffStatus;
  joinDate: string;
  gender?: string;
  address?: string;
  imageUrl?: string;
};

const EMPTY_FORM = {
  name: "",
  role: ROLES[0] as Role,
  email: "",
  phone: "",
  shift: SHIFTS[0],
  status: "Active" as StaffStatus,
  joinDate: "",
  gender: GENDERS[0],
  address: "",
  imageUrl: "",
  password: "",
  confirmPassword: "",
};

type FormState = typeof EMPTY_FORM;

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

function staffToForm(s: Staff): FormState {
  return {
    name: s.name,
    role: s.role,
    email: s.email,
    phone: s.phone,
    shift: s.shift,
    status: s.status,
    joinDate: s.joinDate,
    gender: s.gender ?? GENDERS[0],
    address: s.address ?? "",
    imageUrl: s.imageUrl ?? "",
    password: "",
    confirmPassword: "",
  };
}

function getInitials(name: string) {
  const cleaned = name.replace("Dr.", "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
];

function formatDateLabel(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [outletsList, setOutletsList] = useState<{ id: string; name: string }[]>(OUTLETS_DEFAULT);
  const [outletFilter, setOutletFilter] = useState("");

  const fetchStaff = async () => {
    try {
      const params: Record<string, string> = {};
      if (outletFilter !== "all") {
        params.locationId = outletFilter;
      }
      const res = await axios.get("/api/staff", { params });
      if (res.data?.success && Array.isArray(res.data.data?.staff)) {
        const rawStaff = res.data.data.staff;
        // Filter out doctors from staff list
        const nonDoctorStaff = rawStaff.filter((s: any) => {
          const roleLower = (s.role || "").toLowerCase();
          const nameLower = (s.name || "").toLowerCase();
          return (
            roleLower !== "doctor" &&
            roleLower !== "clinical" &&
            !roleLower.includes("doctor") &&
            !nameLower.startsWith("dr.")
          );
        });

        const mapped: Staff[] = nonDoctorStaff.map((s: any, idx: number) => {
          let roleDisplay = "Front Desk";
          if (s.role === "manager") roleDisplay = "Manager";
          else if (s.role === "front_office") roleDisplay = "Front Desk";
          else if (s.role) roleDisplay = s.role;

          return {
            id: s.id || String(idx),
            staffId: `STF-${1000 + idx + 1}`,
            name: s.name,
            role: roleDisplay,
            email: s.email || "",
            phone: s.phone || "",
            shift: s.shift ? s.shift.charAt(0).toUpperCase() + s.shift.slice(1) : "Morning",
            status: s.isActive !== false ? "Active" : "Inactive",
            joinDate: s.joinDate || (s.createdAt ? String(s.createdAt).slice(0, 10) : ""),
            gender: s.gender || "Female",
            address: s.address || "",
            imageUrl: s.photoUrl || undefined,
          };
        });

        setStaff(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch staff list:", err);
    }
  };

  useEffect(() => {
    axios.get("/api/outlets").then((res) => {
      if (res.data?.success && res.data.data?.locations) {
        const seenOutlets = new Set<string>();
        const mapped: { id: string; name: string }[] = [];
        res.data.data.locations.forEach((l: any) => {
          if (l.id && !seenOutlets.has(l.id)) {
            seenOutlets.add(l.id);
            mapped.push({ id: l.id, name: l.name });
          }
        });
        setOutletsList(mapped);
        if (mapped.length > 0) {
          setOutletFilter((prev) => (prev === "all" || !prev ? mapped[0].id : prev));
        }
      }
    }).catch(() => null);
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [outletFilter]);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All" | Role>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  function openAddModal() {
    setModalMode("add");
    setEditingId(null);
    setImageFile(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSubmitError(null);
    setModalOpen(true);
  }

  function openEditModal(s: Staff) {
    setModalMode("edit");
    setEditingId(s.id);
    setImageFile(null);
    setForm(staffToForm(s));
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSubmitError(null);
    setModalOpen(true);
  }

  function openProfile(s: Staff) {
    setSelectedStaff(s);
  }

  function requestDelete(s: Staff) {
    setDeleteTarget(s);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await axios.delete(`/api/staff/${deleteTarget.id}`);
      if (res.data?.success === false) {
        alert(res.data?.error || "Failed to delete staff.");
        return;
      }
      await fetchStaff();
    } catch (err: any) {
      console.error("Failed to delete staff:", err);
      alert(err.response?.data?.error || "Failed to delete staff.");
    } finally {
      setSelectedStaff((prev) => (prev?.id === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    update("imageUrl", url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (modalMode === "add") {
      if (!form.password || form.password.length < 8) {
        setSubmitError("Password must be at least 8 characters long.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setSubmitError("Passwords do not match.");
        return;
      }
    }

    setUploadingImage(true);
    let uploadedPhotoKey: string | undefined = undefined;

    if (imageFile) {
      try {
        if (uploadConfig.cloudinary.cloudName && uploadConfig.cloudinary.uploadPreset) {
          const formData = new FormData();
          formData.append("file", imageFile);
          formData.append("upload_preset", uploadConfig.cloudinary.uploadPreset);
          formData.append("folder", "dental/staff");

          const cloudinaryRes = await axios.post(
            `https://api.cloudinary.com/v1_1/${uploadConfig.cloudinary.cloudName}/image/upload`,
            formData
          );
          uploadedPhotoKey = cloudinaryRes.data.public_id;
        }
      } catch (uploadErr) {
        console.error("Cloudinary upload failed:", uploadErr);
      }
    }

    const shiftEnumVal = form.shift.toLowerCase() === "evening" || form.shift.toLowerCase() === "night"
      ? "night"
      : form.shift.toLowerCase() === "afternoon"
        ? "afternoon"
        : "morning";

    if (modalMode === "edit" && editingId) {
      try {
        let roleVal = "front_office";
        if (form.role === "Manager") roleVal = "manager";

        const payload: Record<string, any> = {
          name: form.name,
          role: roleVal,
          email: form.email,
          phone: form.phone,
          shift: shiftEnumVal,
          joinDate: form.joinDate || undefined,
          gender: form.gender,
          address: form.address,
          isActive: form.status === "Active",
        };
        if (uploadedPhotoKey) {
          payload.photoKey = uploadedPhotoKey;
        }

        await axios.patch(`/api/staff/${editingId}`, payload);
        fetchStaff();
      } catch (err: any) {
        console.error("Failed to update staff:", err);
        setSubmitError(err.response?.data?.error || "Failed to update staff.");
        setUploadingImage(false);
        return;
      }
      setStaff((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, ...form }
            : s
        )
      );
      setSelectedStaff((prev) =>
        prev && prev.id === editingId ? { ...prev, ...form } : prev
      );
    } else {
      try {
        let roleVal = "front_office";
        if (form.role === "Manager") roleVal = "manager";

        const defaultLocationId = outletFilter !== "all" ? outletFilter : outletsList.find((o) => o.id !== "all")?.id;
        if (defaultLocationId) {
          const payload: Record<string, any> = {
            locationId: defaultLocationId,
            name: form.name,
            role: roleVal,
            email: form.email,
            phone: form.phone,
            password: form.password || "Password@123",
            shift: shiftEnumVal,
            joinDate: form.joinDate || undefined,
            gender: form.gender,
            address: form.address,
            isActive: form.status === "Active",
          };
          if (uploadedPhotoKey) {
            payload.photoKey = uploadedPhotoKey;
          }

          await axios.post("/api/staff", payload);
          fetchStaff();
        } else {
          const newStaff: Staff = {
            ...form,
            id: String(Date.now()),
            staffId: `STF-${1000 + staff.length + 1}`,
            joinDate: form.joinDate || new Date().toISOString().slice(0, 10),
          };
          setStaff((prev) => [newStaff, ...prev]);
        }
      } catch (err: any) {
        console.error("Failed to create staff:", err);
        setSubmitError(err.response?.data?.error || "Failed to create staff.");
        setUploadingImage(false);
        return;
      }
      setCurrentPage(1);
    }

    setUploadingImage(false);
    setImageFile(null);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q);
      const matchesRole = roleFilter === "All" || s.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [staff, query, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStaff = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const stats = useMemo(() => {
    const active = staff.filter((s) => s.status === "Active").length;
    const frontDesk = staff.filter((s) => s.role === "Front Desk").length;
    return [
      { icon: Users, label: "Total Staff", value: String(staff.length) },
      { icon: UserCheck, label: "Active Staff", value: String(active) },
      { icon: Briefcase, label: "Front Desk", value: String(frontDesk) },
      {
        icon: UserX,
        label: "Inactive Staff",
        value: String(staff.length - active),
      },
    ];
  }, [staff]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">


      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
            Staff
          </h1>

          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] font-medium text-[#345263] outline-none focus:border-[#7da3b3]"
            >
              {outletsList.map((o, idx) => (
                <option key={`${o.id}-${idx}`} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                  placeholder="Search staff..."
                  className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value as "All" | Role);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                >
                  <option value="All">All roles</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
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
              Add Staff
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedStaff.map((s, i) => {
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <div
                  key={`${s.id}-${i}`}
                  onClick={() => openProfile(s)}
                  className="group cursor-pointer rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#7da3b3]/30 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    {s.imageUrl ? (
                      <div className="relative h-16 w-16 overflow-hidden rounded-full ring-4 ring-slate-50">
                        <Image
                          src={s.imageUrl}
                          alt={s.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={`flex h-16 w-16 items-center justify-center rounded-full text-[1.05rem] font-semibold ring-4 ring-slate-50 ${color}`}
                      >
                        {getInitials(s.name)}
                      </div>
                    )}
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(s);
                        }}
                        aria-label="Edit staff"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-[#3f6274]"
                      >
                        <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(s);
                        }}
                        aria-label="Delete staff"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 text-[1.02rem] font-semibold text-slate-900">{s.name}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${ROLE_COLORS[s.role]}`}
                    >
                      {s.role}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${STATUS_COLORS[s.status]}`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-[0.8rem] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {s.shift} shift
                    </div>
                    {s.joinDate && (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                        Joined {formatDateLabel(s.joinDate)}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-900/5 pt-4 text-[0.8rem] text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {s.phone}
                    </p>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-900/15 bg-white py-16 text-center text-slate-500">
                No staff match your filters.
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
              <span className="text-[0.7rem] text-slate-500 font-medium">
                Showing{" "}
                <strong className="text-slate-800">{startIndex + 1}</strong>{" "}
                to{" "}
                <strong className="text-slate-800">
                  {Math.min(startIndex + itemsPerPage, filtered.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filtered.length}</strong> staff
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
                {modalMode === "edit" ? "Edit Staff" : "Add Staff"}
              </h2>
            </div>

            <div className="px-6 py-6">
              {submitError && (
                <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.85rem] text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{submitError}</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
                    {form.imageUrl ? (
                      <Image
                        src={form.imageUrl}
                        alt="Staff preview"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <ImagePlus className="h-6 w-6" strokeWidth={1.8} />
                    )}
                  </div>
                  <label className="cursor-pointer rounded-full border border-slate-900/10 px-4 py-2 text-[0.85rem] font-medium text-slate-700 transition-colors hover:bg-slate-50">
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Users className="h-3.5 w-3.5" strokeWidth={2} />
                    Full name
                  </span>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder=""
                    className={inputClass}
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Briefcase className="h-3.5 w-3.5" strokeWidth={2} />
                      Role
                    </span>
                    <select
                      value={form.role}
                      onChange={(e) => update("role", e.target.value as Role)}
                      className={inputClass}
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
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
                      onChange={(e) => update("status", e.target.value as StaffStatus)}
                      className={inputClass}
                    >
                      {STATUSES.map((st) => (
                        <option key={st}>{st}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                      Phone
                    </span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder=""
                      maxLength={10}
                      className={inputClass}
                    />
                  </label>
                </div>



                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Shift
                    </span>
                    <select
                      value={form.shift}
                      onChange={(e) => update("shift", e.target.value)}
                      className={inputClass}
                    >
                      {SHIFTS.map((sh) => (
                        <option key={sh}>{sh}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                      Join date
                    </span>
                    <input
                      type="date"
                      value={form.joinDate}
                      onChange={(e) => update("joinDate", e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className={inputClass}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <VenusAndMars className="h-3.5 w-3.5" strokeWidth={2} />
                    Gender
                  </span>
                  <select
                    value={form.gender}
                    onChange={(e) => update("gender", e.target.value)}
                    className={inputClass}
                  >
                    {GENDERS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                    Address
                  </span>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    className={inputClass}
                  />
                </label>
                {modalMode === "add" && (
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                        <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                        Password
                      </span>
                      <div className="relative">
                        <input
                          required
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 8 characters"
                          value={form.password}
                          onChange={(e) => update("password", e.target.value)}
                          className={`${inputClass} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                        <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                        Confirm password
                      </span>
                      <div className="relative">
                        <input
                          required
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Re-enter password"
                          value={form.confirmPassword}
                          onChange={(e) => update("confirmPassword", e.target.value)}
                          className={`${inputClass} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={uploadingImage}
                    className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263] disabled:opacity-50"
                  >
                    {uploadingImage ? "Saving..." : modalMode === "edit" ? "Save Changes" : "Add Staff"}
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

      {/* Staff profile side panel */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div
            onClick={() => setSelectedStaff(null)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedStaff(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <button
                onClick={() => requestDelete(selectedStaff)}
                aria-label="Delete staff"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-rose-500 transition-colors hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete
              </button>
            </div>

            <div className="px-6 py-6">
              {/* Identity */}
              <div className="flex items-start gap-4">
                {selectedStaff.imageUrl ? (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-4 ring-white">
                    <Image
                      src={selectedStaff.imageUrl}
                      alt={selectedStaff.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[1.3rem] font-semibold text-[#3f6274] ring-4 ring-white">
                    {getInitials(selectedStaff.name)}
                  </div>
                )}

                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedStaff.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${ROLE_COLORS[selectedStaff.role]}`}
                    >
                      {selectedStaff.role}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${STATUS_COLORS[selectedStaff.status]}`}
                    >
                      {selectedStaff.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-[0.85rem] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedStaff.address || "Address not provided"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedStaff.phone}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedStaff.email}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                  Staff Information
                </p>
                <div className="mt-4 grid grid-cols-2 gap-y-4 text-[0.85rem]">
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <IdCard className="h-3.5 w-3.5" strokeWidth={2} />
                      Staff ID
                    </p>
                    <p className="mt-1 font-medium text-slate-800">{selectedStaff.staffId}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <VenusAndMars className="h-3.5 w-3.5" strokeWidth={2} />
                      Gender
                    </p>
                    <p className="mt-1 font-medium text-slate-800">
                      {selectedStaff.gender ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Shift
                    </p>
                    <p className="mt-1 font-medium text-slate-800">{selectedStaff.shift}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                      Join Date
                    </p>
                    <p className="mt-1 font-medium text-slate-800">
                      {formatDateLabel(selectedStaff.joinDate)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                      Status
                    </p>
                    <p className="mt-1 font-medium text-slate-800">{selectedStaff.status}</p>
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