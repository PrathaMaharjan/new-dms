"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Clock,
  Mail,
  Phone,
  User,
  Stethoscope,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
} from "lucide-react";
import {
  getPublicLocations,
  getPublicServices,
  getPublicDoctors,
  submitAppointmentBooking,
} from "@/lib/api";

const NO_PREFERENCE = "No Preference";
const ALL_CATEGORIES = "All Categories";

interface OutletOption {
  id: string;
  name: string;
  address?: string | null;
}

interface RawTreatment {
  id: string;
  name: string;
  category?: string | null;
  durationMinutes?: number | null;
  priceCents?: number | null;
  doctorIds?: string[];
  doctors?: { id: string; name: string; specialization?: string | null }[];
}

interface RawDoctor {
  id: string;
  name: string;
  specialization?: string | null;
  treatmentIds?: string[];
  treatments?: { id: string; name: string; category?: string }[];
}

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400";

function BookingForm() {
  const searchParams = useSearchParams();
  const paramDentist = searchParams.get("dentist") || searchParams.get("provider") || "";
  const paramService = searchParams.get("service") || "";

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOutletData, setLoadingOutletData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [rawTreatments, setRawTreatments] = useState<RawTreatment[]>([]);
  const [rawDoctors, setRawDoctors] = useState<RawDoctor[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);

  const tenantSlug =
    process.env.NEXT_PUBLIC_TENANT_SLUG?.trim() || "sunrise-dental-group";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    locationId: "",
    service: paramService,
    dentist: paramDentist || NO_PREFERENCE,
    date: "",
    time: "",
    notes: "",
  });

  // 1. Fetch Outlets for Clinic on Mount
  useEffect(() => {
    let isMounted = true;

    async function loadOutlets() {
      try {
        const res = await getPublicLocations(tenantSlug);
        const locList: OutletOption[] = res?.data?.data?.locations || [];

        if (isMounted && locList.length > 0) {
          setOutlets(locList);
          setForm((prev) => ({
            ...prev,
            locationId: prev.locationId || locList[0].id,
          }));
        }
      } catch (err) {
        console.error("Failed to load clinic outlets:", err);
      }
    }

    loadOutlets();
    return () => {
      isMounted = false;
    };
  }, [tenantSlug]);

  // 2. Fetch Services & Doctors for the selected Outlet
  useEffect(() => {
    let isMounted = true;

    async function loadOutletServicesAndDoctors() {
      if (!form.locationId) return;

      try {
        setLoadingOutletData(true);

        const [servicesRes, doctorsRes] = await Promise.allSettled([
          getPublicServices({ locationId: form.locationId, tenantSlug }),
          getPublicDoctors({ locationId: form.locationId, tenantSlug }),
        ]);

        let loadedTreatments: RawTreatment[] = [];
        if (servicesRes.status === "fulfilled" && servicesRes.value?.data?.success) {
          const raw = servicesRes.value.data.data?.treatments || [];
          if (Array.isArray(raw)) {
            loadedTreatments = raw.map((t: any) => ({
              id: t.id || "",
              name: t.name || t.title || String(t),
              category: t.category || "General",
              durationMinutes: t.durationMinutes,
              priceCents: t.priceCents,
              doctorIds: t.doctorIds || [],
              doctors: t.doctors || [],
            }));
          }
        }

        let loadedDoctors: RawDoctor[] = [];
        if (doctorsRes.status === "fulfilled" && doctorsRes.value?.data?.success) {
          const raw =
            doctorsRes.value.data.data?.doctors ||
            doctorsRes.value.data?.doctors ||
            [];
          if (Array.isArray(raw)) {
            loadedDoctors = raw
              .map((d: any) => ({
                id: d.id || "",
                name:
                  typeof d === "string"
                    ? d
                    : d.name || d.fullName || d.title || "",
                specialization: d.specialization,
                treatmentIds: d.treatmentIds || [],
                treatments: d.treatments || [],
              }))
              .filter((d) => Boolean(d.name));
          }
        }

        // Fallback load all org doctors if none tied specifically
        if (loadedDoctors.length === 0) {
          try {
            const allDocRes = await getPublicDoctors({ tenantSlug });
            const allRaw =
              allDocRes?.data?.data?.doctors || allDocRes?.data?.doctors || [];
            if (Array.isArray(allRaw)) {
              loadedDoctors = allRaw
                .map((d: any) => ({
                  id: d.id || "",
                  name:
                    typeof d === "string"
                      ? d
                      : d.name || d.fullName || d.title || "",
                  specialization: d.specialization,
                  treatmentIds: d.treatmentIds || [],
                  treatments: d.treatments || [],
                }))
                .filter((d) => Boolean(d.name));
            }
          } catch (e) {
            console.error("Fallback load doctors error:", e);
          }
        }

        if (isMounted) {
          setRawTreatments(loadedTreatments);
          setRawDoctors(loadedDoctors);

          if (paramService) {
            const matched = loadedTreatments.find(
              (t) => t.name.toLowerCase() === paramService.toLowerCase()
            );
            if (matched && matched.category) {
              setSelectedCategory(matched.category);
            }
          }

          setForm((prev) => {
            const names = loadedTreatments.map((t) => t.name);
            let selectedService = prev.service;
            if (!names.includes(selectedService)) {
              const matchedSvc = names.find(
                (s) =>
                  paramService &&
                  s.toLowerCase().includes(paramService.toLowerCase())
              );
              selectedService = matchedSvc || names[0] || "";
            }

            return {
              ...prev,
              service: selectedService,
            };
          });
        }
      } catch (err) {
        console.error("Failed to load services/doctors for outlet:", err);
        if (isMounted) {
          setRawTreatments([]);
          setRawDoctors([]);
        }
      } finally {
        if (isMounted) setLoadingOutletData(false);
      }
    }

    loadOutletServicesAndDoctors();
    return () => {
      isMounted = false;
    };
  }, [form.locationId, tenantSlug, paramService]);

  // Derive unique categories
  const categories = useMemo(() => {
    const catSet = new Set<string>();
    rawTreatments.forEach((t) => {
      if (t.category && t.category.trim()) {
        catSet.add(t.category.trim());
      }
    });
    return [ALL_CATEGORIES, ...Array.from(catSet)];
  }, [rawTreatments]);

  // Filter services by selected category
  const filteredServices = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES) {
      return rawTreatments;
    }
    return rawTreatments.filter(
      (t) => t.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [rawTreatments, selectedCategory]);

  function handleCategoryChange(newCategory: string) {
    setSelectedCategory(newCategory);
    const availableUnderCategory =
      newCategory === ALL_CATEGORIES
        ? rawTreatments
        : rawTreatments.filter(
            (t) => t.category?.toLowerCase() === newCategory.toLowerCase()
          );

    const isCurrentServiceValid = availableUnderCategory.some(
      (t) => t.name === form.service
    );

    if (!isCurrentServiceValid && availableUnderCategory.length > 0) {
      setForm((prev) => ({
        ...prev,
        service: availableUnderCategory[0].name,
      }));
    }
  }

  // Filter doctors who can perform the currently selected service
  const availableDentists = useMemo(() => {
    if (!form.service || rawDoctors.length === 0) {
      return [NO_PREFERENCE, ...rawDoctors.map((d) => d.name)];
    }

    const currentTreatment = rawTreatments.find((t) => t.name === form.service);

    const qualifiedDoctors = rawDoctors.filter((doc) => {
      const byTreatmentId =
        currentTreatment && doc.treatmentIds?.includes(currentTreatment.id);
      const byTreatmentName = doc.treatments?.some(
        (t) => t.name.toLowerCase() === form.service.toLowerCase()
      );
      const byTreatmentDocIds =
        currentTreatment && currentTreatment.doctorIds?.includes(doc.id);

      return byTreatmentId || byTreatmentName || byTreatmentDocIds;
    });

    if (qualifiedDoctors.length === 0) {
      return [NO_PREFERENCE, ...rawDoctors.map((d) => d.name)];
    }

    return [NO_PREFERENCE, ...qualifiedDoctors.map((d) => d.name)];
  }, [form.service, rawTreatments, rawDoctors]);

  useEffect(() => {
    if (form.dentist !== NO_PREFERENCE && !availableDentists.includes(form.dentist)) {
      setForm((prev) => ({ ...prev, dentist: NO_PREFERENCE }));
    }
  }, [availableDentists, form.dentist]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const selectedDentist =
        form.dentist === NO_PREFERENCE || form.dentist === "None"
          ? undefined
          : form.dentist;

      const res = await submitAppointmentBooking({
        fullName: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        preferredDate: form.date,
        preferredTime: form.time,
        serviceName: form.service || undefined,
        dentistName: selectedDentist,
        tenantSlug,
        locationId: form.locationId || undefined,
        notes: form.notes
          ? `[Dentist: ${selectedDentist || "No Preference"}] ${form.notes}`
          : `[Dentist: ${selectedDentist || "No Preference"}]`,
        source: "online_booking",
      });

      if (res.data?.success) {
        setSubmitted(true);
      } else {
        setError(res.data?.error || "Failed to submit booking. Please try again.");
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          "Could not connect to POS server. Please make sure POS app is running."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedOutlet = outlets.find((o) => o.id === form.locationId);

  return (
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <ToothOutline className="absolute -left-16 top-24 h-64 w-64 text-sky-200/60 -rotate-12" />
        <ToothOutline className="absolute -right-20 top-[28rem] h-80 w-80 text-sky-200/50 rotate-12" />
        <ToothbrushOutline className="absolute left-[8%] bottom-16 h-40 w-40 text-sky-200/50 -rotate-6" />
        <SparkleOutline className="absolute right-[12%] top-16 h-10 w-10 text-sky-300/70" />
        <SparkleOutline className="absolute left-[20%] top-[42%] h-6 w-6 text-sky-300/60" />
        <CircleRing className="absolute right-[6%] bottom-[8%] h-56 w-56 text-sky-200/40" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 pb-24 pt-32 lg:px-8 lg:pt-40">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-300">
            Book an Appointment
          </p>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Let's get your smile scheduled
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-[1rem] leading-relaxed text-slate-600">
            Select your preferred outlet, service, and dentist, and we&apos;ll
            confirm your appointment shortly.
          </p>
        </div>

        <div className="mt-12">
          {submitted ? (
            <div className="flex flex-col items-center rounded-3xl border border-slate-900/5 bg-white/90 p-10 text-center shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] backdrop-blur-sm sm:p-14">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-slate-900">
                Appointment requested
              </h2>
              <p className="mt-2 max-w-sm text-[0.95rem] text-slate-600">
                Thanks, {form.name.split(" ")[0] || "there"}. We&apos;ll reach
                out at {form.phone || form.email} to confirm your{" "}
                {form.date ? `${form.date} ` : ""}appointment for{" "}
                <span className="font-semibold text-slate-900">{form.service}</span>
                {selectedOutlet ? ` at our ${selectedOutlet.name} branch` : ""}.
              </p>

              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-sky-200/80 bg-sky-50/70 p-4 text-left text-xs text-sky-900 max-w-md shadow-sm">
                <Clock className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" strokeWidth={2} />
                <div>
                  <span className="font-semibold block text-sky-950 text-[0.85rem] mb-0.5">Please Arrive 15–20 Minutes Early</span>
                  <span className="text-slate-600 leading-relaxed block">
                    To ensure smooth check-in and avoid missing your appointment slot, please plan to arrive at least 15 to 20 minutes prior to your scheduled time.
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSubmitted(false)}
                className="mt-8 text-[0.9rem] font-medium text-sky-700 underline-offset-4 hover:underline"
              >
                Book another appointment
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-slate-900/5 bg-white/90 p-8 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] backdrop-blur-sm sm:p-10"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Outlet Select */}
                {outlets.length > 0 && (
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-sky-600" strokeWidth={2} />
                      Select Clinic Outlet
                    </span>
                    <select
                      required
                      value={form.locationId}
                      onChange={(e) => update("locationId", e.target.value)}
                      className={inputClass}
                    >
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} {o.address ? `(${o.address})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <User className="h-3.5 w-3.5 text-sky-600" strokeWidth={2} />
                    Full name
                  </span>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Pratha Maharjan"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Phone className="h-3.5 w-3.5 text-sky-600" strokeWidth={2} />
                    Phone number
                  </span>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="9XXXXXXXXX"
                    className={inputClass}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-sky-600" strokeWidth={2} />
                    Email
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

                {/* Category Filter */}
                {categories.length > 1 && (
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Layers className="h-3.5 w-3.5 text-sky-600" strokeWidth={2} />
                      Category
                    </span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      disabled={loadingOutletData}
                      className={inputClass}
                    >
                      {categories.map((cat) => (
                        <option key={`cat-${cat}`} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {/* Service Select */}
                <label className={categories.length > 1 ? "block" : "block sm:col-span-2"}>
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Stethoscope className="h-3.5 w-3.5 text-sky-600" strokeWidth={2} />
                    Service
                  </span>
                  <select
                    value={form.service}
                    onChange={(e) => update("service", e.target.value)}
                    disabled={loadingOutletData}
                    className={inputClass}
                  >
                    {loadingOutletData ? (
                      <option value="">Loading services...</option>
                    ) : filteredServices.length === 0 ? (
                      <option value="">No services available</option>
                    ) : (
                      filteredServices.map((s) => (
                        <option key={`service-${s.id || s.name}`} value={s.name}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                {/* Preferred Dentist */}
                <label className="block sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <User className="h-3.5 w-3.5 text-sky-600" strokeWidth={2} />
                      Preferred dentist
                    </span>
                    {availableDentists.length > 1 && (
                      <span className="text-[0.7rem] text-sky-600 font-medium">
                        {availableDentists.length - 1} available
                      </span>
                    )}
                  </div>
                  <select
                    value={form.dentist}
                    onChange={(e) => update("dentist", e.target.value)}
                    disabled={loadingOutletData}
                    className={inputClass}
                  >
                    {loadingOutletData ? (
                      <option value="">Loading dentists...</option>
                    ) : (
                      availableDentists.map((d, idx) => (
                        <option key={`dentist-${d}-${idx}`} value={d}>
                          {d}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Calendar className="h-3.5 w-3.5 text-sky-600" strokeWidth={2} />
                    Preferred date
                  </span>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-sky-600" strokeWidth={2} />
                    Preferred time
                  </span>
                  <input
                    required
                    type="time"
                    value={form.time}
                    onChange={(e) => update("time", e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    Notes (optional)
                  </span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Anything we should know before your visit?"
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </label>

                {error && (
                  <div className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || loadingOutletData}
                className="group relative mt-8 h-12 w-full overflow-hidden rounded-full border border-[#a5c5d1] sm:w-auto disabled:opacity-60 cursor-pointer"
              >
                <div className="inline-flex h-12 w-full items-center justify-center bg-[#7da3b3] px-10 text-[0.95rem] font-medium text-white transition-transform duration-300 group-hover:-translate-y-full">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Confirm Appointment"
                  )}
                </div>

                <div className="absolute inset-0 inline-flex h-12 w-full translate-y-full items-center justify-center bg-white px-10 text-[0.95rem] font-medium text-slate-900 transition-transform duration-300 group-hover:translate-y-0">
                  {loading ? "Submitting..." : "Confirm Appointment"}
                </div>
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <section className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-slate-400 text-sm">Loading booking form...</div>
        </section>
      }
    >
      <BookingForm />
    </Suspense>
  );
}

function ToothOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" fill="none" className={className}>
      <path
        d="M100 10c-28 0-46 18-46 46 0 20 6 34 10 52 5 22 8 46 14 72 4 18 12 30 22 30s16-14 20-32c3-14 4-30 8-30s5 16 8 30c4 18 10 32 20 32s18-12 22-30c6-26 9-50 14-72 4-18 10-32 10-52 0-28-18-46-46-46-14 0-22 8-30 8s-16-8-30-8"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ToothbrushOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 100" fill="none" className={className}>
      <rect x="10" y="42" width="120" height="16" rx="8" stroke="currentColor" strokeWidth="5" />
      <path d="M130 50h30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <rect x="160" y="20" width="50" height="60" rx="14" stroke="currentColor" strokeWidth="5" />
      <path d="M172 34v32M186 30v40M200 34v32" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function SparkleOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className}>
      <path
        d="M20 2c0 8 6 16 18 18-12 2-18 10-18 18 0-8-6-16-18-18 12-2 18-10 18-18Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircleRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className}>
      <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}