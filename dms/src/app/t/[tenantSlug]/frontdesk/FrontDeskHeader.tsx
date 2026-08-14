"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";

import { Calendar, Users, Eye, LogOut, Settings, LayoutDashboard, Wallet } from "lucide-react";

export type FrontDeskTabType = "dashboard" | "appointments" | "patients" | "availability" | "billing" | "settings";

interface FrontDeskHeaderProps {
  activeTab: FrontDeskTabType;
  setActiveTab: (tab: FrontDeskTabType) => void;
  onLogout?: () => void;
}

function formatSlug(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function FrontDeskHeader({
  activeTab,
  setActiveTab,
  onLogout,
}: FrontDeskHeaderProps) {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug ?? "";

  const [orgName, setOrgName] = useState<string>(
    tenantSlug ? formatSlug(tenantSlug) : "Clinic Management"
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);




  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      await axios.post("/api/auth/logout");

      if (onLogout) {
        onLogout();
      }
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsLoggingOut(false);
      const loginPath = tenantSlug ? `/t/${tenantSlug}/login` : "/login";
      router.push(loginPath);
      router.refresh();
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center justify-center gap-6 border-b border-slate-900/5 pb-8 text-center">
      {/* Top Right Logout Action */}
      <div className="absolute top-0 right-0">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50/50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 transition-all duration-200 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-700 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
        </button>
      </div>

      {/* Header Info */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7da3b3]">
          Front Desk
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          {orgName}
        </h1>
      </div>

      {/* Centered, Light Theme Navigation Container */}
      <div className="inline-flex w-full max-w-2xl items-center gap-1 rounded-full bg-slate-100 p-1.5 shadow-md shadow-slate-200/50 border border-slate-200/60">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${activeTab === "dashboard"
              ? "bg-[#7da3b3] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Dashboard
        </button>

        <button
          onClick={() => setActiveTab("appointments")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${activeTab === "appointments"
            ? "bg-[#7da3b3] text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Appointments
        </button>

        <button
          onClick={() => setActiveTab("patients")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${activeTab === "patients"
            ? "bg-[#7da3b3] text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
        >
          <Users className="h-3.5 w-3.5" />
          Patients
        </button>

        <button
          onClick={() => setActiveTab("availability")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${activeTab === "availability"
            ? "bg-[#7da3b3] text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
        >
          <Eye className="h-3.5 w-3.5" />
          Schedules
        </button>

        <button
          onClick={() => setActiveTab("billing")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${activeTab === "billing"
            ? "bg-[#7da3b3] text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
        >
          <Wallet className="h-3.5 w-3.5" />
          Billing
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${activeTab === "settings"
            ? "bg-[#7da3b3] text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
      </div>
    </div>
  );
}