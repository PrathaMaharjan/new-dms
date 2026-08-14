"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Stethoscope, Home, ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

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
            The page you're looking for doesn't exist or may have been moved.
            Please check the URL or head back to your dashboard.
          </p>
        </div>

  
      </div>
    </div>
  );
}