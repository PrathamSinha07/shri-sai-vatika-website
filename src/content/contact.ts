// Milestone 8 — Contact content.
//
// Only confirmed contact details are used: the phone/WhatsApp number and
// the venue address from src/content/site.ts, plus the existing visit
// booking form. No email address, opening hours, staff availability or
// social accounts exist in confirmed material, so none may appear here.

import { site } from "./site";

export const contactSection = {
  eyebrow: "Contact",
  heading: "We would love to hear about your celebration",
  lede:
    "Choosing a date, comparing packages, or planning a visit — speak with us directly and we will be glad to help.",
} as const;

export const contactCards = {
  call: {
    label: "Call",
    title: "Speak with us",
    description: `Call ${site.phoneDisplay} to talk about your event, packages or a venue visit.`,
    ctaLabel: `Call ${site.phoneDisplay}`,
  },
  whatsapp: {
    label: "WhatsApp",
    title: "Message us",
    description:
      "Send your questions about packages, dates or a visit — we will reply on WhatsApp.",
    ctaLabel: "Chat on WhatsApp",
  },
  visit: {
    label: "Visit",
    title: "See the venue in person",
    description:
      "Choose a convenient date and time slot, and we will host you at Shri Sai Vatika.",
    ctaLabel: "Book a Visit",
  },
} as const;

export const contactClosing = {
  addressLabel: "Find us",
  note: "Visit us at the address above, or call before you come and we will help you find your way.",
  directionsLabel: "Get Directions",
} as const;
