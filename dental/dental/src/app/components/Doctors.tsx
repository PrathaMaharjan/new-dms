"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Mail, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const DOCTORS = [
  {
    name: "Dr. Anisha Rai",
    role: "Lead Dentist · Aesthetic Dentistry",
    image: "/images/services/anesthetic-dentistry.png",
    email: "anisha@chitwandental.com",
  },
  {
    name: "Dr. Bikash Shrestha",
    role: "Orthodontist",
    image: "/images/services/anesthetic-dentistry.png",
    email: "bikash@chitwandental.com",
  },
  {
    name: "Dr. Priya Gurung",
    role: "Oral & Maxillofacial Surgeon",
    image: "/images/services/anesthetic-dentistry.png",
    email: "priya@chitwandental.com",
  },
  {
    name: "Dr. Suman Adhikari",
    role: "General & Preventive Care",
    image: "/images/services/anesthetic-dentistry.png",
    email: "suman@chitwandental.com",
  },
];

const LOOP_DOCTORS = [...DOCTORS, ...DOCTORS, ...DOCTORS];

interface DoctorsProps {
  tenantSlug?: string;
}

export default function Doctors({ tenantSlug }: DoctorsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isCorrectingRef = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth / 3;
  }, []);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || isCorrectingRef.current) return;

    const setWidth = el.scrollWidth / 3;

    if (el.scrollLeft < setWidth * 0.5) {
      isCorrectingRef.current = true;
      el.scrollLeft += setWidth;
      isCorrectingRef.current = false;
    } else if (el.scrollLeft > setWidth * 1.5) {
      isCorrectingRef.current = true;
      el.scrollLeft -= setWidth;
      isCorrectingRef.current = false;
    }
  };

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;

    const card = el.querySelector<HTMLElement>("[data-card]");
    const gap = parseFloat(getComputedStyle(el).columnGap || "24");
    const step = card ? card.offsetWidth + gap : 304;

    el.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" });
  };

  return (
    <section id="dentist" className="relative overflow-hidden bg-[#f7fafb] py-16 lg:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full border border-[#7da3b3]/10" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full border border-[#7da3b3]/10" />
        <ToothOutline className="absolute -left-16 bottom-0 h-64 w-64 text-[#7da3b3]/10 -rotate-12" />
        <ToothOutline className="absolute -right-20 top-10 h-72 w-72 text-[#7da3b3]/10 rotate-12" />
        <ToothbrushOutline className="absolute right-[8%] bottom-16 h-36 w-36 text-[#7da3b3]/10 rotate-6" />
        <SparkleOutline className="absolute left-[16%] top-12 h-8 w-8 text-[#7da3b3]/25" />
        <SparkleOutline className="absolute right-[22%] top-[10%] h-5 w-5 text-[#7da3b3]/20" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-8 lg:px-14 xl:px-20">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-sky-300">
            Our Team
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Meet the doctors
          </h2>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-slate-500">
            Experienced, board-certified specialists dedicated to giving you
            a smile you're proud of.
          </p>
        </div>

        <div className="relative mt-16">
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            aria-label="Previous doctors"
            className="absolute -left-5 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/5 transition-colors hover:bg-[#7da3b3] hover:text-white sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            aria-label="Next doctors"
            className="absolute -right-5 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/5 transition-colors hover:bg-[#7da3b3] hover:text-white sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Scrolling Viewport */}
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="flex gap-6 overflow-x-auto pb-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {LOOP_DOCTORS.map((doc, i) => (
              <div
                key={`${doc.name}-${i}`}
                data-card
                className="group w-[280px] flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-shadow duration-300 hover:shadow-xl sm:w-[320px] lg:w-[calc((100%-72px)/4)]"
              >
                {/* Image Wrap - aspect adjusted to 4/3 to reduce length/height */}
                <div className="relative aspect-[4/3] overflow-hidden bg-[#eaf3f6]">
                  <Image
                    src={doc.image}
                    alt={doc.name}
                    fill
                    sizes="(max-width: 1024px) 320px, 400px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                {/* Details Card */}
                <div className="p-5">
                  <h3 className="text-[1.02rem] font-semibold text-slate-900 line-clamp-1">
                    {doc.name}
                  </h3>
                  <p className="mt-1 text-[0.82rem] font-medium text-[#7da3b3] line-clamp-1">
                    {doc.role}
                  </p>

                  <a
                    href={`mailto:${doc.email}`}
                    className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-[0.82rem] font-medium text-[#7da3b3] transition-colors hover:text-[#5f8b9c]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span className="line-clamp-1">{doc.email}</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-14 flex justify-center">
          <Link
            href="/booking"
            className="group relative inline-flex h-14 items-center overflow-hidden rounded-full bg-white pl-7 pr-16 text-slate-900 shadow-lg"
          >
            <span className="relative z-10 text-[0.95rem] font-medium transition-colors duration-300 group-hover:text-white">
              Book Appointment
            </span>

            <span className="absolute right-1 top-1 h-12 w-12 rounded-full bg-[#7da3b3] transition-all duration-500 ease-out group-hover:w-[calc(100%-8px)]" />

            <span className="absolute right-4 z-10 flex h-5 w-5 items-center justify-center">
              <ArrowRight className="h-5 w-5 text-white" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ToothOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" fill="none" className={className}>
      <path
        d="M100 10c-28 0-46 18-46 46 0 20 6 34 10 52 5 22 8 46 14 72 4 18 12 30 22 30s16-14 20-32c3-14 4-30 8-30s5 16 8 30c4 18 10 32 20 32s18-12 22-30c6-26 9-50 14-72 4-18 10-32 10-52 0-28-18-46-46-46-14 0-22 8-30 8s-16-8-30-8"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ToothbrushOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 100" fill="none" className={className}>
      <rect x="10" y="42" width="120" height="16" rx="8" stroke="currentColor" strokeWidth="5" />
      <path d="M130 50h30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <rect x="160" y="20" width="50" height="60" rx="14" stroke="currentColor" strokeWidth="5" />
      <path d="M172 34v32M186 30v40M200 34v32" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function SparkleOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className}>
      <path
        d="M20 2c0 8 6 16 18 18-12 2-18 10-18 18 0-8-6-16-18-18 12-2 18-10 18-18Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}