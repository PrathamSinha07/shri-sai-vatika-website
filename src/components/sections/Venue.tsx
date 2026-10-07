"use client";

import Image from "next/image";
import { motion, MotionConfig } from "motion/react";
import { venueAbout } from "@/content/venue";

export default function Venue() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="venue" className="bg-background" aria-labelledby="venue-heading">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <p className="eyebrow">{venueAbout.eyebrow}</p>
              <h2 id="venue-heading" className="font-display text-section mt-4 text-primary-deep">
                {venueAbout.heading}
              </h2>
              {venueAbout.paragraphs.map((p, i) => (
                <p key={i} className="text-body mt-4 text-muted-foreground">
                  {p}
                </p>
              ))}
              <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border pt-5 sm:grid-cols-2">
                {venueAbout.facts.map((f) => (
                  <div key={f}>
                    <dt className="sr-only">Venue detail</dt>
                    <dd className="text-small text-foreground">{f}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>

            <motion.figure
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <Image
                src="/images/06.jpg"
                alt="Wide view of Shri Sai Vatika venue exterior at night with lawn, red carpet, and decorated canopy"
                width={1200}
                height={800}
                sizes="(max-width: 767px) 100vw, 50vw"
                className="h-auto w-full"
              />
              <figcaption className="text-small mt-3 text-muted-foreground">
                The venue at Shri Sai Vatika, Danapur, Patna.
              </figcaption>
            </motion.figure>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
