"use client";

import { motion, MotionConfig } from "motion/react";
import { directorMessage } from "@/content/director";

export default function Director() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="director" className="bg-surface" aria-labelledby="director-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="grid gap-12 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <p className="eyebrow">{directorMessage.eyebrow}</p>
              <h2 id="director-heading" className="font-display text-section mt-4 text-primary-deep">
                A word from our director
              </h2>
              {/* Placeholder-ready visual for a future client-provided photograph */}
              <div
                className="mt-10 flex h-56 w-44 items-center justify-center border border-border bg-ivory"
                role="img"
                aria-label="Portrait of Mr. Navneet Kumar, Director — photograph forthcoming from the venue"
              >
                <span className="font-display text-4xl text-gold" aria-hidden="true">
                  NK
                </span>
              </div>
              <p className="mt-4 font-display text-xl text-primary-deep">{directorMessage.name}</p>
              <p className="text-small text-muted-foreground">
                {directorMessage.title}, {directorMessage.organisation}
              </p>
            </motion.div>

            <motion.blockquote
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className="border-l border-gold pl-6"
            >
              {directorMessage.paragraphs.map((p, i) => (
                <p key={i} className="text-body mt-0 mb-5 text-foreground last:mb-0">
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
