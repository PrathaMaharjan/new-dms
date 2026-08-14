"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import axios from "axios";
import {
  LayoutDashboard,
  Stethoscope,
  CalendarDays,
  Users,
  Settings,
  LogOut,
  Wallet,
  Package,
  Wrench,
} from "lucide-react";

const BASE_NAV_ITEMS = [
  { label: "Dashboard", href: "", icon: LayoutDashboard, exact: true },
  { label: "Appointments", href: "/appointments", icon: CalendarDays },
  { label: "Doctors", href: "/doctors", icon: Stethoscope },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Staffs", href: "/staffs", icon: Users },
  { label: "Treatments", href: "/treatments", icon: CalendarDays },
  { label: "Billing", href: "/billing", icon: Wallet },
  { label: "Inventory", href: "/inventory", icon: Package, requiresInventory: true },
  { label: "Service Material", href: "/material", icon: Wrench, requiresInventory: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

function formatTenantSlug(slug?: string): string {
  if (!slug) return "Chitwan Dental";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface SidebarProps {
  inventoryEnabled?: boolean;
}

function Sidebar({ inventoryEnabled = true }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const adminRoot = `/t/${params.tenantSlug}/admin`;

  const NAV_ITEMS = BASE_NAV_ITEMS.filter(
    (item) => !item.requiresInventory || inventoryEnabled
  );

  async function handleLogout() {
    await axios.post(
      "/api/auth/logout",
      {},
      { withCredentials: true }
    );
    router.push(`/login`);
    router.refresh();
  }

  const displayTitle = formatTenantSlug(params.tenantSlug);

  return (
    <aside className="sticky top-0 flex h-screen w-70 shrink-0 flex-col self-start bg-[#3f6274]  py-6">

      {/* Brand */}
      <div className="flex flex-col gap-1 px-6">
        <span className="text-2xl font-semibold tracking-tight text-white capitalize truncate" title={displayTitle}>
          {displayTitle}
        </span>
        <hr className="border-white/15 mt-7" />
      </div>

      {/* Nav */}
      <nav className="mt-6 flex flex-1 flex-col gap-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
          const fullHref = `${adminRoot}${href}`;
          const active = exact
            ? pathname === fullHref
            : pathname === fullHref || pathname?.startsWith(`${fullHref}/`);

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
              <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Centered Logout Section */}
      <div className="mt-auto border-t border-white/15 px-4 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="group flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-[0.9rem] font-medium text-white/90 shadow-xs transition-all duration-200 hover:border-rose-300/30 hover:bg-red-500 hover:text-white hover:shadow-md cursor-pointer"
        >
          <LogOut className="h-[1.05rem] w-[1.05rem] transition-transform duration-200 group-hover:-translate-x-0.5" strokeWidth={2} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;