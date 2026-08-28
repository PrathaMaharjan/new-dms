"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import axios from "axios";
import {
  User,
  Mail,
  Phone,
  Stethoscope,
  BriefcaseMedical,
  GraduationCap,
  Cake,
  Droplet,
  VenusAndMars,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Save,
  Loader2,
  Check,
  X,
  AlertCircle,
  Camera,
} from "lucide-react";
import { uploadConfig } from "@/lib/cloudinary/storage";
import { RichFormattedTextarea } from "@/components/treatments/RichFormattedTextarea";
import { htmlToCleanMarkdown } from "@/lib/formatters/richText";

const SPECIALIZATIONS = [
  "General Dentistry",
  "Orthodontics",
  "Endodontics",
  "Periodontics",
  "Oral Surgery",
  "Pediatric Dentistry",
];

const SPECIALIZATION_MAP_BACKEND: Record<string, string> = {
  "General Dentistry": "general_dentistry",
  Orthodontics: "orthodontics",
  Endodontics: "endodontics",
  Periodontics: "periodontics",
  "Oral Surgery": "oral_surgery",
  "Pediatric Dentistry": "pediatric_dentistry",
};

const SPECIALIZATION_MAP_FRONTEND: Record<string, string> = {
  general_dentistry: "General Dentistry",
  orthodontics: "Orthodontics",
  endodontics: "Endodontics",
  periodontics: "Periodontics",
  oral_surgery: "Oral Surgery",
  pediatric_dentistry: "Pediatric Dentistry",
  prosthodontics: "Prosthodontics",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["Female", "Male", "Other"];

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

const textareaClass = inputClass;

interface ProfileForm {
  name: string;
  email: string;
  phone: string;
  specialization: string;
  experience: string;
  qualification: string;
  imageUrl: string;
  doctorId: string;
  age: string;
  bloodGroup: string;
  gender: string;
  dob: string;
  address: string;
  education: string;
  experienceNotes: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_PROFILE: ProfileForm = {
  name: "",
  email: "",
  phone: "",
  specialization: SPECIALIZATIONS[0],
  experience: "",
  qualification: "",
  imageUrl: "",
  doctorId: "",
  age: "",
  bloodGroup: BLOOD_GROUPS[0],
  gender: GENDERS[0],
  dob: "",
  address: "",
  education: "",
  experienceNotes: "",
};

const EMPTY_PASSWORD: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function pickField(raw: any, ...keys: string[]): string {
  for (const key of keys) {
    if (raw?.[key] !== undefined && raw?.[key] !== null && raw?.[key] !== "") {
      return String(raw[key]);
    }
  }
  return "";
}

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

function FieldLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
      {icon}
      {children}
    </span>
  );
}

export default function DoctorSettingsTab() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<"profile" | "password" | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(EMPTY_PASSWORD);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Fetch user details first
      const userRes = await axios.get("/api/user-details").catch(() => null);
      const u = userRes?.data?.success ? userRes.data.data?.user : null;

      // 2. Fetch doctor profile details if available
      let d: any = null;
      let doctorId = "";

      const listRes = await axios.get("/api/doctor").catch(() => null);
      if (listRes?.data?.success && listRes.data.data?.doctors?.length > 0) {
        const doctors = listRes.data.data.doctors;
        const matchingDoc = doctors.find((doc: any) => doc.id === u?.id || doc.email === u?.email) || doctors[0];
        if (matchingDoc?.id) {
          doctorId = matchingDoc.id;
          const docRes = await axios.get(`/api/doctor/${matchingDoc.id}`).catch(() => null);
          if (docRes?.data?.success && docRes.data.data?.doctor) {
            d = docRes.data.data.doctor;
          }
        }
      }

      if (u || d) {
        const rawDob = pickField(d, "dateOfBirth", "dob", "date_of_birth");
        const formattedDob = rawDob ? rawDob.split("T")[0] : "";
        const computedAge = d?.age || calculateAgeFromDob(rawDob);
        setProfile({
          name: u?.name || d?.name || "",
          email: u?.email || d?.email || "",
          phone: u?.phone || d?.phone || "",
          specialization: SPECIALIZATION_MAP_FRONTEND[d?.specialization] || SPECIALIZATIONS[0],
          experience: String(d?.yearsOfExperience ?? d?.experience ?? ""),
          qualification: d?.qualification || "",
          imageUrl: u?.photoUrl || d?.photoUrl || "",
          doctorId: doctorId || d?.id || u?.id || "",
          age: String(computedAge || ""),
          bloodGroup: d?.bloodGroup || BLOOD_GROUPS[0],
          gender: d?.gender || GENDERS[0],
          dob: formattedDob,
          address: pickField(d, "address", "location", "doctorAddress", "residenceAddress"),
          education: htmlToCleanMarkdown(d?.education || ""),
          experienceNotes: htmlToCleanMarkdown(d?.bio || d?.experienceNotes || ""),
        });
      }
    } catch (err) {
      console.error("Failed to load doctor profile:", err);
      setErrorMsg("Failed to load your profile from the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function update<K extends keyof ProfileForm>(key: K, value: string) {
    setProfile((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "dob") {
        updated.age = calculateAgeFromDob(value);
      } else if (key === "age") {
        if (value && !isNaN(Number(value))) {
          const numAge = Number(value);
          if (numAge > 0 && numAge < 120) {
            const currentYear = new Date().getFullYear();
            const birthYear = currentYear - numAge;
            if (!prev.dob || new Date(prev.dob).getFullYear() !== birthYear) {
              updated.dob = `${birthYear}-01-01`;
            }
          }
        } else if (!value) {
          updated.dob = "";
        }
      }
      return updated;
    });
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadConfig.cloudinary.uploadPreset!);
      formData.append("folder", "dental/staff");

      const cloudinaryRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${uploadConfig.cloudinary.cloudName}/image/upload`,
        formData
      );
      const photoKey: string = cloudinaryRes.data.public_id;

      const { data: responseBody } = await axios.patch("/api/user-details", { photoKey });
      if (!responseBody?.success) {
        setErrorMsg(responseBody?.error ?? "Failed to upload photo.");
        return;
      }
      if (profile.doctorId) {
        await axios.patch(`/api/doctor/${profile.doctorId}`, { photoKey }).catch(() => null);
      }
      setProfile((prev) => ({ ...prev, imageUrl: responseBody.data.user.photoUrl }));
      setSuccessMsg("Profile photo updated!");
    } catch (err: any) {
      console.error("Failed to upload photo:", err);
      setErrorMsg(err.response?.data?.error ?? "Failed to upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!profile.name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    setSavingSection("profile");
    try {
      const [firstName, ...lastNameParts] = profile.name.trim().split(" ");
      const lastName = lastNameParts.join(" ");

      // 1. Update user details
      const userRes = await axios.patch("/api/user-details", {
        firstName: firstName || profile.name.trim(),
        lastName,
        email: profile.email.trim(),
        phone: profile.phone.trim(),
      }).catch((err) => err.response);

      // 2. Update doctor details if doctorId exists or find matching doctor
      let docRes = null;
      let targetDocId = profile.doctorId;

      if (!targetDocId) {
        const listRes = await axios.get("/api/doctor").catch(() => null);
        if (listRes?.data?.success && listRes.data.data?.doctors?.length > 0) {
          const matching = listRes.data.data.doctors.find((doc: any) => doc.email === profile.email) || listRes.data.data.doctors[0];
          targetDocId = matching?.id;
        }
      }

      if (targetDocId) {
        const docPayload: Record<string, unknown> = {
          name: profile.name.trim(),
          email: profile.email.trim(),
          phone: profile.phone.trim(),
          specialization: SPECIALIZATION_MAP_BACKEND[profile.specialization] || "general_dentistry",
          qualification: profile.qualification,
          yearsOfExperience: parseInt(profile.experience, 10) || 0,
          dateOfBirth: profile.dob || undefined,
          bloodGroup: profile.bloodGroup,
          gender: profile.gender,
          address: profile.address,
          education: profile.education,
          bio: profile.experienceNotes,
        };
        docRes = await axios.patch(`/api/doctor/${targetDocId}`, docPayload).catch((err) => err.response);
      }

      const userSuccess = userRes?.data?.success ?? false;
      const docSuccess = docRes?.data?.success ?? false;

      if (userSuccess || docSuccess || userRes?.status === 200 || docRes?.status === 200) {
        setSuccessMsg("Profile updated successfully!");
      } else {
        const error = docRes?.data?.error || userRes?.data?.error || "Failed to update profile.";
        setErrorMsg(error);
      }
    } catch (err: any) {
      console.error("Failed to save doctor profile:", err);
      setErrorMsg(err.response?.data?.error || "Failed to update profile.");
    } finally {
      setSavingSection(null);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setErrorMsg("Please fill in your current and new password.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setErrorMsg("New password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMsg("New password and confirmation do not match.");
      return;
    }

    setSavingSection("password");
    try {
      const { data: responseBody } = await axios.patch("/api/user-details/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });

      if (!responseBody?.success) {
        setErrorMsg(responseBody?.error ?? "Failed to change password.");
        return;
      }

      setSuccessMsg("Password changed! Redirecting you to log in again...");
      setPasswordForm(EMPTY_PASSWORD);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      console.error("Failed to change password:", err);
      setErrorMsg(err.response?.data?.error ?? "Failed to change password.");
    } finally {
      setSavingSection(null);
    }
  }

  const initials = profile.name
    .replace("Dr.", "")
    .trim()
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "DR";

  return (
    <div className="w-full py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        {errorMsg && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
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
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-900/5 bg-white p-16 text-center text-xs text-slate-400 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
            <span>Loading your profile...</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-sm">
            {/* Identity header */}
            <div className="flex items-center gap-4 border-b border-slate-900/5 p-6 sm:p-7">
              <div className="relative shrink-0">
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-900/10 bg-slate-100 text-[1.3rem] font-semibold text-[#3f6274] shadow-sm ring-4 ring-slate-50">
                  {avatarPreview || profile.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview ?? profile.imageUrl}
                      alt={profile.name || "Doctor photo"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  title="Change photo"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#345263] text-white shadow-sm transition-colors hover:bg-[#2a4351] disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleAvatarPick}
                  className="hidden"
                />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-900">
                  {profile.name || "Your Name"}
                </h2>
                <p className="mt-0.5 flex items-center gap-2 text-[0.85rem] text-slate-500">
                  <span>{profile.specialization}</span>
                  {(profile.age || calculateAgeFromDob(profile.dob)) ? (
                    <>
                      <span>•</span>
                      <span>{profile.age || calculateAgeFromDob(profile.dob)} yrs old</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            {/* Profile + professional details */}
            <form onSubmit={handleSaveProfile} className="border-b border-slate-900/5 p-6 sm:p-7">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900">Personal information</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel icon={<User className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Full name
                  </FieldLabel>
                  <input
                    required
                    type="text"
                    value={profile.name}
                    onChange={(e) => update("name", e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <FieldLabel icon={<Mail className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Email
                  </FieldLabel>
                  <input
                    required
                    type="email"
                    value={profile.email}
                    onChange={(e) => update("email", e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <FieldLabel icon={<Phone className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Phone
                  </FieldLabel>
                  <input
                    required
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="e.g. 9812345678"
                    maxLength={10}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="mt-7 border-t border-slate-100 pt-6">
                <h3 className="text-sm font-semibold text-slate-900">Professional details</h3>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel icon={<Stethoscope className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Specialization
                  </FieldLabel>
                  <select
                    value={profile.specialization}
                    onChange={(e) => update("specialization", e.target.value)}
                    className={inputClass}
                  >
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <FieldLabel icon={<BriefcaseMedical className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Years of experience
                  </FieldLabel>
                  <input
                    required
                    type="number"
                    min={0}
                    value={profile.experience}
                    onChange={(e) => update("experience", e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <FieldLabel icon={<GraduationCap className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Qualification
                  </FieldLabel>
                  <input
                    required
                    type="text"
                    value={profile.qualification}
                    onChange={(e) => update("qualification", e.target.value)}
                    placeholder=""
                    className={inputClass}
                  />
                </label>


                <label className="block">
                  <FieldLabel icon={<Cake className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Date of birth
                  </FieldLabel>
                  <input
                    type="date"
                    value={profile.dob}
                    onChange={(e) => update("dob", e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <FieldLabel icon={<Droplet className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Blood group
                  </FieldLabel>
                  <select
                    value={profile.bloodGroup}
                    onChange={(e) => update("bloodGroup", e.target.value)}
                    className={inputClass}
                  >
                    {BLOOD_GROUPS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <FieldLabel icon={<VenusAndMars className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Gender
                  </FieldLabel>
                  <select
                    value={profile.gender}
                    onChange={(e) => update("gender", e.target.value)}
                    className={inputClass}
                  >
                    {GENDERS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <FieldLabel icon={<MapPin className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Address
                  </FieldLabel>
                  <input
                    type="text"
                    value={profile.address}
                    onChange={(e) => update("address", e.target.value)}
                    className={inputClass}
                  />
                </label>

                <div className="sm:col-span-2">
                  <RichFormattedTextarea
                    label="Education"
                    icon={<GraduationCap className="h-3.5 w-3.5" strokeWidth={2} />}
                    value={profile.education}
                    onChange={(val) => update("education", val)}
                    helperText="Qualifications, degrees, medical colleges"
                  />
                </div>

                <div className="sm:col-span-2">
                  <RichFormattedTextarea
                    label="Experience notes / Bio"
                    icon={<BriefcaseMedical className="h-3.5 w-3.5" strokeWidth={2} />}
                    value={profile.experienceNotes}
                    onChange={(val) => update("experienceNotes", val)}
                    helperText="Doctor bio, achievements, clinical experience"
                  />
                </div>
              </div>

              <div className="mt-7 flex justify-end border-t border-slate-100 pt-6">
                <button
                  type="submit"
                  disabled={savingSection === "profile"}
                  className="flex items-center gap-1.5 rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSection === "profile" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save profile
                </button>
              </div>
            </form>

            {/* Password */}
            <form onSubmit={handleChangePassword} className="p-6 sm:p-7">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900">Password &amp; security</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <FieldLabel icon={<Lock className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Current password
                  </FieldLabel>
                  <div className="relative">
                    <input
                      required
                      type={showCurrentPw ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <FieldLabel icon={<Lock className="h-3.5 w-3.5" strokeWidth={2} />}>
                    New password
                  </FieldLabel>
                  <div className="relative">
                    <input
                      required
                      type={showNewPw ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <FieldLabel icon={<Lock className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Confirm new password
                  </FieldLabel>
                  <div className="relative">
                    <input
                      required
                      type={showConfirmPw ? "text" : "password"}
                      placeholder="Re-enter new password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
              </div>

              <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#7da3b3]" />
                Use at least 8 characters with a mix of letters and numbers.
              </p>

              <div className="mt-6 flex justify-end border-t border-slate-100 pt-6">
                <button
                  type="submit"
                  disabled={savingSection === "password"}
                  className="flex items-center gap-1.5 rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSection === "password" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Update password
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}