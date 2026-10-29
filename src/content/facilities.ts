// Facilities as supplied by the client. Grouped for presentation only;
// do not add amenities the venue does not offer.
// Client-approved revision: gate and passage decorations are listed as
// separate entries; Varmala and the Baraat welcome mala are not listed.

export type FacilityIcon =
  | "hall"
  | "lawn"
  | "rooms"
  | "parking"
  | "cctv"
  | "wifi"
  | "security"
  | "fire"
  | "water"
  | "power"
  | "stage"
  | "gate"
  | "passage"
  | "food"
  | "selfie";

export const facilityGroups: ReadonlyArray<{
  title: string;
  items: ReadonlyArray<{ label: string; icon: FacilityIcon }>;
}> = [
  {
    title: "The Spaces",
    items: [
      { label: "3000 sq.ft. AC Hall", icon: "hall" },
      { label: "8000 sq.ft. Lawn", icon: "lawn" },
      { label: "4 Deluxe AC Rooms", icon: "rooms" },
    ],
  },
  {
    title: "Guest Comforts",
    items: [
      { label: "Parking", icon: "parking" },
      { label: "CCTV Surveillance", icon: "cctv" },
      { label: "Wi-Fi", icon: "wifi" },
      { label: "Security Guard", icon: "security" },
      { label: "Fire Safety", icon: "fire" },
      { label: "Purified Water", icon: "water" },
      { label: "Power Backup", icon: "power" },
    ],
  },
  {
    title: "Celebration Details",
    items: [
      { label: "Stage", icon: "stage" },
      { label: "Gate Decoration", icon: "gate" },
      { label: "Passage Decoration", icon: "passage" },
      { label: "Food Stall", icon: "food" },
      { label: "Selfie Point", icon: "selfie" },
    ],
  },
];
