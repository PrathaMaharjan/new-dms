// import Link from "next/link";
// import { SiInstagram, SiWhatsapp, SiFacebook, SiYoutube } from "@icons-pack/react-simple-icons";

// interface FooterProps {
//   tenantSlug?: string;
// }

// const FOOTER_COLUMNS = [
//   {
//     heading: "General",
//     links: [
//       { label: "Home", href: "/" },
//       { label: "About Us", href: "/about" },
//       { label: "Services", href: "/services" },
//       { label: "Testimonial", href: "/testimonial" },
//     ],
//   },
//   {
//     heading: "About",
//     links: [
//       { label: "Blog", href: "/blog" },
//       { label: "Careers", href: "/careers" },
//       { label: "Culture", href: "/culture" },
//     ],
//   },
//   {
//     heading: "Resources",
//     links: [
//       { label: "Free Content", href: "/free-content" },
//       { label: "Glossary", href: "/glossary" },
//       { label: "Tutorials", href: "/tutorials" },
//     ],
//   },
// ];

// const SOCIAL_LINKS = [
//   { label: "Instagram", href: "#", icon: SiInstagram },
//   { label: "WhatsApp", href: "#", icon: SiWhatsapp },
//   { label: "Facebook", href: "#", icon: SiFacebook },
//   { label: "YouTube", href: "#", icon: SiYoutube },
// ];

// export default function Footer({ tenantSlug = "chitwan-dental-home" }: FooterProps) {
//   return (
//     <footer className="bg-[#7da3b3]">
//       <div className="mx-auto max-w-6xl px-6 lg:px-8">
//         <div className="grid grid-cols-2 gap-x-8 gap-y-12 border-t border-white/20 py-14 sm:grid-cols-4">
//           {FOOTER_COLUMNS.map((col) => (
//             <div key={col.heading}>
//               <p className="text-[0.8rem] font-medium uppercase tracking-wide text-white/70">
//                 {col.heading}
//               </p>
//               <ul className="mt-4 space-y-3">
//                 {col.links.map((link) => (
//                   <li key={link.href}>
//                     <Link
//                       href={link.href}
//                       className="text-[0.95rem] text-white underline-offset-4 transition-all hover:underline"
//                     >
//                       {link.label}
//                     </Link>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           ))}

//           {/* Social */}
//           <div>
//             <p className="text-[0.8rem] font-medium uppercase tracking-wide text-white/70">
//               Social
//             </p>
//             <div className="mt-4 flex items-center gap-3">
//               {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
//                 <Link
//                   key={label}
//                   href={href}
//                   aria-label={label}
//                   className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:border-white/60"
//                 >
//                   <Icon size={16} color="currentColor" />
//                 </Link>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* Bottom bar */}
//         <div className="flex flex-col items-center justify-between gap-4 border-t border-white/20 py-6 sm:flex-row">
//           <p className="text-[0.9rem] text-white">
//             © 2026, Chitwan Dental Clinic
//           </p>
//           <div className="flex flex-wrap items-center gap-6">
//             <Link
//               href="/terms"
//               className="text-[0.9rem] text-white underline-offset-4 transition-all hover:underline"
//             >
//               Terms & Condition
//             </Link>
//             <Link
//               href="/privacy"
//               className="text-[0.9rem] text-white underline-offset-4 transition-all hover:underline"
//             >
//               Privacy Policy
//             </Link>
//             {/* Staff Portal Link */}
//             <Link
//               href={`/login?tenant=${tenantSlug}`}
//               className="text-[0.9rem] font-medium text-white/90 underline-offset-4 transition-all hover:text-white hover:underline"
//             >
//               Staff Portal Login
//             </Link>
//           </div>
//         </div>
//       </div>
//     </footer>
//   );
// }