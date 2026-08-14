"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, User, Phone, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

  }

  return (
    <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white px-4 py-16">

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <ToothOutline className="absolute -left-16 top-24 h-64 w-64 text-sky-200/60 -rotate-12" />
        <ToothOutline className="absolute -right-20 top-[28rem] h-80 w-80 text-sky-200/50 rotate-12" />
        <ToothbrushOutline className="absolute left-[8%] bottom-16 h-40 w-40 text-sky-200/50 -rotate-6" />
        <SparkleOutline className="absolute right-[12%] top-16 h-10 w-10 text-sky-300/70" />
        <SparkleOutline className="absolute left-[20%] top-[42%] h-6 w-6 text-sky-300/60" />
        <CircleRing className="absolute right-[6%] bottom-[8%] h-56 w-56 text-sky-200/40" />
      </div>

      <div className="relative mx-auto w-full max-w-md pt-10">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-400">
            Member Access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
            Create an account
          </h1>

        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-[2rem] border border-slate-900/[0.06] bg-white p-9 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.22)] sm:p-10"
        >
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                <User className="h-3.5 w-3.5" strokeWidth={2} />
                Full name
              </span>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-slate-900/10 bg-slate-50/60 px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                Email
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="youremail@clinic.com"
                className="w-full rounded-xl border border-slate-900/10 bg-slate-50/60 px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                Phone
              </span>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                className="w-full rounded-xl border border-slate-900/10 bg-slate-50/60 px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                Password
              </span>
              <div className="relative">
                <input
                  required
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-slate-900/10 bg-slate-50/60 px-3.5 py-2.5 pr-11 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
              </div>
            </label>
          </div>

          <button
            type="submit"
            className="group relative mt-9 h-[52px] w-full overflow-hidden rounded-full border border-[#a5c5d1] shadow-[0_10px_24px_-12px_rgba(125,163,179,0.6)]"
          >
            <div className="inline-flex h-[52px] w-full items-center justify-center gap-2 bg-[#7da3b3] px-10 text-[0.95rem] font-medium text-white transition-transform duration-300 group-hover:-translate-y-full">
              Create Account
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="absolute inset-0 inline-flex h-[52px] w-full translate-y-full items-center justify-center gap-2 bg-white px-10 text-[0.95rem] font-medium text-slate-900 transition-transform duration-300 group-hover:translate-y-0">
              Create Account
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </div>
          </button>
        </form>

        <p className="mt-6 text-center text-[0.9rem] text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-sky-700 underline-offset-4 hover:underline">
            Sign in
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