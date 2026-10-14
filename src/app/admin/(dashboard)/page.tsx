import type { Metadata } from "next";
import Link from "next/link";
import StatusBadge from "@/components/admin/StatusBadge";
import { formatDateTime, formatDate } from "@/components/admin/format";
import { getOverviewMetrics, type OverviewMetrics } from "@/lib/admin/bookings";
import { requireOwnerPage } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Dashboard Overview",
  robots: { index: false, follow: false },
};

const CARDS = [
  { key: "total", label: "Total requests" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "upcoming", label: "Upcoming visits" },
] as const;

export default async function AdminOverviewPage() {
  // Server-side gate: unauthenticated and unauthorized visitors are redirected
  // before any booking data is read.
  await requireOwnerPage("/admin");

  let metrics: OverviewMetrics | null = null;
  try {
    metrics = await getOverviewMetrics();
  } catch (err) {
    console.error("Overview metrics failed", err instanceof Error ? err.message : err);
  }

  if (!metrics) {
    return (
      <div className="rounded-panel border border-[#e3bbbb] bg-[#f8e7e7] p-6">
        <h1 className="font-display text-2xl text-[#8a2222]">We couldn&rsquo;t load the dashboard</h1>
        <p className="text-small mt-2 text-[#8a2222]">
          Booking data is unavailable right now. Please refresh the page in a moment.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-primary-deep">Overview</h1>
          <p className="text-small mt-1 text-muted-foreground">
            Live figures from the visit-booking requests stored in Supabase.
          </p>
        </div>
        <Link
          href="/admin/bookings"
          className="btn-text rounded-control border border-primary px-4 py-2.5 text-primary transition-colors hover:bg-primary hover:text-surface"
        >
          Manage bookings
        </Link>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map((card) => (
          <li
            key={card.key}
            data-metric={card.key}
            className="rounded-card border border-border bg-surface p-4 sm:p-5"
          >
            <p className="text-small uppercase tracking-[0.12em] text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-primary-deep">
              {metrics[card.key]}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-5">
        <h2 className="text-small font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          All statuses
        </h2>
        <ul className="text-small mt-3 flex flex-wrap gap-x-6 gap-y-2 text-foreground">
          <li>Rescheduled: {metrics.rescheduled}</li>
          <li>Completed: {metrics.completed}</li>
          <li>Cancelled: {metrics.cancelled}</li>
        </ul>
      </div>

      <section className="mt-10" aria-labelledby="recent-heading">
        <div className="flex items-end justify-between gap-4">
          <h2 id="recent-heading" className="font-display text-2xl text-primary-deep">
            Recent booking requests
          </h2>
          <Link href="/admin/bookings" className="text-small underline underline-offset-4 hover:text-primary">
            View all
          </Link>
        </div>

        {metrics.recent.length === 0 ? (
          <p className="mt-4 rounded-card border border-dashed border-border bg-surface p-6 text-small text-muted-foreground">
            No visit requests yet. New submissions from the website appear here
            as soon as they arrive.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-card border border-border bg-surface">
            <table className="w-full border-collapse text-left text-small">
              <caption className="sr-only">The five most recent visit booking requests</caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Visit</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Slot</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Received</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recent.map((booking) => (
                  <tr key={booking.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">{booking.customerName}</span>
                      <span className="text-muted-foreground"> · {booking.eventType}</span>
                    </td>
                    <td className="px-4 py-3">{formatDate(booking.visitDate)}</td>
                    <td className="px-4 py-3">{booking.timeSlot}</td>
                    <td className="px-4 py-3"><StatusBadge status={booking.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(booking.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
