"use client";

import { getImageProps } from "next/image";
import { motion, MotionConfig } from "motion/react";
import { site } from "@/content/site";
import { bookVisitHref } from "@/content/navigation";
import { whatsappUrl } from "@/lib/whatsapp";

const tourMessage = `Namaste, I would like to request a virtual or in-person tour of ${site.name}. Please share available dates and timings.`;

// Warm, near-neutral scrim rather than a saturated maroon wash: it deepens the
// pink-lit photograph towards candlelight so the type stays legible without
// flattening the image or tinting it pink.
const SCRIM = "#1a0a0c";

export default function Hero() {
  const common = {
    alt: "Elegant wedding hall at Shri Sai Vatika with stage, floral decor and seating",
    sizes: "100vw",
    priority: true,
    quality: 80,
  } as const;

  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({ ...common, src: "/images/01.jpg", width: 1920, height: 1280 });
  const {
    props: { srcSet: mobileSrcSet, ...mobileImg },
  } = getImageProps({
    ...common,
    src: "/images/02.jpg",
    width: 1000,
    height: 1780,
    alt: "Shri Sai Vatika lawn at night decorated with flowers and lights",
  });

  return (
    <MotionConfig reducedMotion="user">
      <section className="relative isolate flex min-h-svh items-end overflow-hidden md:min-h-screen" aria-label="Introduction">
        <picture className="absolute inset-0 -z-10">
          <source media="(max-width: 767px)" srcSet={mobileSrcSet} />
          <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
          <img {...mobileImg} alt={mobileImg.alt} className="absolute inset-0 h-full w-full object-cover object-center" />
        </picture>

        {/* Cinematic overlay — a warm scrim rising from the base, a soft left
            wash on wider screens, and a faint unify layer that calms the pink
            cast of the hall lighting without washing the photograph out. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `linear-gradient(to top, ${SCRIM}f2 0%, ${SCRIM}c4 26%, ${SCRIM}59 52%, ${SCRIM}0d 74%, transparent 100%)`,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 hidden md:block"
          style={{
            backgroundImage: `linear-gradient(to right, ${SCRIM}a6 0%, ${SCRIM}3d 38%, transparent 66%)`,
          }}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#3d1119]/20 mix-blend-multiply" />

        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-28 sm:px-6 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="max-w-2xl"
          >
            {/* Brand line: client-requested boost — fluid ~1rem–1.35rem sizing
                (was 0.78/0.84rem) with bold weight and a soft scrim-coloured
                text shadow so the gold reads over any part of the photograph.
                Colour, uppercase tracking and the gold rule preserve the
                existing identity; the clamp keeps it clear of the headline
                and inside the gutter on every viewport. */}
            <p className="flex items-center gap-3 text-[clamp(1rem,2.6vw,1.35rem)] font-bold uppercase tracking-[0.3em] text-gold-rich [text-shadow:0_1px_3px_rgba(26,10,12,0.65)]">
              <span aria-hidden="true" className="h-px w-10 shrink-0 bg-gold-rich/80 sm:w-14" />
              {site.shortName}
            </p>
            <h1 className="font-display mt-6 text-hero text-surface">
              <span className="sm:block">Where Celebrations </span>
              <span className="sm:block">Become Memories</span>
            </h1>
            <p className="text-body mt-6 max-w-xl text-ivory/90">
              A premium wedding and celebration venue in Danapur, Patna —
              an AC banquet hall, spacious lawn, and spaces designed for
              occasions that deserve care.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <a
                href={bookVisitHref}
                className="btn-text btn-primary ring-1 ring-inset ring-gold-rich/35 sm:px-8"
              >
                Plan Your Celebration
              </a>
              <a
                href={whatsappUrl(tourMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-text btn-outline-light sm:px-8"
              >
                WhatsApp Us
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
