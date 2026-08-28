"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import axios from "axios";
import {
  Search,
  Plus,
  Star,
  MoreVertical,
  User,
  Mail,
  Phone,
  GraduationCap,
  BriefcaseMedical,
  Stethoscope,
  CalendarCheck,
  Users,
  Award,
  TrendingUp,
  TrendingDown,
  ImagePlus,
  Syringe,
  HeartPulse,
  Cross,
  Pill,
  Activity,
  PhoneCall,
  Filter,
  ChevronLeft,
  ChevronRight,
  SquarePen,
  MapPin,
  IdCard,
  Droplet,
  Cake,
  Clock,
  VenusAndMars,
  Trash2,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { uploadConfig, getImageUrl } from "@/lib/cloudinary/storage";
import { RichFormattedTextarea } from "@/components/treatments/RichFormattedTextarea";
import { FormattedContent } from "@/components/treatments/FormattedContent";
import { htmlToCleanMarkdown } from "@/lib/formatters/richText";
import WorkloadConfigCard from "../../organization/doctors/components/WorkloadConfigCard";
import DoctorScheduleEditor from "../../doctor/DoctorScheduleEditor";

const SPECIALIZATIONS: string[] = [];

const SPECIALIZATION_MAP_BACKEND: Record<string, string> = {
  "General Dentistry": "general_dentistry",
  "Orthodontics": "orthodontics",
  "Endodontics": "endodontics",
  "Periodontics": "periodontics",
  "Oral Surgery": "oral_surgery",
  "Pediatric Dentistry": "pediatric_dentistry",
  "Prosthodontics": "prosthodontics",
};

const SPECIALIZATION_MAP_FRONTEND: Record<string, string> = {
  "general_dentistry": "General Dentistry",
  "orthodontics": "Orthodontics",
  "endodontics": "Endodontics",
  "periodontics": "Periodontics",
  "oral_surgery": "Oral Surgery",
  "pediatric_dentistry": "Pediatric Dentistry",
  "prosthodontics": "Prosthodontics",
};

function calculateAgeFromDob(dob?: string | null): string {
  if (!dob) return "";
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? String(age) : "";
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["Female", "Male", "Other"];

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
];

type Doctor = {
  id: string;
  name: string;
  specialization: string;
  experience: string;
  email: string;
  phone: string;
  qualification: string;
  rating: number;
  patients: number;
  imageUrl?: string;
  doctorId?: string;
  age?: string;
  bloodGroup?: string;
  gender?: string;
  dob?: string;
  dateOfBirth?: string;
  address?: string;
  location?: string;
  education?: string[];
  experienceNotes?: string[];
};

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  specialization: "",
  experience: "",
  qualification: "",
  imageUrl: "",
  age: "",
  bloodGroup: BLOOD_GROUPS[0],
  gender: GENDERS[0],
  dob: "",
  address: "",
  education: "",
  experienceNotes: "",
  password: "",
  confirmPassword: "",
};


type FormState = typeof EMPTY_FORM;

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

const textareaClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";


function formatDob(val?: string | null): string {
  if (!val) return "";
  if (val.includes("T")) return val.split("T")[0];
  return val;
}

function doctorToForm(doc: Doctor): FormState {
  const dobVal = formatDob(doc.dob || doc.dateOfBirth);
  const computedAge = calculateAgeFromDob(dobVal);
  return {
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    specialization: doc.specialization,
    experience: doc.experience ?? "",
    qualification: doc.qualification ?? "",
    imageUrl: doc.imageUrl ?? "",
    age: computedAge || doc.age || "",
    bloodGroup: doc.bloodGroup ?? BLOOD_GROUPS[0],
    gender: doc.gender ?? GENDERS[0],
    dob: dobVal,
    address: doc.address ?? "",
    education: (doc.education ?? []).map((e) => htmlToCleanMarkdown(e)).join("\n"),
    experienceNotes: (doc.experienceNotes ?? []).map((e) => htmlToCleanMarkdown(e)).join("\n"),
    password: "",
    confirmPassword: "",
  };
}

function linesToArray(value: string): string[] {
  if (!value) return [];
  const clean = htmlToCleanMarkdown(value);
  if (!clean) return [];

  return clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}


function pickField(raw: any, ...keys: string[]): string {
  for (const key of keys) {
    if (raw?.[key] !== undefined && raw?.[key] !== null && raw?.[key] !== "") {
      return String(raw[key]);
    }
  }
  return "";
}

export default function DoctorsPage() {
  const params = useParams();
  const tenantSlug = typeof params?.tenantSlug === "string" ? params.tenantSlug : "";
  const storageKey = tenantSlug ? `dms_${tenantSlug}_custom_specializations` : "dms_custom_specializations";

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);
  const [query, setQuery] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState("All");
  const [specializationsList, setSpecializationsList] = useState<string[]>(SPECIALIZATIONS);

  useEffect(() => {
    if (typeof window !== "undefined" && storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setSpecializationsList(Array.from(new Set([...SPECIALIZATIONS, ...parsed])));
          }
        }
      } catch (e) {}
    }
  }, [storageKey]);

  const [isAddingSpec, setIsAddingSpec] = useState(false);
  const [newSpecInput, setNewSpecInput] = useState("");

  const handleAddSpecialization = () => {
    const trimmed = newSpecInput.trim();
    if (!trimmed) return;
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!specializationsList.includes(formatted)) {
      const updated = [...specializationsList, formatted];
      setSpecializationsList(updated);
      try {
        const customOnly = updated.filter((s) => !SPECIALIZATIONS.includes(s));
        localStorage.setItem(storageKey, JSON.stringify(customOnly));
      } catch (e) { }
    }
    update("specialization", formatted);
    setIsAddingSpec(false);
    setNewSpecInput("");
  };


  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [profileTab, setProfileTab] = useState<"detail" | "schedule" | "patients" | "appointments">(
    "detail"
  );

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState<number>(0);

  async function loadData() {
    try {
      setLoading(true);

      let locId: string | null = locationId;
      if (!locId) {
        const userRes = await axios.get("/api/user-details").catch(() => null);
        if (userRes?.data?.success && userRes.data.data?.user?.locationId) {
          locId = userRes.data.data.user.locationId;
          setLocationId(locId);
        }
      }

      if (!locId) {
        const servicesRes = await axios.get("/api/services").catch(() => null);
        if (servicesRes?.data?.success && servicesRes.data.data.services?.length > 0) {
          locId = servicesRes.data.data.services[0].locationId;
          setLocationId(locId);
        }
      }


      const [res, apptsRes] = await Promise.all([
        axios.get("/api/doctor", {
          params: locId ? { locationId: locId } : undefined,
        }),
        axios.get("/api/appoments", {
          params: locId ? { locationId: locId } : undefined,
        }).catch(() => null),
      ]);

      if (apptsRes?.data?.success && Array.isArray(apptsRes.data.data?.appointments)) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const count = apptsRes.data.data.appointments.filter((a: any) => {
          if (a.status === "cancelled") return false;
          const aDate = a.date || (a.startTime ? new Date(a.startTime).toISOString().slice(0, 10) : "");
          return aDate === todayStr;
        }).length;
        setTodayAppointmentsCount(count);
      } else {
        setTodayAppointmentsCount(0);
      }

      if (res.data?.success) {
        const dbDoctors = res.data.data?.doctors || [];
        const mapped = dbDoctors.map((d: any, index: number) => {
          const specName = SPECIALIZATION_MAP_FRONTEND[d.specialization] || d.specialization || "General Dentistry";
          if (specName && !SPECIALIZATIONS.includes(specName)) {
            setSpecializationsList((prev) => (prev.includes(specName) ? prev : [...prev, specName]));
          }
          const rawDob = formatDob(pickField(d, "dateOfBirth", "dob", "date_of_birth"));
          const computedAge = calculateAgeFromDob(rawDob);
          return {
            id: d.id,
            name: d.name,
            specialization: specName,
            experience: d.yearsOfExperience !== undefined && d.yearsOfExperience !== null ? String(d.yearsOfExperience) : "0",
            email: d.email,
            phone: d.phone || "",
            qualification: d.qualification || "BDS",
            rating: 5.0,
            patients: d.patientsCheckedUp ?? 0,
            imageUrl: d.photoUrl || undefined,
            doctorId: `DOC-${1000 + index + 1}`,
            age: computedAge || (d.age ? String(d.age) : ""),
            bloodGroup: d.bloodGroup || "O+",
            gender: d.gender || "Female",
            dob: rawDob,
            address: pickField(d, "address", "location", "doctorAddress", "residenceAddress"),
            education: d.education ? [d.education] : [],
            experienceNotes: d.bio ? [d.bio] : [],
          };
        });
        setDoctors(mapped);
      }
    } catch (err) {
      console.error("Failed to load doctors data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedDoctor) return;

    if (profileTab === "appointments") {
      setAppointmentsLoading(true);
      axios.get(`/api/doctor/${selectedDoctor.id}/appointments`)
        .then((res) => {
          if (res.data?.success) {
            setAppointments(res.data.data?.appointments || []);
          }
        })
        .catch((err) => {
          console.error("Failed to load doctor appointments", err);
        })
        .finally(() => {
          setAppointmentsLoading(false);
        });
    } else if (profileTab === "patients") {
      setPatientsLoading(true);
      axios.get(`/api/doctor/${selectedDoctor.id}/patent`)
        .then((res) => {
          if (res.data?.success) {
            setPatients(res.data.data?.visits || []);
          }
        })
        .catch((err) => {
          console.error("Failed to load doctor patients history", err);
        })
        .finally(() => {
          setPatientsLoading(false);
        });
    }
  }, [profileTab, selectedDoctor?.id]);

  async function openProfile(doc: Doctor) {
    setSelectedDoctor(doc);
    setProfileTab("detail");
    setDetailsLoading(true);
    try {
      const res = await axios.get(`/api/doctor/${doc.id}`);
      if (res.data?.success && res.data.data?.doctor) {
        const fullDoc = res.data.data.doctor;
        const dobVal = formatDob(pickField(fullDoc, "dateOfBirth", "dob", "date_of_birth")) || doc.dob;
        const computedAge = calculateAgeFromDob(dobVal);
        const mergedDoc: Doctor = {
          ...doc,
          name: fullDoc.name || doc.name,
          email: fullDoc.email || doc.email,
          phone: fullDoc.phone || doc.phone || "",
          qualification: fullDoc.qualification || doc.qualification || "",
          experience: fullDoc.yearsOfExperience !== undefined && fullDoc.yearsOfExperience !== null ? String(fullDoc.yearsOfExperience) : doc.experience,
          imageUrl: fullDoc.photoUrl || doc.imageUrl,
          education: fullDoc.education ? (typeof fullDoc.education === "string" ? fullDoc.education.split("\n") : fullDoc.education) : (doc.education || []),
          experienceNotes: fullDoc.bio ? (typeof fullDoc.bio === "string" ? fullDoc.bio.split("\n") : fullDoc.bio) : (doc.experienceNotes || []),
          age: computedAge || fullDoc.age || doc.age,
          bloodGroup: fullDoc.bloodGroup || doc.bloodGroup,
          gender: fullDoc.gender || doc.gender,
          dob: dobVal,
          address: pickField(fullDoc, "address", "location", "doctorAddress", "residenceAddress") || doc.address,
        };
        setSelectedDoctor((prev) => (prev && prev.id === doc.id ? mergedDoc : prev));
        setDoctors((prev) => prev.map((d) => (d.id === doc.id ? mergedDoc : d)));
      }
    } catch (err) {
      console.error("Failed to load doctor details", err);
    } finally {
      setDetailsLoading(false);
    }
  }

  function openAddModal() {
    setModalMode("add");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSubmitError(null);
    setModalOpen(true);
  }

  async function openEditModal(doc: Doctor) {
    setModalMode("edit");
    setEditingId(doc.id);
    setForm(doctorToForm(doc));
    setImageFile(null);
    setImagePreview(doc.imageUrl || null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSubmitError(null);
    setModalOpen(true);

    try {
      const res = await axios.get(`/api/doctor/${doc.id}`);
      if (res.data?.success && res.data.data?.doctor) {
        const fullDoc = res.data.data.doctor;
        const dobVal = formatDob(pickField(fullDoc, "dateOfBirth", "dob", "date_of_birth")) || doc.dob;
        const computedAge = calculateAgeFromDob(dobVal);
        const mergedDoc: Doctor = {
          ...doc,
          name: fullDoc.name || doc.name,
          email: fullDoc.email || doc.email,
          phone: fullDoc.phone || doc.phone || "",
          qualification: fullDoc.qualification || doc.qualification || "",
          experience: fullDoc.yearsOfExperience !== undefined && fullDoc.yearsOfExperience !== null ? String(fullDoc.yearsOfExperience) : doc.experience,
          imageUrl: fullDoc.photoUrl || doc.imageUrl,
          education: fullDoc.education ? (typeof fullDoc.education === "string" ? fullDoc.education.split("\n") : fullDoc.education) : (doc.education || []),
          experienceNotes: fullDoc.bio ? (typeof fullDoc.bio === "string" ? fullDoc.bio.split("\n") : fullDoc.bio) : (doc.experienceNotes || []),
          age: computedAge || fullDoc.age || doc.age,
          bloodGroup: fullDoc.bloodGroup || doc.bloodGroup,
          gender: fullDoc.gender || doc.gender,
          dob: dobVal,
          address: pickField(fullDoc, "address", "location", "doctorAddress", "residenceAddress") || doc.address,
        };
        setForm(doctorToForm(mergedDoc));
        setImagePreview(mergedDoc.imageUrl || null);
        setDoctors((prev) => prev.map((d) => (d.id === doc.id ? mergedDoc : d)));
      }
    } catch (err) {
      console.error("Failed to load doctor details for edit", err);
    }
  }


  function requestDeleteDoctor(doc: Doctor) {
    setDoctorToDelete(doc);
  }


  async function confirmDeleteDoctor() {
    if (!doctorToDelete) return;
    const doc = doctorToDelete;

    setDeletingId(doc.id);
    try {
      const res = await axios.delete(`/api/doctor/${doc.id}`);
      if (res.data?.success) {
        setDoctors((prev) => prev.filter((d) => d.id !== doc.id));
        setSelectedDoctor((prev) => (prev?.id === doc.id ? null : prev));
      }
    } catch (err) {
      console.error("Error deleting doctor:", err);
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || "Failed to delete doctor.");
      } else {
        alert("An unexpected error occurred while deleting.");
      }
    } finally {
      setDeletingId(null);
      setDoctorToDelete(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doctors.filter((d) => {
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q);
      const matchesSpecialization =
        specializationFilter === "All" || d.specialization === specializationFilter;
      return matchesQuery && matchesSpecialization;
    });
  }, [doctors, query, specializationFilter]);


  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDoctors = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const avgRating = useMemo(() => {
    if (doctors.length === 0) return 0;
    return doctors.reduce((sum, d) => sum + d.rating, 0) / doctors.length;
  }, [doctors]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "dob") {
        updated.age = calculateAgeFromDob(value);
      }
      return updated;
    });
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (modalMode === "add") {
      if (!form.password || form.password.length < 8) {
        setSubmitError("Password must be at least 8 characters.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setSubmitError("Password and confirmation do not match.");
        return;
      }
    }

    setSubmitting(true);

    let uploadedPhotoKey: string | undefined = undefined;
    if (imageFile) {
      setUploadingImage(true);
      try {
        if (uploadConfig.cloudinary.cloudName && uploadConfig.cloudinary.uploadPreset) {
          const formData = new FormData();
          formData.append("file", imageFile);
          formData.append("upload_preset", uploadConfig.cloudinary.uploadPreset);
          formData.append("folder", "dental/doctors");

          const cloudinaryRes = await axios.post(
            `https://api.cloudinary.com/v1_1/${uploadConfig.cloudinary.cloudName}/image/upload`,
            formData
          );
          uploadedPhotoKey = cloudinaryRes.data.public_id;
        }
      } catch (uploadErr) {
        console.error("Cloudinary upload failed:", uploadErr);
      } finally {
        setUploadingImage(false);
      }
    }

    const { education, experienceNotes, ...rest } = form;
    const educationList = linesToArray(education);
    const experienceNotesList = linesToArray(experienceNotes);

    try {
      if (modalMode === "edit" && editingId) {

        const payload: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          specialization: SPECIALIZATION_MAP_BACKEND[form.specialization] || form.specialization || "General Dentistry",
          qualification: form.qualification,
          yearsOfExperience: parseInt(form.experience, 10) || 0,
        };

        if (uploadedPhotoKey) payload.photoKey = uploadedPhotoKey;
        if (educationList.length > 0) payload.education = educationList.join("\n");
        if (experienceNotesList.length > 0) payload.bio = experienceNotesList.join("\n");
        if (form.dob) payload.dateOfBirth = form.dob;
        if (form.bloodGroup) payload.bloodGroup = form.bloodGroup;
        if (form.gender) payload.gender = form.gender;
        if (form.address) payload.address = form.address;

        const res = await axios.patch(`/api/doctor/${editingId}`, payload);

        if (res.data?.success) {
          const updatedDocPhoto = res.data.data?.doctor?.photoUrl || (uploadedPhotoKey ? getImageUrl(uploadedPhotoKey, { width: 400, height: 300 }) : undefined);
          setDoctors((prev) =>
            prev.map((d) =>
              d.id === editingId
                ? {
                  ...d,
                  ...rest,
                  experience: form.experience,
                  imageUrl: updatedDocPhoto || d.imageUrl,
                  education: educationList,
                  experienceNotes: experienceNotesList,
                }
                : d
            )
          );
          setSelectedDoctor((prev) =>
            prev && prev.id === editingId
              ? {
                ...prev,
                ...rest,
                experience: form.experience,
                imageUrl: updatedDocPhoto || prev.imageUrl,
                education: educationList,
                experienceNotes: experienceNotesList,
              }
              : prev
          );
        }
      } else {
        if (!locationId) {
          setSubmitError("Could not determine location ID. Please configure services first.");
          setSubmitting(false);
          return;
        }

        const payload: Record<string, unknown> = {
          locationId,
          name: form.name,
          email: form.email,
          password: form.password,
          specialization: SPECIALIZATION_MAP_BACKEND[form.specialization] || form.specialization || "General Dentistry",
          yearsOfExperience: parseInt(form.experience, 10) || 0,
          employmentType: "full_time",
        };


        if (form.phone.trim()) payload.phone = form.phone.trim();
        if (uploadedPhotoKey) payload.photoKey = uploadedPhotoKey;
        if (form.qualification) payload.qualification = form.qualification;
        if (educationList.length > 0) payload.education = educationList.join("\n");
        if (experienceNotesList.length > 0) payload.bio = experienceNotesList.join("\n");
        if (form.dob) payload.dateOfBirth = form.dob;
        if (form.bloodGroup) payload.bloodGroup = form.bloodGroup;
        if (form.gender) payload.gender = form.gender;
        if (form.address) payload.address = form.address;

        const res = await axios.post("/api/doctor", payload);
        if (res.data?.success) {
          const newDoc = res.data.data.doctor;
          setDoctors((prev) => [
            {
              id: newDoc.id,
              rating: 5,
              patients: 0,
              doctorId: `DOC-${1000 + prev.length + 1}`,
              name: newDoc.name,
              email: newDoc.email,
              phone: form.phone,
              specialization: form.specialization,
              experience: form.experience,
              qualification: form.qualification,
              imageUrl: newDoc.photoUrl || (uploadedPhotoKey ? getImageUrl(uploadedPhotoKey, { width: 400, height: 300 }) : undefined),
              age: calculateAgeFromDob(form.dob) || form.age,
              bloodGroup: form.bloodGroup,
              gender: form.gender,
              dob: form.dob,
              address: form.address,
              education: educationList,
              experienceNotes: experienceNotesList,
            },
            ...prev,
          ]);
          setCurrentPage(1);
        }
      }

      setForm(EMPTY_FORM);
      setImageFile(null);
      setImagePreview(null);
      setEditingId(null);
      setSubmitError(null);
      setModalOpen(false);
    } catch (err) {
      console.error("Error submitting doctor:", err);
      if (axios.isAxiosError(err)) {
        setSubmitError(err.response?.data?.error || "An error occurred. Please try again.");
      } else {
        setSubmitError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const totalPatients = doctors.reduce((acc, d) => acc + (d.patients || 0), 0);
  const activeSpecializations = new Set(doctors.map((d) => d.specialization).filter(Boolean)).size;

  const stats = [
    {
      icon: Stethoscope,
      label: "Total Doctors",
      value: String(doctors.length),
    },
    {
      icon: CalendarCheck,
      label: "Appointments Today",
      value: String(todayAppointmentsCount),
    },
    {
      icon: Users,
      label: "Total Patients Served",
      value: totalPatients.toLocaleString(),
    },
    {
      icon: Award,
      label: "Specializations",
      value: String(activeSpecializations),
    },
  ];

  const formatDOB = (dobStr?: string) => {
    if (!dobStr) return "—";
    const date = new Date(dobStr);
    return isNaN(date.getTime()) ? dobStr : date.toLocaleDateString();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">



      <div className="sticky top-0 z-20 w-full border-b border-slate-100 bg-white px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
            Doctors
          </h1>

        
        </div>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6 lg:px-10">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            return (
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
            );
          })}
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
                  placeholder="Search doctors..."
                  className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={specializationFilter}
                  onChange={(e) => {
                    setSpecializationFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                >
                  <option value="All">All specializations</option>
                  {specializationsList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 rounded-full bg-[#749fb1] px-5 py-2.5 text-[0.9rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263]"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Add Doctor
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
            {loading ? (
              <div className="col-span-full py-16 text-center text-slate-500">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-[#7da3b3]" />
                <p className="mt-4 text-[0.9rem]">Loading doctors...</p>
              </div>
            ) : (
              paginatedDoctors.map((doc, i) => {
                const initials = doc.name
                  .replace("Dr.", "")
                  .trim()
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];

                return (
                  <div
                    key={doc.id}
                    onClick={() => openProfile(doc)}
                    className="group cursor-pointer rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#7da3b3]/30 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      {doc.imageUrl ? (
                        <div className="relative h-16 w-16 overflow-hidden rounded-full ring-4 ring-slate-50">
                          <Image
                            src={doc.imageUrl}
                            alt={doc.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`flex h-16 w-16 items-center justify-center rounded-full text-[1.05rem] font-semibold ring-4 ring-slate-50 ${color}`}
                        >
                          {initials}
                        </div>
                      )}
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(doc);
                          }}
                          aria-label="Edit doctor"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-[#3f6274]"
                        >
                          <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteDoctor(doc);
                          }}
                          disabled={deletingId === doc.id}
                          aria-label="Delete doctor"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    <p className="mt-4 text-[1.02rem] font-semibold text-slate-900">{doc.name}</p>

                    <span className="mt-2 inline-flex items-center rounded-full bg-[#7da3b3]/10 px-2.5 py-1 text-[0.75rem] font-medium text-[#3f6274]">
                      {doc.specialization}
                    </span>

                    <div className="mt-3 flex items-center gap-1.5 text-[0.8rem] text-slate-500">
                      <BriefcaseMedical className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {doc.experience} years experience
                    </div>

                    <div className="mt-4 flex items-center justify-end border-t border-slate-900/5 pt-4">
                      <p className="text-[0.8rem] text-slate-500">{doc.patients} patients</p>
                    </div>
                  </div>
                );
              })
            )}

            {filtered.length === 0 && !loading && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-900/15 bg-white py-16 text-center text-slate-500">
                No doctors match your filters.
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {!loading && filtered.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
              <span className="text-[0.7rem] text-slate-500 font-medium">
                Showing{" "}
                <strong className="text-slate-800">{startIndex + 1}</strong>{" "}
                to{" "}
                <strong className="text-slate-800">
                  {Math.min(startIndex + itemsPerPage, filtered.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filtered.length}</strong> doctors
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
          <div
            onClick={() => setModalOpen(false)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setModalOpen(false)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>

            </div>

            <div className="px-6 py-6">
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="flex items-center gap-4">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
                    {(imagePreview || form.imageUrl) ? (
                      <Image
                        src={imagePreview || form.imageUrl}
                        alt="Doctor preview"
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
                    <User className="h-3.5 w-3.5" strokeWidth={2} />
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
                      placeholder="e.g. 9812345678"
                      maxLength={10}
                      className={inputClass}
                    />
                  </label>
                </div>



                <div className="grid grid-cols-2 gap-4">
                  <div className="block">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                        <Stethoscope className="h-3.5 w-3.5" strokeWidth={2} />
                        Specialization
                      </span>
                      {!isAddingSpec && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingSpec(true);
                            setNewSpecInput("");
                          }}
                          className="cursor-pointer text-[0.75rem] font-medium text-[#3f6274] hover:underline"
                        >
                          + Add new
                        </button>
                      )}
                    </div>
                    {isAddingSpec ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="e.g. Implantology"
                          value={newSpecInput}
                          onChange={(e) => setNewSpecInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddSpecialization();
                            }
                          }}
                          autoFocus
                          className={`${inputClass} !py-2 text-xs`}
                        />
                        <button
                          type="button"
                          onClick={handleAddSpecialization}
                          className="shrink-0 rounded-xl bg-[#7da3b3] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#345263]"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingSpec(false)}
                          className="shrink-0 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <select
                        value={form.specialization}
                        onChange={(e) => {
                          if (e.target.value === "__add_new__") {
                            setIsAddingSpec(true);
                            setNewSpecInput("");
                          } else {
                            update("specialization", e.target.value);
                          }
                        }}
                        className={inputClass}
                      >
                        <option value="">Select specialization...</option>
                        {specializationsList.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        <option value="__add_new__">+ Add new specialization...</option>
                      </select>
                    )}
                  </div>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <BriefcaseMedical className="h-3.5 w-3.5" strokeWidth={2} />
                      Years of experience
                    </span>
                    <input
                      required
                      type="number"
                      min={0}
                      placeholder="e.g. 5"
                      value={form.experience}
                      onChange={(e) => update("experience", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <GraduationCap className="h-3.5 w-3.5" strokeWidth={2} />
                    Qualification
                  </span>
                  <input
                    required
                    type="text"
                    value={form.qualification}
                    onChange={(e) => update("qualification", e.target.value)}

                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Cake className="h-3.5 w-3.5" strokeWidth={2} />
                    Date of birth
                  </span>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(e) => update("dob", e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className={inputClass}
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Droplet className="h-3.5 w-3.5" strokeWidth={2} />
                      Blood group
                    </span>
                    <select
                      value={form.bloodGroup}
                      onChange={(e) => update("bloodGroup", e.target.value)}
                      className={inputClass}
                    >
                      {BLOOD_GROUPS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </label>
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
                </div>

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

                <RichFormattedTextarea
                  label="Education"
                  icon={<GraduationCap className="h-3.5 w-3.5" strokeWidth={2} />}
                  value={form.education}
                  onChange={(val) => update("education", val)}
                  helperText="Qualifications, degrees, medical colleges"
                />

                <RichFormattedTextarea
                  label="Experience notes / Bio"
                  icon={<BriefcaseMedical className="h-3.5 w-3.5" strokeWidth={2} />}
                  value={form.experienceNotes}
                  onChange={(val) => update("experienceNotes", val)}
                  helperText="Doctor bio, past positions, clinical experience"
                />
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

                {submitError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.85rem] text-rose-700">
                    {submitError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting || uploadingImage}
                    className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting || uploadingImage ? "Saving..." : modalMode === "edit" ? "Save Changes" : "Add Doctor"}
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

      {/* Doctor profile side panel */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div
            onClick={() => setSelectedDoctor(null)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedDoctor(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <button
                onClick={() => requestDeleteDoctor(selectedDoctor)}
                disabled={deletingId === selectedDoctor.id}
                aria-label="Delete doctor"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete
              </button>
            </div>

            <div className="px-6 py-6">
              {/* Identity */}
              <div className="flex items-start gap-4">
                {selectedDoctor.imageUrl ? (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-4 ring-white">
                    <Image
                      src={selectedDoctor.imageUrl}
                      alt={selectedDoctor.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[1.3rem] font-semibold text-[#3f6274] ring-4 ring-white">
                    {selectedDoctor.name
                      .replace("Dr.", "")
                      .trim()
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}

                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedDoctor.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.85rem] text-slate-500">
                    <span>{selectedDoctor.specialization}</span>
                    <span className="text-slate-300">|</span>
                    <span>{selectedDoctor.experience} years experience</span>
                  </div>

                  <div className="mt-3 space-y-1 text-[0.85rem] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedDoctor.address || selectedDoctor.location || "Address not provided"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedDoctor.phone}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                      {selectedDoctor.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-6 flex items-center gap-6 border-b border-slate-900/10">
                {(
                  [
                    { key: "detail", label: "Detail Information" },
                    { key: "schedule", label: "Working Hours & Breaks" },
                    { key: "patients", label: "Patient History" },
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

              {/* Tab content */}
              {profileTab === "detail" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  {detailsLoading ? (
                    <div className="py-10 text-center text-slate-500">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#7da3b3]" />
                      <p className="mt-2 text-[0.8rem]">Loading details...</p>
                    </div>
                  ) : (
                    <>
                      <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                        Doctor Information
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-y-4 text-[0.85rem]">
                        <div>
                          <p className="flex items-center gap-1.5 text-slate-400">
                            <IdCard className="h-3.5 w-3.5" strokeWidth={2} />
                            Doctor ID
                          </p>
                          <p className="mt-1 font-medium text-slate-800">
                            {selectedDoctor.doctorId ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-slate-400">
                            <User className="h-3.5 w-3.5" strokeWidth={2} />
                            Age
                          </p>
                          <p className="mt-1 font-medium text-slate-800">
                            {selectedDoctor.age || calculateAgeFromDob(selectedDoctor.dob || selectedDoctor.dateOfBirth)
                              ? `${selectedDoctor.age || calculateAgeFromDob(selectedDoctor.dob || selectedDoctor.dateOfBirth)} Years Old`
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-slate-400">
                            <Droplet className="h-3.5 w-3.5" strokeWidth={2} />
                            Blood Group
                          </p>
                          <p className="mt-1 font-medium text-slate-800">
                            {selectedDoctor.bloodGroup ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-slate-400">
                            <VenusAndMars className="h-3.5 w-3.5" strokeWidth={2} />
                            Gender
                          </p>
                          <p className="mt-1 font-medium text-slate-800">
                            {selectedDoctor.gender ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-slate-400">
                            <Cake className="h-3.5 w-3.5" strokeWidth={2} />
                            Date of Birth
                          </p>
                          <p className="mt-1 font-medium text-slate-800">
                            {formatDOB(selectedDoctor.dob || selectedDoctor.dateOfBirth)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-slate-900/5 pt-5">
                        <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                          Education
                        </p>
                        <div className="mt-3">
                          <FormattedContent
                            content={
                              selectedDoctor.education && selectedDoctor.education.length > 0
                                ? selectedDoctor.education.join("\n")
                                : selectedDoctor.qualification || "—"
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-6 border-t border-slate-900/5 pt-5">
                        <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                          Experience
                        </p>
                        <div className="mt-3">
                          <FormattedContent
                            content={
                              selectedDoctor.experienceNotes && selectedDoctor.experienceNotes.length > 0
                                ? selectedDoctor.experienceNotes.join("\n")
                                : `${selectedDoctor.experience} years of experience in ${selectedDoctor.specialization.toLowerCase()}`
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {profileTab === "schedule" && selectedDoctor && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <DoctorScheduleEditor
                    doctorId={selectedDoctor.id}
                    doctorName={selectedDoctor.name}
                    compact={true}
                    onSaveSuccess={() => openProfile(selectedDoctor)}
                  />
                </div>
              )}

              {profileTab === "patients" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900 mb-4">
                    Patient History
                  </p>
                  {patientsLoading ? (
                    <div className="py-12 text-center text-slate-500">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#7da3b3]" />
                      <p className="mt-2 text-[0.8rem]">Loading patient history...</p>
                    </div>
                  ) : patients.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-900/15 bg-white py-12 text-center text-[0.85rem] text-slate-500">
                      No patient history recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {patients.map((visit: any, index: number) => (
                        <div key={visit.appointmentId || index} className="flex items-center justify-between p-3 rounded-xl border border-slate-900/5 hover:bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7da3b3]/10 text-[#3f6274] font-medium text-[0.9rem]">
                              {visit.patientName ? visit.patientName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "P"}
                            </div>
                            <div>
                              <p className="text-[0.9rem] font-semibold text-slate-800">{visit.patientName}</p>
                              <p className="text-[0.75rem] text-slate-500">{visit.treatmentName}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[0.8rem] text-slate-600 font-medium">
                              {visit.startTime ? new Date(visit.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "—"}
                            </p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium capitalize mt-1 ${visit.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                              visit.status === "pending" || visit.status === "scheduled" ? "bg-amber-100 text-amber-700" :
                                "bg-rose-100 text-rose-700"
                              }`}>
                              {visit.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {profileTab === "appointments" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900 mb-4">
                    Appointment History
                  </p>
                  {appointmentsLoading ? (
                    <div className="py-12 text-center text-slate-500">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#7da3b3]" />
                      <p className="mt-2 text-[0.8rem]">Loading appointment history...</p>
                    </div>
                  ) : appointments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-900/15 bg-white py-12 text-center text-[0.85rem] text-slate-500">
                      No appointment history recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {appointments.map((appt: any, index: number) => {
                        const apptDate = appt.startTime ? new Date(appt.startTime) : null;
                        const timeStr = apptDate ? apptDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : "";
                        const dateStr = apptDate ? apptDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "";
                        return (
                          <div key={appt.id || index} className="flex items-center justify-between p-3 rounded-xl border border-slate-900/5 hover:bg-slate-50/50">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7da3b3]/10 text-[#3f6274] font-medium text-[0.9rem]">
                                {appt.patientName ? appt.patientName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "P"}
                              </div>
                              <div>
                                <p className="text-[0.9rem] font-semibold text-slate-800">{appt.patientName}</p>
                                <p className="text-[0.75rem] text-slate-500">{appt.treatmentName}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[0.8rem] text-slate-600 font-medium">
                                {dateStr} at {timeStr}
                              </p>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium capitalize mt-1 ${appt.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                                appt.status === "pending" || appt.status === "scheduled" ? "bg-amber-100 text-amber-700" :
                                  "bg-rose-100 text-rose-700"
                                }`}>
                                {appt.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {doctorToDelete && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 sm:items-center">
          <div
            onClick={() => !deletingId && setDoctorToDelete(null)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-t-2xl bg-white p-6 text-center shadow-2xl sm:rounded-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <Trash2 className="h-5 w-5" strokeWidth={2} />
            </div>

            <h3 className="mt-4 text-[1.05rem] font-semibold text-slate-900">
              Do you want to remove {doctorToDelete.name}?
            </h3>


            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={confirmDeleteDoctor}
                disabled={deletingId === doctorToDelete.id}
                className="flex-1 rounded-full bg-rose-500 px-5 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deletingId === doctorToDelete.id ? "Removing..." : "Remove"}
              </button>
              <button
                type="button"
                onClick={() => setDoctorToDelete(null)}
                disabled={deletingId === doctorToDelete.id}
                className="flex-1 rounded-full border border-slate-900/10 px-5 py-2.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
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