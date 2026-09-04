"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  CreditCard,
  FolderOpen,
  LogOut,
  UserStar,
} from "lucide-react";
import { clearReturnUrl, getReturnUrl } from "@/lib/patient-navigation";
import axios from "axios";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: "Home", path: "/patientPortal/dashboard", icon: Home },
    {
      label: "Appointments",
      path: "/patientPortal/appointments",
      icon: Calendar,
    },
    { label: "Billing", path: "/patientPortal/billing", icon: CreditCard },
    { label: "Records", path: "/patientPortal/records", icon: FolderOpen },
    { label: "My Detail", path: "/patientPortal/myDetail", icon: UserStar },
  ];

  const handleNavigation = (path: string) => {
    router.push(path);
  };

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

  return (
    <header className="relative w-full overflow-hidden bg-[#edf7fc] px-6 py-8">
      <div className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full border-4 border-sky-100/60" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-3">
          <div className="hidden sm:block" />

          <div className="text-center">
            <span className="text-[0.7rem] font-bold tracking-[0.2em] text-[#7da3b3] uppercase">
              PATIENT PORTAL
            </span>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#1e3240] sm:text-3xl">
              Sunrise Dental Group
            </h1>
          </div>

          <div className="flex justify-center sm:justify-end">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50/50 px-4 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100/80 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
              Logout
            </button>
          </div>
        </div>

        <nav className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 p-1.5 shadow-[0_4px_20px_-4px_rgba(52,82,99,0.08)] backdrop-blur-md border border-slate-100">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-[#7da3b3] text-white shadow-md shadow-[#7da3b3]/20"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
