"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
// import Navbar from "./Navbar";
// import Footer from "./Footer";

type SiteChromeContextType = {
  hideChrome: boolean;
  setHideChrome: (val: boolean) => void;
};

const SiteChromeContext = createContext<SiteChromeContextType>({
  hideChrome: false,
  setHideChrome: () => { },
});

export function useSiteChrome() {
  return useContext(SiteChromeContext);
}

export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [hideChrome, setHideChrome] = useState(false);

  // Reset hideChrome when pathname changes
  useEffect(() => {
    setHideChrome(false);
  }, [pathname]);

  const isTenantDashboard = pathname
    ? /^\/t\/[^/]+\/(admin|frontdesk|doctor|organization)(\/|$)/.test(pathname)
    : false;

  const isSuperAdmin = pathname?.startsWith("/superadmin");
  const isPatientPortal = pathname?.startsWith("/patientPortal");

  const shouldHideChrome = isTenantDashboard || isSuperAdmin || isPatientPortal || hideChrome;

  return (
    <SiteChromeContext.Provider value={{ hideChrome, setHideChrome }}>
      {/* {!shouldHideChrome && <Navbar />} */}
      {children}
      {/* {!shouldHideChrome && <Footer />} */}
    </SiteChromeContext.Provider>
  );
}