"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { ArrowRight, ArrowLeft, AlertCircle, KeyRound } from "lucide-react";

export default function VerifyOTPPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  function handleChange(value: string, index: number) {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d+$/.test(pastedData)) return;

    const digits = pastedData.slice(0, 6).split("");
    const newOtp = [...otp];
    digits.forEach((digit, idx) => {
      newOtp[idx] = digit;
    });
    setOtp(newOtp);

    const nextIndex = Math.min(digits.length, 5);
    inputRefs.current[nextIndex]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fullOtp = otp.join("");
    if (fullOtp.length < 6) {
      setError("Please enter all 6 digits of your OTP code.");
      return;
    }

    setLoading(true);

    try {
      const { data: responseBody } = await axios.post(
        "/api/auth/verify-otp",
        { email, otp: fullOtp },
        { withCredentials: true }
      );

      if (!responseBody?.success) {
        setError(responseBody?.error ?? "Invalid or expired OTP code.");
        return;
      }

      const resetToken = responseBody?.data?.resetToken;
      router.push(`/reset-password?token=${resetToken}`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Invalid or expired OTP code.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendMessage(null);
    try {
      await axios.post("/api/auth/forgot-password", { email });
    } catch {
      // Deliberately silent either way, same "never confirm or deny"
      // principle the backend itself follows for this endpoint.
    } finally {
      setResendMessage("If an account exists with this email, a new code has been sent.");
    }
  }

  return (
    <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <ToothOutline className="absolute -left-16 top-24 h-64 w-64 -rotate-12 text-sky-200/60" />
        <ToothOutline className="absolute -right-20 top-[28rem] h-80 w-80 rotate-12 text-sky-200/50" />
        <ToothbrushOutline className="absolute bottom-16 left-[8%] h-40 w-40 -rotate-6 text-sky-200/50" />
        <SparkleOutline className="absolute right-[12%] top-16 h-10 w-10 text-sky-300/70" />
        <SparkleOutline className="absolute left-[20%] top-[42%] h-6 w-6 text-sky-300/60" />
        <CircleRing className="absolute bottom-[8%] right-[6%] h-56 w-56 text-sky-200/40" />
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-400">Security Verification</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Enter OTP Code</h1>
          <p className="mt-2 text-[0.9rem] text-slate-600">
            We sent a verification code to <span className="font-medium text-slate-900">{email || "your email"}</span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 rounded-[2rem] border border-slate-900/[0.06] bg-white p-9 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.22)] sm:p-10"
        >
          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[0.85rem] text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
              {error}
            </div>
          )}

          {resendMessage && (
            <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[0.85rem] text-sky-700">
              {resendMessage}
            </div>
          )}

          <div className="space-y-4">
            <span className="flex items-center justify-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
              <KeyRound className="h-3.5 w-3.5 text-sky-500" strokeWidth={2} />
              6-Digit Code
            </span>

            <div className="flex items-center justify-between gap-2 pt-1">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  onChange={(e) => handleChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={handlePaste}
                  className="h-12 w-12 rounded-xl border border-slate-900/10 bg-slate-50/60 text-center text-lg font-semibold text-slate-900 outline-none transition-colors focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 sm:h-13 sm:w-13 sm:text-xl"
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative mt-9 h-[52px] w-full overflow-hidden rounded-full border border-[#a5c5d1] shadow-[0_10px_24px_-12px_rgba(125,163,179,0.6)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="inline-flex h-[52px] w-full items-center justify-center gap-2 bg-[#7da3b3] px-10 text-[0.95rem] font-medium text-white transition-transform duration-300 group-hover:-translate-y-full">
              {loading ? "Verifying..." : "Verify Code"}
              {!loading && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
            </div>
            <div className="absolute inset-0 inline-flex h-[52px] w-full translate-y-full items-center justify-center gap-2 bg-white px-10 text-[0.95rem] font-medium text-slate-900 transition-transform duration-300 group-hover:translate-y-0">
              {loading ? "Verifying..." : "Verify Code"}
              {!loading && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
            </div>
          </button>
        </form>

        <p className="mt-6 text-center text-[0.9rem] text-slate-600">
          Didn't receive the code?{" "}
          <button type="button" onClick={handleResend} className="font-medium text-sky-700 underline-offset-4 hover:underline">
            Resend OTP
          </button>
        </p>

        <p className="mt-6 text-center text-[0.9rem] text-slate-600">
          <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-sky-700 underline-offset-4 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Back to sign in
          </Link>
        </p>
      </div>
    </section>
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