"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const looksLikePhone = identifier.length > 0 && !identifier.includes("@");
  const IdentifierIcon = looksLikePhone ? Phone : Mail;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = identifier.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (looksLikePhone) {
      setError("Superadmin accounts sign in with email only, not phone number.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const { data: responseBody } = await axios.post("/api/superadmin/login", {
        email: trimmedEmail,
        password,
      });

      if (!responseBody?.success) {
        setError(responseBody?.error ?? "Invalid email or password.");
        return;
      }

      router.push("/superadmin/dashboard");
      router.refresh();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? "Something went wrong. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white px-4 py-16">
      <div className="relative mx-auto w-full max-w-md">
        <div className="text-center">
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
            Admin Login
          </h1>
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

          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                <IdentifierIcon className="h-3.5 w-3.5" strokeWidth={2} />
                Email or phone number
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@gmail.com or 9XXXXXXXXX"
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[0.85rem] text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                />
                Remember me
              </label>
              <Link
                href="/forgot-password"
                className="text-[0.85rem] font-medium text-sky-700 underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative mt-9 h-[52px] w-full overflow-hidden rounded-full border border-[#a5c5d1] shadow-[0_10px_24px_-12px_rgba(125,163,179,0.6)] disabled:opacity-60"
          >
            <div className="inline-flex h-[52px] w-full items-center justify-center gap-2 bg-[#7da3b3] px-10 text-[0.95rem] font-medium text-white transition-transform duration-300 group-hover:-translate-y-full">
              {loading ? "Signing in..." : "Sign In"}
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="absolute inset-0 inline-flex h-[52px] w-full translate-y-full items-center justify-center gap-2 bg-white px-10 text-[0.95rem] font-medium text-slate-900 transition-transform duration-300 group-hover:translate-y-0">
              {loading ? "Signing in..." : "Sign In"}
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </div>
          </button>
        </form>

        <p className="mt-6 text-center text-[0.9rem] text-slate-600">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-sky-700 underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </section>
  );
}
