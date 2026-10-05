export function whatsappUrl(message: string): string {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
