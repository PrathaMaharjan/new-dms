"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Dentist", href: "/dentist" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isLanding = pathname === "/";
  const light = isLanding && !scrolled;

  return (
    <header
      className={[
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled || !isLanding
          ? "bg-white/70 backdrop-blur-md border-b border-slate-900/5 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]"
          : "bg-transparent border-b border-transparent",
      ].join(" ")}
    >
      <nav className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-5 lg:px-14 xl:px-20">
        {/* Logo */}
        <Link
          href="/"
          className={[
            "text-[1.2rem] font-semibold tracking-tight transition-colors",
            light ? "text-white" : "text-slate-900",
          ].join(" ")}
        >
          Chitwan Dental Home
        </Link>

        {/* Desktop Navigation */}
        <ul className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={[
                  "relative text-[1rem] font-medium transition-colors after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-current after:transition-all after:duration-300 hover:after:w-full",
                  light
                    ? "text-white/85 hover:text-white"
                    : "text-slate-600 hover:text-slate-900",
                ].join(" ")}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/booking"
          className={[
            "group relative hidden h-12 overflow-hidden rounded-md border md:inline-flex",
            light ? "border-white/60" : "border-slate-300",
          ].join(" ")}
        >
       
          <div
            className={[
              "inline-flex h-12 items-center justify-center gap-2 px-6 transition-transform duration-300 group-hover:-translate-y-[150%]",
              light ? "bg-transparent text-white" : "bg-white text-slate-900",
            ].join(" ")}
          >
            Contact
            <ArrowUpRight className="h-4 w-4" />
          </div>

          {/* Hover State */}
          <div
            className={[
              "absolute inset-0 inline-flex h-12 w-full translate-y-full items-center justify-center gap-2 transition-transform duration-300 group-hover:translate-y-0",
              light ? "bg-white text-slate-900" : "bg-[#7da3b3] text-white",
            ].join(" ")}
          >
            Contact
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </Link>

        {/* Mobile Menu Button */}
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className={[
            "flex h-9 w-9 items-center justify-center rounded-full transition-colors md:hidden",
            light ? "text-white" : "text-slate-900",
          ].join(" ")}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" strokeWidth={1.8} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={1.8} />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      <div
        className={[
          "overflow-hidden transition-[max-height] duration-300 ease-in-out md:hidden",
          mobileOpen ? "max-h-80" : "max-h-0",
        ].join(" ")}
      >
        <ul className="flex flex-col gap-1 border-t border-slate-900/5 bg-white/90 px-6 py-4 backdrop-blur-md">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="relative block py-2.5 text-[1rem] font-medium text-slate-700 after:absolute after:left-0 after:bottom-1 after:h-[2px] after:w-0 after:bg-slate-900 after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </Link>
            </li>
          ))}

          <li className="pt-3">
            <Link
              href="/booking"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center gap-2 rounded-md bg-[#7da3b3] px-5 py-3 text-white"
            >
              Contact
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}