// Milestone 8 — Packages content.
//
// Pricing below is client-confirmed and nothing else may be added:
//   - Complete Venue Package: ₹1,60,000 (one-time venue booking)
//   - Deluxe Catering: ₹849 per person
//   - Royal Catering: ₹1,099 per person
//   - Non-Vegetarian Catering: priced separately — no confirmed figure
//
// Inclusions, menus, guest counts, taxes, discounts and other commercial
// terms have NOT been confirmed by the client. Descriptions must stay
// honest about that and point to an enquiry instead of implying details.

import { site } from "./site";

export interface PackageOffer {
  id: string;
  name: string;
  /** Confirmed figure, formatted for display (e.g. "₹1,60,000"). */
  price: string;
  /** How the price applies (e.g. "One-time venue price", "Per person"). */
  priceUnit: string;
  description: string;
  /** Pre-filled WhatsApp message identifying the offering. */
  enquiryMessage: string;
}

export const packagesSection = {
  eyebrow: "Packages & Pricing",
  heading: "Clear pricing, confirmed with you personally",
  lede:
    "Celebrations are planned differently in every family, so we keep our pricing simple: one complete venue package, two catering menus, and a non-vegetarian option quoted to your requirement.",
} as const;

export const venuePackage: PackageOffer = {
  id: "complete-venue",
  name: "Complete Venue Package",
  price: "₹1,60,000",
  priceUnit: "One-time venue price",
  description:
    "Reserve Shri Sai Vatika for your celebration with a single venue booking. How the spaces are arranged for your date, and everything the booking includes, is confirmed personally when you enquire.",
  enquiryMessage: `Namaste, I would like to enquire about the Complete Venue Package (₹1,60,000) at ${site.name}. Please share details, inclusions and available dates.`,
};

export const cateringPackages: readonly PackageOffer[] = [
  {
    id: "deluxe-catering",
    name: "Deluxe Catering",
    price: "₹849",
    priceUnit: "Per person",
    description:
      "Our Deluxe per-plate catering menu. The menu and what it includes are shared with you in full when you enquire.",
    enquiryMessage: `Namaste, I would like to enquire about Deluxe Catering (₹849 per person) at ${site.name}. Please share the menu and details.`,
  },
  {
    id: "royal-catering",
    name: "Royal Catering",
    price: "₹1,099",
    priceUnit: "Per person",
    description:
      "Our Royal per-plate catering menu for celebrations that call for a grander spread. The menu and what it includes are shared in full when you enquire.",
    enquiryMessage: `Namaste, I would like to enquire about Royal Catering (₹1,099 per person) at ${site.name}. Please share the menu and details.`,
  },
];

export const nonVegCatering = {
  id: "non-veg-catering",
  name: "Non-Vegetarian Catering",
  priceNote: "Priced separately — no fixed rate is published",
  description:
    "Non-vegetarian catering is quoted separately from the Deluxe and Royal menus. Tell us your requirement and we will confirm the price.",
  enquiryMessage: `Namaste, I would like to enquire about non-vegetarian catering at ${site.name}. Please share the pricing and details.`,
  ctaLabel: "Enquire for Pricing",
} as const;

export const packagesNote =
  "Menus, inclusions and availability are shared in complete detail when you enquire — every celebration is planned personally with our team.";
