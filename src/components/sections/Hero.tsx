"use client";

import { getImageProps } from "next/image";
import { motion, MotionConfig } from "motion/react";
import { site } from "@/content/site";
import { whatsappUrl } from "@/lib/whatsapp";

const tourMessage = `Namaste, I would like to request a virtual or in-person tour of ${site.name}. Please share available dates and timings.`;

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
      <section className="relative isolate flex min-h-[85svh] items-end overflow-hidden md:min-h-[88vh]" aria-label="Introduction">
        <picture className="absolute inset-0 -z-10">
          <source media="(max-width: 767px)" srcSet={mobileSrcSet} />
          <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
          <img {...mobileImg} alt={mobileImg.alt} className="absolute inset-0 h-full w-full object-cover object-center" />
        </picture>

        {/* readability overlay — only where text sits, not the whole frame */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-t from-primary-deep/80 via-primary-deep/25 to-transparent"
        />

        <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-28 sm:px-6 md:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <p className="eyebrow" style={{ color: "var(--color-gold-muted)" }}>{site.shortName}</p>
            <h1 className="font-display mt-4 text-hero text-surface">
              Where Celebrations Become Memories
            </h1>
            <p className="text-body mt-5 max-w-xl text-surface/90">
              A premium wedding and celebration venue in Danapur, Patna —
              an AC banquet hall, spacious lawn, and spaces designed for
              occasions that deserve care.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#contact"
                className="btn-text inline-flex items-center justify-center bg-primary px-7 py-4 text-surface transition-colors hover:bg-primary-deep"
              >
                Plan Your Celebration
              </a>
              <a
                href={whatsappUrl(tourMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-text inline-flex items-center justify-center border border-gold-muted/70 px-7 py-4 text-surface transition-colors hover:bg-surface/10"
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
