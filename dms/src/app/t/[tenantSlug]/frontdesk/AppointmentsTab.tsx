"use client";

import { Fragment, useState, useMemo, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Clock,
  Plus,
  Check,
  X,
  UserPlus,
  Search,
  Filter,
  Phone,
  Mail,
  User,
  UserCheck,
  UserX,
  Calendar,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Inbox,
  StickyNote,
  AlertCircle,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400";
const ITEMS_PER_PAGE = 8;

function sourceBadgeClasses(source: string) {
  return source === "Online"
    ? "bg-sky-50 text-sky-700 border border-sky-100"
    : "bg-amber-50 text-amber-700 border border-amber-100";
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  dob?: string;
  age?: string;
  gender?: string;
  bloodGroup?: string;
  phone: string;
  email: string;
}

interface Appointment {
  id: string;
  patient: string;
  patientId?: string;
  phone: string;
  email: string;
  dob?: string;
  age?: string;
  gender?: string;
  dentist: string;
  providerId?: string;
  service: string;
  treatmentId?: string;
  date: string;
  time: string;
  source: string;
  status: "Pending" | "Confirmed" | "Rejected";
  attendance: string;
  rawStatus?: string;
  notes?: string;
}

interface DoctorOption {
  id: string;
  name: string;
}

interface TreatmentOption {
  id: string;
  name: string;
  durationMinutes?: number;
}

async function deductInventoryForCompletedAppointment(params: {
  treatmentId?: string;
  treatmentName?: string;
  locationId?: string;
}) {
  let locId = params.locationId;
  if (!locId || locId === "all") {
    try {
      const outletsRes = await axios.get("/api/outlets").catch(() => null);
      if (outletsRes?.data?.success && Array.isArray(outletsRes.data.data?.locations) && outletsRes.data.data.locations.length > 0) {
        locId = outletsRes.data.data.locations[0]?.id;
      }
    } catch (e) { }
  }

  if (!locId) return;

  try {
    let recipeItems: { materialId: string; quantity: number }[] = [];

    const [treatRes, itemRes] = await Promise.all([
      axios.get(`/api/treatment?locationId=${locId}&limit=100`).catch(() => null),
      axios.get(`/api/inventory/item?locationId=${locId}`).catch(() => null),
    ]);

    const treatmentsList: any[] = treatRes?.data?.success && Array.isArray(treatRes.data.data?.treatments)
      ? treatRes.data.data.treatments
      : [];

    const inventoryItemsList: any[] = itemRes?.data?.success && Array.isArray(itemRes.data.data?.items)
      ? itemRes.data.data.items
      : [];

    const normName = (params.treatmentName || "").trim().toLowerCase();
    const matchingTreatment = treatmentsList.find(
      (t: any) =>
        (params.treatmentId && t.id === params.treatmentId) ||
        (normName && t.name?.trim().toLowerCase() === normName)
    );

    const targetTreatmentId = matchingTreatment?.id || params.treatmentId;

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("dms_service_recipes_v1");
        const stored = raw ? JSON.parse(raw) : {};

        if (targetTreatmentId && stored[targetTreatmentId]?.items?.length > 0) {
          recipeItems = stored[targetTreatmentId].items;
        } else {
          for (const key of Object.keys(stored)) {
            const recipe = stored[key];
            if (!recipe || !Array.isArray(recipe.items) || recipe.items.length === 0) continue;
            const foundT = treatmentsList.find((t: any) => t.id === key);
            if (
              key === targetTreatmentId ||
              (foundT && normName && foundT.name?.trim().toLowerCase() === normName)
            ) {
              recipeItems = recipe.items;
              break;
            }
          }
        }
      } catch (e) { }
    }

    if (recipeItems.length === 0 && matchingTreatment && Array.isArray(matchingTreatment.supplies)) {
      recipeItems = matchingTreatment.supplies.map((s: any) => ({
        materialId: s.itemId || s.materialId,
        quantity: s.quantityRequired || s.quantity || 1,
      }));
    }

    for (const item of recipeItems) {
      const targetInvItem = inventoryItemsList.find(
        (inv: any) => inv.id === item.materialId
      );

      const targetItemId = targetInvItem?.id || item.materialId;
      const targetLocId = targetInvItem?.locationId || locId;

      if (targetItemId && Number(item.quantity) > 0) {
        await axios
          .post(`/api/inventory/item/${targetItemId}/movement`, {
            locationId: targetLocId,
            quantity: -Math.abs(Math.round(Number(item.quantity))),
            type: "used",
            note: `Automated deduction for completed appointment (${params.treatmentName || "Service"})`,
          })
          .catch(() => null);
      }
    }
  } catch (err) { }
}

function formatDateTime(isoString: string | Date | null | undefined) {
  if (!isoString) return { date: "-", time: "-" };
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { date: "-", time: "-" };
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

export function calculateAgeFromDob(dob?: string | null): string {
  if (!dob) return "";
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? String(age) : "";
}

export default function AppointmentsTab() {
  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [doctorsList, setDoctorsList] = useState<DoctorOption[]>([]);
  const [treatmentsList, setTreatmentsList] = useState<TreatmentOption[]>([]);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);

  const [view, setView] = useState<"list" | "review">("list");

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterSource, setFilterSource] = useState<"All" | "Online" | "Walk-in">("All");
  const [filterDate, setFilterDate] = useState<string>("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState<string | null>(null);

  // Booking Form State
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [patientMode, setPatientMode] = useState<"search" | "new">("search");
  const [searchPatientQuery, setSearchPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>("");
  const [preferredDate, setPreferredDate] = useState<string>("");
  const [preferredTime, setPreferredTime] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const initialRegisterForm = {
    firstName: "",
    lastName: "",
    dob: "",
    age: "",
    gender: "Male",
    bloodGroup: "",
    phone: "",
    email: "",
  };
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);


      let currentLocId = locationId;
      if (!currentLocId) {
        const userRes = await axios.get("/api/user-details").catch(() => null);
        if (userRes?.data?.success && userRes.data.data?.user?.locationId) {
          currentLocId = userRes.data.data.user.locationId;
        }

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
        }

        if (currentLocId) {
          setLocationId(currentLocId);
        }
      }

      let doctorsRes = await axios
        .get("/api/doctor", {
          params: currentLocId ? { locationId: currentLocId } : undefined,
        })
        .catch(() => null);

      if (!doctorsRes?.data?.success || !doctorsRes.data.data.doctors?.length) {
        doctorsRes = await axios.get("/api/doctor", {
          params: currentLocId ? { locationId: currentLocId } : undefined,
        }).catch(() => null);
      }

      if (doctorsRes?.data?.success && doctorsRes.data.data.doctors) {
        const docs = doctorsRes.data.data.doctors.map((d: any) => ({
          id: d.id,
          name: d.name,
        }));
        setDoctorsList(docs);
      }

      const treatmentsRes = await axios.get("/api/treatment", {
        params: currentLocId ? { locationId: currentLocId } : undefined,
      }).catch(() => null);
      if (treatmentsRes?.data?.success && treatmentsRes.data.data.treatments) {
        const trts = treatmentsRes.data.data.treatments.map((t: any) => ({
          id: t.id,
          name: t.name,
          durationMinutes: t.durationMinutes,
        }));
        setTreatmentsList(trts);
        if (trts.length > 0 && !selectedTreatmentId) {
          setSelectedTreatmentId(trts[0].id);
        }
      }

      const patientsRes = await axios.get("/api/patent", {
        params: currentLocId ? { locationId: currentLocId } : undefined,
      }).catch(() => null);
      if (patientsRes?.data?.success && patientsRes.data.data.patients) {
        const pts: Patient[] = patientsRes.data.data.patients.map((p: any) => {
          let calculatedAge = "";
          if (p.age !== null && p.age !== undefined && p.age !== "") {
            calculatedAge = String(p.age);
          } else if (p.dob) {
            calculatedAge = calculateAgeFromDob(p.dob);
          }
          return {
            id: p.id,
            firstName: p.firstName || "",
            lastName: p.lastName || "",
            name: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient",
            phone: p.phone || "",
            email: p.email || "",
            dob: p.dob || "",
            age: calculatedAge,
            gender: p.gender || "",
            bloodGroup: p.bloodGroup || "",
          };
        });
        setPatientsList(pts);
      }

      if (currentLocId) {
        const apptsRes = await axios
          .get("/api/appoments", {
            params: { locationId: currentLocId },
          })
          .catch(() => null);

        if (apptsRes?.data?.success && apptsRes.data.data.appointments) {
          const mapped: Appointment[] = apptsRes.data.data.appointments.map((a: any) => {
            const { date, time } = formatDateTime(a.startTime);
            let attendance = "Pending";
            if (a.status === "checked_in") attendance = "Checked In";
            else if (a.status === "no_show") attendance = "No-Show";
            else if (a.status === "completed") attendance = "Completed";
            else if (a.status === "cancelled") attendance = "Cancelled";

            const docObj = doctorsList.find(
              (d) =>
                (a.providerId && d.id === a.providerId) ||
                (a.providerName && d.name.toLowerCase() === a.providerName.toLowerCase())
            );

            return {
              id: a.id,
              patient: a.patientName || "Patient",
              phone: a.patientPhone || "-",
              email: a.patientEmail || "-",
              dentist: a.providerName || (docObj ? docObj.name : "Unassigned"),
              providerId: docObj ? docObj.id : (a.providerId || ""),
              service: a.treatmentName || "General Treatment",
              treatmentId: a.treatmentId,
              date,
              time,
              source: a.source === "online_booking" ? "Online" : "Walk-in",
              status: "Confirmed",
              attendance,
              rawStatus: a.status,
              notes: a.notes || "",
            };
          });
          setAppointments(mapped);
        }

        // 6. Fetch Pending Appointments
        const pendingRes = await axios
          .get("/api/appoments/pending", {
            params: { locationId: currentLocId },
          })
          .catch(() => null);

        if (pendingRes?.data?.success && pendingRes.data.data.appointments) {
          const mappedPending: Appointment[] = pendingRes.data.data.appointments.map((a: any) => {
            const { date, time } = formatDateTime(a.startTime);
            return {
              id: a.id,
              patient: a.patientName || "Patient",
              phone: a.patientPhone || "-",
              email: a.patientEmail || "-",
              dentist: "Unassigned",
              service: a.treatmentName || "General Treatment",
              date,
              time,
              source: a.source === "online_booking" ? "Online" : "Walk-in",
              status: "Pending",
              attendance: "Pending",
              notes: a.notes || "",
            };
          });
          setPendingAppointments(mappedPending);
        }
      }
    } catch (err) {
      console.error("Failed to load appointments tab data:", err);
      setErrorMsg("Failed to load data from server.");
    } finally {
      setLoading(false);
    }
  }, [locationId, selectedTreatmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPatients = searchPatientQuery
    ? patientsList.filter(
      (p) =>
        p.name.toLowerCase().includes(searchPatientQuery.toLowerCase()) ||
        p.phone.includes(searchPatientQuery)
    )
    : [];

  const handleDobChange = (dobValue: string) => {
    let calculatedAge = "";
    if (dobValue) {
      const birthDate = new Date(dobValue);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      calculatedAge = age >= 0 ? String(age) : "";
    }
    setRegisterForm((prev) => ({ ...prev, dob: dobValue, age: calculatedAge }));
  };

  function handleQuickRegister(e: React.FormEvent) {
    e.preventDefault();
    const fullName = `${registerForm.firstName.trim()} ${registerForm.lastName.trim()}`.trim();
    if (!fullName || !registerForm.phone) {
      setErrorMsg("First name, last name, and phone number are required.");
      return;
    }

    const tempPatient: Patient = {
      id: "",
      firstName: registerForm.firstName.trim(),
      lastName: registerForm.lastName.trim(),
      name: fullName,
      dob: registerForm.dob,
      age: registerForm.age,
      gender: registerForm.gender,
      bloodGroup: registerForm.bloodGroup,
      phone: registerForm.phone,
      email: registerForm.email,
    };

    setSelectedPatient(tempPatient);
    setSearchPatientQuery("");
    setSuccessMsg("Patient details entered for booking.");
  }

  function resetBookingForm() {
    setShowAddAppt(false);
    setEditingApptId(null);
    setSelectedPatient(null);
    setSearchPatientQuery("");
    setRegisterForm(initialRegisterForm);
    setPatientMode("search");
    setSelectedDoctorId("");
    setPreferredDate("");
    setPreferredTime("");
    setNotes("");
  }

  function toggleAppointmentExpansion(appointmentId: string) {
    setExpandedAppointmentId((prev) => (prev === appointmentId ? null : appointmentId));
  }

  function handleEditClick(appt: Appointment) {
    setEditingApptId(appt.id);
    setSelectedPatient({
      id: appt.patientId || "",
      firstName: "",
      lastName: "",
      name: appt.patient,
      phone: appt.phone,
      email: appt.email,
    });
    setPatientMode("search");
    setSelectedDoctorId(appt.providerId || "");
    setSelectedTreatmentId(appt.treatmentId || "");
    setPreferredDate(appt.date !== "-" ? appt.date : "");
    setPreferredTime(appt.time !== "-" ? appt.time : "");
    setNotes(appt.notes || "");
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowAddAppt(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await axios.delete(`/api/appoments/${deleteTarget.id}`);
      if (res.data?.success === false) {
        setErrorMsg(res.data?.error || "Failed to delete appointment.");
      } else {
        setSuccessMsg("Appointment deleted.");
        await loadData();
      }
    } catch (err: any) {
      console.error("Failed to delete appointment:", err);
      setErrorMsg(err.response?.data?.error || "Failed to delete appointment.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleAddAppt(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    let activeLocId = locationId;
    if (!activeLocId) {
      try {
        const servicesRes = await axios.get("/api/services");
        if (servicesRes.data?.success && servicesRes.data.data.services?.length > 0) {
          activeLocId = servicesRes.data.data.services[0].locationId;
          setLocationId(activeLocId);
        }
      } catch (err) {
        console.error("Error retrieving location ID", err);
      }
    }

    if (!activeLocId) {
      setErrorMsg("Location ID could not be identified. Please make sure services are configured.");
      return;
    }

    if (!selectedTreatmentId) {
      setErrorMsg("Please select a treatment.");
      return;
    }

    if (!preferredDate || !preferredTime) {
      setErrorMsg("Please select date and time.");
      return;
    }

    setSubmitting(true);
    try {
      // Editing an existing appointment
      if (editingApptId) {
        const payload = {
          patientName: selectedPatient?.name || undefined,
          patientPhone: selectedPatient?.phone || undefined,
          treatmentId: selectedTreatmentId || undefined,
          providerId: selectedDoctorId || undefined,
          date: preferredDate,
          time: preferredTime,
          notes: notes || undefined,
        };
        const res = await axios.patch(`/api/appoments/${editingApptId}`, payload);
        if (!res.data?.success) {
          setErrorMsg(res.data?.error || "Failed to update appointment.");
          return;
        }
        setSuccessMsg("Appointment successfully updated!");
        resetBookingForm();
        await loadData();
        return;
      }

      if (selectedPatient?.id) {

        const payload = {
          patientId: selectedPatient.id,
          locationId: activeLocId,
          treatmentId: selectedTreatmentId,
          providerId: selectedDoctorId || undefined,
          preferredDate,
          preferredTime,
          notes: notes || undefined,
        };

        const res = await axios.post("/api/appoments/assign", payload);
        if (!res.data?.success) {
          setErrorMsg(res.data?.error || "Failed to add appointment.");
          return;
        }
      } else {

        let targetPatientId: string | null = null;
        if (registerForm.firstName && registerForm.lastName) {
          const createPatientRes = await axios
            .post("/api/patent", {
              locationId: activeLocId,
              firstName: registerForm.firstName.trim(),
              lastName: registerForm.lastName.trim(),
              dob: registerForm.dob || undefined,
              age: registerForm.age ? Number(registerForm.age) : 0,
              gender: registerForm.gender || undefined,
              bloodGroup: registerForm.bloodGroup || undefined,
              phone: registerForm.phone || undefined,
              email: registerForm.email || undefined,
            })
            .catch(() => null);

          if (createPatientRes?.data?.success && createPatientRes.data.data?.patient?.id) {
            targetPatientId = createPatientRes.data.data.patient.id;
          }
        }

        if (targetPatientId) {
          const payload = {
            patientId: targetPatientId,
            locationId: activeLocId,
            treatmentId: selectedTreatmentId,
            providerId: selectedDoctorId || undefined,
            preferredDate,
            preferredTime,
            notes: notes || undefined,
          };
          const res = await axios.post("/api/appoments/assign", payload);
          if (!res.data?.success) {
            setErrorMsg(res.data?.error || "Failed to add appointment.");
            return;
          }
        } else {

          const fullName = selectedPatient
            ? selectedPatient.name
            : `${registerForm.firstName.trim()} ${registerForm.lastName.trim()}`.trim();
          const phone = selectedPatient ? selectedPatient.phone : registerForm.phone;
          const email = selectedPatient ? selectedPatient.email : registerForm.email;
          const dob = selectedPatient ? selectedPatient.dob : registerForm.dob;

          if (!fullName || !phone) {
            setErrorMsg("Please provide patient name and phone number.");
            return;
          }

          const payload = {
            fullName,
            phone,
            email: email || undefined,
            dob: dob || undefined,
            locationId: activeLocId,
            treatmentId: selectedTreatmentId,
            providerId: selectedDoctorId || undefined,
            preferredDate,
            preferredTime,
            notes: notes || undefined,
            source: "staff",
          };

          const res = await axios.post("/api/appoments", payload);
          if (!res.data?.success) {
            setErrorMsg(res.data?.error || "Failed to add appointment.");
            return;
          }
        }
      }

      setSuccessMsg("Appointment successfully added!");
      resetBookingForm();

      await loadData();
    } catch (err: any) {
      const status = err?.response?.status;
      const apiErr =
        err?.response?.data?.error || "An error occurred while adding the appointment.";

      // 4xx booking conflicts/validation are expected user-facing outcomes,
      // so avoid noisy console errors for these cases.
      if (![400, 404, 409].includes(status)) {
        console.error("Failed to add appointment:", err);
      }

      setErrorMsg(apiErr);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept(id: string) {
    try {
      setSubmitting(true);
      const res = await axios.patch(`/api/appoments/${id}/status`, { status: "confirmed" });
      if (res.data?.success) {
        await loadData();
      } else {
        alert(res.data?.error || "Failed to confirm appointment.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to confirm appointment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(id: string) {
    try {
      setSubmitting(true);
      const res = await axios.patch(`/api/appoments/${id}/status`, { status: "cancelled" });
      if (res.data?.success) {
        await loadData();
      } else {
        alert(res.data?.error || "Failed to reject appointment.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to reject appointment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAttendance(id: string, newStatus: string) {
    try {

      const res = await axios.patch(`/api/appoments/${id}/status`, { status: newStatus });
      if (res.data?.success) {
        await loadData();
      } else {
        alert(res.data?.error || "Failed to update status.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to update status.");
    }
  }

  async function handleDentistChange(id: string, newProviderId: string) {
    const doctorObj = doctorsList.find((d) => d.id === newProviderId);

    // Optimistic UI update
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
            ...a,
            providerId: newProviderId,
            dentist: doctorObj ? doctorObj.name : a.dentist,
          }
          : a
      )
    );

    try {
      const res = await axios.patch(`/api/appoments/${id}/reassign`, {
        providerId: newProviderId,
      });
      if (res.data?.success) {
        await loadData();
      } else {
        alert(res.data?.error || "Failed to reassign dentist.");
        await loadData();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to reassign dentist.");
      await loadData();
    }
  }

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return appointments.filter((appt) => {
      const matchesSearch =
        !q ||
        appt.patient.toLowerCase().includes(q) ||
        appt.phone.toLowerCase().includes(q) ||
        appt.email.toLowerCase().includes(q) ||
        appt.dentist.toLowerCase().includes(q);
      const matchesSource = filterSource === "All" ? true : appt.source === filterSource;
      const matchesDate = filterDate ? appt.date === filterDate : true;
      return matchesSearch && matchesSource && matchesDate;
    });
  }, [appointments, searchQuery, filterSource, filterDate]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const paginatedAppointments = useMemo(() => {
    return filteredAppointments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAppointments, startIndex]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleFilterSourceChange = (src: "All" | "Online" | "Walk-in") => {
    setFilterSource(src);
    setCurrentPage(1);
  };

  const handleFilterDateChange = (date: string) => {
    setFilterDate(date);
    setCurrentPage(1);
  };

  return (
    <div className="w-full py-6">
      <div className="space-y-6 w-full">

        {/* Top Error / Success Banners */}
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

        {/* View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 w-full">
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${view === "list"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Appointments
            </button>
            <button
              onClick={() => setView("review")}
              className={`relative flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${view === "review"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              Pending Review
              {pendingAppointments.length > 0 && (
                <span className="ml-0.5 inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[0.65rem] font-bold text-white">
                  {pendingAppointments.length}
                </span>
              )}
            </button>
          </div>

          {view === "list" && (
            <button
              onClick={() => {
                if (showAddAppt) {
                  resetBookingForm();
                } else {
                  setShowAddAppt(true);
                  setEditingApptId(null);
                  setSelectedPatient(null);
                  setPatientMode("search");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }
              }}
              className="flex items-center gap-1.5 rounded-full bg-[#7da3b3] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Appointment
            </button>
          )}
        </div>

        {/* Pending Review View */}
        {view === "review" && (
          <div className="space-y-4 w-full">
            {pendingAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center">
                <Inbox className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-500">No pending requests right now</p>
                <p className="text-xs text-slate-400 mt-1">
                  New online or desk requests will show up here for review.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {pendingAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="relative overflow-hidden rounded-2xl border border-slate-900/5 bg-white/90 p-5 pl-6 shadow-sm backdrop-blur-sm space-y-3"
                  >
                    <span className="absolute left-0 top-0 h-full w-1.5 bg-[#7da3b3]" />

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-sky-50 flex items-center justify-center text-sky-700 font-bold shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{appt.patient}</p>
                          <span
                            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${sourceBadgeClasses(
                              appt.source
                            )}`}
                          >
                            {appt.source}
                          </span>
                        </div>
                      </div>
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Pending
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" /> {appt.phone}
                      </p>
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />{" "}
                        <span className="truncate">{appt.email}</span>
                      </p>

                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" /> {appt.date} · {appt.time}
                      </p>
                    </div>

                    <div className="text-xs font-medium text-slate-800">
                      <span className="inline-block bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                        {appt.service}
                      </span>
                    </div>

                    {/* Notes */}
                    <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                      <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        <StickyNote className="h-3 w-3" /> Notes
                      </p>
                      <p
                        className={`text-xs leading-snug ${appt.notes ? "text-slate-600" : "text-slate-400 italic"
                          }`}
                      >
                        {appt.notes || "No additional notes from the patient."}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => handleEditClick(appt)}
                        disabled={submitting}
                        className="flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-sky-600 hover:border-sky-200 transition-colors disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleAccept(appt.id)}
                        disabled={submitting}
                        className="flex items-center justify-center gap-1.5 rounded-full bg-[#7da3b3] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Confirm
                      </button>
                      <button
                        onClick={() => handleReject(appt.id)}
                        disabled={submitting}
                        className="flex items-center justify-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-500 border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit Pending Appointment (stay on Pending Review view) */}
        {view === "review" && showAddAppt && editingApptId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-2xl rounded-2xl border border-sky-200 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b border-sky-100 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Edit Pending Appointment
                </h3>
                <button
                  type="button"
                  onClick={resetBookingForm}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddAppt} className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Patient</span>
                  <input className={inputClass} value={selectedPatient?.name || ""} readOnly />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Assign Dentist</span>
                  <select
                    className={inputClass}
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                  >
                    <option value="">Auto-assign available dentist</option>
                    {doctorsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Treatment / Service *</span>
                  <select
                    required
                    className={inputClass}
                    value={selectedTreatmentId}
                    onChange={(e) => setSelectedTreatmentId(e.target.value)}
                  >
                    <option value="" disabled>
                      Select Treatment
                    </option>
                    {treatmentsList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.durationMinutes ? `(${t.durationMinutes}m)` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Date *</span>
                  <input
                    required
                    type="date"
                    className={inputClass}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Time *</span>
                  <input
                    required
                    type="time"
                    className={inputClass}
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Notes (Optional)</span>
                  <input
                    type="text"
                    placeholder="Any additional notes..."
                    className={inputClass}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>

                <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetBookingForm}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-xl bg-[#7da3b3] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] transition-colors disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Main Appointments List View */}
        {view === "list" && (
          <>
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search patient, phone, dentist..."
                  className={`${inputClass} pl-9`}
                />
              </div>

              {/* Booking Type Filter */}
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
                <select
                  value={filterSource}
                  onChange={(e) =>
                    handleFilterSourceChange(e.target.value as "All" | "Online" | "Walk-in")
                  }
                  className={`${inputClass} appearance-none pl-9 pr-8`}
                >
                  <option value="All">All Bookings</option>
                  <option value="Online">Online Bookings</option>
                  <option value="Walk-in">Walk-in Bookings</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/60">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => handleFilterDateChange(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 font-medium outline-none cursor-pointer"
                />
                {filterDate && (
                  <button
                    onClick={() => handleFilterDateChange("")}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold ml-1"
                    title="Clear Date Filter"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Add Appointment Form */}
            {showAddAppt && !editingApptId && (
              <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-6 shadow-md backdrop-blur-sm space-y-6">
                <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    New Desk Entry
                  </h3>
                  <button
                    onClick={resetBookingForm}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Patient Details Column */}
                  <div className="space-y-4 border-r border-slate-100 pr-0 md:pr-6">
                    <h4 className="text-xs font-semibold text-[#7da3b3] uppercase tracking-wider">
                      Patient Details
                    </h4>

                    {/* Mode selector */}
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => {
                          setPatientMode("search");
                          setSelectedPatient(null);
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${patientMode === "search"
                            ? "bg-white text-slate-900 shadow-sm font-semibold"
                            : "text-slate-500 hover:text-slate-800"
                          }`}
                      >
                        <Search className="h-3.5 w-3.5" />
                        Existing Patient
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPatientMode("new");
                          setSelectedPatient(null);
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${patientMode === "new"
                            ? "bg-white text-slate-900 shadow-sm font-semibold"
                            : "text-slate-500 hover:text-slate-800"
                          }`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        New Patient
                      </button>
                    </div>

                    {/* Mode A: Search Existing Patient */}
                    {patientMode === "search" && !selectedPatient && (
                      <div className="space-y-2 pt-1">
                        <label className="block text-xs font-medium text-slate-600">
                          Search Existing Patient
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Type patient name or phone..."
                            value={searchPatientQuery}
                            onChange={(e) => setSearchPatientQuery(e.target.value)}
                            className={`${inputClass} pl-9`}
                          />
                        </div>

                        {searchPatientQuery && (
                          <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-50">
                            {filteredPatients.length > 0 ? (
                              filteredPatients.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPatient(p);
                                    setSearchPatientQuery("");
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 flex justify-between items-center"
                                >
                                  <div>
                                    <span className="font-medium text-slate-900 block">
                                      {p.name}
                                    </span>
                                    <span className="text-[0.68rem] text-slate-400">
                                      {p.gender || "Gender N/A"} • {p.age ? `${p.age} yrs` : (p.dob ? `${calculateAgeFromDob(p.dob)} yrs` : "Age N/A")}
                                    </span>
                                  </div>
                                  <span className="text-slate-400">{p.phone}</span>
                                </button>
                              ))
                            ) : (
                              <div className="p-4 text-center">
                                <p className="text-xs text-slate-500 mb-2">
                                  No active record found matching "{searchPatientQuery}"
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPatientMode("new");
                                    setRegisterForm({
                                      ...registerForm,
                                      firstName: searchPatientQuery,
                                    });
                                    setSearchPatientQuery("");
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#7da3b3] hover:underline"
                                >
                                  <UserPlus className="h-3 w-3" /> Register "{searchPatientQuery}" as
                                  New Patient
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mode B: Quick Registration */}
                    {patientMode === "new" && !selectedPatient && (
                      <form
                        onSubmit={handleQuickRegister}
                        className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 space-y-3 pt-3"
                      >
                        <span className="mb-1 block text-sm font-bold text-slate-700">
                          Quick Patient Details
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              First Name *
                            </label>
                            <input
                              required
                              type="text"
                              placeholder="First Name"
                              value={registerForm.firstName}
                              className={inputClass}
                              onChange={(e) =>
                                setRegisterForm({ ...registerForm, firstName: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Last Name *
                            </label>
                            <input
                              required
                              type="text"
                              placeholder="Last Name"
                              value={registerForm.lastName}
                              className={inputClass}
                              onChange={(e) =>
                                setRegisterForm({ ...registerForm, lastName: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Date of Birth
                            </label>
                            <input
                              type="date"
                              value={registerForm.dob}
                              className={inputClass}
                              onChange={(e) => handleDobChange(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Age
                            </label>
                            <input
                              type="number"
                              min="0"
                              placeholder="Age"
                              value={registerForm.age}
                              className={inputClass}
                              onChange={(e) =>
                                setRegisterForm({ ...registerForm, age: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Gender
                            </label>
                            <select
                              value={registerForm.gender}
                              className={inputClass}
                              onChange={(e) =>
                                setRegisterForm({ ...registerForm, gender: e.target.value })
                              }
                            >
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Blood Group
                            </label>
                            <select
                              value={registerForm.bloodGroup}
                              className={inputClass}
                              onChange={(e) =>
                                setRegisterForm({ ...registerForm, bloodGroup: e.target.value })
                              }
                            >
                              <option value="">Select Blood Group</option>
                              <option value="A+">A+</option>
                              <option value="A-">A-</option>
                              <option value="B+">B+</option>
                              <option value="B-">B-</option>
                              <option value="AB+">AB+</option>
                              <option value="AB-">AB-</option>
                              <option value="O+">O+</option>
                              <option value="O-">O-</option>
                            </select>
                          </div>
                        </div>

                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Phone Number *
                        </label>
                        <input
                          required
                          type="tel"
                          placeholder="Phone Number"
                          value={registerForm.phone}
                          className={inputClass}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, phone: e.target.value })
                          }
                        />

                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="Email Address"
                          value={registerForm.email}
                          className={inputClass}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, email: e.target.value })
                          }
                        />

                        <button
                          type="submit"
                          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#7da3b3] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#6b92a2]"
                        >
                          <Check className="h-4 w-4" /> Confirm Patient Info
                        </button>
                      </form>
                    )}

                    {/* Selected Patient Box */}
                    {selectedPatient && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex justify-between items-center mt-2">
                        <div className="space-y-1">
                          <p className="text-[0.7rem] font-bold uppercase text-emerald-600 tracking-wider">
                            Patient Selected
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {selectedPatient.name}
                          </p>
                          <p className="text-xs text-slate-600 font-medium">
                            {selectedPatient.gender || "Gender N/A"} •{" "}
                            {selectedPatient.age ? `${selectedPatient.age} yrs` : (selectedPatient.dob ? `${calculateAgeFromDob(selectedPatient.dob)} yrs` : "")}
                          </p>
                          <p className="text-xs flex items-center gap-1 text-slate-500">
                            <Phone className="h-3 w-3" /> {selectedPatient.phone || "No phone"}
                          </p>
                          <p className="text-xs flex items-center gap-1 text-slate-500">
                            <Mail className="h-3 w-3" /> {selectedPatient.email || "No email"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPatient(null)}
                          className="text-slate-400 hover:text-slate-600 text-xs underline font-medium"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Appointment Details Form */}
                  <form onSubmit={handleAddAppt} className="space-y-4">
                    <h4 className="text-xs font-semibold text-[#7da3b3] uppercase tracking-wider">
                      Appointment Details
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-600">
                          Assign Dentist
                        </span>
                        <select
                          className={inputClass}
                          value={selectedDoctorId}
                          onChange={(e) => setSelectedDoctorId(e.target.value)}
                        >
                          <option value="">Auto-assign available dentist</option>
                          {doctorsList.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-600">
                          Treatment / Service *
                        </span>
                        <select
                          required
                          className={inputClass}
                          value={selectedTreatmentId}
                          onChange={(e) => setSelectedTreatmentId(e.target.value)}
                        >
                          <option value="" disabled>
                            Select Treatment
                          </option>
                          {treatmentsList.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} {t.durationMinutes ? `(${t.durationMinutes}m)` : ""}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-600">
                          Date *
                        </span>
                        <input
                          required
                          type="date"
                          className={inputClass}
                          value={preferredDate}
                          onChange={(e) => setPreferredDate(e.target.value)}
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-600">
                          Time *
                        </span>
                        <input
                          required
                          type="time"
                          className={inputClass}
                          value={preferredTime}
                          onChange={(e) => setPreferredTime(e.target.value)}
                        />
                      </label>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Any additional notes..."
                        className={inputClass}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="h-10 w-full flex items-center justify-center gap-2 rounded-xl bg-[#7da3b3] text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#6b92a2] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {submitting ? "Booking Appointment..." : "Add Appointment"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Edit Appointment Form */}
            {showAddAppt && editingApptId && (
              <form
                onSubmit={handleAddAppt}
                className="grid gap-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-6 shadow-md backdrop-blur-sm sm:grid-cols-6"
              >
                <div className="sm:col-span-6 flex items-center justify-between border-b border-sky-100 pb-3 mb-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-2">
                    <Pencil className="h-4 w-4" /> Edit Appointment
                  </h3>
                  <button
                    type="button"
                    onClick={resetBookingForm}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Read-only patient info */}
                <div className="sm:col-span-6 rounded-xl bg-white border border-slate-200/80 p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-sky-50 flex items-center justify-center text-sky-700 font-bold shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[0.65rem] font-bold uppercase text-slate-400 tracking-wider">
                        Patient
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedPatient?.name}
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {selectedPatient?.phone || "No phone"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {selectedPatient?.email || "No email"}
                  </span>
                </div>

                <label className="block sm:col-span-3">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Assign Dentist
                  </span>
                  <select
                    className={inputClass}
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                  >
                    <option value="">Auto-assign available dentist</option>
                    {doctorsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-3">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Treatment / Service *
                  </span>
                  <select
                    required
                    className={inputClass}
                    value={selectedTreatmentId}
                    onChange={(e) => setSelectedTreatmentId(e.target.value)}
                  >
                    <option value="" disabled>
                      Select Treatment
                    </option>
                    {treatmentsList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.durationMinutes ? `(${t.durationMinutes}m)` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-3">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Date *</span>
                  <input
                    required
                    type="date"
                    className={inputClass}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                </label>

                <label className="block sm:col-span-3">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Time *</span>
                  <input
                    required
                    type="time"
                    className={inputClass}
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                  />
                </label>

                <label className="block sm:col-span-6">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Notes (Optional)
                  </span>
                  <input
                    type="text"
                    placeholder="Any additional notes..."
                    className={inputClass}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>

                <div className="sm:col-span-6 flex justify-end gap-2 pt-3 border-t border-sky-100 mt-2">
                  <button
                    type="button"
                    onClick={resetBookingForm}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-xl bg-[#7da3b3] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] transition-colors disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {/* Appointments Data Grid */}
            <div className="w-full overflow-hidden rounded-2xl border border-slate-900/5 bg-white/90 shadow-lg backdrop-blur-sm">
              {loading ? (
                <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
                  <span>Loading appointments from database...</span>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[1100px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
                        <th className="p-4 pl-6">Patient Name</th>
                        <th className="p-4">Phone Number</th>
                        <th className="p-4">Email Address</th>
                        <th className="p-4">Assigned Doctor</th>
                        <th className="p-4">Service</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Date & Time</th>
                        <th className="p-4">Attendance</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {paginatedAppointments.map((appt) => {
                        const isExpanded = expandedAppointmentId === appt.id;

                        return (
                          <Fragment key={appt.id}>
                            <tr
                              className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                              onClick={() => toggleAppointmentExpansion(appt.id)}
                            >
                              {/* Patient Name */}
                              <td className="p-4 pl-6">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-700 font-bold shrink-0">
                                    <User className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-slate-900">{appt.patient}</span>
                                </div>
                              </td>

                              {/* Phone Column */}
                              <td className="p-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                                <span className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                                  {appt.phone}
                                </span>
                              </td>

                              {/* Email Column */}
                              <td className="p-4 text-xs text-slate-600 max-w-[180px] truncate">
                                <span className="flex items-center gap-1.5 truncate" title={appt.email}>
                                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{appt.email}</span>
                                </span>
                              </td>

                              {/* Doctor Dropdown Column */}
                              <td className="p-4">
                                <div className="relative flex items-center min-w-[160px]">
                                  <Stethoscope className="absolute left-2.5 h-3.5 w-3.5 text-sky-500 pointer-events-none" />
                                  <select
                                    onClick={(e) => e.stopPropagation()}
                                    value={appt.providerId || ""}
                                    onChange={(e) => handleDentistChange(appt.id, e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-2 py-1 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:border-sky-400 focus:bg-white transition-all cursor-pointer"
                                  >
                                    <option value="" disabled>
                                      Select Doctor
                                    </option>
                                    {doctorsList.map((doc) => (
                                      <option key={doc.id} value={doc.id}>
                                        {doc.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>

                              {/* Service Column */}
                              <td className="p-4 text-xs font-medium text-slate-800">
                                <span className="inline-block bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                                  {appt.service}
                                </span>
                              </td>

                              {/* Origin Column */}
                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider ${sourceBadgeClasses(
                                    appt.source
                                  )}`}
                                >
                                  {appt.source}
                                </span>
                              </td>

                              {/* Date & Time Column */}
                              <td className="p-4">
                                <div className="text-xs space-y-0.5 whitespace-nowrap">
                                  <p className="flex items-center gap-1 text-slate-700 font-medium">
                                    <Calendar className="h-3 w-3 text-slate-400" /> {appt.date}
                                  </p>
                                  <p className="flex items-center gap-1 text-slate-500">
                                    <Clock className="h-3 w-3 text-sky-400" /> {appt.time}
                                  </p>
                                </div>
                              </td>

                              {/* Attendance Column */}
                              <td className="p-4">
                                <select
                                  onClick={(e) => e.stopPropagation()}
                                  value={
                                    appt.rawStatus ||
                                    (appt.attendance === "Checked In"
                                      ? "checked_in"
                                      : appt.attendance === "No-Show"
                                        ? "no_show"
                                        : appt.attendance === "Completed"
                                          ? "completed"
                                          : "confirmed")
                                  }
                                  onChange={(e) => handleAttendance(appt.id, e.target.value)}
                                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none transition-all cursor-pointer ${appt.attendance === "Checked In" || appt.rawStatus === "checked_in"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : appt.attendance === "No-Show" || appt.rawStatus === "no_show"
                                        ? "border-rose-200 bg-rose-50 text-rose-700"
                                        : appt.rawStatus === "completed"
                                          ? "border-slate-200 bg-slate-100 text-slate-600"
                                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                  <option value="confirmed">Confirmed (Pending)</option>
                                  <option value="checked_in">Checked In</option>
                                  <option value="no_show">No-Show</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </td>

                              {/* Actions Column */}
                              <td className="p-4 pr-6">
                                <div className="flex items-center justify-end gap-1.5">

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditClick(appt);
                                    }}
                                    title="Edit Appointment"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-colors"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget(appt);
                                    }}
                                    title="Delete Appointment"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-slate-50/40">
                                <td colSpan={9} className="px-6 pb-4">
                                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                    <p className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
                                      Appointment Notes
                                    </p>
                                    <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap break-words">
                                      {appt.notes?.trim() || "No notes added for this appointment."}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {filteredAppointments.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-xs text-slate-400 font-medium">
                            No confirmed appointments match your active search and date filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Footer */}
              {!loading && filteredAppointments.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50 text-xs text-slate-500">
                  <div>
                    Showing <span className="font-semibold text-slate-700">{startIndex + 1}</span>{" "}
                    to{" "}
                    <span className="font-semibold text-slate-700">
                      {Math.min(startIndex + ITEMS_PER_PAGE, filteredAppointments.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-700">
                      {filteredAppointments.length}
                    </span>{" "}
                    appointments
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
          </>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Delete Appointment</h3>
                  <p className="text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Are you sure you want to delete the appointment for{" "}
                <span className="font-semibold text-slate-900">{deleteTarget.patient}</span> on{" "}
                <span className="font-semibold text-slate-900">
                  {deleteTarget.date} · {deleteTarget.time}
                </span>
                ?
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
