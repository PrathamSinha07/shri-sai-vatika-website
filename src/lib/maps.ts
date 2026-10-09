// Google Maps URL builders.
//
// The venue has no confirmed latitude/longitude, so every URL is derived
// from the confirmed address string in src/content/site.ts — never from
// invented coordinates.
//
// - googleMapsUrl(): customer-facing "open in Maps" destination link.
//   NEXT_PUBLIC_GOOGLE_MAPS_URL still overrides it when set.
// - googleMapsDirectionsUrl(): "Get Directions" link (destination = venue).
// - googleMapsEmbedUrl(): keyless interactive map embed for an <iframe>.
//   The embed is always address-derived; an override link may point at a
//   place page that cannot be embedded, so it is not reused here.

import { site } from "@/content/site";

const addressQuery = () => `${site.name}, ${site.address.lines.join(", ")}`;

export function googleMapsSearchUrl(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery())}`;
}

export function googleMapsUrl(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL || googleMapsSearchUrl();
}

export function googleMapsDirectionsUrl(): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressQuery())}`;
}

export function googleMapsEmbedUrl(): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(addressQuery())}&z=15&output=embed`;
}
