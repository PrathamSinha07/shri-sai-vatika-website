"use client";

import Image from "next/image";
import { motion, MotionConfig } from "motion/react";
import { serviceCategories } from "@/content/services";

export default function Services() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="services" className="bg-background" aria-labelledby="services-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="grid gap-10 md:grid-cols-2 md:items-end md:gap-16">
            <div>
              <p className="eyebrow">Services</p>
              <h2 id="services-heading" className="font-display text-section mt-4 text-primary-deep">
                Everything your celebration needs, in one place
              </h2>
            </div>
            <p className="text-body text-muted-foreground">
              From catering to the band baja baraat, Shri Sai Vatika brings the
              elements of a complete wedding celebration together — coordinated
              on one venue, for one seamless day.
            </p>
          </div>

          <ol className="mt-14 border-t border-border">
            {serviceCategories.map((name, i) => (
              <motion.li
                key={name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex items-baseline justify-between gap-6 border-b border-border py-5"
              >
                <span className="font-display text-xl text-primary-deep sm:text-2xl">
                  {name}
                </span>
                <span className="text-small text-gold" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </motion.li>
            ))}
          </ol>

          <motion.figure
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="mt-14"
          >
            <Image
              src="/images/04.jpg"
              alt="Decoration and event setup at Shri Sai Vatika Banquet Hall"
              width={1400}
              height={700}
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="h-auto w-full"
            />
          </motion.figure>
        </div>
      </section>
    </MotionConfig>
  );
}
