"use client";

import { usePathname } from "next/navigation";
import Navbar from "./componets/Navbar";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Update this to match your login path
  const isLoginPage = pathname === "/patientPortal" || pathname === "/login";

  return (
    <>
      {!isLoginPage && <Navbar />}
      <main className="w-full bg-[#edf7fc] px-4 py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </>
  );
}