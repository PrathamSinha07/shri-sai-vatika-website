// Server-only Supabase access via PostgREST (no anon access; service role
// key must never reach the browser).
import { requiredEnv } from "@/lib/env";
import { slotCapacity } from "@/lib/booking/capacity";
import { BOOKING_TIME_SLOTS } from "@/content/booking";
import type { NormalizedBooking } from "@/lib/booking/validate";

export class SlotUnavailableError extends Error {
  constructor() {
    super("slot_unavailable");
    this.name = "SlotUnavailableError";
  }
}

export class BookingStoreError extends Error {
  constructor() {
    super("booking_store_error");
    this.name = "BookingStoreError";
  }
}

/** Stable marker raised by the slot-capacity trigger (see migration 0003). */
export const CAPACITY_VIOLATION_MARKER = "slot capacity exceeded";

function headers(): HeadersInit {
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function baseUrl(): string {
  return requiredEnv("SUPABASE_URL").replace(/\/$/, "");
}

export interface SlotAvailability {
  capacity: number;
  /** Capacity-consuming bookings per fixed slot (CANCELLED excluded). */
  counts: Record<string, number>;
  /** Spots still open per fixed slot. */
  remaining: Record<string, number>;
  /** Slots with no room left (kept for the existing form/UX contract). */
  booked: string[];
}

/**
 * Availability for one date. Only capacity-consuming bookings count:
 * CANCELLED bookings release their slot (the database trigger guarantees
 * the same rule atomically at write time).
 */
export async function getSlotAvailability(visitDate: string): Promise<SlotAvailability> {
  const url = `${baseUrl()}/rest/v1/visit_bookings?visit_date=eq.${encodeURIComponent(
    visitDate
  )}&status=neq.CANCELLED&select=time_slot`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new BookingStoreError();
  const rows = (await res.json()) as Array<{ time_slot: string }>;

  const counts: Record<string, number> = {};
  for (const slot of BOOKING_TIME_SLOTS) counts[slot] = 0;
  for (const row of rows) counts[row.time_slot] = (counts[row.time_slot] ?? 0) + 1;

  const capacity = slotCapacity();
  const remaining: Record<string, number> = {};
  const booked: string[] = [];
  for (const slot of BOOKING_TIME_SLOTS) {
    const open = Math.max(0, capacity - (counts[slot] ?? 0));
    remaining[slot] = open;
    if (open === 0) booked.push(slot);
  }
  return { capacity, counts, remaining, booked };
}

/** How many capacity-consuming bookings a date + slot currently holds. */
export async function countActiveBookings(
  visitDate: string,
  timeSlot: string
): Promise<number> {
  const url = `${baseUrl()}/rest/v1/visit_bookings?visit_date=eq.${encodeURIComponent(
    visitDate
  )}&time_slot=eq.${encodeURIComponent(timeSlot)}&status=neq.CANCELLED&select=id`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new BookingStoreError();
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows.length;
}

export async function insertVisitBooking(
  data: NormalizedBooking
): Promise<{ id: string; createdAt: string }> {
  const res = await fetch(`${baseUrl()}/rest/v1/visit_bookings`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify({
      customer_name: data.customerName,
      phone: data.phone,
      email: data.email,
      event_type: data.eventType,
      visit_date: data.visitDate,
      time_slot: data.timeSlot,
      message: data.message,
      status: "PENDING",
      source: "website",
    }),
    cache: "no-store",
  });

  if (res.status === 409 || res.status === 23505) {
    throw new SlotUnavailableError();
  }
  if (!res.ok) {
    // Unique violations (23505) and the slot-capacity trigger both surface
    // as errors here; the trigger's statement is atomic, so nothing was
    // partially inserted and the caller can safely report "slot taken".
    const body = await res.text().catch(() => "");
    if (body.includes("23505") || body.includes(CAPACITY_VIOLATION_MARKER)) {
      throw new SlotUnavailableError();
    }
    console.error("Booking insert failed", res.status, body);
    throw new BookingStoreError();
  }
  const rows = (await res.json()) as Array<{ id: string; created_at: string }>;
  return { id: rows[0].id, createdAt: rows[0].created_at };
}
