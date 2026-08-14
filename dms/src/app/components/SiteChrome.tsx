"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

 
  const isTenantDashboard = pathname
    ? /^\/t\/[^/]+\/(admin|frontdesk|doctor|organization)(\/|$)/.test(pathname)
    : false;

 
  const isSuperAdmin = pathname?.startsWith("/superadmin");

  if (isTenantDashboard || isSuperAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}