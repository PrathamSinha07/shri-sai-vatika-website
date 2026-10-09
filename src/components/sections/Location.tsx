"use client";

import { motion, MotionConfig } from "motion/react";
import { bookVisitHref } from "@/content/navigation";
import { locationSection } from "@/content/location";
import { site } from "@/content/site";
import {
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsUrl,
} from "@/lib/maps";

export default function Location() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="location" className="bg-surface" aria-labelledby="location-heading">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <p className="eyebrow">{locationSection.eyebrow}</p>
              <h2
                id="location-heading"
                className="font-display text-section mt-4 text-primary-deep"
              >
                {locationSection.heading}
              </h2>
              <p className="text-body mt-4 text-muted-foreground">{locationSection.lede}</p>

              <div className="mt-8 border-t border-border pt-6">
                <p className="text-small uppercase tracking-[0.18em] text-muted-foreground">
                  {locationSection.addressLabel}
                </p>
                <address className="mt-3 not-italic">
                  {site.address.lines.map((line) => (
                    <p key={line} className="font-display text-xl text-primary-deep sm:text-2xl">
                      {line}
                    </p>
                  ))}
                </address>
                <p className="text-small mt-3 text-muted-foreground">
                  {locationSection.landmarkNote}
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={googleMapsDirectionsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-text inline-flex items-center justify-center gap-2 bg-primary px-7 py-4 text-surface transition-colors hover:bg-primary-deep"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  {locationSection.directionsLabel}
                </a>
                <a
                  href={bookVisitHref}
                  className="btn-text inline-flex items-center justify-center border border-primary px-7 py-4 text-primary transition-colors hover:bg-primary hover:text-surface"
                >
                  Plan a Visit
                </a>
              </div>

              <p className="text-small mt-6 text-muted-foreground">
                Prefer to talk?{" "}
                <a
                  href={site.phoneHref}
                  className="text-primary underline-offset-4 transition-colors hover:text-primary-deep hover:underline"
                >
                  Call {site.phoneDisplay}
                </a>
              </p>
            </motion.div>

            <motion.figure
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <div className="relative h-80 overflow-hidden border border-border bg-background sm:h-96 lg:h-[28rem]">
                <iframe
                  title={locationSection.mapTitle}
                  src={googleMapsEmbedUrl()}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
              <figcaption className="text-small mt-3 text-muted-foreground">
                {locationSection.mapCaption}{" "}
                <a
                  href={googleMapsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 transition-colors hover:text-primary-deep hover:underline"
                >
                  {locationSection.openMapLabel}
                </a>
              </figcaption>
            </motion.figure>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
