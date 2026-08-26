"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import axios from "axios";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Users,
  UserPlus,
  CalendarCheck,
  Mail,
  Phone,
  MapPin,
  Droplet,
  IdCard,
  Cake,
  VenusAndMars,
  Stethoscope,
  ClipboardList,
  AlertCircle,
  Pill,
  User,
  Loader2,
  Wallet,
  CheckCircle2,
} from "lucide-react";

const STATUSES = ["Active", "Inactive"] as const;

type Patient = {
  id: string;
  patientId: string;
  name: string;
  age: string;
  dob?: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address?: string;
  assignedDoctor: string;
  lastVisit: string;
  status: (typeof STATUSES)[number];
  imageUrl?: string;
  allergies?: string[];
  medicalHistory?: string[];
  medications?: string[];
  balanceDueCents: number | null;
};

function initialsOf(name: string) {
  return name
    .trim()
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function centsToDisplay(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
];

function apiPatientToPatient(p: any): Patient {
  return {
    id: p.id,
    patientId: p.patientId || `PAT-${String(p.id).slice(-4)}`,
    name: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient",
    age: p.age != null ? String(p.age) : "",
    dob: p.dob || undefined,
    gender: p.gender || "Other",
    bloodGroup: p.bloodGroup || "-",
    phone: p.phone || "-",
    email: p.email || "-",
    address: p.address || "",
    assignedDoctor: p.assignedDoctorName || "Unassigned",
    lastVisit: p.lastVisit || p.updatedAt || p.createdAt || "",
    status: p.treatmentCompleted ? "Inactive" : "Active",
    imageUrl: p.imageUrl || undefined,
    allergies: p.allergies || [],
    medicalHistory: p.medicalHistory || [],
    medications: p.medications || [],
    balanceDueCents: typeof p.balanceDueCents === "number" ? p.balanceDueCents : null,
  };
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [profileTab, setProfileTab] = useState<"detail" | "medical" | "appointments">(
    "detail"
  );

  const loadPatients = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const userRes = await axios.get("/api/user-details").catch(() => null);
      const locId = userRes?.data?.success ? userRes.data.data?.user?.locationId : undefined;

      const res = await axios.get("/api/patent", {
        params: locId ? { locationId: locId } : undefined,
      });
      if (res.data?.success && res.data.data?.patients) {
        const rawPatients = res.data.data.patients;
        const mapped: Patient[] = await Promise.all(
          rawPatients.map(async (p: any) => {
            const base = apiPatientToPatient(p);
            const ledgerRes = await axios.get(`/api/patent/${p.id}/ledger`).catch(() => null);
            const summary = ledgerRes?.data?.success ? ledgerRes.data.data.summary : null;
            const balanceDueCents = summary
              ? summary.balanceDueCents
              : (typeof p.balanceDueCents === "number" ? p.balanceDueCents : 0);
            return { ...base, balanceDueCents };
          })
        );
        setPatients(mapped);
      }
    } catch (err) {
      console.error("Failed to load patients:", err);
      setLoadError("Failed to load patients from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.patientId.toLowerCase().includes(q);
      const matchesDoctor = doctorFilter === "All" || p.assignedDoctor === doctorFilter;
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesQuery && matchesDoctor && matchesStatus;
    });
  }, [patients, query, doctorFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPatients = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const newThisMonth = useMemo(() => {
    const now = new Date();
    return patients.filter((p) => {
      const visit = new Date(p.lastVisit);
      return visit.getMonth() === now.getMonth() && visit.getFullYear() === now.getFullYear();
    }).length;
  }, [patients]);

  const stats = [
    { icon: Users, label: "Total Patients", value: String(patients.length) },
    { icon: UserPlus, label: "New This Month", value: String(newThisMonth) },
    { icon: CalendarCheck, label: "Active Patients", value: String(patients.filter((p) => p.status === "Active").length) },
  ];

  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);

  async function openProfile(p: Patient) {
    setSelectedPatient(p);
    setProfileTab("detail");
    setPatientAppointments([]);
    setLoadingAppts(true);

    try {
      const [historyRes, apptsRes] = await Promise.all([
        axios.get(`/api/patent/${p.id}`).catch(() => null),
        axios.get(`/api/appoments?patientId=${p.id}`).catch(() => null),
      ]);

      if (historyRes?.data?.success && historyRes.data.data?.patient) {
        const full = historyRes.data.data.patient;
        setSelectedPatient((prev) => {
          if (!prev || prev.id !== p.id) return prev;
          return {
            ...prev,
            allergies: full.allergies || prev.allergies,
            medicalHistory: full.medicalHistory || prev.medicalHistory,
            medications: full.currentMedications || full.medications || prev.medications,
            address: full.address || prev.address,
            phone: full.phone || prev.phone,
            email: full.email || prev.email,
            dob: full.dob || prev.dob,
            age: full.age != null ? String(full.age) : prev.age,
            bloodGroup: full.bloodGroup || prev.bloodGroup,
            gender: full.gender || prev.gender,
          };
        });
      }

      if (apptsRes?.data?.success && Array.isArray(apptsRes.data.data?.appointments)) {
        setPatientAppointments(apptsRes.data.data.appointments);
      }
    } catch (err) {
      console.error("Failed to load patient extended details/appointments:", err);
    } finally {
      setLoadingAppts(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
            Patients
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-[0.85rem] font-medium text-slate-500">{stat.label}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                  <stat.icon className="h-4 w-4" strokeWidth={2} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search patients..."
                  className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white pl-9 pr-4 py-2.5 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-900/5 bg-slate-50/60">
                  <th className="px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Patient</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Age</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Gender</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Phone</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Email</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Blood Group</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Assigned Doctor</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Last Visit</th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">Payment</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
                        Loading patients...
                      </span>
                    </td>
                  </tr>
                )}

                {!loading && loadError && (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-rose-500">
                      {loadError}
                    </td>
                  </tr>
                )}

                {!loading &&
                  !loadError &&
                  paginatedPatients.map((p, i) => {
                    const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    return (
                      <tr
                        key={p.id}
                        onClick={() => openProfile(p)}
                        className="cursor-pointer border-b border-slate-900/5 transition-colors last:border-b-0 hover:bg-[#7da3b3]/[0.04]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                                <Image src={p.imageUrl} alt={p.name} fill unoptimized className="object-cover" />
                              </div>
                            ) : (
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold ${color}`}>
                                {initialsOf(p.name)}
                              </div>
                            )}
                            <div>
                              <p className="text-[0.9rem] font-medium text-slate-900">{p.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[0.85rem] text-slate-600">{p.age}yrs</td>
                        <td className="px-4 py-4 text-[0.85rem] text-slate-600">{p.gender}</td>
                        <td className="px-4 py-4 text-[0.85rem] text-slate-700">{p.phone}</td>
                        <td className="px-4 py-4 text-[0.85rem] text-slate-500">{p.email}</td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[0.75rem] font-medium text-rose-600">
                            <Droplet className="h-3 w-3" strokeWidth={2} />
                            {p.bloodGroup}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[0.85rem] text-slate-600">{p.assignedDoctor}</td>
                        <td className="px-4 py-4 text-[0.85rem] text-slate-600">
                          {p.lastVisit ? new Date(p.lastVisit).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                        </td>
                        <td className="px-4 py-4">
                          <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium", p.status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"].join(" ")}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs whitespace-nowrap">
                          {p.balanceDueCents === null ? (
                            <span className="text-slate-400 text-[0.72rem]">No data</span>
                          ) : p.balanceDueCents > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded border border-rose-200/60 text-[0.72rem]">
                              <Wallet className="h-3 w-3 text-rose-500 shrink-0" />
                              NPR {centsToDisplay(p.balanceDueCents)} due
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200/60 text-[0.72rem]">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                              Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {!loading && !loadError && filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-slate-500">
                      No patients match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!loading && !loadError && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs">
              <span className="text-[0.7rem] text-slate-500 font-medium">
                Showing <strong className="text-slate-800">{startIndex + 1}</strong> to <strong className="text-slate-800">{Math.min(startIndex + itemsPerPage, filtered.length)}</strong> of <strong className="text-slate-800">{filtered.length}</strong> patients
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button key={pageNum} onClick={() => handlePageChange(pageNum)} className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${currentPage === pageNum ? "bg-[#7da3b3] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>
                    {pageNum}
                  </button>
                ))}
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div onClick={() => setSelectedPatient(null)} className="absolute inset-0" aria-hidden />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedPatient(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="flex items-start gap-4">
                {selectedPatient.imageUrl ? (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-4 ring-white">
                    <Image src={selectedPatient.imageUrl} alt={selectedPatient.name} fill unoptimized className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[1.3rem] font-semibold text-[#3f6274] ring-4 ring-white">
                    {initialsOf(selectedPatient.name)}
                  </div>
                )}

                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedPatient.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.85rem] text-slate-500">

                    <span className="text-slate-300"></span>
                    <span>{selectedPatient.age} yrs, {selectedPatient.gender}</span>
                    <span className="text-slate-300">|</span>
                    <span
                      className={
                        selectedPatient.status === "Active" ? "text-emerald-600" : "text-slate-500"
                      }
                    >
                      {selectedPatient.status}
                    </span>
                    <span className="text-slate-300">|</span>
                    {selectedPatient.balanceDueCents === null ? (
                      <span className="text-slate-400">No billing data</span>
                    ) : selectedPatient.balanceDueCents > 0 ? (
                      <span className="inline-flex items-center gap-1 text-rose-600">
                        <Wallet className="h-3.5 w-3.5" strokeWidth={2} />
                        NPR {centsToDisplay(selectedPatient.balanceDueCents)} due
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                        Settled
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1 text-[0.85rem] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedPatient.address ?? "Address not provided"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedPatient.phone}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedPatient.email}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-6 border-b border-slate-900/10">
                {(
                  [
                    { key: "detail", label: "Detail Information" },
                    { key: "medical", label: "Medical History" },
                    { key: "appointments", label: "Appointment History" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setProfileTab(tab.key)}
                    className={`-mb-px border-b-2 px-1 pb-3 text-[0.85rem] font-medium transition-colors ${profileTab === tab.key
                      ? "border-[#3f6274] text-[#3f6274]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {profileTab === "detail" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                    Patient Information
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-y-4 text-[0.85rem]">
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <IdCard className="h-3.5 w-3.5" strokeWidth={2} />
                        Patient ID
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{selectedPatient.patientId}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Droplet className="h-3.5 w-3.5" strokeWidth={2} />
                        Blood Group
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{selectedPatient.bloodGroup}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <VenusAndMars className="h-3.5 w-3.5" strokeWidth={2} />
                        Gender
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{selectedPatient.gender}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Cake className="h-3.5 w-3.5" strokeWidth={2} />
                        Age
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{selectedPatient.age} Years Old</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Stethoscope className="h-3.5 w-3.5" strokeWidth={2} />
                        Assigned Doctor
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{selectedPatient.assignedDoctor}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <CalendarCheck className="h-3.5 w-3.5" strokeWidth={2} />
                        Last Visit
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {selectedPatient.lastVisit
                          ? new Date(selectedPatient.lastVisit).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {profileTab === "medical" && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                    <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                      <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
                      Allergies
                    </p>
                    {selectedPatient.allergies && selectedPatient.allergies.length > 0 ? (
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[0.85rem] text-slate-600">
                        {selectedPatient.allergies.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-[0.85rem] text-slate-500">No known allergies.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                    <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                      <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                      Medical History
                    </p>
                    {selectedPatient.medicalHistory && selectedPatient.medicalHistory.length > 0 ? (
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[0.85rem] text-slate-600">
                        {selectedPatient.medicalHistory.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-[0.85rem] text-slate-500">No conditions recorded.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                    <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                      <Pill className="h-3.5 w-3.5 text-black-600" strokeWidth={2} />
                      Current Medications & Prescriptions
                    </p>
                    {(() => {
                      const latestPrescriptionAppt = patientAppointments.find((a) => a.prescription || a.prescriptionText);
                      const medsList = selectedPatient.medications || [];
                      const hasMeds = medsList.length > 0;
                      const hasPres = !!latestPrescriptionAppt;

                      if (!hasMeds && !hasPres) {
                        return <p className="mt-3 text-[0.85rem] text-slate-500">No medications or prescriptions recorded.</p>;
                      }

                      return (

                        <div className=" mt-3 list-disc space-y-1.5 pl-5 ">

                          {hasPres && (
                            <div className="rounded-xl text-xs space-y-1">
                              <ul className="mt-3 list-disc space-y-1.5  text-[0.85rem] text-slate-600">
                                <li>{latestPrescriptionAppt.prescription || latestPrescriptionAppt.prescriptionText}</li>
                              </ul>
                            </div>
                          )}
                          {hasMeds && (
                            <ul className="list-disc list-inside space-y-1.5 text-[0.85rem] text-slate-600">
                              {medsList.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {profileTab === "appointments" && (
                <div className="mt-5 space-y-3">
                  {loadingAppts ? (
                    <div className="flex items-center justify-center p-8 text-xs text-slate-400 gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#3f6274]" />
                      <span>Loading appointment history...</span>
                    </div>
                  ) : patientAppointments.length > 0 ? (
                    patientAppointments.map((appt) => (
                      <div
                        key={appt.id}
                        className="rounded-2xl border border-slate-900/5 bg-white p-5 shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                            <Stethoscope className="h-3.5 w-3.5 text-[#3f6274]" />
                            {appt.treatmentName}
                          </span>
                          <span className="text-[0.75rem] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
                            {appt.startTime ? new Date(appt.startTime).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-slate-400" /> {appt.providerName || "Unassigned"}
                          </span>
                          <span className="rounded-full bg-sky-50 text-sky-700 px-2 py-0.5 text-[0.7rem] font-medium uppercase">
                            {appt.status}
                          </span>
                        </div>
                        {appt.noteText ? (
                          <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                            <span className="font-semibold text-slate-900 text-[0.7rem] uppercase tracking-wider block">Clinical Note:</span>
                            <p className="leading-relaxed">{appt.noteText}</p>
                          </div>
                        ) : (
                          <p className="text-[0.75rem] text-slate-400 italic pt-1">No clinical note attached.</p>
                        )}
                        {(appt.prescription || appt.prescriptionText) && (
                          <div className="mt-2 rounded-xl bg-sky-50/80 border border-sky-100 p-3 text-xs text-sky-900 space-y-1">
                            <span className="font-bold text-sky-900 text-[0.7rem] uppercase tracking-wider block flex items-center gap-1">
                              <Pill className="h-3.5 w-3.5 text-sky-600" /> Prescription / Instructions:
                            </span>
                            <p className="leading-relaxed font-medium">{appt.prescription || appt.prescriptionText}</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-900/15 bg-white p-10 text-center text-[0.85rem] text-slate-500 shadow-sm">
                      No appointment history recorded yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

}