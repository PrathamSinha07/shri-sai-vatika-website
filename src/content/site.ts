// Single source of truth for business information.
// Client-provided; verify before production deployment.

export const site = {
  name: "Shri Sai Vatika Banquet Hall",
  shortName: "Shri Sai Vatika",
  tagline: "Where Celebrations Become Memories",
  phoneDisplay: "98350 63448",
  phoneHref: "tel:+919835063448",
  whatsappNumber: "919835063448",
  address: {
    lines: ["Near T Point, Gola Road, Danapur", "Patna - 801503", "Bihar, India"],
    mapsUrl: process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL ?? "",
  },
} as const;

export const verifiedNotice =
  "Business details and pricing are client-provided and pending verification.";

// Flat list retained for compatibility; structured facilities live in
// `src/content/facilities.ts`.
// Package pricing lives in `src/content/packages.ts`.
export const facilities = [
  "3000 sq.ft. AC Hall",
  "8000 sq.ft. Lawn",
  "4 Deluxe AC Rooms",
  "Parking",
  "CCTV surveillance",
  "Wi-Fi",
  "Security guard",
  "Fire safety",
  "Purified water",
  "Power backup",
  "Stage",
  "Gate/passage decoration",
  "Food stall",
  "Selfie point",
  "Varmala",
  "30-piece Baraat welcome mala",
] as const;


