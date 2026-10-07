"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, MotionConfig } from "motion/react";
import { services } from "@/content/services";

export default function Services() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="services" className="bg-background" aria-labelledby="services-heading">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">Services</p>
            <h2 id="services-heading" className="font-display text-section mt-4 text-primary-deep">
              Everything your celebration needs
            </h2>
            <p className="text-body mt-4 text-muted-foreground">
              From catering to the band baja baraat, each element of your
              celebration is thoughtfully arranged. Explore the services that
              make Shri Sai Vatika a complete wedding destination.
            </p>
          </div>

          <div className="mt-12 space-y-16 md:space-y-20">
            {services.map((service, i) => (
              <motion.div
                key={service.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <Link
                  href={`/services/${service.slug}`}
                  className="group grid gap-6 md:grid-cols-2 md:items-center md:gap-12"
                  aria-label={`Learn more about ${service.title}`}
                >
                  <div
                    className={`relative overflow-hidden ${
                      i % 2 === 1 ? "md:order-2" : ""
                    }`}
                  >
                    <Image
                      src={service.image}
                      alt={service.imageAlt}
                      width={800}
                      height={600}
                      sizes="(max-width: 767px) 100vw, 50vw"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-primary-deep/0 transition-colors duration-300 group-hover:bg-primary-deep/10"
                    />
                  </div>

                  <div className={i % 2 === 1 ? "md:order-1" : ""}>
                    <div className="flex items-baseline gap-4">
                      <span
                        aria-hidden="true"
                        className="font-display text-sm text-gold"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-display text-2xl text-primary-deep transition-colors duration-200 group-hover:text-primary sm:text-3xl">
                        {service.title}
                      </h3>
                    </div>
                    <p className="text-body mt-3 text-muted-foreground">
                      {service.tagline}
                    </p>
                    <span
                      aria-hidden="true"
                      className="mt-5 inline-flex items-center gap-2 text-small font-semibold uppercase tracking-wider text-gold transition-colors group-hover:text-primary"
                    >
                      Explore
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
