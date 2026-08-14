"use client";

import { useState, useEffect } from "react";
import BackgroundDecorations from "../BackgroundDecorations";
import DoctorHeader, { DoctorTabType } from "./DoctorHeader";
import DoctorScheduleTab from "./DoctorScheduleTab";
import DoctorAppointmentsTab from "./DoctorAppointmentTab";
import DoctorPatientsTab from "./DoctorPatientsTab";
import DoctorSettingsTab from "./DoctorSettingsTab";
import DoctorDashboardTab from "./DoctorDashboardTab";

export default function DoctorPage() {
  const [activeTab, setActiveTabState] = useState<DoctorTabType>("appointments");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab") as DoctorTabType;
      const validTabs: DoctorTabType[] = ["dashboard", "appointments", "patients", "schedule", "settings"];
      if (urlTab && validTabs.includes(urlTab)) {
        setActiveTabState(urlTab);
      } else {
        const savedTab = localStorage.getItem("doctor_active_tab") as DoctorTabType;
        if (savedTab && validTabs.includes(savedTab)) {
          setActiveTabState(savedTab);
        }
      }
    }
  }, []);

  const setActiveTab = (tab: DoctorTabType) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("doctor_active_tab", tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <section className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-sky-50 via-white to-white text-slate-900">
      <BackgroundDecorations />

      <div className="relative mx-auto w-full px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <DoctorHeader activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="mt-10">
          {activeTab === "dashboard" && <DoctorDashboardTab />}
          {activeTab === "appointments" && <DoctorAppointmentsTab />}
          {activeTab === "patients" && <DoctorPatientsTab />}
          {activeTab === "schedule" && <DoctorScheduleTab />}
          {activeTab === "settings" && <DoctorSettingsTab />}
        </div>
      </div>
    </section>
  );
}