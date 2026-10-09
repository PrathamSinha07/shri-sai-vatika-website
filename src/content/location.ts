// Milestone 8 — Location content.
//
// The address itself lives in src/content/site.ts (single source of truth).
// Only client-confirmed details appear here — no travel times, distances or
// landmarks beyond the confirmed "Near T Point, Gola Road" reference.

export const locationSection = {
  eyebrow: "Location",
  heading: "Find us on Gola Road, Danapur",
  lede:
    "Shri Sai Vatika sits near the T Point on Gola Road in Danapur — a short distance from Patna, and convenient for your guests to reach.",
  addressLabel: "Address",
  landmarkNote:
    "Look for the decorated entrance on Gola Road, near the T Point at Danapur.",
  mapTitle:
    "Map of Shri Sai Vatika near T Point, Gola Road, Danapur, Patna 801503",
  mapCaption:
    "Shri Sai Vatika is located near T Point on Gola Road, Danapur, Patna.",
  directionsLabel: "Get Directions",
  openMapLabel: "Open in Google Maps",
} as const;
