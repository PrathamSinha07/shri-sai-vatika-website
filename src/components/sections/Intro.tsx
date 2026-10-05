"use client";

import Image from "next/image";
import { motion, MotionConfig } from "motion/react";
import { site } from "@/content/site";
import { whatsappUrl } from "@/lib/whatsapp";

const tourMessage = `Namaste, I would like to request a tour of ${site.name}. Please share available dates and timings.`;

export default function Intro() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="venue" className="bg-background" aria-labelledby="intro-heading">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <p className="eyebrow">Welcome to {site.shortName}</p>
            <h2 id="intro-heading" className="font-display text-section mt-4 text-primary-deep">
              Your celebration deserves a setting that feels as special as the moment itself.
            </h2>
            <p className="text-body mt-5 text-muted-foreground">
              Set on Gola Road in Danapur, Shri Sai Vatika brings together a
              3000 sq.ft. air-conditioned hall, an 8000 sq.ft. lawn, and
              thoughtful hospitality for weddings and family occasions —
              a short distance from Patna.
            </p>
            <a
              href={whatsappUrl(tourMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-text mt-8 inline-flex items-center gap-2 border-b border-gold pb-1 text-primary transition-colors hover:text-primary-deep"
            >
              Request a Tour →
            </a>
          </motion.div>

          <motion.figure
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <Image
              src="/images/05.jpg"
              alt="Decorated entrance corridor at Shri Sai Vatika during an evening event"
              width={918}
              height={612}
              sizes="(max-width: 767px) 100vw, 50vw"
              className="h-auto w-full"
            />
          </motion.figure>
        </div>
      </section>
    </MotionConfig>
  );
}
