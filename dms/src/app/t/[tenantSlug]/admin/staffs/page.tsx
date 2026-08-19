"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import axios from "axios";
import { uploadConfig } from "@/lib/cloudinary/storage";
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
  BadgeCheck,
  AlertCircle,
  RefreshCw,
  Lock,
  EyeOff,
  Eye,
  ImagePlus,
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

const AVATAR_COLORS = [
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
];

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

const SEED_STAFF: Staff[] = [
  {
    id: "1",
    staffId: "STF-1001",
    name: "Sujata Karki",
    role: "Front Desk",
    email: "sujata.karki@chitwandental.com",
    phone: "+977 981-2345671",
    shift: "Morning",
    status: "Active",
    joinDate: "2024-02-10",
    gender: "Female",
    address: "Bharatpur-10, Chitwan",
  },
  {
    id: "3",
    staffId: "STF-1003",
    name: "Bimala Thapa",
    role: "Front Desk",
    email: "bimala.thapa@chitwandental.com",
    phone: "+977 981-2345673",
    shift: "Evening",
    status: "Active",
    joinDate: "2024-05-19",
    gender: "Female",
    address: "Narayangarh, Chitwan",
  },
];

const EMPTY_FORM = {
  name: "",
  role: "Front Desk" as Role, // Manager restricted to Front Desk
  email: "",
  phone: "",
  shift: "Morning",
  status: "Active" as StaffStatus,
  joinDate: "",
  gender: "Female",
  address: "",
  imageUrl: "",
  password: "",
  confirmPassword: "",
};

type FormState = typeof EMPTY_FORM;

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function staffToForm(s: Staff): FormState {
  return {
    name: s.name,
    role: s.role || "Front Desk",
    email: s.email,
    phone: s.phone,
    shift: s.shift,
    status: s.status,
    joinDate: s.joinDate || "",
    gender: s.gender || "Female",
    address: s.address || "",
    imageUrl: s.imageUrl || "",
    password: "",
    confirmPassword: "",
  };
}

function formatDateLabel(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Staff[]>(SEED_STAFF);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      let locId = locationId;
      if (!locId) {
        const outletsRes = await axios.get("/api/outlets").catch(() => null);
        if (outletsRes?.data?.success && outletsRes.data.data?.locations?.length > 0) {
          locId = outletsRes.data.data.locations[0].id;
          setLocationId(locId);
        } else {
          const servicesRes = await axios.get("/api/services").catch(() => null);
          if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
            locId = servicesRes.data.data.services[0].locationId;
            setLocationId(locId);
          }
        }
      }

      const params: Record<string, string> = {};
      if (locId) {
        params.locationId = locId;
      }
      const res = await axios.get("/api/staff", { params });

      if (res.data?.success && Array.isArray(res.data.data?.staff)) {
        const rawStaff = res.data.data.staff;
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

        const mapped: Staff[] = nonDoctorStaff.map((s: any, idx: number) => ({
          id: s.id,
          staffId: `STF-${1000 + idx + 1}`,
          name: s.name,
          role: s.role === "front_office" ? "Front Desk" : s.role || "Front Desk",
          email: s.email,
          phone: s.phone,
          shift: s.shift ? s.shift.charAt(0).toUpperCase() + s.shift.slice(1) : "Morning",
          status: s.isActive !== false ? "Active" : "Inactive",
          joinDate: s.createdAt ? s.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
          gender: s.gender || "Female",
          address: s.address || "",
          imageUrl: s.photoUrl || undefined,
        }));
        setStaff(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch staff:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All" | Role>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  function openAddModal() {
    setModalMode("add");
    setEditingId(null);
    setImageFile(null);
    setForm({ ...EMPTY_FORM, role: "Front Desk" }); // Fixed to Front Desk
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

    const cleanPhone = form.phone.trim().replace(/[\s-]/g, "");
    if (cleanPhone && !/^9\d{9}$/.test(cleanPhone)) {
      setSubmitError("Please enter a valid 10-digit phone number starting with 9 (e.g. 9812345678).");
      return;
    }

    if (modalMode === "add" && !editingId) {
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

    if (editingId) {
      try {
        const payload: Record<string, any> = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          shift: shiftEnumVal,
          gender: form.gender,
          address: form.address,
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
        let locId = locationId;
        if (!locId) {
          const outletsRes = await axios.get("/api/outlets").catch(() => null);
          if (outletsRes?.data?.success && outletsRes.data.data?.locations?.length > 0) {
            locId = outletsRes.data.data.locations[0].id;
          }
        }

        if (locId) {
          const payload: Record<string, any> = {
            locationId: locId,
            name: form.name,
            role: "front_office",
            email: form.email,
            phone: form.phone,
            password: form.password || "Password@123",
            shift: shiftEnumVal,
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
        console.error("Failed to add staff:", err);
        setSubmitError(err.response?.data?.error || "Failed to add staff.");
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
        s.phone.toLowerCase().includes(q) ||
        s.staffId.toLowerCase().includes(q);
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
    ];
  }, [staff]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">


      {/* Sticky Header */}
      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10 border-b border-slate-200/60">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
          Staffs
        </h1>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        {errorMsg && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={fetchStaff}
              className="flex items-center gap-1 font-semibold text-rose-600 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Filter Controls & Card Grid */}
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

          {/* Grid Layout (Matching Org Staffs Page) */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-900/15 bg-white py-16 text-center text-slate-400">
                Loading staff records...
              </div>
            ) : paginatedStaff.map((s, i) => {
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
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${ROLE_COLORS[s.role] || "bg-slate-100 text-slate-700"}`}
                    >
                      {s.role}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${STATUS_COLORS[s.status]}`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-[0.8rem] text-slate-500">
                    <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                    {s.shift} shift
                  </div>

                  <div className="mt-4 border-t border-slate-900/5 pt-4 text-[0.8rem] text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {s.phone || "—"}
                    </p>
                  </div>
                </div>
              );
            })}

            {!loading && filtered.length === 0 && (
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

      {/* Add / Edit Side Drawer */}
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
                    <Users className="h-3.5 w-3.5" />
                    Full name
                  </span>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Sujata Karki"
                    className={inputClass}
                  />
                </label>


                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between text-[0.8rem] font-medium text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" />
                      Role
                    </span>

                  </span>
                  <input
                    disabled
                    type="text"
                    value="Front Desk"
                    className={`${inputClass} bg-slate-100 text-slate-600 cursor-not-allowed font-medium`}
                  />

                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Mail className="h-3.5 w-3.5" />
                      Email address
                    </span>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="demo@gmail.com"
                      className={inputClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Phone className="h-3.5 w-3.5" />
                      Phone number
                    </span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="98XXXXXXXX"
                      maxLength={10}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Clock className="h-3.5 w-3.5" />
                      Shift
                    </span>
                    <select
                      value={form.shift}
                      onChange={(e) => update("shift", e.target.value)}
                      className={inputClass}
                    >
                      {SHIFTS.map((s) => (
                        <option key={s} value={s}>
                          {s} Shift
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <VenusAndMars className="h-3.5 w-3.5" />
                      Gender
                    </span>
                    <select
                      value={form.gender}
                      onChange={(e) => update("gender", e.target.value)}
                      className={inputClass}
                    >
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Status
                  </span>
                  <select
                    value={form.status}
                    onChange={(e) => update("status", e.target.value as StaffStatus)}
                    className={inputClass}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>

                {modalMode === "add" && (
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                        <Lock className="h-3.5 w-3.5" />
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
                        <Lock className="h-3.5 w-3.5" />
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

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    Address
                  </span>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}

                    className={inputClass}
                  />
                </label>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-full px-5 py-2.5 text-[0.9rem] font-medium text-slate-500 transition-colors hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingImage}
                    className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263] disabled:opacity-50"
                  >
                    {uploadingImage ? "Saving..." : modalMode === "edit" ? "Save Staff" : "Add Staff"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Staff Profile Side Drawer */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div onClick={() => setSelectedStaff(null)} className="absolute inset-0" aria-hidden />
          <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedStaff(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const target = selectedStaff;
                    setSelectedStaff(null);
                    openEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-[#3f6274] transition-colors hover:bg-[#7da3b3]/15"
                >
                  <SquarePen className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => {
                    const target = selectedStaff;
                    setSelectedStaff(null);
                    requestDelete(target);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-rose-500 transition-colors hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="flex items-center gap-4">
                {selectedStaff.imageUrl ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded-full ring-4 ring-slate-50">
                    <Image
                      src={selectedStaff.imageUrl}
                      alt={selectedStaff.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7da3b3]/25 text-xl font-bold text-[#345263]">
                    {getInitials(selectedStaff.name)}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedStaff.name}</h2>
                  <p className="text-xs text-slate-400 font-mono">{selectedStaff.staffId}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.72rem] font-medium ${ROLE_COLORS[selectedStaff.role] || "bg-slate-100 text-slate-700"}`}>
                      {selectedStaff.role}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.72rem] font-medium ${STATUS_COLORS[selectedStaff.status]}`}>
                      {selectedStaff.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-4 rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Contact Information
                </h3>
                <div className="space-y-3 text-[0.88rem]">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" /> Email
                    </span>
                    <span className="font-medium text-slate-800">{selectedStaff.email || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" /> Phone
                    </span>
                    <span className="font-medium text-slate-800">{selectedStaff.phone || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" /> Shift
                    </span>
                    <span className="font-medium text-slate-800">{selectedStaff.shift}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 flex items-center gap-2">
                      <VenusAndMars className="h-4 w-4 text-slate-400" /> Gender
                    </span>
                    <span className="font-medium text-slate-800">{selectedStaff.gender || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" /> Joined
                    </span>
                    <span className="font-medium text-slate-800">
                      {formatDateLabel(selectedStaff.joinDate)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedStaff.address && (
                <div className="mt-4 rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Address
                  </h3>
                  <p className="mt-2 text-[0.88rem] text-slate-700">{selectedStaff.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div onClick={() => setDeleteTarget(null)} className="absolute inset-0" aria-hidden />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <Trash2 className="h-5 w-5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 text-[1.05rem] font-semibold text-slate-900">
              Delete {deleteTarget.name}?
            </h3>
            <p className="mt-1.5 text-[0.85rem] leading-relaxed text-slate-500">
              This action will remove this staff record.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-rose-600"
              >
                Delete
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
