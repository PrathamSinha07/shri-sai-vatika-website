"use client";

import { motion, MotionConfig } from "motion/react";
import { facilityGroups, type FacilityIcon } from "@/content/facilities";

function Icon({ name }: { name: FacilityIcon }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "h-6 w-6",
  };
  switch (name) {
    case "hall":
      return <svg {...common}><path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/></svg>;
    case "lawn":
      return <svg {...common}><path d="M12 21v-7"/><path d="M12 14c-4 0-6-2.5-6-6 3 0 5 1.5 6 4 1-2.5 3-4 6-4 0 3.5-2 6-6 6Z"/></svg>;
    case "rooms":
      return <svg {...common}><path d="M3 18v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8"/><path d="M3 18h18M7 12V9"/></svg>;
    case "parking":
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 16v-8h3a2.5 2.5 0 0 1 0 5h-3"/></svg>;
    case "cctv":
      return <svg {...common}><path d="M3 8l13-3 1 4-13 3z"/><path d="M15 15l-2 4M7 19h8"/></svg>;
    case "wifi":
      return <svg {...common}><path d="M4 9a12 12 0 0 1 16 0M7.5 12.5a7 7 0 0 1 9 0M11 16a2.5 2.5 0 0 1 2 0"/><circle cx="12" cy="18.5" r="0.5" fill="currentColor"/></svg>;
    case "security":
      return <svg {...common}><path d="M12 3l7 3v6c0 4-3 6.5-7 8-4-1.5-7-4-7-8V6z"/><path d="M9.5 12l2 2 3.5-3.5"/></svg>;
    case "fire":
      return <svg {...common}><path d="M12 3c1 3-3 5-3 9a5 5 0 0 0 10 0c0-2-1-3.5-2-5-0.5 1.5-1.5 2-2.5 2C14.5 7 13.5 4.5 12 3Z"/></svg>;
    case "water":
      return <svg {...common}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/></svg>;
    case "power":
      return <svg {...common}><path d="M13 3L5 13h5l-1 8 8-11h-5z"/></svg>;
    case "stage":
      return <svg {...common}><path d="M4 16h16M6 16v4M18 16v4M8 16V9h8v7"/><path d="M8 9c0-2 1.5-3 4-3s4 1 4 3"/></svg>;
    case "gate":
      return <svg {...common}><path d="M5 21V10a7 7 0 0 1 14 0v11M5 21h14M12 10v11"/></svg>;
    case "food":
      return <svg {...common}><path d="M7 3v7a2 2 0 0 0 4 0V3M9 3v18M16 3c-1.5 1.5-2 4-2 6h3v12M16 3v18"/></svg>;
    case "selfie":
      return <svg {...common}><rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M10.5 18h3"/></svg>;
    case "varmala":
    case "baraat":
      return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M12 11v8M9 15l3 2 3-2"/></svg>;
  }
}

export default function Facilities() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="facilities" className="bg-surface" aria-labelledby="facilities-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <p className="eyebrow">Facilities</p>
            <h2 id="facilities-heading" className="font-display text-section mt-4 text-primary-deep">
              Everything in place for your celebration
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
            {facilityGroups.map((group) => (
              <div key={group.title}>
                <h3 className="font-display text-xl text-primary-deep">{group.title}</h3>
                <ul className="mt-6 space-y-5">
                  {group.items.map((item) => (
                    <li key={item.label} className="flex items-center gap-4">
                      <span className="text-gold">
                        <Icon name={item.icon} />
                      </span>
                      <span className="text-body text-foreground">{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
