"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Search,
  Plus,
  Stethoscope,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  Syringe,
  Clock,
  Layers,
  ShieldCheck,
  Banknote,
  Timer,
  ClipboardList,
  ListChecks,
  Tag,
  Trash2,
  X,
  UploadCloud,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  SquarePen,
  IdCard,
  Filter,
} from "lucide-react";
import { uploadConfig, getImageUrl } from "@/lib/cloudinary/storage";
import { RichFormattedTextarea } from "@/components/treatments/RichFormattedTextarea";
import { FormattedContent } from "@/components/treatments/FormattedContent";

const CATEGORIES: string[] = [];

const ANESTHESIA_OPTIONS = ["None", "Local", "Sedation", "General"];

const CATEGORY_COLORS: Record<string, string> = {
  Preventive: "bg-emerald-100 text-emerald-700",
  Restorative: "bg-sky-100 text-sky-700",
  Cosmetic: "bg-violet-100 text-violet-700",
  Orthodontic: "bg-amber-100 text-amber-700",
  Surgical: "bg-rose-100 text-rose-700",
  Pediatric: "bg-teal-100 text-teal-700",
};

type Treatment = {
  id: string;
  name: string;
  category: string;
  duration: string;
  price: number;
  description: string;
  treatmentId?: string;
  sessions?: string;
  recoveryTime?: string;
  anesthesia?: string;
  createdDate?: string;
  procedureSteps?: string[];
  aftercare?: string[];
  imageUrl?: string;
  locationId?: string;
};

const EMPTY_FORM = {
  name: "",
  category: "",
  duration: "",
  price: "",
  description: "",
  sessions: "",
  recoveryTime: "",
  anesthesia: ANESTHESIA_OPTIONS[0],
  procedureSteps: "",
  aftercare: "",
  imageUrl: "",
};

type FormState = typeof EMPTY_FORM;

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

import { htmlToCleanMarkdown } from "@/lib/formatters/richText";

const textareaClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

function treatmentToForm(t: Treatment): FormState {
  const formatArrayForEditor = (arr?: string[]) => {
    if (!arr || arr.length === 0) return "";
    return arr
      .map((item) => {
        if (!item) return "";
        const clean = htmlToCleanMarkdown(item);
        return clean.startsWith("- ") || clean.startsWith("* ") ? clean : `- ${clean}`;
      })
      .filter(Boolean)
      .join("\n");
  };

  return {
    name: t.name,
    category: t.category,
    duration: t.duration,
    price: String(t.price),
    description: htmlToCleanMarkdown(t.description || ""),
    sessions: t.sessions ?? "",
    recoveryTime: t.recoveryTime ?? "",
    anesthesia: t.anesthesia ?? ANESTHESIA_OPTIONS[0],
    procedureSteps: formatArrayForEditor(t.procedureSteps),
    aftercare: formatArrayForEditor(t.aftercare),
    imageUrl: t.imageUrl ?? "",
  };
}

function linesToArray(value: string): string[] {
  if (!value) return [];
  const clean = htmlToCleanMarkdown(value);
  if (!clean) return [];

  return clean
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "").trim())
    .filter((line) => line.length > 0);
}

export default function AdminTreatmentsPage() {
  const params = useParams();
  const tenantSlug = typeof params?.tenantSlug === "string" ? params.tenantSlug : "";
  const storageKey = tenantSlug ? `dms_${tenantSlug}_custom_treatment_categories` : "dms_custom_treatment_categories";

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Treatment | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [categoriesList, setCategoriesList] = useState<string[]>(CATEGORIES);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const cleanCustom = parsed.filter(
              (c: string) =>
                typeof c === "string" &&
                c.trim().toLowerCase() !== "mm" &&
                c.trim().length > 0
            );
            localStorage.setItem(storageKey, JSON.stringify(cleanCustom));
            setCategoriesList(Array.from(new Set([...CATEGORIES, ...cleanCustom])));
          }
        }
      } catch (e) {}
    }
  }, [storageKey]);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const handleAddCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed || trimmed.toLowerCase() === "mm") return;
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!categoriesList.includes(formatted)) {
      const updated = [...categoriesList, formatted];
      setCategoriesList(updated);
      try {
        const customOnly = updated.filter((c) => !CATEGORIES.includes(c));
        localStorage.setItem(storageKey, JSON.stringify(customOnly));
      } catch (e) {}
    }
    update("category", formatted);
    setIsAddingCategory(false);
    setNewCategoryInput("");
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [profileTab, setProfileTab] = useState<"detail" | "procedure" | "aftercare">("detail");
  const [todayBookingsCount, setTodayBookingsCount] = useState<number>(0);

  async function loadData() {
    try {
      setLoading(true);

      // Resolve the outlet location assigned to this admin/manager
      let locId = locationId;
      if (!locId) {
        const outletsRes = await axios.get("/api/outlets").catch(() => null);
        if (outletsRes?.data?.success && Array.isArray(outletsRes.data.data?.locations) && outletsRes.data.data.locations.length > 0) {
          locId = outletsRes.data.data.locations[0].id;
          setLocationId(locId);
        } else {
          const servicesRes = await axios.get("/api/services").catch(() => null);
          if (servicesRes?.data?.success && servicesRes.data.data?.services?.length > 0) {
            locId = servicesRes.data.data.services[0].locationId;
            setLocationId(locId);
          }
        }
      }

      // Fetch treatments and appointments for this outlet
      const [treatmentsRes, apptsRes] = await Promise.all([
        axios.get("/api/treatment", { params: locId ? { locationId: locId } : undefined }),
        axios.get("/api/appoments", { params: locId ? { locationId: locId } : undefined }).catch(() => null),
      ]);

      if (apptsRes?.data?.success && Array.isArray(apptsRes.data.data?.appointments)) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const count = apptsRes.data.data.appointments.filter((a: any) => {
          if (a.status === "cancelled") return false;
          const aDate = a.date || (a.startTime ? new Date(a.startTime).toISOString().slice(0, 10) : "");
          return aDate === todayStr;
        }).length;
        setTodayBookingsCount(count);
      } else {
        setTodayBookingsCount(0);
      }

      if (treatmentsRes.data?.success) {
        const dbTreatments = treatmentsRes.data.data.treatments || [];
        const mapped = dbTreatments.map((t: any, index: number) => {
          const rawCat = (t.category || "").trim();
          const catName =
            rawCat.toLowerCase() === "mm"
              ? ""
              : CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ||
                (rawCat ? rawCat.charAt(0).toUpperCase() + rawCat.slice(1) : "");
          if (catName && !CATEGORIES.includes(catName) && catName.toLowerCase() !== "mm") {
            setCategoriesList((prev) => (prev.includes(catName) ? prev : [...prev, catName]));
          }
          return {
            id: t.id,
            locationId: t.locationId,
            name: t.name,
            category: catName,
            duration: `${t.durationMinutes} mins`,
            price: t.priceCents / 100,
            description: t.description || "",
            treatmentId: `TRT-${1000 + index + 1}`,
            sessions: String(t.sessions || 1),
            recoveryTime: t.recoveryTime || "",
            anesthesia: t.anesthesia ? t.anesthesia.charAt(0).toUpperCase() + t.anesthesia.slice(1) : "None",
            imageUrl: t.imageUrl || undefined,
            procedureSteps: t.procedureSteps || [],
            aftercare: t.aftercareInstructions || [],
          };
        });
        setTreatments(mapped);
      }
    } catch (err) {
      console.error("Failed to load treatments data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openProfile(t: Treatment) {
    setSelectedTreatment(t);
    setProfileTab("detail");
  }

  function openAddModal() {
    setModalMode("add");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setModalOpen(true);
  }

  function openEditModal(t: Treatment) {
    setModalMode("edit");
    setEditingId(t.id);
    setForm(treatmentToForm(t));
    setImageFile(null);
    setModalOpen(true);
  }

  function requestDeleteTreatment(t: Treatment) {
    setDeleteTarget(t);
  }

  async function confirmDeleteTreatment() {
    if (!deleteTarget) return;
    const t = deleteTarget;

    setDeletingId(t.id);
    try {
      const res = await axios.delete(`/api/treatment/${t.id}`);
      if (res.data?.success) {
        setTreatments((prev) => prev.filter((x) => x.id !== t.id));
        setSelectedTreatment((prev) => (prev?.id === t.id ? null : prev));
      }
    } catch (err) {
      console.error("Error deleting treatment:", err);
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || "Failed to delete treatment.");
      } else {
        alert("An unexpected error occurred while deleting.");
      }
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return treatments.filter((t) => {
      const matchesQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "All" || t.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [treatments, query, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTreatments = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const avgPrice = useMemo(() => {
    if (treatments.length === 0) return 0;
    return treatments.reduce((sum, t) => sum + t.price, 0) / treatments.length;
  }, [treatments]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let resolvedLocationId = locationId;
    if (!resolvedLocationId && modalMode === "add") {
      const outletsRes = await axios.get("/api/outlets").catch(() => null);
      if (outletsRes?.data?.success && Array.isArray(outletsRes.data.data?.locations) && outletsRes.data.data.locations.length > 0) {
        resolvedLocationId = outletsRes.data.data.locations[0].id;
        setLocationId(resolvedLocationId);
      }
    }

    let uploadedPhotoKey: string | undefined = undefined;
    if (imageFile) {
      setUploadingImage(true);
      try {
        if (uploadConfig.cloudinary.cloudName && uploadConfig.cloudinary.uploadPreset) {
          const formData = new FormData();
          formData.append("file", imageFile);
          formData.append("upload_preset", uploadConfig.cloudinary.uploadPreset);
          formData.append("folder", "dental/treatments");

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

    const { procedureSteps, aftercare, price, imageUrl, ...rest } = form;
    const procedureList = linesToArray(procedureSteps);
    const aftercareList = linesToArray(aftercare);
    const priceNumber = Number(price) || 0;

    const durationVal = parseInt(form.duration.replace(/\D/g, ""), 10) || 30;
    const priceVal = Math.round(priceNumber * 100);
    const sessionsVal = parseInt(form.sessions, 10) || 1;
    const anesthesiaVal = form.anesthesia.toLowerCase();

    try {
      if (modalMode === "edit" && editingId) {
        const payload: Record<string, unknown> = {
          name: form.name,
          category: form.category.trim(),
          durationMinutes: durationVal,
          priceCents: priceVal,
          sessions: sessionsVal,
          anesthesia: anesthesiaVal,
          recoveryTime: form.recoveryTime || null,
          description: form.description || null,
          procedureSteps: procedureList,
          aftercareInstructions: aftercareList,
        };

        if (uploadedPhotoKey) {
          payload.photoKey = uploadedPhotoKey;
        } else if (imageUrl !== undefined) {
          payload.imageUrl = imageUrl || null;
        }

        const res = await axios.patch(`/api/treatment/${editingId}`, payload);
        if (res.data?.success) {
          const updatedTreatment = res.data.data.treatment;
          const displayCat =
            CATEGORIES.find((c) => c.toLowerCase() === (updatedTreatment.category || "").toLowerCase()) ||
            updatedTreatment.category;
          const newImgUrl =
            updatedTreatment.imageUrl ||
            (uploadedPhotoKey ? getImageUrl(uploadedPhotoKey, { width: 400, height: 300 }) : form.imageUrl);

          setTreatments((prev) =>
            prev.map((t) =>
              t.id === editingId
                ? {
                    ...t,
                    name: updatedTreatment.name,
                    category: displayCat,
                    duration: `${updatedTreatment.durationMinutes} mins`,
                    price: updatedTreatment.priceCents / 100,
                    description: updatedTreatment.description || "",
                    sessions: String(updatedTreatment.sessions || 1),
                    recoveryTime: updatedTreatment.recoveryTime || "",
                    anesthesia: updatedTreatment.anesthesia
                      ? updatedTreatment.anesthesia.charAt(0).toUpperCase() + updatedTreatment.anesthesia.slice(1)
                      : "None",
                    imageUrl: newImgUrl || undefined,
                    procedureSteps: updatedTreatment.procedureSteps || [],
                    aftercare: updatedTreatment.aftercareInstructions || [],
                  }
                : t
            )
          );

          setSelectedTreatment((prev) =>
            prev && prev.id === editingId
              ? {
                  ...prev,
                  name: updatedTreatment.name,
                  category: displayCat,
                  duration: `${updatedTreatment.durationMinutes} mins`,
                  price: updatedTreatment.priceCents / 100,
                  description: updatedTreatment.description || "",
                  sessions: String(updatedTreatment.sessions || 1),
                  recoveryTime: updatedTreatment.recoveryTime || "",
                  anesthesia: updatedTreatment.anesthesia
                    ? updatedTreatment.anesthesia.charAt(0).toUpperCase() + updatedTreatment.anesthesia.slice(1)
                    : "None",
                  imageUrl: newImgUrl || undefined,
                  procedureSteps: updatedTreatment.procedureSteps || [],
                  aftercare: updatedTreatment.aftercareInstructions || [],
                }
              : prev
          );
        }
      } else {
        if (!resolvedLocationId) {
          alert("Could not determine your outlet ID. Please make sure your account is assigned to an outlet.");
          return;
        }

        const payload: Record<string, unknown> = {
          locationId: resolvedLocationId,
          name: form.name,
          category: form.category.trim(),
          durationMinutes: durationVal,
          priceCents: priceVal,
          sessions: sessionsVal,
          anesthesia: anesthesiaVal,
          recoveryTime: form.recoveryTime || null,
          description: form.description || null,
          procedureSteps: procedureList,
          aftercareInstructions: aftercareList,
          hasNoSupplies: true,
        };

        if (uploadedPhotoKey) {
          payload.photoKey = uploadedPhotoKey;
        } else if (imageUrl) {
          payload.imageUrl = imageUrl;
        }

        const res = await axios.post("/api/treatment", payload);
        if (res.data?.success) {
          const newTreatment = res.data.data.treatment;
          const displayCat =
            CATEGORIES.find((c) => c.toLowerCase() === (newTreatment.category || "").toLowerCase()) ||
            newTreatment.category;
          const newImgUrl =
            newTreatment.imageUrl ||
            (uploadedPhotoKey ? getImageUrl(uploadedPhotoKey, { width: 400, height: 300 }) : undefined);

          setTreatments((prev) => [
            {
              id: newTreatment.id,
              locationId: newTreatment.locationId,
              treatmentId: `TRT-${1000 + prev.length + 1}`,
              createdDate: new Date(newTreatment.createdAt).toISOString().slice(0, 16).replace("T", " "),
              name: newTreatment.name,
              category: displayCat,
              duration: `${newTreatment.durationMinutes} mins`,
              price: newTreatment.priceCents / 100,
              description: newTreatment.description || "",
              sessions: String(newTreatment.sessions || 1),
              recoveryTime: newTreatment.recoveryTime || "",
              anesthesia: newTreatment.anesthesia
                ? newTreatment.anesthesia.charAt(0).toUpperCase() + newTreatment.anesthesia.slice(1)
                : "None",
              imageUrl: newImgUrl || undefined,
              procedureSteps: newTreatment.procedureSteps || [],
              aftercare: newTreatment.aftercareInstructions || [],
            },
            ...prev,
          ]);
          setCurrentPage(1);
        }
      }

      setForm(EMPTY_FORM);
      setImageFile(null);
      setEditingId(null);
      setModalOpen(false);
    } catch (err) {
      console.error("Error submitting treatment:", err);
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || "An error occurred.");
      } else {
        alert("An error occurred.");
      }
    }
  }

  const stats = [
    {
      icon: Stethoscope,
      label: "Total Treatments",
      value: String(treatments.length),
      trend: "+1 this month",
      trendUp: true,
    },
    {
      icon: CalendarCheck,
      label: "Bookings Today",
      value: String(todayBookingsCount),
      trend: "Today's bookings",
      trendUp: true,
    },
    {
      icon: Banknote,
      label: "Average Price",
      value: `NPR ${Math.round(avgPrice).toLocaleString()}`,
      trend: "Decreased by 2%",
      trendUp: false,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
          Treatments
        </h1>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        {/* Stats */}
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

        <div className="mt-10 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search treatments..."
                  className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                >
                  <option value="All">All categories</option>
                  {categoriesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
              Add Treatment
            </button>
          </div>

          {/* Table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-900/5">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[0.75rem] font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Treatment</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Sessions</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/5 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-xs text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-[#7da3b3]" />
                        <span>Loading treatments...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedTreatments.map((t) => {
                      const color = CATEGORY_COLORS[t.category] ?? "bg-slate-100 text-slate-700";

                      return (
                        <tr
                          key={t.id}
                          onClick={() => openProfile(t)}
                          className="cursor-pointer transition-colors hover:bg-[#7da3b3]/[0.06]"
                        >
                          <td className="px-5 py-4 text-[0.9rem] font-semibold text-slate-900">
                            <div className="flex items-center gap-3">
                              {t.imageUrl ? (
                                <img
                                  src={t.imageUrl}
                                  alt={t.name}
                                  className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7da3b3]/10 text-[#3f6274]">
                                  <Stethoscope className="h-5 w-5" strokeWidth={1.75} />
                                </div>
                              )}
                              <span>{t.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${color}`}>
                              {t.category}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[0.85rem] text-slate-600">
                            <p className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                              {t.duration}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-[0.85rem] text-slate-700">
                            <p className="flex items-center gap-1">
                              <Banknote className="h-3.5 w-3.5" strokeWidth={2} />
                              NPR {t.price.toLocaleString()}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-[0.85rem] text-slate-500">
                            {t.sessions ?? "1"} session{t.sessions === "1" ? "" : "s"}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(t);
                                }}
                                aria-label="Edit treatment"
                                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                              >
                                <SquarePen className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDeleteTreatment(t);
                                }}
                                disabled={deletingId === t.id}
                                aria-label="Delete treatment"
                                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="bg-white py-16 text-center text-slate-500">
                          No treatments match your filters.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {!loading && filtered.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
              <span className="text-[0.7rem] font-medium text-slate-500">
                Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{" "}
                <strong className="text-slate-800">
                  {Math.min(startIndex + itemsPerPage, filtered.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filtered.length}</strong> treatments
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
                    className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${
                      currentPage === pageNum
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

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div onClick={() => setModalOpen(false)} className="absolute inset-0" aria-hidden />
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
              <h2 className="text-[0.95rem] font-semibold text-slate-900">
                {modalMode === "edit" ? "Edit Treatment" : "Add Treatment"}
              </h2>
            </div>

            <div className="px-6 py-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Treatment Picture Upload */}
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <ImageIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    Treatment Picture
                  </span>
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-900/10 bg-white p-3.5">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      {imageFile ? (
                        <img
                          src={URL.createObjectURL(imageFile)}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : form.imageUrl ? (
                        <img
                          src={form.imageUrl}
                          alt="Treatment"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Stethoscope className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                          <UploadCloud className="h-3.5 w-3.5" />
                          <span>{imageFile || form.imageUrl ? "Change photo" : "Upload photo"}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setImageFile(file);
                              }
                            }}
                          />
                        </label>
                        {(imageFile || form.imageUrl) && (
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              update("imageUrl", "");
                            }}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-[0.75rem] text-slate-400">
                        Recommended: PNG, JPG, or WEBP up to 5MB
                      </p>
                    </div>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Tag className="h-3.5 w-3.5" strokeWidth={2} />
                    Treatment name
                  </span>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Teeth Whitening"
                    className={inputClass}
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <div className="block">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                        <Layers className="h-3.5 w-3.5" strokeWidth={2} />
                        Category
                      </span>
                      {!isAddingCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingCategory(true);
                            setNewCategoryInput("");
                          }}
                          className="cursor-pointer text-[0.75rem] font-medium text-[#3f6274] hover:underline"
                        >
                          + Add new
                        </button>
                      )}
                    </div>
                    {isAddingCategory ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="e.g. Whitening"
                          value={newCategoryInput}
                          onChange={(e) => setNewCategoryInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCategory();
                            }
                          }}
                          autoFocus
                          className={`${inputClass} !py-2 text-xs`}
                        />
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          className="shrink-0 rounded-xl bg-[#7da3b3] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#345263]"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingCategory(false)}
                          className="shrink-0 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <select
                        value={form.category}
                        onChange={(e) => {
                          if (e.target.value === "__add_new__") {
                            setIsAddingCategory(true);
                            setNewCategoryInput("");
                          } else {
                            update("category", e.target.value);
                          }
                        }}
                        className={inputClass}
                      >
                        <option value="">Select category...</option>
                        {categoriesList.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__add_new__">+ Add new category...</option>
                      </select>
                    )}
                  </div>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Timer className="h-3.5 w-3.5" strokeWidth={2} />
                      Duration
                    </span>
                    <input
                      type="text"
                      value={form.duration}
                      onChange={(e) => update("duration", e.target.value)}
                      placeholder="45 mins"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Banknote className="h-3.5 w-3.5" strokeWidth={2} />
                      Price (NPR)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={form.price}
                      onChange={(e) => update("price", e.target.value)}
                      placeholder="6500"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <ListChecks className="h-3.5 w-3.5" strokeWidth={2} />
                      Sessions
                    </span>
                    <input
                      type="text"
                      value={form.sessions}
                      onChange={(e) => update("sessions", e.target.value)}
                      placeholder="1"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Syringe className="h-3.5 w-3.5" strokeWidth={2} />
                      Anesthesia
                    </span>
                    <select
                      value={form.anesthesia}
                      onChange={(e) => update("anesthesia", e.target.value)}
                      className={inputClass}
                    >
                      {ANESTHESIA_OPTIONS.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      Recovery time
                    </span>
                    <input
                      type="text"
                      value={form.recoveryTime}
                      onChange={(e) => update("recoveryTime", e.target.value)}
                      placeholder="2-3 days"
                      className={inputClass}
                    />
                  </label>
                </div>

                <RichFormattedTextarea
                  required
                  label="Description"
                  icon={<ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />}
                  value={form.description}
                  onChange={(val) => update("description", val)}
                />

                <RichFormattedTextarea
                  label="Procedure steps (one per line)"
                  icon={<ListChecks className="h-3.5 w-3.5" strokeWidth={2} />}
                  value={form.procedureSteps}
                  onChange={(val) => update("procedureSteps", val)}
                />

                <RichFormattedTextarea
                  label="Aftercare instructions (one per line)"
                  icon={<ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />}
                  value={form.aftercare}
                  onChange={(val) => update("aftercare", val)}
                />

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263]"
                  >
                    {modalMode === "edit" ? "Save Changes" : "Add Treatment"}
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

      {/* Treatment detail side panel */}
      {selectedTreatment && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div onClick={() => setSelectedTreatment(null)} className="absolute inset-0" aria-hidden />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedTreatment(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <button
                onClick={() => requestDeleteTreatment(selectedTreatment)}
                disabled={deletingId === selectedTreatment.id}
                aria-label="Delete treatment"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete
              </button>
            </div>

            <div className="px-6 py-6">
              {/* Identity */}
              <div>
                {selectedTreatment.imageUrl && (
                  <div className="mb-4 max-h-56 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                    <img
                      src={selectedTreatment.imageUrl}
                      alt={selectedTreatment.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <h2 className="text-xl font-semibold text-slate-900">{selectedTreatment.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.85rem] text-slate-500">
                  <span>{selectedTreatment.category}</span>
                  <span className="text-slate-300">|</span>
                  <span>{selectedTreatment.duration}</span>
                  <span className="text-slate-300">|</span>
                  <span className="font-medium text-slate-700">
                    NPR {selectedTreatment.price.toLocaleString()}
                  </span>
                </div>

                <div className="mt-3">
                  <FormattedContent content={selectedTreatment.description} />
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-6 flex items-center gap-6 border-b border-slate-900/10">
                {(
                  [
                    { key: "detail", label: "Detail Information" },
                    { key: "procedure", label: "Procedure Steps" },
                    { key: "aftercare", label: "Aftercare" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setProfileTab(tab.key)}
                    className={`-mb-px border-b-2 px-1 pb-3 text-[0.85rem] font-medium transition-colors ${
                      profileTab === tab.key
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
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                    Treatment Information
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-y-4 text-[0.85rem]">
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <IdCard className="h-3.5 w-3.5" strokeWidth={2} />
                        Treatment ID
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {selectedTreatment.treatmentId ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <ListChecks className="h-3.5 w-3.5" strokeWidth={2} />
                        Sessions
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {selectedTreatment.sessions ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Syringe className="h-3.5 w-3.5" strokeWidth={2} />
                        Anesthesia
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {selectedTreatment.anesthesia ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                        Recovery Time
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {selectedTreatment.recoveryTime ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                        Created Date
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {selectedTreatment.createdDate ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {profileTab === "procedure" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                    Procedure Steps
                  </p>
                  {selectedTreatment.procedureSteps && selectedTreatment.procedureSteps.length > 0 ? (
                    <div className="mt-3 space-y-2 text-[0.85rem] text-slate-600">
                      {selectedTreatment.procedureSteps.map((item, idx) => (
                        <div key={idx} className="leading-relaxed">
                          <FormattedContent content={item} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[0.85rem] text-slate-500">No procedure steps recorded yet.</p>
                  )}
                </div>
              )}

              {profileTab === "aftercare" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                    Aftercare Instructions
                  </p>
                  {selectedTreatment.aftercare && selectedTreatment.aftercare.length > 0 ? (
                    <div className="mt-3 space-y-2 text-[0.85rem] text-slate-600">
                      {selectedTreatment.aftercare.map((item, idx) => (
                        <div key={idx} className="leading-relaxed">
                          <FormattedContent content={item} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[0.85rem] text-slate-500">No aftercare instructions recorded yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div onClick={() => setDeleteTarget(null)} className="absolute inset-0" aria-hidden />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <Trash2 className="h-5 w-5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 text-[1.05rem] font-semibold text-slate-900">
              Do you want to delete {deleteTarget.name} ?
            </h3>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={confirmDeleteTreatment}
                disabled={deletingId === deleteTarget.id}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
              >
                {deletingId === deleteTarget.id ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId === deleteTarget.id}
                className="flex-1 rounded-full border border-slate-900/10 px-4 py-2.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
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