"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useCallback } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
}

let sparkleId = 0;

interface BrushingHighlightProps {
  tenantSlug?: string;
}

export default function BrushingHighlight({ tenantSlug }: BrushingHighlightProps) {
  const [sparkleList, setSparkleList] = useState<Sparkle[]>([]);
  // Track cursor position inside the tooth container
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastSpawnRef = useRef(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update custom cursor coordinates
    setCursorPos({ x, y });

    // Handle sparkle generation
    const now = Date.now();
    if (now - lastSpawnRef.current < 60) return;
    lastSpawnRef.current = now;

    const newSparkle: Sparkle = {
      id: sparkleId++,
      x,
      y,
      size: 10 + Math.random() * 10,
      rotation: Math.random() * 360,
    };

    setSparkleList((prev) => [...prev, newSparkle]);

    setTimeout(() => {
      setSparkleList((prev) => prev.filter((s) => s.id !== newSparkle.id));
    }, 700);
  }, []);

  const handleMouseLeave = () => {
    setCursorPos(null); // Hide custom toothbrush when hovering out
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#eaf3f6] via-[#dcebf0] to-[#c9e0e8] py-12 lg:py-16">
      {/* Decorative accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <Sparkles className="absolute left-[8%] top-20 h-6 w-6 text-[#7da3b3]/40" strokeWidth={1.5} />
        <Sparkles className="absolute right-[38%] bottom-24 h-4 w-4 text-[#7da3b3]/30" strokeWidth={1.5} />
        <div className="absolute -right-16 top-1/4 h-72 w-72 rounded-full border border-[#7da3b3]/15" />
      </div>

      <div className="relative mx-auto flex max-w-[1600px] flex-col items-center px-8 lg:flex-row lg:justify-center lg:px-14 xl:px-20">
        {/* Left — text */}
        <div className="w-full max-w-xl lg:w-auto lg:flex-shrink-0">
          <p className="text-[0.8rem] font-semibold uppercase tracking-[0.15em] text-sky-300">
            Daily Care
          </p>

          <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-[3.2rem] lg:leading-[1.15]">
            Small habits,{" "}
            <span className="text-sky-300">built the right way</span>
          </h2>

          <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-slate-600">
            A few minutes of proper care each day is often the difference
            between a checkup and a filling. We'll show you exactly how!
          </p>

          <Link
            href="/services"
            className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#7da3b3] px-6 text-[0.95rem] font-medium text-white shadow-md shadow-[#7da3b3]/30 transition-all hover:-translate-y-0.5 hover:bg-[#6a8f9f] hover:shadow-lg"
          >
            Learn our approach
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Right — image container */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative mt-12 aspect-[4/5] w-full max-w-md flex-shrink-0 cursor-none lg:mt-0 lg:w-[380px] xl:w-[440px]"
        >
          <Image
            src="/images/large-tooth.png"
            alt="Illustration of a healthy tooth"
            fill
            sizes="(max-width: 1024px) 100vw, 440px"
            className="object-contain drop-shadow-2xl"
            priority
          />

          {/* Custom floating toothbrush cursor */}
          {cursorPos && (
            <div
              className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: cursorPos.x,
                top: cursorPos.y,
              }}
            >
              <img
                src="/images/cursor.png"
                alt="Toothbrush Cursor"
                className="h-11 w-11 object-contain" 
              />
            </div>
          )}

          {sparkleList.map((s) => (
            <span
              key={s.id}
              className="pointer-events-none absolute animate-sparkle-pop"
              style={{
                left: s.x,
                top: s.y,
                width: s.size,
                height: s.size,
                transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
              }}
            >
              <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
                <path
                  d="M16 2c0 6.5 4.8 12.8 14 14-9.2 1.2-14 7.5-14 14 0-6.5-4.8-12.8-14-14 9.2-1.2 14-7.5 14-14Z"
                  fill="#7da3b3"
                />
              </svg>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}