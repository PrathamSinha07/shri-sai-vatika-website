// Configurable per-slot capacity for visit bookings.
//
// This value mirrors the database-side capacity enforced atomically by the
// trigger in supabase/migrations/0003_slot_capacity.sql (PostgreSQL setting
// app.slot_capacity — same parse rule, same default, same clamp). Here it
// only drives friendly pre-checks and the availability display — the
// database trigger is the final arbiter under concurrency, so a mismatch
// degrades to a slightly stale "no longer available" message, never to
// overselling.
export const DEFAULT_SLOT_CAPACITY = 2;
export const MIN_SLOT_CAPACITY = 1;
export const MAX_SLOT_CAPACITY = 100;

// A bare integer of at most 9 digits (a longer digit run would overflow the
// database's integer type in visit_bookings_slot_capacity()). Anything else
// — missing, empty, decimal, text, or scientific notation — is malformed
// and falls back to the documented default, exactly like the database-side
// parse, so the display never promises more spots than the trigger enforces.
const STRICT_INTEGER = /^[+-]?[0-9]{1,9}$/;

/** Parses and clamps a raw capacity value; malformed input falls back to the default. */
export function parseSlotCapacity(raw: string | null | undefined): number {
  const value = (raw ?? "").trim();
  if (!STRICT_INTEGER.test(value)) return DEFAULT_SLOT_CAPACITY;
  return Math.min(MAX_SLOT_CAPACITY, Math.max(MIN_SLOT_CAPACITY, Number.parseInt(value, 10)));
}

/** The configured capacity (BOOKING_SLOT_CAPACITY, default 2). */
export function slotCapacity(): number {
  return parseSlotCapacity(process.env.BOOKING_SLOT_CAPACITY);
}

/** Spots still open for a slot with `taken` capacity-consuming bookings. */
export function remainingSpots(taken: number, capacity: number): number {
  return Math.max(0, capacity - taken);
}

/** True when a slot has no room left for another booking. */
export function isSlotFull(taken: number, capacity: number): boolean {
  return taken >= capacity;
}
