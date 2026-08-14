"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Search,
  User,
  Calendar,
  FileText,
  History,
  Stethoscope,
  ChevronRight,
  AlertCircle,
  X,
  PlusCircle,
  ChevronDown,
  ChevronLeft,
  Loader2,
  Wallet,
  CheckCircle2,
} from "lucide-react";

export interface TreatmentRecord {
  id: string;
  date: string;
  service: string;
  notes: string;
  prescription?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  category?: string;
  priceCents?: number;
  durationMinutes?: number;
}

export interface TreatedPatient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: string;
  medicalHistory: string[];
  allergies: string[];
  lastVisit: string;
  totalVisits: number;
  history: TreatmentRecord[];
  // TODO: hardcoded placeholder until billing/ledger data is exposed via API.
  // Replace getHardcodedBalanceDueCents() with the real balanceDueCents
  // value returned from the backend once that join/column exists.
  balanceDueCents: number;
}

// TEMPORARY: deterministic fake balance so the UI has something to show.
// Same patient always gets the same demo value across re-renders.
function getHardcodedBalanceDueCents(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 997;
  }
  // ~1/3 of patients show as "Settled", the rest show a fake due amount.
  if (hash % 3 === 0) return 0;
  return 50000 + (hash % 20) * 10000; // e.g. NPR 500 - 2400
}

function centsToDisplay(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function calculateAgeFromDob(dob?: string | null) {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : 0;
}

export default function DoctorPatientsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<TreatedPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [showNoteDropdown, setShowNoteDropdown] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [newService, setNewService] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newPrescription, setNewPrescription] = useState("");
  const [newAllergiesInput, setNewAllergiesInput] = useState("");
  const [newMedicalHistoryInput, setNewMedicalHistoryInput] = useState("");

  const [noteableAppts, setNoteableAppts] = useState<{ id: string; treatmentName: string; startTime: string }[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const [patients, setPatients] = useState<TreatedPatient[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);


      const [treatmentsRes, servicesRes, patientsRes] = await Promise.all([
        axios.get("/api/treatment").catch(() => null),
        axios.get("/api/services").catch(() => null),
        axios.get("/api/patent").catch(() => null),
      ]);

      const allServices: ServiceItem[] = [];
      const seenNames = new Set<string>();

      if (treatmentsRes?.data?.success && treatmentsRes.data.data.treatments) {
        treatmentsRes.data.data.treatments.forEach((t: any) => {
          const name = t.name || t.title;
          if (name && !seenNames.has(name)) {
            seenNames.add(name);
            allServices.push({
              id: t.id,
              name,
              category: t.category,
              priceCents: t.priceCents,
              durationMinutes: t.durationMinutes,
            });
          }
        });
      }

      if (servicesRes?.data?.success && servicesRes.data.data.services) {
        servicesRes.data.data.services.forEach((s: any) => {
          const name = s.name || s.title;
          if (name && !seenNames.has(name)) {
            seenNames.add(name);
            allServices.push({
              id: s.id,
              name,
              category: s.category,
              priceCents: s.priceCents,
              durationMinutes: s.durationMinutes,
            });
          }
        });
      }

      setServices(allServices);
      if (allServices.length > 0) {
        setNewService((prev) => prev || allServices[0].name);
      }


      let currentLocId: string | null = null;
      if (treatmentsRes?.data?.success && treatmentsRes.data.data.treatments?.length > 0) {
        currentLocId = treatmentsRes.data.data.treatments[0].locationId;
      } else if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
        currentLocId = servicesRes.data.data.services[0].locationId;
      } else if (patientsRes?.data?.success && patientsRes.data.data.patients?.length > 0) {
        currentLocId = patientsRes.data.data.patients[0].locationId;
      }

      const patientApptsMap: Record<string, any[]> = {};
      const patientNameApptsMap: Record<string, any[]> = {};

      if (currentLocId) {
        const apptsRes = await axios
          .get("/api/appoments", { params: { locationId: currentLocId } })
          .catch(() => null);

        if (apptsRes?.data?.success && apptsRes.data.data.appointments) {
          apptsRes.data.data.appointments.forEach((a: any) => {
            if (a.patientId) {
              if (!patientApptsMap[a.patientId]) patientApptsMap[a.patientId] = [];
              patientApptsMap[a.patientId].push(a);
            }
            if (a.patientName) {
              const key = a.patientName.trim().toLowerCase();
              if (!patientNameApptsMap[key]) patientNameApptsMap[key] = [];
              patientNameApptsMap[key].push(a);
            }
          });
        }
      }


      if (patientsRes?.data?.success && patientsRes.data.data.patients) {
        const rawPatients = patientsRes.data.data.patients;
        const mappedPromises = rawPatients.map(async (p: any) => {
          const patientName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient";
          const normName = patientName.toLowerCase();
          const appts = patientApptsMap[p.id] || patientNameApptsMap[normName] || [];

          const historyRecords: TreatmentRecord[] = appts.map((a: any) => {
            const dateStr = a.startTime
              ? new Date(a.startTime).toISOString().split("T")[0]
              : "N/A";
            return {
              id: a.id,
              date: dateStr,
              service: a.treatmentName || a.serviceName || "General Service",
              notes: a.notes || `Appointment Status: ${a.status || "Confirmed"}`,
            };
          });

          const lastVisitDate =
            historyRecords[0]?.date ||
            (p.lastVisit ? new Date(p.lastVisit).toISOString().split("T")[0] : "N/A");

          const ledgerRes = await axios.get(`/api/patent/${p.id}/ledger`).catch(() => null);
          const summary = ledgerRes?.data?.success ? ledgerRes.data.data.summary : null;
          const balanceDueCents = summary ? summary.balanceDueCents : 0;

          return {
            id: p.id,
            name: patientName,
            phone: p.phone || "-",
            age: p.age ?? calculateAgeFromDob(p.dob),
            gender: p.gender || "Male",
            medicalHistory: [],
            allergies: [],
            lastVisit: lastVisitDate,
            totalVisits: Math.max(1, historyRecords.length),
            history: historyRecords,
            balanceDueCents,
          };
        });

        const mapped: TreatedPatient[] = await Promise.all(mappedPromises);
        setPatients(mapped);
      }
    } catch (err: any) {
      console.error("Failed to fetch doctor patients:", err);
      setErrorMsg("Failed to load patient records from database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPatients = filteredPatients.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleSelectPatient = async (patient: TreatedPatient) => {
    setSelectedPatient(patient);
    setShowNoteDropdown(false);

    try {
      const [detailRes, apptsRes, historyRes, noteablesRes] = await Promise.all([
        axios.get(`/api/patent/${patient.id}`).catch(() => null),
        axios.get(`/api/patent/${patient.id}/appoments`).catch(() => null),
        axios.get(`/api/patent/${patient.id}/medical-History`).catch(() => null),
        axios.get(`/api/patent/${patient.id}/clinical-notes`).catch(() => null),
      ]);

      let updatedDetail = {
        name: patient.name,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
      };

      if (detailRes?.data?.success && detailRes.data.data.patient) {
        const p = detailRes.data.data.patient;
        updatedDetail = {
          name: `${p.firstName || ""} ${p.lastName || ""}`.trim() || patient.name,
          phone: p.phone || patient.phone,
          age: p.age ?? calculateAgeFromDob(p.dob) ?? patient.age,
          gender: p.gender || patient.gender,
        };
      }

      let historyRecords: TreatmentRecord[] = patient.history;
      if (apptsRes?.data?.success && apptsRes.data.data.appointments) {
        historyRecords = apptsRes.data.data.appointments.map((a: any) => {
          const dateStr = a.startTime
            ? new Date(a.startTime).toISOString().split("T")[0]
            : "N/A";
          return {
            id: a.id,
            date: dateStr,
            service: a.treatmentName || "General Service",
            notes: a.noteText || `Appointment Status: ${a.status || "Completed"}`,
            prescription: a.prescription || a.prescriptionText || undefined,
          };
        });
      }

      let allergies: string[] = patient.allergies;
      let medicalHistory: string[] = patient.medicalHistory;
      if (historyRes?.data?.success && historyRes.data.data.medicalHistory) {
        allergies = historyRes.data.data.medicalHistory.allergies || [];
        medicalHistory = historyRes.data.data.medicalHistory.medicalHistory || [];
      }

      let noteables: { id: string; treatmentName: string; startTime: string }[] = [];
      if (noteablesRes?.data?.success && noteablesRes.data.data.appointments) {
        noteables = noteablesRes.data.data.appointments;
      }
      setNoteableAppts(noteables);
      if (noteables.length > 0) {
        setSelectedAppointmentId(noteables[0].id);
      } else {
        setSelectedAppointmentId("");
      }

      const updated: TreatedPatient = {
        ...patient,
        ...updatedDetail,
        history: historyRecords,
        allergies,
        medicalHistory,
        lastVisit: historyRecords[0]?.date || patient.lastVisit,
        totalVisits: Math.max(1, historyRecords.length),
      };

      setSelectedPatient(updated);
      setPatients((prev) => prev.map((p) => (p.id === patient.id ? updated : p)));
    } catch (err) {
      console.error("Error loading patient detail:", err);
    }
  };

  const handleAddTreatmentNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !newNotes) return;

    if (!selectedAppointmentId && noteableAppts.length > 0) {
      setSelectedAppointmentId(noteableAppts[0].id);
    }

    const apptIdToUse = selectedAppointmentId || noteableAppts[0]?.id;
    if (!apptIdToUse) {
      setErrorMsg("No appointment selected to attach this clinical note.");
      return;
    }

    try {
      setIsSubmittingNote(true);
      setErrorMsg(null);

      const payload = {
        appointmentId: apptIdToUse,
        noteText: newNotes.trim(),
        prescription: newPrescription.trim() || undefined,
        allergy: newAllergiesInput.trim() || undefined,
        medicalHistory: newMedicalHistoryInput.trim() || undefined,
      };

      const res = await axios.post(`/api/patent/${selectedPatient.id}/clinical-notes`, payload);

      if (res.data?.success) {
        setShowNoteDropdown(false);
        setNewNotes("");
        setNewPrescription("");
        setNewAllergiesInput("");
        setNewMedicalHistoryInput("");

        await handleSelectPatient(selectedPatient);
      } else {
        setErrorMsg(res.data?.error || "Failed to save clinical note.");
      }
    } catch (err: any) {
      console.error("Error saving clinical entry:", err);
      setErrorMsg(err.response?.data?.error || "Failed to save clinical entry.");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-slate-800">
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

      {/* Search & Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Patient Name, Phone, or ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#7da3b3] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Total Patients:</span>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-900 font-bold border border-slate-200">
            {patients.length}
          </span>
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-12">

        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden min-h-[580px]">
          <div>

            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-[0.7rem] font-bold uppercase tracking-wider text-slate-500">
              <span>Patient Directory</span>
              <span>Last Visit / Payment</span>
            </div>


            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
                  <span>Loading patient records...</span>
                </div>
              ) : paginatedPatients.length === 0 ? (
                <div className="p-8 text-center">
                  <User className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">No records found</p>
                </div>
              ) : (
                paginatedPatients.map((patient) => {
                  const isSelected = selectedPatient?.id === patient.id;
                  const defaultService = services[0]?.name || "N/A";
                  const latestService = patient.history[0]?.service || defaultService;

                  return (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className={`group cursor-pointer p-3.5 transition-all flex items-center justify-between ${isSelected
                        ? "bg-sky-50/60 border-l-4 border-l-[#7da3b3]"
                        : "hover:bg-slate-50 border-l-4 border-l-transparent"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-600 font-bold group-hover:bg-sky-100 group-hover:text-sky-700 transition-colors">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#7da3b3] transition-colors">
                              {patient.name}
                            </h4>

                          </div>
                          <p className="text-[0.68rem] text-slate-500 mt-0.5">
                            {patient.phone} • {patient.age}y/o {patient.gender}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-[0.68rem] font-semibold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded">
                          <Stethoscope className="h-3 w-3 text-sky-600" />
                          <span className="truncate max-w-[100px]">{latestService}</span>
                        </div>
                        <span className="text-[0.62rem] text-slate-400 flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" /> {patient.lastVisit}
                        </span>
                        {patient.balanceDueCents > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded border border-rose-200/60 text-[0.62rem]">
                            <Wallet className="h-2.5 w-2.5 text-rose-500 shrink-0" />
                            NPR {centsToDisplay(patient.balanceDueCents)} due
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200/60 text-[0.62rem]">
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                            Settled
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Front-Desk Pagination Controls */}
          {!loading && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs">
              <span className="text-[0.7rem] text-slate-500 font-medium">
                Showing{" "}
                <strong className="text-slate-800">
                  {filteredPatients.length > 0 ? startIndex + 1 : 0}
                </strong>{" "}
                to{" "}
                <strong className="text-slate-800">
                  {Math.min(startIndex + itemsPerPage, filteredPatients.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filteredPatients.length}</strong>
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
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>


        <div className="lg:col-span-7">
          {selectedPatient ? (
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-6">
              {/* Header Info Banner */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 shrink-0 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 font-bold">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{selectedPatient.name}</h3>
                      {selectedPatient.balanceDueCents > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded border border-rose-200/60 text-[0.68rem]">
                          <Wallet className="h-3 w-3 text-rose-500 shrink-0" />
                          NPR {centsToDisplay(selectedPatient.balanceDueCents)} due
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200/60 text-[0.68rem]">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                          Settled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedPatient.gender}, {selectedPatient.age} yrs • Phone:{" "}
                      {selectedPatient.phone}
                    </p>
                  </div>
                </div>


                <button
                  onClick={() => setShowNoteDropdown(!showNoteDropdown)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#7da3b3] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] transition-colors"
                >
                  <PlusCircle className="h-4 w-4" /> Add Note
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${showNoteDropdown ? "rotate-180" : ""
                      }`}
                  />
                </button>
              </div>

              {showNoteDropdown && (
                <form
                  onSubmit={handleAddTreatmentNote}
                  className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm space-y-3 transition-all duration-300"
                >
                  <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                    <h4 className="text-xs font-bold text-sky-900">New Clinical Entry</h4>
                    <button
                      type="button"
                      onClick={() => setShowNoteDropdown(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Select Appointment / Procedure
                      </label>
                      {noteableAppts.length > 0 ? (
                        <select
                          required
                          value={selectedAppointmentId}
                          onChange={(e) => setSelectedAppointmentId(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#7da3b3] text-xs font-medium text-slate-800"
                        >
                          {noteableAppts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.treatmentName} ({new Date(a.startTime).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                      ) : selectedPatient.history.length > 0 ? (
                        <select
                          required
                          value={selectedAppointmentId}
                          onChange={(e) => setSelectedAppointmentId(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#7da3b3] text-xs font-medium text-slate-800"
                        >
                          <option value="">Select Appointment</option>
                          {selectedPatient.history.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.service} ({h.date})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 text-[0.75rem] rounded-lg">
                          No appointments found for this patient to attach clinical notes to.
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Clinical Notes & Observations
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#7da3b3]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Prescription / Instructions (Optional)
                      </label>
                      <input
                        type="text"
                        value={newPrescription}
                        onChange={(e) => setNewPrescription(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#7da3b3]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Add Allergies</label>
                        <input
                          type="text"
                          value={newAllergiesInput}
                          onChange={(e) => setNewAllergiesInput(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#7da3b3]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Add Medical History
                        </label>
                        <input
                          type="text"
                          value={newMedicalHistoryInput}
                          onChange={(e) => setNewMedicalHistoryInput(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#7da3b3]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-sky-100">
                    <button
                      type="button"
                      onClick={() => setShowNoteDropdown(false)}
                      className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingNote || (!selectedAppointmentId && noteableAppts.length === 0 && selectedPatient.history.length === 0)}
                      className="rounded-lg bg-[#7da3b3] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSubmittingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Record
                    </button>
                  </div>
                </form>
              )}


              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-amber-50/50 border border-amber-200/60 p-3 space-y-1">
                  <p className="font-bold text-amber-800 flex items-center gap-1.5 text-[0.68rem] uppercase tracking-wider">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Allergies
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedPatient.allergies.length > 0 ? (
                      selectedPatient.allergies.map((allergy, i) => (
                        <span
                          key={i}
                          className="bg-amber-100/80 text-amber-900 font-semibold px-2 py-0.5 rounded text-[0.68rem]"
                        >
                          {allergy}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">No known allergies recorded.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1">
                  <p className="font-bold text-slate-700 flex items-center gap-1.5 text-[0.68rem] uppercase tracking-wider">
                    <Stethoscope className="h-3.5 w-3.5 text-sky-600" /> Medical History
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedPatient.medicalHistory.length > 0 ? (
                      selectedPatient.medicalHistory.map((cond, i) => (
                        <span
                          key={i}
                          className="bg-white text-slate-700 font-semibold border border-slate-200 px-2 py-0.5 rounded text-[0.68rem]"
                        >
                          {cond}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">No pre-existing conditions recorded.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline Section */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-[#7da3b3]" /> Treatment History
                </h4>

                {selectedPatient.history.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No treatment records on file for this patient.
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-100 pl-4 space-y-4 ml-2">
                    {selectedPatient.history.map((record) => (
                      <div key={record.id} className="relative group">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#7da3b3] ring-4 ring-white" />

                        <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Stethoscope className="h-3.5 w-3.5 text-sky-600" /> {record.service}
                            </span>
                            <span className="text-[0.68rem] text-slate-400 font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {record.date}
                            </span>
                          </div>

                          <div>
                            <p className="font-semibold text-slate-500 text-[0.68rem]">
                              Clinical Notes:
                            </p>
                            <p className="text-slate-700 mt-0.5 leading-relaxed">{record.notes}</p>
                          </div>

                          {record.prescription && (
                            <div className="rounded-lg bg-sky-50 border border-sky-100 p-2 mt-2">
                              <p className="font-bold text-sky-900 text-[0.68rem] flex items-center gap-1">
                                <FileText className="h-3 w-3 text-sky-600" /> Prescription:
                              </p>
                              <p className="text-sky-800 mt-0.5 font-medium">{record.prescription}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-16 text-center h-full flex flex-col items-center justify-center min-h-[580px]">
              <FileText className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600">Select a Patient</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Click on any patient row from the directory on the left to view their detailed
                medical history and records.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}