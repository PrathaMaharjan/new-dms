"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";

const SERVICES = [
  {
    label: "Aesthetic dentistry",
    image: "/images/services/aesthetic-dentistry.png",
  },
  {
    label: "Orthodontics",
    image: "/images/services/orthodontics.png",
  },
  {
    label: "Implantology",
    image: "/images/services/implantology.png",
  },
  {
    label: "Whitening",
    image: "/images/services/whitening.png",
  },
  {
    label: "Surgical dentistry",
    image: "/images/services/surgical-dentistry.png",
  },
];

const LOOP_SERVICES = [...SERVICES, ...SERVICES, ...SERVICES];
const SET_COUNT = SERVICES.length;

interface ServicesProps {
  tenantSlug?: string;
}

export default function Services({ tenantSlug }: ServicesProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isCorrectingRef = useRef(false);
  const isInteractingRef = useRef(false);
  const autoScrollSpeed = 0.6; 

  const getSetWidth = (el: HTMLDivElement) => {
    const card = el.querySelector<HTMLElement>("[data-card]");
    if (!card) return 0;
    const gap = parseFloat(getComputedStyle(el).columnGap || "20");
    return SET_COUNT * (card.offsetWidth + gap);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;


    el.scrollLeft = getSetWidth(el);

    let animationFrameId: number;

    const loop = () => {
      
      if (!isInteractingRef.current && !isCorrectingRef.current) {
        el.scrollLeft += autoScrollSpeed;
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);


  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || isCorrectingRef.current) return;

    const setWidth = getSetWidth(el);
    if (!setWidth) return;

  
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
    const gap = parseFloat(getComputedStyle(el).columnGap || "20");
    const step = card ? card.offsetWidth + gap : 300;


    isInteractingRef.current = true;
    el.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" });

    const timeout = setTimeout(() => {
      isInteractingRef.current = false;
    }, 500);

    return () => clearTimeout(timeout);
  };

  return (
    <section id="services" className="relative overflow-hidden bg-white py-24 lg:py-32">
    
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <ToothOutline className="absolute -left-16 top-10 h-64 w-64 text-[#7da3b3]/20 -rotate-12" />
        <ToothOutline className="absolute -right-20 bottom-0 h-80 w-80 text-[#7da3b3]/15 rotate-12" />
        <ToothbrushOutline className="absolute left-[6%] bottom-12 h-40 w-40 text-[#7da3b3]/15 -rotate-6" />
        <SparkleOutline className="absolute right-[14%] top-8 h-10 w-10 text-[#7da3b3]/30" />
        <SparkleOutline className="absolute left-[22%] top-[8%] h-6 w-6 text-[#7da3b3]/25" />
        <CircleRing className="absolute right-[4%] top-[20%] h-56 w-56 text-[#7da3b3]/15" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-8 lg:px-14 xl:px-20">
     
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-sky-300">
            Services
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Expert care for every smile
          </h2>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-slate-500">
            We offer a full spectrum of treatments, each tailored to elevate
            your health, confidence, and natural beauty.
          </p>
        </div>

        <div 
          className="relative mt-16"
          onMouseEnter={() => { isInteractingRef.current = true; }}
          onMouseLeave={() => { isInteractingRef.current = false; }}
          onTouchStart={() => { isInteractingRef.current = true; }}
          onTouchEnd={() => { isInteractingRef.current = false; }}
        >
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            aria-label="Previous services"
            className="absolute -left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/5 transition-colors hover:bg-[#7da3b3] hover:text-white sm:flex lg:-left-5"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            aria-label="Next services"
            className="absolute -right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/5 transition-colors hover:bg-[#7da3b3] hover:text-white sm:flex lg:-right-5"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:gap-5 [&::-webkit-scrollbar]:hidden"
          >
            {LOOP_SERVICES.map(({ label, image }, i) => (
              <div
                key={`${label}-${i}`}
                data-card
                className="group relative aspect-[4/5] w-[220px] flex-shrink-0 overflow-hidden rounded-2xl bg-[#7da3b3] sm:w-[260px] lg:w-[300px]"
              >
                <Image
                  src={image}
                  alt={label}
                  fill
                  sizes="300px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
                <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10">
                  <p className="text-[0.95rem] font-medium text-white">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

    
 {/* CTA */}
<div className="mt-14 flex justify-center">
  <Link
    href="/booking"
    className="group relative h-12 overflow-hidden rounded-full border border-slate-300 inline-flex"
  >
    <div className="inline-flex h-12 items-center justify-center gap-2 px-6 bg-white text-slate-900 transition-transform duration-300 group-hover:-translate-y-[150%]">
      Schedule an Appointment
      <ArrowUpRight className="h-4 w-4" />
    </div>

    {/* Hover state */}
    <div className="absolute inset-0 inline-flex h-12 w-full translate-y-full items-center justify-center gap-2 bg-[#7da3b3] text-white transition-transform duration-300 group-hover:translate-y-0">
      Schedule an Appointment
      <ArrowUpRight className="h-4 w-4" />
    </div>
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

function CircleRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className}>
      <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}