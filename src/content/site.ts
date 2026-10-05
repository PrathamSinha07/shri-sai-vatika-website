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

export const facilities = [
  "3000 sq.ft. AC Hall",
  "8000 sq.ft. Lawn Area",
  "4 Deluxe AC Rooms",
  "Flower decoration",
  "Lighting setup",
  "Parking",
  "WiFi",
  "CCTV surveillance",
  "Security",
  "Fire safety",
  "Purified water",
  "Stage/decor",
  "Power backup",
  "Catering",
  "Wedding/event services",
] as const;

export const packages = [
  {
    name: "Complete Venue Package",
    price: "₹1,60,000",
    note: "Full venue booking",
  },
  {
    name: "Deluxe Catering",
    price: "₹849/person",
    note: "Per-plate catering",
  },
  {
    name: "Royal Catering",
    price: "₹1,099/person",
    note: "Premium per-plate catering",
  },
] as const;
