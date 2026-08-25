"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  X,
  Stethoscope,
  Loader2,
  AlertCircle,
  Check,
  Pencil,
  Trash2,
  Droplet,
  Wallet,
} from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-1 focus:ring-sky-400";

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ITEMS_PER_PAGE = 8;

interface TreatmentRecord {
  id: string;
  date: string;
  time: string;
  treatment: string;
  doctor: string;
  notes: string;
  prescription?: string;
}

interface Patient {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  age?: string;
  dob: string;
  phone: string;
  email: string;
  gender: string;
  bloodGroup: string;
  treatmentStatus: string;
  assignedDoctor: string;
  allergies?: string[];
  medicalHistory?: string[];
  medications?: string[];
  history: TreatmentRecord[];
  balanceDueCents: number | null; // null = no billing data available yet
}

function calculateAge(dobString: string): number {
  if (!dobString) return 0;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function centsToDisplay(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const emptyPatientForm = {
  firstName: "",
  lastName: "",
  age: "",
  dob: "",
  phone: "",
  email: "",
  gender: GENDER_OPTIONS[0],
  bloodGroup: BLOOD_GROUP_OPTIONS[0],
};

export default function PatientsTab() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddPatient, setShowAddPatient] = useState(false);

  const [newPatient, setNewPatient] = useState({ ...emptyPatientForm });

  // Edit state
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editPatient, setEditPatient] = useState({ ...emptyPatientForm });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [historySearch, setHistorySearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Resolve Location ID
      let currentLocId = locationId;
      if (!currentLocId) {
        const [servicesRes, treatmentsRes, patientsRes] = await Promise.all([
          axios.get("/api/services").catch(() => null),
          axios.get("/api/treatment").catch(() => null),
          axios.get("/api/patent").catch(() => null),
        ]);

        if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
          currentLocId = servicesRes.data.data.services[0].locationId;
        } else if (treatmentsRes?.data?.success && treatmentsRes.data.data.treatments?.length > 0) {
          currentLocId = treatmentsRes.data.data.treatments[0].locationId;
        } else if (patientsRes?.data?.success && patientsRes.data.data.patients?.length > 0) {
          currentLocId = patientsRes.data.data.patients[0].locationId;
        }

        if (currentLocId) setLocationId(currentLocId);
      }

      // Fetch Patients
      const res = await axios.get("/api/patent");
      if (res.data?.success && res.data.data.patients) {
        const rawPatients = res.data.data.patients;
        const mappedPromises = rawPatients.map(async (p: any) => {
          const ledgerRes = await axios.get(`/api/patent/${p.id}/ledger`).catch(() => null);
          const summary = ledgerRes?.data?.success ? ledgerRes.data.data.summary : null;
          const balanceDueCents = summary
            ? summary.balanceDueCents
            : (typeof p.balanceDueCents === "number" ? p.balanceDueCents : 0);

          return {
            id: p.id,
            name: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient",
            firstName: p.firstName || "",
            lastName: p.lastName || "",
            age: p.age != null ? String(p.age) : "",
            dob: p.dob || "",
            phone: p.phone || "-",
            email: p.email || "-",
            gender: p.gender || "Male",
            bloodGroup: p.bloodGroup || "-",
            treatmentStatus: p.treatmentCompleted ? "Completed" : "In Treatment",
            assignedDoctor: p.assignedDoctorName || "Unassigned",
            history: [],
            balanceDueCents,
          };
        });
        const mapped: Patient[] = await Promise.all(mappedPromises);
        setPatients(mapped);
      }
    } catch (err: any) {
      console.error("Failed to load patients:", err);
      setErrorMsg("Failed to load patients from database.");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAgeChange = (val: string) => {
    const ageNum = parseInt(val, 10);
    if (!isNaN(ageNum) && ageNum >= 0) {
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - ageNum;
      setNewPatient((prev) => ({
        ...prev,
        age: val,
        dob: `${birthYear}-01-01`,
      }));
    } else {
      setNewPatient((prev) => ({ ...prev, age: val }));
    }
  };

  const handleDobChange = (val: string) => {
    const calculated = calculateAge(val);
    setNewPatient((prev) => ({
      ...prev,
      dob: val,
      age: calculated > 0 ? calculated.toString() : "",
    }));
  };

  const handleEditAgeChange = (val: string) => {
    const ageNum = parseInt(val, 10);
    if (!isNaN(ageNum) && ageNum >= 0) {
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - ageNum;
      setEditPatient((prev) => ({
        ...prev,
        age: val,
        dob: `${birthYear}-01-01`,
      }));
    } else {
      setEditPatient((prev) => ({ ...prev, age: val }));
    }
  };

  const handleEditDobChange = (val: string) => {
    const calculated = calculateAge(val);
    setEditPatient((prev) => ({
      ...prev,
      dob: val,
      age: calculated > 0 ? calculated.toString() : "",
    }));
  };

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    let activeLocId = locationId;
    if (!activeLocId) {
      const servicesRes = await axios.get("/api/services").catch(() => null);
      if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
        activeLocId = servicesRes.data.data.services[0].locationId;
        setLocationId(activeLocId);
      }
    }

    if (!activeLocId) {
      setErrorMsg("Location ID could not be identified.");
      return;
    }

    if (!newPatient.firstName || !newPatient.lastName) {
      setErrorMsg("Please enter patient first and last name.");
      return;
    }

    const cleanPhone = newPatient.phone.trim().replace(/[\s-]/g, "");
    if (cleanPhone && !/^9\d{9}$/.test(cleanPhone)) {
      setErrorMsg("Please enter a valid 10-digit phone number starting with 9 .");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        locationId: activeLocId,
        firstName: newPatient.firstName.trim(),
        lastName: newPatient.lastName.trim(),
        age: newPatient.age ? Number(newPatient.age) : undefined,
        dob: newPatient.dob || undefined,
        phone: newPatient.phone || undefined,
        email: newPatient.email || undefined,
        gender: newPatient.gender || undefined,
        bloodGroup: newPatient.bloodGroup || undefined,
      };

      const res = await axios.post("/api/patent", payload);
      if (res.data?.success) {
        setSuccessMsg("Patient created successfully!");
        setShowAddPatient(false);
        setNewPatient({ ...emptyPatientForm });
        await loadData();
      } else {
        setErrorMsg(res.data?.error || "Failed to create patient.");
      }
    } catch (err: any) {
      console.error("Error creating patient:", err);
      setErrorMsg(err.response?.data?.error || "Failed to create patient.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditPatient(patient: Patient, e: React.MouseEvent) {
    e.stopPropagation();
    setShowAddPatient(false);
    setDeleteConfirmId(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setEditingPatientId(patient.id);
    const calculatedAge = patient.dob ? calculateAge(patient.dob) : 0;
    setEditPatient({
      firstName: patient.firstName,
      lastName: patient.lastName,
      age: calculatedAge > 0 ? calculatedAge.toString() : (patient.age ? String(patient.age) : ""),
      dob: patient.dob,
      phone: patient.phone === "-" ? "" : patient.phone,
      email: patient.email === "-" ? "" : patient.email,
      gender: GENDER_OPTIONS.includes(patient.gender) ? patient.gender : GENDER_OPTIONS[0],
      bloodGroup: BLOOD_GROUP_OPTIONS.includes(patient.bloodGroup) ? patient.bloodGroup : BLOOD_GROUP_OPTIONS[0],
    });
  }

  function closeEditPatient() {
    setEditingPatientId(null);
    setEditPatient({ ...emptyPatientForm });
  }

  async function handleEditPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPatientId) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    if (!editPatient.firstName || !editPatient.lastName) {
      setErrorMsg("Please enter patient first and last name.");
      return;
    }

    const cleanPhone = editPatient.phone.trim().replace(/[\s-]/g, "");
    if (cleanPhone && !/^9\d{9}$/.test(cleanPhone)) {
      setErrorMsg("Please enter a valid 10-digit phone number starting with 9 ).");
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = {
        firstName: editPatient.firstName.trim(),
        lastName: editPatient.lastName.trim(),
        age: editPatient.age ? Number(editPatient.age) : 0,
        dob: editPatient.dob || undefined,
        phone: editPatient.phone || undefined,
        email: editPatient.email || undefined,
        gender: editPatient.gender || undefined,
        bloodGroup: editPatient.bloodGroup || undefined,
      };

      const res = await axios.patch(`/api/patent/${editingPatientId}`, payload);
      if (res.data?.success !== false) {
        setSuccessMsg("Patient updated successfully!");
        closeEditPatient();
        await loadData();
      } else {
        setErrorMsg(res.data?.error || "Failed to update patient.");
      }
    } catch (err: any) {
      console.error("Error updating patient:", err);
      setErrorMsg(err.response?.data?.error || "Failed to update patient.");
    } finally {
      setEditSubmitting(false);
    }
  }

  function requestDeletePatient(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setErrorMsg(null);
    setSuccessMsg(null);
    setDeleteConfirmId((current) => (current === id ? null : id));
  }

  async function confirmDeletePatient(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const res = await axios.delete(`/api/patent/${id}`);
      if (res.data?.success !== false) {
        setSuccessMsg("Patient deleted successfully.");
        if (expandedPatientId === id) setExpandedPatientId(null);
        if (editingPatientId === id) closeEditPatient();
        await loadData();
      } else {
        setErrorMsg(res.data?.error || "Failed to delete patient.");
      }
    } catch (err: any) {
      console.error("Error deleting patient:", err);
      setErrorMsg(err.response?.data?.error || "Failed to delete patient.");
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  }

  function cancelDeletePatient(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteConfirmId(null);
  }

  async function toggleTreatmentStatus(id: string, currentStatus: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const isCompleted = currentStatus === "In Treatment";
      await axios
        .patch(`/api/patent/${id}`, {
          treatmentCompleted: isCompleted,
          age: 0,
        })
        .catch(() => null);

      await loadData();
    } catch (err: any) {
      console.error("Failed to update status:", err);
    }
  }

  const toggleExpand = async (id: string) => {
    if (expandedPatientId !== id) {
      setHistorySearch("");
      setFilterDate("");
      setExpandedPatientId(id);

      try {
        const [res, historyRes] = await Promise.all([
          axios.get(`/api/patent/${id}/appoments`).catch(() => null),
          axios.get(`/api/patent/${id}/medical-History`).catch(() => axios.get(`/api/patent/${id}/medical-history`).catch(() => null)),
        ]);

        let historyRecords: TreatmentRecord[] = [];
        if (res?.data?.success && res.data.data.appointments) {
          historyRecords = res.data.data.appointments.map((a: any) => {
            const startTimeDate = a.startTime ? new Date(a.startTime) : null;
            const dateStr = startTimeDate ? startTimeDate.toISOString().split("T")[0] : "N/A";
            const timeStr = startTimeDate ? startTimeDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A";

            return {
              id: a.id,
              date: dateStr,
              time: timeStr,
              treatment: a.treatmentName || "General Treatment",
              doctor: a.providerName || "Unassigned",
              notes: a.noteText || `Status: ${a.status || "Completed"}`,
              prescription: a.prescription || a.prescriptionText || undefined,
            };
          });
        }

        let allergies: string[] = [];
        let medicalHistory: string[] = [];
        let medications: string[] = [];
        if (historyRes?.data?.success && historyRes.data.data.medicalHistory) {
          const mh = historyRes.data.data.medicalHistory;
          allergies = mh.allergies || [];
          medicalHistory = mh.medicalHistory || [];
          medications = mh.currentMedications || [];
        }

        const latestApptPrescription = historyRecords.find((r) => r.prescription);
        if (latestApptPrescription && latestApptPrescription.prescription) {
          const presText = `Latest Prescription (${latestApptPrescription.treatment} - ${latestApptPrescription.date}): ${latestApptPrescription.prescription}`;
          if (!medications.includes(presText)) {
            medications = [presText, ...medications];
          }
        }

        setPatients((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  history: historyRecords,
                  allergies,
                  medicalHistory,
                  medications,
                }
              : p
          )
        );
      } catch (err) {
        console.error("Failed to load patient appointment history:", err);
      }
    } else {
      setExpandedPatientId(null);
    }
  };

  const clearHistoryFilters = () => {
    setHistorySearch("");
    setFilterDate("");
  };

  // Filter Logic
  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.bloodGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPatients = filteredPatients.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* Notifications */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-700">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 w-full">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient name, phone, email..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>

        <button
          onClick={() => {
            closeEditPatient();
            setShowAddPatient(!showAddPatient);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className="flex items-center gap-1.5 rounded-full bg-[#7da3b3] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] transition-colors"
        >
          <UserPlus className="h-4 w-4" /> Add New Patient
        </button>
      </div>

      {/* Add Patient Form */}
      {showAddPatient && (
        <form
          onSubmit={handleAddPatient}
          className="grid gap-4 rounded-2xl border border-slate-900/5 bg-white/90 p-6 shadow-md backdrop-blur-sm sm:grid-cols-6"
        >
          <div className="sm:col-span-6 flex items-center justify-between border-b border-slate-100 pb-3 mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7da3b3] flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Register New Patient
            </h3>
            <button
              type="button"
              onClick={() => setShowAddPatient(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">First Name *</span>
            <input
              required
              type="text"
              placeholder="First Name"
              value={newPatient.firstName}
              className={inputClass}
              onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Last Name *</span>
            <input
              required
              type="text"
              placeholder="Last Name"
              value={newPatient.lastName}
              className={inputClass}
              onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })}
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Age</span>
            <input
              type="number"
              min="0"
              placeholder="Age"
              value={newPatient.age}
              className={inputClass}
              onChange={(e) => handleAgeChange(e.target.value)}
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Gender</span>
            <select
              value={newPatient.gender}
              className={inputClass}
              onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
            >
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Blood Group</span>
            <select
              value={newPatient.bloodGroup}
              className={inputClass}
              onChange={(e) => setNewPatient({ ...newPatient, bloodGroup: e.target.value })}
            >
              {BLOOD_GROUP_OPTIONS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Date of Birth</span>
            <input
              type="date"
              value={newPatient.dob}
              className={inputClass}
              onChange={(e) => handleDobChange(e.target.value)}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Phone Number</span>
            <input
              type="tel"
              placeholder=""
              maxLength={10}
              value={newPatient.phone}
              className={inputClass}
              onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Email Address</span>
            <input
              type="email"
              placeholder="Email Address"
              value={newPatient.email}
              className={inputClass}
              onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
            />
          </label>

          <div className="sm:col-span-6 flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={() => setShowAddPatient(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-[#7da3b3] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Patient
            </button>
          </div>
        </form>
      )}

      {/* Edit Patient Form */}
      {editingPatientId && (
        <form
          onSubmit={handleEditPatient}
          className="grid gap-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-6 shadow-md backdrop-blur-sm sm:grid-cols-6"
        >
          <div className="sm:col-span-6 flex items-center justify-between border-b border-sky-100 pb-3 mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit Patient
            </h3>
            <button
              type="button"
              onClick={closeEditPatient}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">First Name *</span>
            <input
              required
              type="text"
              placeholder="First Name"
              value={editPatient.firstName}
              className={inputClass}
              onChange={(e) => setEditPatient({ ...editPatient, firstName: e.target.value })}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Last Name *</span>
            <input
              required
              type="text"
              placeholder="Last Name"
              value={editPatient.lastName}
              className={inputClass}
              onChange={(e) => setEditPatient({ ...editPatient, lastName: e.target.value })}
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Age</span>
            <input
              type="number"
              min="0"
              placeholder="Age"
              value={editPatient.age}
              className={inputClass}
              onChange={(e) => handleEditAgeChange(e.target.value)}
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Gender</span>
            <select
              value={editPatient.gender}
              className={inputClass}
              onChange={(e) => setEditPatient({ ...editPatient, gender: e.target.value })}
            >
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Blood Group</span>
            <select
              value={editPatient.bloodGroup}
              className={inputClass}
              onChange={(e) => setEditPatient({ ...editPatient, bloodGroup: e.target.value })}
            >
              {BLOOD_GROUP_OPTIONS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Date of Birth</span>
            <input
              type="date"
              value={editPatient.dob}
              className={inputClass}
              onChange={(e) => handleEditDobChange(e.target.value)}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Phone Number</span>
            <input
              type="tel"
              placeholder="Phone Number"
              maxLength={10}
              value={editPatient.phone}
              className={inputClass}
              onChange={(e) => setEditPatient({ ...editPatient, phone: e.target.value })}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Email Address</span>
            <input
              type="email"
              placeholder="Email Address"
              value={editPatient.email}
              className={inputClass}
              onChange={(e) => setEditPatient({ ...editPatient, email: e.target.value })}
            />
          </label>

          <div className="sm:col-span-6 flex justify-end gap-2 pt-3 border-t border-sky-100 mt-2">
            <button
              type="button"
              onClick={closeEditPatient}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-[#7da3b3] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] transition-colors disabled:opacity-50"
            >
              {editSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* TABLE (grid-based, matches working layout) */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-900/5 bg-white/90 shadow-lg backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
            <span>Loading patients list...</span>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1380px] w-full">
              {/* Header Row */}
              <div className="grid grid-cols-[2fr_1.2fr_1.5fr_0.8fr_0.7fr_1fr_1.1fr_1.3fr_1.1fr_1.1fr_1fr] border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
                <div className="p-4 pl-6">Patient Name</div>
                <div className="p-4">Phone</div>
                <div className="p-4">Email</div>
                <div className="p-4">Gender</div>
                <div className="p-4">Age</div>
                <div className="p-4">Blood Group</div>
                <div className="p-4">DOB</div>
                <div className="p-4">Assigned Doctor</div>
                <div className="p-4">Status</div>
                <div className="p-4">Payment</div>
                <div className="p-4 pr-6 text-center">Action</div>
              </div>

              {/* Data Rows */}
              <div className="divide-y divide-slate-100 text-sm">
                {paginatedPatients.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-medium">
                    No patients found matching your search.
                  </div>
                ) : (
                  paginatedPatients.map((patient) => {
                    const isExpanded = expandedPatientId === patient.id;
                    const age = calculateAge(patient.dob);
                    const isConfirmingDelete = deleteConfirmId === patient.id;
                    const isDeleting = deletingId === patient.id;

                    return (
                      <div key={patient.id} className="transition-colors">
                        <div
                          onClick={() => toggleExpand(patient.id)}
                          className={`grid grid-cols-[2fr_1.2fr_1.5fr_0.8fr_0.7fr_1fr_1.1fr_1.3fr_1.1fr_1.1fr_1fr] items-center text-sm cursor-pointer hover:bg-slate-50/50 transition-colors ${isExpanded ? "bg-sky-50/30" : ""
                            }`}
                        >
                          <div className="p-4 pl-6 flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-700 font-bold shrink-0">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 truncate block">
                                {patient.name}
                              </span>
                            </div>
                          </div>

                          <div className="p-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              {patient.phone}
                            </span>
                          </div>

                          <div className="p-4 text-xs text-slate-600 min-w-0 max-w-[180px] truncate">
                            <span className="flex items-center gap-1.5 truncate" title={patient.email}>
                              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{patient.email}</span>
                            </span>
                          </div>

                          <div className="p-4 text-xs font-medium text-slate-700">{patient.gender}</div>

                          <div className="p-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                            {patient.age || (age > 0 ? `${age} yrs` : "-")}
                          </div>

                          <div className="p-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded border border-rose-200/60 text-[0.72rem]">
                              <Droplet className="h-3 w-3 text-rose-500 shrink-0" />
                              {patient.bloodGroup || "-"}
                            </span>
                          </div>

                          <div className="p-4 text-xs text-slate-700 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              {patient.dob || "N/A"}
                            </span>
                          </div>

                          <div className="p-4 text-xs font-semibold text-slate-800">
                            <span className="flex items-center gap-1.5">
                              <Stethoscope className="h-3.5 w-3.5 text-[#7da3b3] shrink-0" />
                              {patient.assignedDoctor}
                            </span>
                          </div>

                          <div className="p-4">
                            <button
                              onClick={(e) => toggleTreatmentStatus(patient.id, patient.treatmentStatus, e)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider transition-all ${patient.treatmentStatus === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                                }`}
                            >
                              {patient.treatmentStatus === "Completed" ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  Completed
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3 text-amber-600" />
                                  In Treatment
                                </>
                              )}
                            </button>
                          </div>

                          <div className="p-4 text-xs whitespace-nowrap">
                            {patient.balanceDueCents === null ? (
                              <span className="text-slate-400 text-[0.72rem]">No data</span>
                            ) : patient.balanceDueCents > 0 ? (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded border border-rose-200/60 text-[0.72rem]">
                                <Wallet className="h-3 w-3 text-rose-500 shrink-0" />
                                NPR {centsToDisplay(patient.balanceDueCents)} due
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200/60 text-[0.72rem]">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                Settled
                              </span>
                            )}
                          </div>

                          <div className="p-4 pr-6 flex items-center justify-center gap-1.5 text-slate-400">
                            {isConfirmingDelete ? (
                              <div
                                className="flex items-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[0.65rem] font-semibold text-rose-600 whitespace-nowrap">
                                  Delete?
                                </span>
                                <button
                                  onClick={(e) => confirmDeletePatient(patient.id, e)}
                                  disabled={isDeleting}
                                  title="Confirm delete"
                                  className="flex items-center justify-center h-6 w-6 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={cancelDeletePatient}
                                  disabled={isDeleting}
                                  title="Cancel"
                                  className="flex items-center justify-center h-6 w-6 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => openEditPatient(patient, e)}
                                  title="Edit patient"
                                  className="flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => requestDeletePatient(patient.id, e)}
                                  title="Delete patient"
                                  className="flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <span className="w-px h-4 bg-slate-200 mx-0.5" />
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-sky-600" />
                                ) : (
                                  <ChevronDown className="h-5 w-5" />
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-slate-50/80 p-6 border-t border-b border-sky-100/60 shadow-inner space-y-4">
                            {/* Medical Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div className="rounded-xl bg-amber-50/60 border border-amber-200/60 p-3 space-y-1">
                                <p className="font-bold text-amber-800 flex items-center gap-1.5 text-[0.68rem] uppercase tracking-wider">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Allergies
                                </p>
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {patient.allergies && patient.allergies.length > 0 ? (
                                    patient.allergies.map((allergy, i) => (
                                      <span key={i} className="bg-amber-100/80 text-amber-900 font-semibold px-2 py-0.5 rounded text-[0.68rem]">
                                        {allergy}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400">None recorded</span>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-xl bg-sky-50/60 border border-sky-200/60 p-3 space-y-1">
                                <p className="font-bold text-sky-800 flex items-center gap-1.5 text-[0.68rem] uppercase tracking-wider">
                                  <Stethoscope className="h-3.5 w-3.5 text-sky-600" /> Medical History
                                </p>
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {patient.medicalHistory && patient.medicalHistory.length > 0 ? (
                                    patient.medicalHistory.map((cond, i) => (
                                      <span key={i} className="bg-white text-slate-700 font-semibold border border-slate-200 px-2 py-0.5 rounded text-[0.68rem]">
                                        {cond}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400">None recorded</span>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/60 p-3 space-y-1">
                                <p className="font-bold text-emerald-800 flex items-center gap-1.5 text-[0.68rem] uppercase tracking-wider">
                                  <FileText className="h-3.5 w-3.5 text-emerald-600" /> Medications
                                </p>
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {patient.medications && patient.medications.length > 0 ? (
                                    patient.medications.map((med, i) => (
                                      <span key={i} className="bg-emerald-100/80 text-emerald-900 font-semibold px-2 py-0.5 rounded text-[0.68rem]">
                                        {med}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400">None recorded</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200/80 space-y-4 shadow-sm">
                              <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                  <FileText className="h-4 w-4 text-sky-600" /> Treatment History & Prescriptions
                                </h4>
                                <span className="text-xs text-slate-400 font-medium">
                                  {patient.history.length} Record(s)
                                </span>
                              </div>

                              {patient.history.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                                  <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    <input
                                      type="text"
                                      placeholder="Search procedures, doctors, notes..."
                                      value={historySearch}
                                      onChange={(e) => setHistorySearch(e.target.value)}
                                      className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-sky-400 placeholder:text-slate-400"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <span className="text-[0.7rem] font-medium text-slate-400">Date:</span>
                                    <input
                                      type="date"
                                      value={filterDate}
                                      onChange={(e) => setFilterDate(e.target.value)}
                                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-400"
                                    />
                                  </div>
                                  {(historySearch || filterDate) && (
                                    <button
                                      onClick={clearHistoryFilters}
                                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
                                    >
                                      <X className="h-3.5 w-3.5" /> Clear
                                    </button>
                                  )}
                                </div>
                              )}

                              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                {patient.history.length > 0 ? (
                                  patient.history
                                    .filter((rec) => {
                                      const matchText =
                                        !historySearch ||
                                        rec.treatment.toLowerCase().includes(historySearch.toLowerCase()) ||
                                        rec.doctor.toLowerCase().includes(historySearch.toLowerCase()) ||
                                        rec.notes.toLowerCase().includes(historySearch.toLowerCase()) ||
                                        (rec.prescription && rec.prescription.toLowerCase().includes(historySearch.toLowerCase()));
                                      const matchDate = !filterDate || rec.date === filterDate;
                                      return matchText && matchDate;
                                    })
                                    .map((record) => (
                                      <div
                                        key={record.id}
                                        className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-1.5"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <span className="font-semibold text-xs text-slate-900">
                                            {record.treatment}
                                          </span>
                                          <div className="flex items-center gap-2 text-[0.7rem] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200/80">
                                            <span className="flex items-center gap-1">
                                              <Calendar className="h-3 w-3 text-sky-600" /> {record.date}
                                            </span>
                                            <span className="text-slate-300">•</span>
                                            <span className="flex items-center gap-1">
                                              <Clock className="h-3 w-3 text-amber-600" /> {record.time}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-[0.75rem] font-medium text-slate-600">
                                          <Stethoscope className="h-3.5 w-3.5 text-sky-600" />
                                          <span>{record.doctor}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 pt-0.5">{record.notes}</p>
                                        {record.prescription && (
                                          <div className="rounded-lg bg-sky-50 border border-sky-100 p-2 mt-1 text-xs">
                                            <p className="font-bold text-sky-900 text-[0.68rem] flex items-center gap-1">
                                              <FileText className="h-3 w-3 text-sky-600" /> Prescription:
                                            </p>
                                            <p className="text-sky-800 mt-0.5 font-medium">{record.prescription}</p>
                                          </div>
                                        )}
                                      </div>
                                    ))
                                ) : (
                                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-lg">
                                    No additional treatment history records attached.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filteredPatients.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{startIndex + 1}</span> to{" "}
              <span className="font-semibold text-slate-700">
                {Math.min(startIndex + ITEMS_PER_PAGE, filteredPatients.length)}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{filteredPatients.length}</span> patients
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-7 w-7 rounded-lg text-xs font-semibold transition-colors ${currentPage === pageNum
                      ? "bg-[#7da3b3] text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}