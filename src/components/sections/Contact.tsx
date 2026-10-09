"use client";

import { motion, MotionConfig } from "motion/react";
import { contactCards, contactClosing, contactSection } from "@/content/contact";
import { bookVisitHref } from "@/content/navigation";
import { site } from "@/content/site";
import { googleMapsDirectionsUrl } from "@/lib/maps";
import { defaultEnquiryMessage, whatsappUrl } from "@/lib/whatsapp";

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.55 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.45-8.44ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.5-5.27c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.89-9.89 9.89Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5s1.07 2.9 1.22 3.1c.15.2 2.11 3.22 5.1 4.51.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export default function Contact() {
  const cards = [
    {
      icon: <PhoneIcon />,
      copy: contactCards.call,
      href: site.phoneHref,
      external: false,
    },
    {
      icon: <WhatsAppIcon />,
      copy: contactCards.whatsapp,
      href: whatsappUrl(defaultEnquiryMessage),
      external: true,
    },
    {
      icon: <CalendarIcon />,
      copy: contactCards.visit,
      href: bookVisitHref,
      external: false,
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <section id="contact" className="bg-surface" aria-labelledby="contact-heading">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">{contactSection.eyebrow}</p>
            <h2 id="contact-heading" className="font-display text-section mt-4 text-primary-deep">
              {contactSection.heading}
            </h2>
            <p className="text-body mt-4 text-muted-foreground">{contactSection.lede}</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {cards.map((card) => (
              <motion.div
                key={card.copy.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex flex-col gap-6 border border-border bg-background p-6 sm:p-8"
              >
                <span className="text-gold">{card.icon}</span>
                <div>
                  <p className="text-small uppercase tracking-[0.18em] text-muted-foreground">
                    {card.copy.label}
                  </p>
                  <h3 className="font-display mt-2 text-2xl text-primary-deep">
                    {card.copy.title}
                  </h3>
                </div>
                <p className="text-body text-muted-foreground">{card.copy.description}</p>
                <a
                  href={card.href}
                  {...(card.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="btn-text mt-auto inline-flex items-center justify-center border border-primary px-6 py-4 text-primary transition-colors hover:bg-primary hover:text-surface sm:self-start"
                >
                  {card.copy.ctaLabel}
                </a>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mt-10 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-start sm:justify-between"
          >
            <address className="not-italic">
              <p className="text-small uppercase tracking-[0.18em] text-muted-foreground">
                {contactClosing.addressLabel}
              </p>
              {site.address.lines.map((line) => (
                <p key={line} className="font-display mt-2 text-xl text-primary-deep">
                  {line}
                </p>
              ))}
            </address>
            <div className="max-w-sm">
              <p className="text-small text-muted-foreground">{contactClosing.note}</p>
              <a
                href={googleMapsDirectionsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-text mt-4 inline-flex items-center justify-center border border-primary px-6 py-4 text-primary transition-colors hover:bg-primary hover:text-surface"
              >
                {contactClosing.directionsLabel} →
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
