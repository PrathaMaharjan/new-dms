"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import axios from "axios";
import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Store,
  Users,
  Briefcase,
  Settings,
  LogOut,
  CalendarDays,
  Package,
  Wrench,
  Stethoscope,
  Wallet,
  Receipt,
  BarChart3,
  Percent,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

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

const NAV_STRUCTURE: NavEntry[] = [
  { label: "Dashboard", href: "", icon: LayoutDashboard, exact: true },
  { label: "Analytics", href: "/analytics", icon: BarChart3, exact: true },
  {
    groupLabel: "Operations",
    icon: Store,
    items: [
      { label: "Outlets", href: "/outlets", icon: Store },
      { label: "Staffs", href: "/staffs", icon: Users },
      { label: "Doctors", href: "/doctors", icon: Stethoscope },
      { label: "Commission", href: "/commision", icon: Percent },
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
  if (!slug) return "Chitwan Group";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface OrgSidebarProps {
  inventoryEnabled?: boolean;
}

function OrgSidebar({ inventoryEnabled = true }: OrgSidebarProps) {
  const pathname = usePathname();
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const orgRoot = `/t/${params.tenantSlug}/organization`;

  const ORG_NAV_ITEMS = useMemo(
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
    const fullHref = `${orgRoot}${href}`;
    return exact
      ? pathname === fullHref
      : pathname === fullHref || pathname?.startsWith(`${fullHref}/`);
  }

  // Auto-expand whichever group contains the currently active route
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const entry of ORG_NAV_ITEMS) {
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
    try {
      await axios.post(
        "/api/auth/logout",
        {},
        { withCredentials: true }
      );
      router.push(`/login`);
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const displayTitle = formatTenantSlug(params.tenantSlug);

  return (
    <>
      {/* Mobile top bar toggle (only visible below lg) */}
      <div className="flex items-center justify-between bg-[#3f6274] px-4 py-3 lg:hidden">
        <span className="text-lg font-semibold text-white capitalize truncate" title={displayTitle}>
          {displayTitle}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-white hover:bg-white/10"
        >
          <Menu className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>

      {/* Backdrop, mobile only, shown when sidebar is open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar
          - Mobile: fixed overlay panel that slides in/out, closed by default
          - Desktop (lg+): sticky column pinned to viewport height, part of normal flex layout */}
      <aside
        className={[
          "flex w-70 shrink-0 flex-col bg-[#3f6274] py-6",
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:transition-none",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-1 px-6">
          <span className="text-2xl font-semibold tracking-tight text-white capitalize truncate" title={displayTitle}>
            {displayTitle}
          </span>
          {/* Close button, mobile only */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1 text-white hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="px-6">
          <hr className="border-white/15 mt-7" />
        </div>

        {/* Nav */}
        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-hide">
          {ORG_NAV_ITEMS.map((entry) => {
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
                    className={`grid overflow-hidden transition-all duration-200 ease-in-out ${
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      {entry.items.map(({ label, href, icon: Icon, exact }) => {
                        const fullHref = `${orgRoot}${href}`;
                        const active = isLeafActive(href, exact);

                        return (
                          <Link
                            key={fullHref}
                            href={fullHref}
                            onClick={() => setOpen(false)}
                            className={[
                              "flex w-full items-center gap-3 pl-11 pr-6 py-2.5 text-[0.85rem] font-medium transition-colors border-l-4",
                              active
                                ? "bg-white text-[#1e293b] border-[#3f6274]"
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
            const fullHref = `${orgRoot}${href}`;
            const active = isLeafActive(href, exact);

            return (
              <Link
                key={fullHref}
                href={fullHref}
                onClick={() => setOpen(false)}
                className={[
                  "flex w-full items-center gap-3 pl-5 pr-6 py-3 text-[0.9rem] font-medium transition-colors border-l-4",
                  active
                    ? "bg-white text-[#1e293b] border-[#3f6274]"
                    : "text-white/85 hover:bg-white/10 hover:text-white border-transparent",
                ].join(" ")}
              >
                <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>

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

export default OrgSidebar;