"use client";

import { useEffect } from "react";
import Hero from "./components/Hero";
import Services from "./components/Services";
import BeforeAfterSlider from "./components/BeforeAfterSlider";
import BrushingHighlight from "./components/BrushingHighlight";
import Doctors from "./components/Doctors";
import { getOrganizationBySlug } from "@/lib/api";

const ORG_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG
console.log(ORG_SLUG)

export default function Home() {
  useEffect(() => {
    async function ensureOrgName() {
      let existing: string | null = null;
      try {
        existing = localStorage.getItem("orgname");
      } catch {
    
      }
      if (existing) return;
      console.log(ORG_SLUG)

      if (!ORG_SLUG) {
        console.error("No organization slug configured for this deployment.");
        return;
      }

      try {
        const { data: responseBody } = await getOrganizationBySlug(ORG_SLUG);
        if (responseBody?.success && responseBody.data?.organization?.name) {
          localStorage.setItem("orgname", responseBody.data.organization.name);
        }
      } catch (err) {
        console.error("Failed to fetch organization name:", err);
      }
    }
    ensureOrgName();
  }, []);

  return (
    <>
      <main className="relative overflow-hidden">
        <Hero />
        <Services />

        <BeforeAfterSlider
          beforeImage="/images/before-after/before.png"
          afterImage="/images/before-after/after.png"
          beforeLabel="Before"
          afterLabel="After"
        />

        <Doctors />
        <BrushingHighlight />
      </main>
    </>
  );
}