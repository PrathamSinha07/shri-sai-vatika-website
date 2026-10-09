"use client";

import { motion, MotionConfig } from "motion/react";
import { bookVisitHref } from "@/content/navigation";
import {
  cateringPackages,
  nonVegCatering,
  packagesNote,
  packagesSection,
  venuePackage,
} from "@/content/packages";
import { defaultEnquiryMessage, whatsappUrl } from "@/lib/whatsapp";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

export default function Packages() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="packages" className="bg-background" aria-labelledby="packages-heading">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">{packagesSection.eyebrow}</p>
            <h2 id="packages-heading" className="font-display text-section mt-4 text-primary-deep">
              {packagesSection.heading}
            </h2>
            <p className="text-body mt-4 text-muted-foreground">{packagesSection.lede}</p>
          </div>

          {/* Complete venue package — the anchor offering */}
          <motion.div
            {...fadeUp}
            className="mt-12 border border-gold-muted/50 bg-primary-deep text-ivory"
          >
            <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-2 md:items-center md:gap-12">
              <div>
                <p className="eyebrow text-gold-muted">The Venue</p>
                <h3 className="font-display mt-3 text-3xl text-surface sm:text-4xl">
                  {venuePackage.name}
                </h3>
                <p className="text-body mt-4 max-w-md text-ivory/85">
                  {venuePackage.description}
                </p>
              </div>
              <div className="md:justify-self-end md:text-right">
                <p className="font-display text-5xl whitespace-nowrap text-gold-rich sm:text-6xl">
                  {venuePackage.price}
                </p>
                <p className="text-small mt-2 uppercase tracking-[0.18em] text-ivory/70">
                  {venuePackage.priceUnit}
                </p>
                <a
                  href={whatsappUrl(venuePackage.enquiryMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Enquire about the ${venuePackage.name} on WhatsApp`}
                  className="btn-text mt-6 inline-flex items-center justify-center border border-gold-muted/70 px-7 py-4 text-surface transition-colors hover:bg-surface/10 md:w-full"
                >
                  Enquire on WhatsApp
                </a>
              </div>
            </div>
          </motion.div>

          {/* Catering menus — per-person pricing */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {cateringPackages.map((offer) => (
              <motion.div
                key={offer.id}
                {...fadeUp}
                className="flex flex-col gap-6 border border-border bg-surface p-6 sm:p-8"
              >
                <h3 className="font-display text-2xl text-primary-deep sm:text-3xl">
                  {offer.name}
                </h3>
                <p className="text-body text-muted-foreground">{offer.description}</p>
                <div className="mt-auto flex items-baseline gap-3 border-t border-border pt-5">
                  <span className="font-display text-4xl whitespace-nowrap text-primary">
                    {offer.price}
                  </span>
                  <span className="text-small uppercase tracking-[0.18em] text-muted-foreground">
                    {offer.priceUnit}
                  </span>
                </div>
                <a
                  href={whatsappUrl(offer.enquiryMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Enquire about ${offer.name} on WhatsApp`}
                  className="btn-text inline-flex items-center justify-center border border-primary px-7 py-4 text-primary transition-colors hover:bg-primary hover:text-surface sm:self-start"
                >
                  Enquire on WhatsApp
                </a>
              </motion.div>
            ))}
          </div>

          {/* Non-vegetarian catering — quoted separately */}
          <motion.div
            {...fadeUp}
            className="mt-6 border border-border bg-surface p-6 sm:p-8"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <h3 className="font-display text-xl text-primary-deep sm:text-2xl">
                  {nonVegCatering.name}
                </h3>
                <p className="text-small mt-1 uppercase tracking-[0.18em] text-muted-foreground">
                  {nonVegCatering.priceNote}
                </p>
                <p className="text-body mt-3 text-muted-foreground">
                  {nonVegCatering.description}
                </p>
              </div>
              <a
                href={whatsappUrl(nonVegCatering.enquiryMessage)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${nonVegCatering.ctaLabel} — ${nonVegCatering.name} on WhatsApp`}
                className="btn-text inline-flex items-center justify-center border border-primary px-7 py-4 text-primary transition-colors hover:bg-primary hover:text-surface sm:shrink-0"
              >
                {nonVegCatering.ctaLabel}
              </a>
            </div>
          </motion.div>

          <p className="text-small mt-8 max-w-2xl text-muted-foreground">{packagesNote}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={bookVisitHref}
              className="btn-text inline-flex items-center justify-center bg-primary px-7 py-4 text-surface transition-colors hover:bg-primary-deep"
            >
              Book a Visit
            </a>
            <a
              href={whatsappUrl(defaultEnquiryMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-text inline-flex items-center justify-center border border-primary px-7 py-4 text-primary transition-colors hover:bg-primary hover:text-surface"
            >
              Ask a Question
            </a>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
