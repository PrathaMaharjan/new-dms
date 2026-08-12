import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface HeroProps {
  tenantSlug?: string;
}

export default function Hero({ tenantSlug }: HeroProps) {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
   
      <Image
        src="/images/hero-tooth.png"
        alt="Dental crown being placed with precision tools on a model tooth"
        fill
        priority
        sizes="100vw"
        className="scale-125 object-cover object-[65%_center] lg:scale-110 lg:object-[70%_center]"
      />

      <div className="relative mx-auto w-full max-w-[1600px] px-8 pb-20 pt-32 lg:px-14 lg:pt-24 xl:px-20">
        <div className="max-w-2xl lg:max-w-3xl">
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Modern Care for a Confident Smile
          </h1>

          <p className="mt-7 text-[1.05rem] leading-relaxed text-white/80">
            We provide high-quality dental care using modern technology and a
            patient-first approach. From routine checkups to advanced
            treatments, your smile is in safe hands.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-5">

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

          
            <Link
              href="/#services"
              className="inline-flex items-center gap-2 text-[0.95rem] font-medium text-white/90 transition-colors hover:text-white"
            >
              See our services
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}