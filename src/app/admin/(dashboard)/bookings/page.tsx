import type { Metadata } from "next";
import BookingsView from "@/components/admin/BookingsView";
import { requireOwnerPage } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

// Private booking management. requireOwnerPage() runs before any booking data
// is read; the client view then loads rows through the authorized
// /api/admin/bookings endpoints (never Supabase directly).
export default async function AdminBookingsPage() {
  await requireOwnerPage("/admin/bookings");
  return <BookingsView />;
}
