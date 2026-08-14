"use client";

import { useState, useEffect } from "react";
import BackgroundDecorations from "../BackgroundDecorations";
import FrontDeskHeader from "./FrontDeskHeader";
import AppointmentsTab from "./AppointmentsTab";
import PatientsTab from "./PatientsTab";
import DoctorAvailabilityTab from "./DoctorAvailabilityTab";
import SettingsTab from "./SettingsTab";
import DashboardTab from "./DashboardTab";
import BillingTab from "./BillingTab";

type FrontDeskTabType = "dashboard" | "appointments" | "patients" | "availability" | "billing" | "settings";

export default function FrontDeskPage() {
  const [activeTab, setActiveTabState] = useState<FrontDeskTabType>("dashboard");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab") as FrontDeskTabType;
      const validTabs: FrontDeskTabType[] = ["dashboard", "appointments", "patients", "availability", "billing", "settings"];
      if (urlTab && validTabs.includes(urlTab)) {
        setActiveTabState(urlTab);
      } else {
        const savedTab = localStorage.getItem("frontdesk_active_tab") as FrontDeskTabType;
        if (savedTab && validTabs.includes(savedTab)) {
          setActiveTabState(savedTab);
        }
      }
    }
  }, []);

  const setActiveTab = (tab: FrontDeskTabType) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("frontdesk_active_tab", tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <section className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-sky-50 via-white to-white text-slate-900">
      <BackgroundDecorations />

      <div className="relative mx-auto w-full px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <FrontDeskHeader activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="mt-10">
          {activeTab === "dashboard" && <DashboardTab onNavigate={setActiveTab} />}
          {activeTab === "appointments" && <AppointmentsTab />}
          {activeTab === "patients" && <PatientsTab />}
          {activeTab === "availability" && <DoctorAvailabilityTab />}
          {activeTab === "billing" && <BillingTab />}
          {activeTab === "settings" && <SettingsTab />}
        </div>
      </div>
    </section>
  );
}