export function googleMapsUrl(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL ?? "";
}
