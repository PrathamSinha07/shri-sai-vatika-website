import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { getSessionCheck } from "@/lib/admin/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Layout for the two protected dashboard pages (/admin and /admin/bookings).
// IMPORTANT: every page rendered under this group must call
// requireOwnerPage("<its own path>") as its first statement, before any
// booking data is fetched — that is the server-side authorization gate. The
// layout only reads the (already cached) session to label the shell.
export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const check = await getSessionCheck();
  const email = check.state === "authorized" ? check.session.email : "";

  return <AdminShell email={email}>{children}</AdminShell>;
}
