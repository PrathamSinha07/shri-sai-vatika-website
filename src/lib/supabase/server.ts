// Server-only Supabase access via PostgREST (no anon access; service role
// key must never reach the browser).
import { requiredEnv } from "@/lib/env";
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

export async function getBookedSlots(visitDate: string): Promise<string[]> {
  const url = `${baseUrl()}/rest/v1/visit_bookings?visit_date=eq.${encodeURIComponent(
    visitDate
  )}&status=neq.CANCELLED&select=time_slot`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new BookingStoreError();
  const rows = (await res.json()) as Array<{ time_slot: string }>;
  return rows.map((r) => r.time_slot);
}

export async function isSlotAvailable(
  visitDate: string,
  timeSlot: string
): Promise<boolean> {
  const url = `${baseUrl()}/rest/v1/visit_bookings?visit_date=eq.${encodeURIComponent(
    visitDate
  )}&time_slot=eq.${encodeURIComponent(timeSlot)}&status=neq.CANCELLED&select=id&limit=1`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new BookingStoreError();
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows.length === 0;
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
    // Unique violation may surface as 400 with code 23505 in the body.
    const body = await res.text().catch(() => "");
    if (body.includes("23505")) throw new SlotUnavailableError();
    console.error("Booking insert failed", res.status, body);
    throw new BookingStoreError();
  }
  const rows = (await res.json()) as Array<{ id: string; created_at: string }>;
  return { id: rows[0].id, createdAt: rows[0].created_at };
}
