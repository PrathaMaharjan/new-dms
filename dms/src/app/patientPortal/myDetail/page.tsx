"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Loader2, AlertCircle, X, Check } from "lucide-react";
import { clearReturnUrl, getReturnUrl } from "@/lib/patient-navigation";

type ProfileData = {
  personal: {
    fullName: string;
    dob: string | null;
    gender: string | null;
    bloodGroup: string | null;
  };
  contact: {
    mobile: string | null;
    email: string | null;
    address: string | null;
    preferredLanguage: string | null;
  };
  medicalFlags: {
    allergies: string[];
    conditions: string[];
    medications: string[];
  };
};

function formatDate(dob: string | null) {
  if (!dob) return "Not on file";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return dob;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function listOrFallback(items: string[], noneLabel: string) {
  return items.length > 0 ? items.join(", ") : noneLabel;
}

export default function MyDetailsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingContact, setEditingContact] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // Reminders state: SMS is toggleable, Email is permanently allowed/disabled from editing
  const [smsReminders, setSmsReminders] = useState(true);
  const [sixMonthRecall, setSixMonthRecall] = useState(true);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const { data: responseBody } = await axios.get(
          "/api/patient-portal/profile",
        );
        if (responseBody?.success) {
          setProfile(responseBody.data);
        } else {
          setError(
            responseBody?.error ?? "Something went wrong loading your details.",
          );
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(
            err.response?.data?.error ??
              "Something went wrong loading your details.",
          );
        } else {
          setError("Something went wrong loading your details.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  function startEditContact() {
    setPhoneInput(profile?.contact.mobile ?? "");
    setEditingContact(true);
  }

  async function handleSaveContact() {
    setSavingContact(true);
    setError(null);
    try {
      const { data: responseBody } = await axios.patch(
        "/api/patient-portal/profile",
        { phone: phoneInput },
      );
      if (!responseBody?.success) {
        setError(
          responseBody?.error ??
            "Something went wrong updating your contact details.",
        );
        return;
      }
      setProfile((prev) =>
        prev
          ? { ...prev, contact: { ...prev.contact, mobile: phoneInput } }
          : prev,
      );
      setEditingContact(false);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error ??
            "Something went wrong updating your contact details.",
        );
      } else {
        setError("Something went wrong updating your contact details.");
      }
    } finally {
      setSavingContact(false);
    }
  }

  async function handleChangeEmail() {
    setEmailError(null);
    setEmailSaving(true);
    try {
      const { data: responseBody } = await axios.patch(
        "/api/patient-portal/profile/email",
        { newEmail },
      );
      if (!responseBody?.success) {
        setEmailError(
          responseBody?.error ?? "Something went wrong updating your email.",
        );
        return;
      }
      setProfile((prev) =>
        prev
          ? { ...prev, contact: { ...prev.contact, email: newEmail } }
          : prev,
      );
      setEmailModalOpen(false);
      setNewEmail("");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setEmailError(
          err.response?.data?.error ??
            "Something went wrong updating your email.",
        );
      } else {
        setEmailError("Something went wrong updating your email.");
      }
    } finally {
      setEmailSaving(false);
    }
  }


    const handleLogout = async () => {
    try {
      await axios.post("/api/patient-auth/logout");
    } catch {
    } finally {
      const returnUrl = getReturnUrl();
      clearReturnUrl(); 
      window.location.href = returnUrl;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#edf7fc]">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your details...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#edf7fc] p-6 md:p-12 font-sans text-slate-800">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#163048] sm:text-4xl">
              My details
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500 leading-relaxed">
              These fields come from your clinic record. You can edit contact
              details and preferences yourself; name, date of birth and clinical
              fields are changed by the clinic so records stay consistent.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
            {error}
          </div>
        )}

        {/* Top Grid: Personal, Contact, Reminders */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Personal Card */}
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                  PERSONAL
                </span>
                <button className="text-[0.7rem] font-medium text-slate-400 hover:text-[#7da3b3] transition-colors cursor-pointer">
                  Request a correction
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Full name</span>
                  <span className="text-xs font-semibold text-[#163048]">
                    {profile?.personal.fullName ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Date of birth</span>
                  <span className="text-xs font-semibold text-[#163048]">
                    {formatDate(profile?.personal.dob ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Gender</span>
                  <span className="text-xs font-semibold text-[#163048]">
                    {profile?.personal.gender ?? "Not on file"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Blood group</span>
                  <span className="text-xs font-semibold text-[#163048]">
                    {profile?.personal.bloodGroup ?? "Not on file"}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[0.68rem] text-slate-400 leading-normal">
              Changed by the clinic to keep clinical records consistent.
            </p>
          </div>

          {/* Contact Card */}
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                  CONTACT
                </span>
                {!editingContact ? (
                  <button
                    onClick={startEditContact}
                    className="text-[0.7rem] font-semibold text-[#7da3b3] hover:text-[#6b92a2] transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingContact(false)}
                      className="text-[0.7rem] font-medium text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveContact}
                      disabled={savingContact}
                      className="text-[0.7rem] font-semibold text-[#7da3b3] hover:text-[#6b92a2] disabled:opacity-60"
                    >
                      {savingContact ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Mobile</span>
                  {editingContact ? (
                    <input
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-36 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-semibold text-[#163048] outline-none focus:border-[#7da3b3]"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[#163048]">
                      {profile?.contact.mobile ?? "Not on file"}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Email</span>
                  <span className="text-xs font-semibold text-[#163048]">
                    {profile?.contact.email ?? "Not on file"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Address</span>
                  <span className="text-xs italic text-slate-400">
                    Not available yet
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">
                    Preferred language
                  </span>
                  <span className="text-xs italic text-slate-400">
                    Not available yet
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Reminders Card */}
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-sm">
            <div>
              <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                REMINDERS
              </span>

              <div className="mt-4 space-y-4 divide-y divide-slate-100">
                {/* SMS Reminders (Phone) - Allow user to toggle */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <h4 className="text-xs font-semibold text-[#163048]">
                      SMS reminders
                    </h4>
                    <p className="text-[0.68rem] text-slate-400">
                      24 hours before each visit
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    onClick={() => setSmsReminders(!smsReminders)}
                    // className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    //   smsReminders ? "bg-[#7da3b3]" : "bg-slate-200"
                    // }`}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-[#7da3b3]/50 opacity-80"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        smsReminders ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Email Reminders - Locked / Not allowed to change */}
                <div className="flex items-center justify-between pt-3">
                  <div>
                    <h4 className="text-xs font-semibold text-[#163048]">
                      Email reminders
                    </h4>
                    <p className="text-[0.68rem] text-slate-400">
                      Confirmations and receipts
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    title="Email preferences cannot be changed"
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-[#7da3b3]/50 opacity-80"
                  >
                    <span className="pointer-events-none inline-block h-5 w-5 transform translate-x-5 rounded-full bg-white shadow ring-0" />
                  </button>
                </div>

                {/* Six-month Recall */}
                <div className="flex items-center justify-between pt-3">
                  <div>
                    <h4 className="text-xs font-semibold text-[#163048]">
                      Six-month recall
                    </h4>
                    <p className="text-[0.68rem] text-slate-400">
                      When a check-up is due
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    onClick={() => setSixMonthRecall(sixMonthRecall)}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-[#7da3b3]/50 opacity-80"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        sixMonthRecall ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Medical Flags & Sign-in/Access */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-sm md:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                  MEDICAL FLAGS
                </span>
                <button className="text-[0.7rem] font-medium text-slate-400 hover:text-[#7da3b3] transition-colors cursor-pointer">
                  Request a correction
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Allergies</span>
                  <span className="text-xs font-semibold text-[#163048]">
                    {listOrFallback(
                      profile?.medicalFlags.allergies ?? [],
                      "None recorded",
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Conditions</span>
                  <span className="text-xs font-semibold text-[#163048]">
                    {listOrFallback(
                      profile?.medicalFlags.conditions ?? [],
                      "None recorded",
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Medications</span>
                  <span className="text-xs font-semibold text-[#163048]">
                    {listOrFallback(
                      profile?.medicalFlags.medications ?? [],
                      "None ongoing",
                    )}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[0.68rem] text-slate-400 leading-normal">
              Tell your clinician at your next visit if anything here is out of
              date.
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-sm">
            <div>
              <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                SIGN-IN & ACCESS
              </span>

              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                You sign in with a one-time code sent to{" "}
                <strong className="text-[#163048]">
                  {profile?.contact.email ?? "your email"}
                </strong>
                . There is no password to manage.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => {
                  setNewEmail("");
                  setEmailError(null);
                  setEmailModalOpen(true);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                Change email
              </button>
              <button
                onClick={handleLogout}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Email Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setEmailModalOpen(false)}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#163048]">Change email</h3>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>

            {emailError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {emailError}
              </div>
            )}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">
                New email address
              </span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#7da3b3]"
              />
            </label>

            <p className="mt-2 text-[0.7rem] text-slate-400">
              You'll need to use this new address the next time you sign in.
            </p>

            <button
              onClick={handleChangeEmail}
              disabled={!newEmail || emailSaving}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7da3b3] py-3 text-xs font-semibold text-white transition-colors hover:bg-[#6b92a2] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {emailSaving ? "Saving..." : "Update email"}
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
