// Booking architecture constants (documentation/architecture only for this
// milestone — no booking UI or backend is implemented yet).

export const BOOKING_TIMEZONE = "Asia/Kolkata";

export const BOOKING_TIME_SLOTS = [
  "09:00 AM – 12:00 PM",
  "01:00 PM – 03:00 PM",
  "03:00 PM – 06:00 PM",
  "06:00 PM – 08:00 PM",
] as const;

export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;

// Customers can only book from the next calendar day onward
// (Asia/Kolkata). Must be enforced on the server as well as the UI.
export function earliestBookableDate(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  const todayIst = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  todayIst.setUTCDate(todayIst.getUTCDate() + 1);
  return todayIst;
}
