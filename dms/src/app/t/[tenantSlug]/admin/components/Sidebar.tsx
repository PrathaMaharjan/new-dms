"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import axios from "axios";
import { useState, useEffect, useMemo } from "react";
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
  BarChart3,
  Receipt,
  Briefcase,
  Menu,
  X,
  ChevronDown,
  Building2,
} from "lucide-react";
import { getImageUrl } from "@/lib/cloudinary/storage";

type NavLeaf = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  requiresInventory?: boolean;
};

type NavGroup = {
  groupLabel: string;
  icon: typeof LayoutDashboard;
  items: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

// Structure mirrors OrgSidebar: Operations / Care / Inventory / Finance,
// minus outlet-specific items (Outlets, Commission) that only apply at the org level.
const NAV_STRUCTURE: NavEntry[] = [
  { label: "Dashboard", href: "", icon: LayoutDashboard, exact: true },
  { label: "Analytics", href: "/analytics", icon: BarChart3, exact: true },
  {
    groupLabel: "Operations",
    icon: Users,
    items: [
      { label: "Staffs", href: "/staffs", icon: Users },
      { label: "Doctors", href: "/doctors", icon: Stethoscope },
    ],
  },
  {
    groupLabel: "Care",
    icon: CalendarDays,
    items: [
      { label: "Appointments", href: "/appointments", icon: CalendarDays },
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Treatments", href: "/treatments", icon: Briefcase },
    ],
  },
  {
    groupLabel: "Inventory",
    icon: Package,
    items: [
      { label: "Inventory", href: "/inventory", icon: Package, requiresInventory: true },
      { label: "Service Material", href: "/material", icon: Wrench, requiresInventory: true },
    ],
  },
  {
    groupLabel: "Finance",
    icon: Wallet,
    items: [
      { label: "Billing", href: "/billing", icon: Wallet },
      { label: "Expenses", href: "/expenses", icon: Receipt },
    ],
  },
  { label: "Settings", href: "/settings", icon: Settings },
];

function formatTenantSlug(slug?: string): string {
  if (!slug) return "Chitwan Dental";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function TenantLogo({
  logoUrl,
  name,
  size = "md",
}: {
  logoUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  const formattedUrl = useMemo(() => getImageUrl(logoUrl), [logoUrl]);

  const dimensions =
    size === "sm"
      ? "h-14 max-w-[220px]"
      : size === "md"
        ? "h-16 max-w-[260px]"
        : "h-20 max-w-[280px]";

  const iconDimensions =
    size === "sm" ? "h-14 w-14 text-xl" : size === "md" ? "h-16 w-16 text-2xl" : "h-20 w-20 text-3xl";

  if (formattedUrl && !hasError) {
    return (
      <div className={`relative ${dimensions} w-full shrink-0 flex items-center justify-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={formattedUrl}
          alt={name}
          className="h-full w-auto max-w-full object-contain"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  const initial = name ? name.trim().charAt(0).toUpperCase() : "";

  return (
    <div className={`flex ${iconDimensions} shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/20 text-white font-bold shadow-xs mx-auto`}>
      {initial || <Building2 className={size === "sm" ? "h-5 w-5 text-white" : "h-7 w-7 text-white"} />}
    </div>
  );
}

interface SidebarProps {
  inventoryEnabled?: boolean;
  logoUrl?: string | null;
  tenantName?: string;
}

function Sidebar({ inventoryEnabled = true, logoUrl, tenantName }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const adminRoot = `/t/${params.tenantSlug}/admin`;

  const NAV_ITEMS = useMemo(
    () =>
      NAV_STRUCTURE.map((entry) => {
        if (isGroup(entry)) {
          return {
            ...entry,
            items: entry.items.filter((item) => !item.requiresInventory || inventoryEnabled),
          };
        }
        return entry;
      }).filter((entry) => (isGroup(entry) ? entry.items.length > 0 : true)),
    [inventoryEnabled]
  );

  function isLeafActive(href: string, exact?: boolean) {
    const fullHref = `${adminRoot}${href}`;
    return exact
      ? pathname === fullHref
      : pathname === fullHref || pathname?.startsWith(`${fullHref}/`);
  }

  // Auto-expand whichever group contains the currently active route
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const entry of NAV_ITEMS) {
      if (isGroup(entry)) {
        next[entry.groupLabel] = entry.items.some((item) => isLeafActive(item.href, item.exact));
      }
    }
    setOpenGroups((prev) => ({ ...prev, ...next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  async function handleLogout() {
    await axios.post(
      "/api/auth/logout",
      {},
      { withCredentials: true }
    );
    router.push(`/login`);
    router.refresh();
  }

  const displayTitle = tenantName || formatTenantSlug(params.tenantSlug);

  return (
    <>
      {/* Mobile top bar toggle (only visible below lg) */}
      <div className="sticky top-0 z-30 flex items-center justify-center bg-[#3f6274] px-4 py-3 shadow-sm lg:hidden w-full relative">
        <TenantLogo logoUrl={logoUrl} name={displayTitle} size="sm" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
        >
          <Menu className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>

      {/* Backdrop, mobile only, shown when sidebar is open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar
          - Mobile: fixed overlay panel that slides in/out, closed by default
          - Desktop (lg+): sticky column pinned to viewport height, part of normal flex layout */}
      <aside
        className={[
          "flex w-70 shrink-0 flex-col bg-[#3f6274] py-6 shadow-2xl lg:shadow-none",
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:transition-none",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 px-6 relative">
          <TenantLogo logoUrl={logoUrl} name={displayTitle} size="lg" />
          {/* Close button, mobile only */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white hover:bg-white/10 lg:hidden shrink-0 cursor-pointer"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="px-6">
          <hr className="border-white/15 mt-5" />
        </div>

        {/* Nav */}
        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-hide">
          {NAV_ITEMS.map((entry) => {
            if (isGroup(entry)) {
              const GroupIcon = entry.icon;
              const isOpen = !!openGroups[entry.groupLabel];
              const groupHasActive = entry.items.some((item) => isLeafActive(item.href, item.exact));

              return (
                <div key={entry.groupLabel} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => toggleGroup(entry.groupLabel)}
                    className={[
                      "flex w-full items-center justify-between gap-3 pl-5 pr-6 py-3 text-[0.9rem] font-medium transition-colors border-l-4",
                      groupHasActive
                        ? "text-white border-[#3f6274]"
                        : "text-white/85 hover:bg-white/10 hover:text-white border-transparent",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-3">
                      <GroupIcon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} />
                      {entry.groupLabel}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      strokeWidth={2}
                    />
                  </button>

                  <div
                    className={`grid overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                  >
                    <div className="overflow-hidden">
                      {entry.items.map(({ label, href, icon: Icon, exact }) => {
                        const fullHref = `${adminRoot}${href}`;
                        const active = isLeafActive(href, exact);

                        return (
                          <Link
                            key={fullHref}
                            href={fullHref}
                            onClick={() => setOpen(false)}
                            className={[
                              "flex w-full items-center gap-3 pl-11 pr-6 py-2.5 text-[0.85rem] font-medium transition-colors border-l-4",
                              active
                                ? "bg-white text-[#3f6274] border-[#3f6274]"
                                : "text-white/75 hover:bg-white/10 hover:text-white border-transparent",
                            ].join(" ")}
                          >
                            <Icon className="h-4 w-4" strokeWidth={2} />
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            const { label, href, icon: Icon, exact } = entry;
            const fullHref = `${adminRoot}${href}`;
            const active = isLeafActive(href, exact);

            return (
              <Link
                key={fullHref}
                href={fullHref}
                onClick={() => setOpen(false)}
                className={[
                  "flex w-full items-center gap-3 pl-5 pr-6 py-3 text-[0.9rem] font-medium transition-colors border-l-4",
                  active
                    ? "bg-white text-[#3f6274] border-[#3f6274]"
                    : "text-white/85 hover:bg-white/10 hover:text-white border-transparent",
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
    </>
  );
}

export default Sidebar;