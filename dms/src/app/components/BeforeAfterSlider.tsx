"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { MoveHorizontal, Sparkles } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  eyebrow?: string;
  heading?: string;
  subtext?: string;
  showBadges?: boolean;
  tenantSlug?: string; 
}

export default function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = "Before",
  afterLabel = "After",
  className = "",
  eyebrow = "Real Results",
  heading = "See the transformation",
  subtext = "Drag the slider and watch years of stains disappear in one visit.",
  showBadges = true,
  tenantSlug = "chitwan-dental-home", 
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, x)));
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setHasInteracted(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updatePosition(e.clientX);
  };

  const handlePointerUp = () => setDragging(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    setHasInteracted(true);
    if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 2));
    if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 2));
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#f4fafc] via-[#eaf3f6] to-[#dcebf0] py-24 lg:py-32">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <ToothOutline className="absolute -left-16 top-10 h-64 w-64 text-[#7da3b3]/15 -rotate-12" />
        <ToothOutline className="absolute -right-20 bottom-0 h-80 w-80 text-[#7da3b3]/10 rotate-12" />
        <ToothbrushOutline className="absolute left-[6%] bottom-12 h-40 w-40 text-[#7da3b3]/10 -rotate-6" />
        <SparkleOutline className="absolute right-[14%] top-8 h-10 w-10 text-[#7da3b3]/30" />
        <SparkleOutline className="absolute left-[22%] top-[8%] h-6 w-6 text-[#7da3b3]/25" />
        <CircleRing className="absolute right-[4%] top-[20%] h-56 w-56 text-[#7da3b3]/15" />
        <Sparkles className="absolute left-[10%] top-16 h-6 w-6 text-[#7da3b3]/40" strokeWidth={1.5} />
        <Sparkles className="absolute right-[38%] bottom-24 h-4 w-4 text-[#7da3b3]/30" strokeWidth={1.5} />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-8 lg:px-14 xl:px-20">
        {/* Heading */}
        {(eyebrow || heading || subtext) && (
          <div className="mx-auto max-w-2xl text-center">
            {eyebrow && (
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-sky-300">
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                {heading}
              </h2>
            )}
            {subtext && (
              <p className="mt-5 text-[1.05rem] leading-relaxed text-slate-500">
                {subtext}
              </p>
            )}
          </div>
        )}

        {/* Slider with floating badges */}
        <div className="relative mx-auto mt-16 max-w-2xl">
          <div
            ref={containerRef}
            className={[
              "relative aspect-square w-full select-none overflow-hidden rounded-2xl shadow-2xl shadow-[#7da3b3]/20 ring-1 ring-black/5",
              className,
            ].join(" ")}
            style={{
              cursor: `url("/images/toothbrush-cursor.png") 16 16, ew-resize`,
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <Image
              src={afterImage}
              alt={afterLabel}
              fill
              sizes="(max-width: 640px) 100vw, 500px"
              className="pointer-events-none object-cover"
              priority
            />

            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            >
              <Image
                src={beforeImage}
                alt={beforeLabel}
                fill
                sizes="(max-width: 640px) 100vw, 500px"
                className="pointer-events-none object-cover"
                priority
              />
            </div>

            {showBadges && (
              <>
                <span className="absolute left-3 top-3 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {beforeLabel}
                </span>
                <span className="absolute right-3 top-3 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {afterLabel}
                </span>
              </>
            )}

            <div
              className="pointer-events-none absolute inset-y-0 w-[2px] bg-white"
              style={{ left: `${position}%` }}
            />

            <div
              role="slider"
              tabIndex={0}
              aria-label="Comparison slider"
              aria-valuenow={Math.round(position)}
              aria-valuemin={0}
              aria-valuemax={100}
              onPointerDown={handlePointerDown}
              onKeyDown={handleKeyDown}
              className={[
                "absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-[#7da3b3] shadow-lg outline-none ring-[#7da3b3] focus-visible:ring-2",
                !hasInteracted ? "animate-pulse" : "",
              ].join(" ")}
              style={{ left: `${position}%` }}
            >
              <MoveHorizontal className="h-4 w-4" />
            </div>
          </div>

          <p className="mt-5 text-center text-[0.85rem] text-slate-400">
            ← Drag to compare →
          </p>
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