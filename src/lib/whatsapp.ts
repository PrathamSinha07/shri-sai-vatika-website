import { site } from "@/content/site";

export function whatsappUrl(message?: string): string {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? site.whatsappNumber;
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const defaultEnquiryMessage = `Namaste, I am interested in booking ${site.name}. Could you please share details about availability and packages?`;
