"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import {
  LayoutDashboard,
  Building2,
  Settings,
  LogOut,
  Lock,
} from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Organizations",
    href: "/organizations",
    icon: Building2,
  },
  {
    label: "Permissions",
    href: "/permissions",
    icon: Lock,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

function SuperAdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const superAdminRoot = "/superadmin";

  async function handleLogout() {
    try {
      await axios.post(
        "/api/auth/logout",
        {},
        { withCredentials: true }
      );

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <aside className="sticky top-0 flex h-screen w-70 shrink-0 flex-col self-start bg-[#3f6274] py-6">
      {/* Brand */}
      <div className="flex items-center justify-center gap-2 px-6">
        <span className="text-2xl font-semibold tracking-tight text-white">
          Abstrakt
        </span>
      </div>
      <hr className="text-white/50 mx-5 mt-4" />

      {/* Nav */}
      <nav className="mt-6 flex flex-1 flex-col gap-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
          const fullHref = `${superAdminRoot}${href}`;

          const active = exact
            ? pathname === fullHref
            : pathname === fullHref ||
            pathname?.startsWith(`${fullHref}/`);

          return (
            <Link
              key={fullHref}
              href={fullHref}
              className={[
                "flex w-full items-center gap-3 rounded-none pl-5 pr-6 py-3 text-[0.9rem] font-medium transition-colors",
                active
                  ? "bg-white text-[#3f6274] border-l-4 border-[#3f6274]"
                  : "text-white/85 hover:bg-white/10 hover:text-white border-l-4 border-transparent",
              ].join(" ")}
            >
              <Icon
                className="h-[1.05rem] w-[1.05rem]"
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="mt-auto border-t border-white/15 px-4 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="group flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[0.9rem] font-medium text-white/90 shadow-xs transition-all duration-200 hover:border-rose-300/30 hover:bg-red-500 hover:text-white hover:shadow-md"
        >
          <LogOut
            className="h-[1.05rem] w-[1.05rem] transition-transform duration-200 group-hover:-translate-x-0.5"
            strokeWidth={2}
          />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

export default SuperAdminSidebar;