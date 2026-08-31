"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  Mail,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type Step = "email" | "code";

export default function PatientLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const organizationName = searchParams.get("org") ?? "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationName) {
      setError(
        "This link is missing the clinic information. Please use the link provided by your clinic."
      );
    }
  }, [organizationName]);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      await axios.post("/api/patient-auth/request-code", {
        email,
        organizationName,
      });
      setInfoMessage("A verification code has been sent to your email.");
      setStep("code");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error ?? "Something went wrong. Please try again."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: responseBody } = await axios.post(
        "/api/patient-auth/verify-code",
        {
          email,
          organizationName,
          code,
        }
      );

      if (!responseBody?.success) {
        setError(responseBody?.error ?? "Invalid or expired code.");
        return;
      }

      router.push("/patientPortal/dashboard");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Invalid or expired code.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white px-4 py-12 selection:bg-sky-100 selection:text-sky-900">
      {/* Background Glow Accents */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-sky-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 -z-10 h-[400px] w-[400px] rounded-full bg-slate-100/80 blur-3xl" />

      <div className="relative mx-auto w-full max-w-md">
        {/* Clinic Brand Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#7da3b3] to-[#9bbecb] text-white shadow-lg shadow-[#7da3b3]/25 ring-8 ring-white">
            <ShieldCheck className="h-7 w-7" strokeWidth={2} />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-[#345263]">
            Patient Portal
          </h1>

          {step === "email" && (
            <div className="mt-2 space-y-3">
              {organizationName ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-md">
                  <Building2 className="h-3.5 w-3.5 text-[#7da3b3]" strokeWidth={2.2} />
                  <span>{organizationName}</span>
                </div>
              ) : null}

              <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500">
                Please enter the email address on file with your clinic to securely log into your portal.
              </p>
            </div>
          )}
        </div>

        {/* Auth Container Card */}
        <div className="mt-7 rounded-[2.5rem] border border-slate-200/60 bg-white/90 p-8 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-10">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 text-xs text-rose-700 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" strokeWidth={2} />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {infoMessage && !error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 text-xs text-emerald-800 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
              <p className="font-medium leading-relaxed">{infoMessage}</p>
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleRequestCode} noValidate className="space-y-5">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Mail className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                  Email Address
                </label>
                <div className="relative">
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={!organizationName}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100/70 disabled:opacity-60"
                  />
                </div>
                <p className="mt-2 text-[0.75rem] leading-relaxed text-slate-400">
                  We'll send a 6-digit verification code to this email.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !organizationName}
                className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#7da3b3] text-sm font-semibold text-white shadow-lg shadow-[#7da3b3]/25 transition-all duration-200 hover:bg-[#6b92a2] hover:shadow-xl hover:shadow-[#7da3b3]/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.2} />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} noValidate className="space-y-5">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <KeyRound className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                  Verification Code
                </label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-center text-2xl font-bold tracking-[0.4em] text-[#345263] outline-none transition-all duration-200 placeholder:tracking-normal placeholder:text-slate-300 hover:border-slate-300 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
                <p className="mt-2 text-center text-[0.75rem] text-slate-400">
                  Sent to <span className="font-semibold text-slate-600">{email}</span>. Expires in 10 minutes.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#7da3b3] text-sm font-semibold text-white shadow-lg shadow-[#7da3b3]/25 transition-all duration-200 hover:bg-[#6b92a2] hover:shadow-xl hover:shadow-[#7da3b3]/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.2} />
                ) : (
                  <>
                    <span>Verify & Log In</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setInfoMessage(null);
                }}
                className="w-full text-center text-xs font-medium text-slate-500 transition-colors duration-150 hover:text-[#345263] hover:underline"
              >
                Use a different email address
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}