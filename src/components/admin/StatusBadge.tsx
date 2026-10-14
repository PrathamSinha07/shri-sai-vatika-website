import type { BookingStatus } from "@/lib/admin/transitions";

const STYLES: Record<BookingStatus, string> = {
  PENDING: "bg-gold-muted/40 text-[#6b4d0f] border-gold-muted",
  CONFIRMED: "bg-[#e6f1e7] text-[#1f5b2a] border-[#b6d6ba]",
  RESCHEDULED: "bg-[#e7eef8] text-[#1f4a7a] border-[#b8cde6]",
  COMPLETED: "bg-[#ece9e4] text-[#4a4238] border-[#d6cfc4]",
  CANCELLED: "bg-[#f8e7e7] text-[#8a2222] border-[#e3bbbb]",
};

const LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  RESCHEDULED: "Rescheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Status pill: colour plus a written label, so meaning never depends on hue. */
export default function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${STYLES[status]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status]}
    </span>
  );
}
