"use client";

import { usePathname } from "next/navigation";
import SuperAdminSidebar from "./components/Sidebar";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/superadmin";

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SuperAdminSidebar />

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}