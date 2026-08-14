"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import axios from "axios";
import {
  Search,
  Plus,
  Filter,
  SquarePen,
  Trash2,
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
  ImagePlus,
  User,
  Loader2,
  FileText,
  Wallet,
  CheckCircle2,
} from "lucide-react";

const STATUSES = ["Active", "Inactive"] as const;

const ASSIGNED_DOCTORS = [
  "Dr. Anisha Sharma",
  "Dr. Rajiv Thapa",
  "Dr. Priya Gurung",
  "Dr. Suresh Karki",
];

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
  locationId?: string;
  balanceDueCents: number | null; // null = no billing data available yet
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
const EMPTY_FORM = {
  imageUrl: "",
  name: "",
  age: "",
  dob: "",
  gender: "Female",
  bloodGroup: "A+",
  phone: "",
  email: "",
  address: "",
  assignedDoctor: ASSIGNED_DOCTORS[0],
  status: "Active" as (typeof STATUSES)[number],
  lastVisit: "",
  allergies: "",
  medicalHistory: "",
  medications: "",
};

type FormState = typeof EMPTY_FORM;

function patientToForm(p: Patient): FormState {
  return {
    imageUrl: p.imageUrl ?? "",
    name: p.name,
    age: p.age,
    dob: p.dob ?? "",
    gender: p.gender,
    bloodGroup: p.bloodGroup,
    phone: p.phone,
    email: p.email,
    address: p.address ?? "",
    assignedDoctor: p.assignedDoctor,
    status: p.status,
    lastVisit: p.lastVisit,
    allergies: (p.allergies ?? []).join("\n"),
    medicalHistory: (p.medicalHistory ?? []).join("\n"),
    medications: (p.medications ?? []).join("\n"),
  };
}

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

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
    locationId: p.locationId || "",
    balanceDueCents: typeof p.balanceDueCents === "number" ? p.balanceDueCents : 0,
  };
}

const cellInputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3] focus:bg-white";

const cellTextareaClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3] focus:bg-white";

type FieldDef =
  | { key: keyof FormState; label: string; icon: typeof User; type: "text" | "email" | "tel" | "date" | "number"; placeholder?: string; required?: boolean }
  | { key: keyof FormState; label: string; icon: typeof User; type: "select"; options: readonly string[] }
  | { key: keyof FormState; label: string; icon: typeof User; type: "textarea"; placeholder?: string };

const FORM_SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Personal Information",
    fields: [
      { key: "name", label: "Full name", icon: User, type: "text", placeholder: "Sita Rai", required: true },
      { key: "gender", label: "Gender", icon: VenusAndMars, type: "select", options: ["Female", "Male", "Other"] },
      { key: "dob", label: "Date of birth", icon: Cake, type: "date" },
      { key: "age", label: "Age", icon: Cake, type: "number", placeholder: "28" },
      { key: "bloodGroup", label: "Blood group", icon: Droplet, type: "select", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
    ],
  },
  {
    title: "Contact Information",
    fields: [
      { key: "email", label: "Email", icon: Mail, type: "email", placeholder: "patient@email.com" },
      { key: "phone", label: "Phone", icon: Phone, type: "tel", placeholder: "98XXXXXXXX", required: true },
      { key: "address", label: "Address", icon: MapPin, type: "text", placeholder: "Bharatpur-10, Chitwan, Nepal" },
    ],
  },
  {
    title: "Care Information",
    fields: [
      { key: "assignedDoctor", label: "Assigned doctor", icon: Stethoscope, type: "select", options: ASSIGNED_DOCTORS },
      { key: "status", label: "Status", icon: UserPlus, type: "select", options: STATUSES },
      { key: "lastVisit", label: "Last visit", icon: CalendarCheck, type: "date" },
    ],
  },
  {
    title: "Medical Information",
    fields: [
      { key: "allergies", label: "Known allergies (one per line)", icon: AlertCircle, type: "textarea", placeholder: "Penicillin" },
      { key: "medicalHistory", label: "Medical history (one per line)", icon: ClipboardList, type: "textarea", placeholder: "Type 2 diabetes" },
      { key: "medications", label: "Current medications (one per line)", icon: Pill, type: "textarea", placeholder: "Metformin 500mg" },
    ],
  },
];

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [profileTab, setProfileTab] = useState<"detail" | "medical" | "appointments">(
    "detail"
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [outletsList, setOutletsList] = useState<{ id: string; name: string }[]>([]);
  const [outletFilter, setOutletFilter] = useState("");

  const loadPatients = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [res, outletsRes] = await Promise.all([
        axios.get("/api/patent"),
        axios.get("/api/outlets").catch(() => null),
      ]);
      if (res.data?.success && res.data.data?.patients) {
        const seenPatients = new Set<string>();
        const rawUnique: any[] = [];
        res.data.data.patients.forEach((raw: any) => {
          if (raw.id && !seenPatients.has(raw.id)) {
            seenPatients.add(raw.id);
            rawUnique.push(raw);
          }
        });

        const mapped: Patient[] = await Promise.all(
          rawUnique.map(async (raw: any) => {
            let locId = raw.locationId || "";
            if (!locId) {
              const detailRes = await axios.get(`/api/patent/${raw.id}`).catch(() => null);
              if (detailRes?.data?.success && detailRes.data.data?.patient?.locationId) {
                locId = detailRes.data.data.patient.locationId;
              }
            }
            const base = apiPatientToPatient({ ...raw, locationId: locId });
            const ledgerRes = await axios.get(`/api/patent/${raw.id}/ledger`).catch(() => null);
            const summary = ledgerRes?.data?.success ? ledgerRes.data.data.summary : null;
            const balanceDueCents = summary
              ? summary.balanceDueCents
              : (typeof raw.balanceDueCents === "number" ? raw.balanceDueCents : 0);
            return { ...base, balanceDueCents };
          })
        );
        setPatients(mapped);
      }
      if (outletsRes?.data?.success && outletsRes.data.data?.locations) {
        const seenOutlets = new Set<string>();
        const mappedOutlets: { id: string; name: string }[] = [];
        outletsRes.data.data.locations.forEach((l: any) => {
          if (l.id && !seenOutlets.has(l.id)) {
            seenOutlets.add(l.id);
            mappedOutlets.push({ id: l.id, name: l.name });
          }
        });
        setOutletsList(mappedOutlets);
        if (mappedOutlets.length > 0) {
          setOutletFilter((prev) => (prev === "all" || !prev ? mappedOutlets[0].id : prev));
        }
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

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "dob" && value) {
        const birthDate = new Date(value);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age >= 0) {
            next.age = String(age);
          }
        }
      } else if (key === "age" && value && !prev.dob) {
        const ageNum = parseInt(value, 10);
        if (!isNaN(ageNum) && ageNum >= 0) {
          const birthYear = new Date().getFullYear() - ageNum;
          next.dob = `${birthYear}-01-01`;
        }
      }
      return next;
    });
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    update("imageUrl", URL.createObjectURL(file));
  }

  function openAddModal() {
    setModalMode("add");
    setEditingId(null);
    setForm({ ...EMPTY_FORM, lastVisit: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  }

  function openEditModal(p: Patient) {
    setModalMode("edit");
    setEditingId(p.id);
    setForm(patientToForm(p));
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { allergies, medicalHistory, medications } = form;
    const allergiesList = linesToArray(allergies);
    const medicalHistoryList = linesToArray(medicalHistory);
    const medicationsList = linesToArray(medications);

    const trimmedName = form.name.trim();
    const [firstName, ...rest] = trimmedName.split(" ");
    const lastName = rest.join(" ") || "-";

    try {
      if (modalMode === "edit" && editingId) {
        const payload: Record<string, any> = {
          firstName,
          lastName,
          age: Number(form.age) || 0,
          dob: form.dob || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          gender: form.gender || undefined,
          bloodGroup: form.bloodGroup || undefined,
          treatmentCompleted: form.status === "Inactive",
          allergies: allergiesList,
          medicalHistory: medicalHistoryList,
          medications: medicationsList,
        };

        const res = await axios.patch(`/api/patent/${editingId}`, payload);
        if (res.data?.success === false) {
          alert(res.data?.error || "Failed to update patient.");
          return;
        }
      } else {
        let locId = outletFilter !== "all" ? outletFilter : (outletsList[0]?.id || "");
        if (!locId) {
          const servicesRes = await axios.get("/api/services").catch(() => null);
          if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
            locId = servicesRes.data.data.services[0].locationId;
          }
        }

        const payload: Record<string, any> = {
          locationId: locId,
          firstName,
          lastName,
          age: Number(form.age) || 0,
          dob: form.dob || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          gender: form.gender || undefined,
          bloodGroup: form.bloodGroup || undefined,
          allergies: allergiesList,
          medicalHistory: medicalHistoryList,
          currentMedications: medicationsList,
        };

        const res = await axios.post("/api/patent", payload);
        if (res.data?.success === false) {
          alert(res.data?.error || "Failed to create patient.");
          return;
        }
      }

      await loadPatients();
      setForm(EMPTY_FORM);
      setEditingId(null);
      setModalOpen(false);

    } catch (err: any) {
      console.error("Failed to save patient:", err);

      alert(err.response?.data?.error || "Failed to save patient.");
    }
  }

  async function handleDeletePatient(id: string, e: React.MouseEvent) {
    e.stopPropagation();

    const confirmed = window.confirm("Delete this patient? This action cannot be undone.");
    if (!confirmed) return;

    const previous = patients;
    setDeletingId(id);
    // Optimistically remove from the list
    setPatients((prev) => prev.filter((p) => p.id !== id));

    try {
      const res = await axios.delete(`/api/patent/${id}`);
      if (!res.data?.success) {
        throw new Error(res.data?.error || "Delete failed");
      }
      if (selectedPatient?.id === id) setSelectedPatient(null);
    } catch (err) {
      console.error("Failed to delete patient:", err);
      // Roll back on failure
      setPatients(previous);
      window.alert("Failed to delete patient. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

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
      const matchesOutlet = outletFilter === "all" || p.locationId === outletFilter;
      return matchesQuery && matchesDoctor && matchesStatus && matchesOutlet;
    });
  }, [patients, query, doctorFilter, statusFilter, outletFilter]);


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
        axios.get(`/api/patent/${p.id}/medical-History`).catch(() => axios.get(`/api/patent/${p.id}/medical-history`).catch(() => null)),
        axios.get(`/api/patent/${p.id}/appoments`).catch(() => null),
      ]);

      let updated = { ...p };
      let apptsList: any[] = [];

      if (apptsRes?.data?.success && apptsRes.data.data.appointments) {
        apptsList = apptsRes.data.data.appointments;
        setPatientAppointments(apptsList);
      }

      if (historyRes?.data?.success && historyRes.data.data.medicalHistory) {
        const mh = historyRes.data.data.medicalHistory;
        updated.allergies = mh.allergies || [];
        updated.medicalHistory = mh.medicalHistory || [];
        updated.medications = mh.currentMedications || [];
      }

      setSelectedPatient(updated);
    } catch (err) {
      console.error("Error loading patient details for admin drawer:", err);
    } finally {
      setLoadingAppts(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
            Patients
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





      <div className="mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">

        <div className=" mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
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
                  value={outletFilter}
                  onChange={(e) => {
                    setOutletFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white pl-9 pr-8 py-2.5 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                >
                  {outletsList.map((o, idx) => (
                    <option key={`${o.id}-${idx}`} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
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

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-full bg-[#749fb1] px-5 py-2.5 text-[0.9rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263]"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add Patient
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-900/5 bg-slate-50/60">
                  <th className="px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Age
                  </th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Gender
                  </th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Blood Group
                  </th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Assigned Doctor
                  </th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Last Visit
                  </th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={11} className="px-6 py-16 text-center text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#7da3b3]" />
                        Loading patients...
                      </span>
                    </td>
                  </tr>
                )}

                {!loading && loadError && (
                  <tr>
                    <td colSpan={11} className="px-6 py-16 text-center text-rose-500">
                      {loadError}
                    </td>
                  </tr>
                )}

                {!loading &&
                  !loadError &&
                  paginatedPatients.map((p, i) => {
                    const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    const isDeleting = deletingId === p.id;
                    return (
                      <tr
                        key={`${p.id}-${i}`}
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
                          {p.lastVisit
                            ? new Date(p.lastVisit).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                            : "-"}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={[
                              "inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium",
                              p.status === "Active"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-slate-100 text-slate-500",
                            ].join(" ")}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs whitespace-nowrap">
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
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(p);
                              }}
                              aria-label="Edit patient"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-[#3f6274]"
                            >
                              <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                            <button
                              onClick={(e) => handleDeletePatient(p.id, e)}
                              disabled={isDeleting}
                              aria-label="Delete patient"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && !loadError && filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-16 text-center text-slate-500">
                      No patients match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {!loading && !loadError && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs">
              <span className="text-[0.7rem] text-slate-500 font-medium">
                Showing{" "}
                <strong className="text-slate-800">{startIndex + 1}</strong>{" "}
                to{" "}
                <strong className="text-slate-800">
                  {Math.min(startIndex + itemsPerPage, filtered.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filtered.length}</strong> patients
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


      {modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div onClick={() => setModalOpen(false)} className="absolute inset-0" aria-hidden />
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
                {modalMode === "edit" ? "Edit Patient" : "Add Patient"}
              </h2>
            </div>

            <div className="px-6 py-6">
              <form onSubmit={handleSubmit} className="space-y-8">


                {FORM_SECTIONS.map((section) => (
                  <div
                    key={section.title}
                    className="overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-sm"
                  >
                    <p className="border-b border-slate-900/5 px-5 py-3 text-[0.88rem] font-semibold text-slate-900">
                      <span className="border-l-2 border-[#3f6274] pl-2">{section.title}</span>
                    </p>
                    <table className="w-full border-collapse">
                      <tbody>
                        {section.fields.map((field, i) => {
                          const Icon = field.icon;
                          return (
                            <tr
                              key={field.key}
                              className={i !== section.fields.length - 1 ? "border-b border-slate-900/5" : ""}
                            >
                              <td className="w-40 shrink-0 bg-slate-50/60 px-4 py-2.5 align-top sm:w-48">
                                <span className="flex items-center gap-1.5 text-[0.78rem] font-medium text-slate-600">
                                  <Icon className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                                  {field.label}
                                  {"required" in field && field.required && (
                                    <span className="text-rose-400">*</span>
                                  )}
                                </span>
                              </td>
                              <td className="px-3 py-1">
                                {field.type === "select" ? (
                                  <select
                                    value={form[field.key]}
                                    onChange={(e) => update(field.key, e.target.value)}
                                    className={cellInputClass}
                                  >
                                    {field.options.map((opt) => (
                                      <option key={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : field.type === "textarea" ? (
                                  <textarea
                                    rows={2}
                                    value={form[field.key]}
                                    onChange={(e) => update(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    className={cellTextareaClass}
                                  />
                                ) : (
                                  <input
                                    type={field.type}
                                    required={"required" in field ? field.required : false}
                                    value={form[field.key]}
                                    onChange={(e) => update(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    className={cellInputClass}
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263]"
                  >
                    {modalMode === "edit" ? "Save Changes" : "Add Patient"}
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

      {/* Patient detail side panel */}
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