"use client";

import Image from "next/image";
import { motion, MotionConfig } from "motion/react";
import { directorMessage } from "@/content/director";

export default function Director() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="director" className="bg-surface" aria-labelledby="director-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">{directorMessage.eyebrow}</p>
            <h2 id="director-heading" className="font-display text-section mt-4 text-primary-deep">
              A word from our director
            </h2>
          </div>

          <div className="mt-12 grid gap-12 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
            <motion.figure
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Image
                src="/images/director.jpg"
                alt="Mr. Navneet Kumar, Director of Shri Sai Vatika Banquet Hall"
                width={1062}
                height={886}
                sizes="(max-width: 767px) 100vw, 40vw"
                className="h-auto w-full"
              />
              <figcaption className="mt-5 border-l-2 border-gold pl-4">
                <p className="font-display text-2xl text-primary-deep">
                  {directorMessage.name}
                </p>
                <p className="text-small mt-1 text-muted-foreground">
                  {directorMessage.title}, {directorMessage.organisation}
                </p>
              </figcaption>
            </motion.figure>

            <motion.blockquote
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className="md:pt-2"
            >
              {directorMessage.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-body mt-0 mb-6 leading-relaxed text-foreground last:mb-0"
                >
                  {p}
                </p>
              ))}
            </motion.blockquote>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
