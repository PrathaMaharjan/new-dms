"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchX, ArrowLeft, Home } from "lucide-react";
import { useSiteChrome } from "./components/SiteChrome";

export default function NotFound() {
  const router = useRouter();
  const { setHideChrome } = useSiteChrome();

  useEffect(() => {
    setHideChrome(true);
    return () => setHideChrome(false);
  }, [setHideChrome]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 flex items-center justify-center px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 border border-sky-100">
          <SearchX className="h-8 w-8 text-[#7da3b3]" />
        </div>

        <div className="space-y-2">
          <p className="text-6xl font-black text-[#345263] tracking-tight">404</p>
          <h1 className="text-base font-bold text-slate-900">Page Not Found</h1>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
            Please check the URL or head back to your dashboard.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#345263] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#253d4b] transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}