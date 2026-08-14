"use client";

import { useState, useEffect, useCallback } from "react";
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


    RefreshCw,
    Stethoscope,
    HeartPulse,
    Cross,
    Pill,
    Activity,
    CalendarClock,
} from "lucide-react";

const inputClass =
    "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

interface ProfileSettings {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
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

export default function AdminSettingsPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [savingSection, setSavingSection] = useState<"profile" | "password" | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [profile, setProfile] = useState<ProfileSettings>(DEFAULT_PROFILE);
    const [passwordForm, setPasswordForm] = useState<PasswordForm>(DEFAULT_PASSWORD_FORM);
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            setErrorMsg(null);

            const res = await axios.get("/api/superadmin/profile").catch(() => null);
            if (res?.data?.success && res.data.data?.admin) {
                const u = res.data.data.admin;
                const [firstName, ...rest] = (u.name ?? "").split(" ");
                setProfile({
                    firstName: firstName ?? "",
                    lastName: rest.join(" "),
                    email: u.email ?? "",
                    phone: u.phone ?? "",
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
        queueMicrotask(() => {
            void loadSettings();
        });
    }, [loadSettings]);

    async function handleSaveProfile(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!profile.firstName.trim()) {
            setErrorMsg("First name is required.");
            return;
        }

        setSavingSection("profile");
        try {
            const { data: responseBody } = await axios.patch("/api/superadmin/profile", {
                firstName: profile.firstName.trim(),
                lastName: profile.lastName.trim(),
                email: profile.email.trim(),
                phone: profile.phone.trim(),
            });

            if (!responseBody?.success) {
                setErrorMsg(responseBody?.error ?? "Failed to update profile.");
            } else {
                setSuccessMsg("Profile updated successfully!");
            }
        } catch (err: unknown) {
            console.error("Failed to save profile:", err);
            if (axios.isAxiosError(err)) {
                setErrorMsg(err.response?.data?.error ?? "Failed to update profile.");
            } else {
                setErrorMsg("Failed to update profile.");
            }
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
            const { data: responseBody } = await axios.patch("/api/superadmin/profile/change-password", {
                oldPassword: passwordForm.currentPassword,
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
                router.push("/superadmin");
            }, 2000);
        } catch (err: unknown) {
            console.error("Failed to change password:", err);
            if (axios.isAxiosError(err)) {
                setErrorMsg(err.response?.data?.error ?? "Failed to change password.");
            } else {
                setErrorMsg("Failed to change password.");
            }
        } finally {
            setSavingSection(null);
        }
    }


    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-50">
            {/* Decorative Background Icons */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                <CalendarClock className="absolute -left-8 top-20 h-44 w-44 -rotate-12 text-[#7da3b3]/[0.07]" strokeWidth={1} />
                <Stethoscope className="absolute right-6 top-52 h-32 w-32 rotate-12 text-[#7da3b3]/[0.07]" strokeWidth={1} />
                <HeartPulse className="absolute left-[22%] bottom-32 h-28 w-28 -rotate-6 text-[#7da3b3]/[0.07]" strokeWidth={1} />
                <Cross className="absolute right-[10%] bottom-20 h-20 w-20 rotate-6 text-[#7da3b3]/[0.07]" strokeWidth={1} />
                <Pill className="absolute left-[48%] top-8 h-16 w-16 rotate-45 text-[#7da3b3]/[0.07]" strokeWidth={1} />
                <Activity className="absolute right-[32%] bottom-[6%] h-24 w-24 text-[#7da3b3]/[0.07]" strokeWidth={1} />
            </div>

            {/* Sticky Top Header */}
            <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl flex items-center gap-2.5">

                    Account Settings
                </h1>
            </div>

            <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
                {/* Notifications */}
                {errorMsg && (
                    <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                            <span>{errorMsg}</span>
                        </div>
                        <button
                            onClick={() => loadSettings()}
                            className="flex items-center gap-1 font-semibold text-rose-600 hover:underline"
                        >
                            <RefreshCw className="h-3 w-3" /> Retry
                        </button>
                    </div>
                )}

                {successMsg && (
                    <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                        <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{successMsg}</span>
                        </div>
                        <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}



                <div className="mt-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-900/5 bg-white p-16 text-center text-xs text-slate-400 shadow-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-[#7da3b3]" />
                            <span>Loading settings...</span>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-sm">
                            {/* Profile Form */}
                            <form onSubmit={handleSaveProfile} className="border-b border-slate-900/5 p-6 sm:p-8">
                                <div className="mb-6">
                                    <h3 className="text-2xl font-semibold text-[#345263]">Personal Information</h3>

                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <label className="block">
                                        <FieldLabel icon={<User className="h-3.5 w-3.5" strokeWidth={2} />}>
                                            First name
                                        </FieldLabel>
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
                                        <FieldLabel icon={<User className="h-3.5 w-3.5" strokeWidth={2} />}>
                                            Last name
                                        </FieldLabel>
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
                                        <FieldLabel icon={<Mail className="h-3.5 w-3.5" strokeWidth={2} />}>
                                            Email address
                                        </FieldLabel>
                                        <input
                                            required
                                            type="email"
                                            placeholder="admin@example.com"
                                            value={profile.email}
                                            className={inputClass}
                                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                        />
                                    </label>

                                    <label className="block sm:col-span-2">
                                        <FieldLabel icon={<Phone className="h-3.5 w-3.5" strokeWidth={2} />}>
                                            Phone number
                                        </FieldLabel>
                                        <input
                                            type="tel"
                                            placeholder="98XXXXXXXX"
                                            value={profile.phone}
                                            className={inputClass}
                                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                        />
                                    </label>
                                </div>

                                <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
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

                            {/* Password Form */}
                            <form onSubmit={handleChangePassword} className="p-6 sm:p-8">
                                <div className="mb-6">
                                    <h3 className="text-2xl font-semibold text-[#345263]">Password & Security</h3>

                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <label className="block sm:col-span-2">
                                        <FieldLabel icon={<Lock className="h-3.5 w-3.5" strokeWidth={2} />}>
                                            Current password
                                        </FieldLabel>
                                        <div className="relative">
                                            <input
                                                required
                                                type={showCurrentPw ? "text" : "password"}
                                                placeholder="Current password"
                                                value={passwordForm.currentPassword}
                                                className={`${inputClass} pr-10`}
                                                onChange={(e) =>
                                                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                                                }
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
                                                className={`${inputClass} pr-10`}
                                                onChange={(e) =>
                                                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                                                }
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
                                                className={`${inputClass} pr-10`}
                                                onChange={(e) =>
                                                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                                                }
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

                                <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
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
        </div>
    );
}