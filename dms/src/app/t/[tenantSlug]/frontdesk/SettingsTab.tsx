"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  User,
  Lock,
  Mail,
  Phone,
  Save,
  Loader2,
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Camera,
} from "lucide-react";
import { uploadConfig } from "@/lib/cloudinary/storage";

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400";

interface ProfileSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photoUrl: string | null;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const DEFAULT_PROFILE: ProfileSettings = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  photoUrl: null,
};

const DEFAULT_PASSWORD_FORM: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function FieldLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
      {icon}
      {children}
    </span>
  );
}

function SwapButton({
  type = "button",
  onClick,
  disabled,
  loading,
  icon,
  children,
  className = "",
}: {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`group relative h-12 w-full overflow-hidden rounded-full border border-[#a5c5d1] disabled:opacity-50 sm:w-auto ${className}`}
    >
      <div className="inline-flex h-12 w-full items-center justify-center gap-1.5 bg-[#7da3b3] px-10 text-[0.95rem] font-medium text-white transition-transform duration-300 group-hover:-translate-y-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </div>
      <div className="absolute inset-0 inline-flex h-12 w-full translate-y-full items-center justify-center gap-1.5 bg-white px-10 text-[0.95rem] font-medium text-slate-900 transition-transform duration-300 group-hover:translate-y-0">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </div>
    </button>
  );
}

export default function SettingsTab() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<"profile" | "password" | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileSettings>(DEFAULT_PROFILE);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(DEFAULT_PASSWORD_FORM);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await axios.get("/api/user-details").catch(() => null);
      if (res?.data?.success && res.data.data?.user) {
        const u = res.data.data.user;
        const [firstName, ...rest] = (u.name ?? "").split(" ");
        setProfile({
          firstName: firstName ?? "",
          lastName: rest.join(" "),
          email: u.email ?? "",
          phone: u.phone ?? "",
          photoUrl: u.photoUrl ?? null,
        });
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      setErrorMsg("Failed to load settings from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
      setProfile((prev) => ({ ...prev, photoUrl: responseBody.data.user.photoUrl }));
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

    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      setErrorMsg("First name and last name are required.");
      return;
    }

    setSavingSection("profile");
    try {
      const { data: responseBody } = await axios.patch("/api/user-details", {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
      });

      if (!responseBody?.success) {
        setErrorMsg(responseBody?.error ?? "Failed to update profile.");
      } else {
        setSuccessMsg("Profile updated successfully!");
      }
    } catch (err: any) {
      console.error("Failed to save profile:", err);
      setErrorMsg(err.response?.data?.error ?? "Failed to update profile.");
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
      setPasswordForm(DEFAULT_PASSWORD_FORM);
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

  const initials =
    `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}`.toUpperCase() || "FD";
  const fullName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Your Name";

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
          <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-slate-900/5 bg-white/90 p-16 text-center text-xs text-slate-400 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
            <span>Loading your profile...</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-900/5 bg-white/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] backdrop-blur-sm">
            <div className="flex items-center gap-4 border-b border-slate-900/5 p-6 sm:p-7">
              <div className="relative shrink-0">
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-900/10 bg-slate-100 text-[1.3rem] font-semibold text-[#3f6274] shadow-sm ring-4 ring-slate-50">
                  {avatarPreview || profile.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview ?? profile.photoUrl!}
                      alt="Profile avatar"
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
                <h2 className="truncate text-lg font-semibold text-slate-900">{fullName}</h2>
                <p className="mt-0.5 truncate text-[0.85rem] text-slate-500">
                  {profile.email || "No email on file yet"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="p-8 sm:p-10">
              <div className="mb-6">
                <h3 className="text-base font-semibold text-slate-900">Personal information</h3>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel icon={<User className="h-3.5 w-3.5" strokeWidth={2} />}>First name</FieldLabel>
                  <input
                    required
                    type="text"
                    placeholder="First name"
                    value={profile.firstName}
                    className={inputClass}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  />
                </label>

                <label className="block">
                  <FieldLabel icon={<User className="h-3.5 w-3.5" strokeWidth={2} />}>Last name</FieldLabel>
                  <input
                    required
                    type="text"
                    placeholder="Last name"
                    value={profile.lastName}
                    className={inputClass}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <FieldLabel icon={<Mail className="h-3.5 w-3.5" strokeWidth={2} />}>Email address</FieldLabel>
                  <input
                    type="email"
                    placeholder="demo@gmail.com"
                    value={profile.email}
                    className={inputClass}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <FieldLabel icon={<Phone className="h-3.5 w-3.5" strokeWidth={2} />}>Phone number</FieldLabel>
                  <input
                    type="tel"
                    placeholder="9XXXXXXXXX"
                    value={profile.phone}
                    className={inputClass}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </label>
              </div>

              <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                <SwapButton
                  type="submit"
                  disabled={savingSection === "profile"}
                  loading={savingSection === "profile"}
                  icon={<Save className="h-4 w-4" />}
                >
                  Save profile
                </SwapButton>
              </div>
            </form>

            <form onSubmit={handleChangePassword} className="border-t border-slate-100 p-8 sm:p-10">
              <div className="mb-6">
                <h3 className="text-base font-semibold text-slate-900">Password &amp; security</h3>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <FieldLabel icon={<Lock className="h-3.5 w-3.5" strokeWidth={2} />}>Current password</FieldLabel>
                  <div className="relative">
                    <input
                      required
                      type={showCurrentPw ? "text" : "password"}
                      placeholder="Current password"
                      value={passwordForm.currentPassword}
                      className={`${inputClass} pr-10`}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
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
                  <FieldLabel icon={<Lock className="h-3.5 w-3.5" strokeWidth={2} />}>New password</FieldLabel>
                  <div className="relative">
                    <input
                      required
                      type={showNewPw ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={passwordForm.newPassword}
                      className={`${inputClass} pr-10`}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
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
                  <FieldLabel icon={<Lock className="h-3.5 w-3.5" strokeWidth={2} />}>Confirm new password</FieldLabel>
                  <input
                    required
                    type={showNewPw ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={passwordForm.confirmPassword}
                    className={inputClass}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  />
                </label>
              </div>

              <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#7da3b3]" />
                Use at least 8 characters with a mix of letters and numbers.
              </p>

              <div className="mt-6 flex justify-end border-t border-slate-100 pt-6">
                <SwapButton
                  type="submit"
                  disabled={savingSection === "password"}
                  loading={savingSection === "password"}
                  icon={<Lock className="h-4 w-4" />}
                >
                  Update password
                </SwapButton>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}