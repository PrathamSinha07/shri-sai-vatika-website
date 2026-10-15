// Pure parsing/validation for bulk owner confirmation.
//
// The bulk-operation limit (MAX_BULK_ITEMS) is intentionally separate from
// the per-slot customer capacity: it caps how many bookings one request may
// touch, and has nothing to do with how many customers fit in a slot.
import {
  canApplyAction,
  isBookingStatus,
  isOwnerAction,
  nextStatusFor,
  type BookingStatus,
} from "@/lib/admin/transitions";

/** Maximum bookings a single bulk request may carry. */
export const MAX_BULK_ITEMS = 10;

/** The only bulk action supported — bulk cancel/complete/reschedule are deliberately not offered. */
export const BULK_ACTIONS = ["confirm"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export function isBulkAction(value: unknown): value is BulkAction {
  return typeof value === "string" && (BULK_ACTIONS as readonly string[]).includes(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BulkItem {
  id: string;
  /** The status the owner was looking at (compare-and-swap pin), or null when malformed. */
  expectedStatus: string | null;
  /** Request-shape problem detected for this item alone, so the others still run. */
  error: string | null;
}

export type BulkParseResult =
  | { ok: true; action: BulkAction; items: BulkItem[] }
  | { ok: false; status: number; error: string };

/**
 * Validates the bulk request envelope. Request-level problems (bad action,
 * missing/oversized list) reject the whole request; per-item shape problems
 * are reported per booking so a partial failure is always possible and
 * always visible.
 */
export function parseBulkConfirmBody(body: unknown): BulkParseResult {
  const input = (body ?? {}) as Record<string, unknown>;

  if (!isBulkAction(input.action)) {
    return {
      ok: false,
      status: 400,
      error: isOwnerAction(input.action)
        ? "Only bulk confirmation is supported."
        : "Unknown bulk action.",
    };
  }

  if (!Array.isArray(input.bookings) || input.bookings.length === 0) {
    return { ok: false, status: 400, error: "Select at least one booking." };
  }
  if (input.bookings.length > MAX_BULK_ITEMS) {
    return {
      ok: false,
      status: 400,
      error: `You can process at most ${MAX_BULK_ITEMS} bookings at a time. Please confirm in smaller batches.`,
    };
  }

  const items: BulkItem[] = input.bookings.map((raw) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : "";
    const expectedStatus = typeof entry.expectedStatus === "string" ? entry.expectedStatus : null;
    if (!UUID_RE.test(id)) {
      return { id, expectedStatus, error: "This booking could not be found." };
    }
    if (!expectedStatus) {
      return { id, expectedStatus, error: "This booking's current status is required." };
    }
    return { id, expectedStatus, error: null };
  });

  return { ok: true, action: input.action, items };
}

export type BulkItemCheck =
  | { ok: true; id: string; expectedStatus: BookingStatus; nextStatus: BookingStatus }
  | { ok: false; id: string; code: "invalid_request" | "invalid_transition"; error: string };

/**
 * Per-item transition validation. The compare-and-swap WHERE clause in the
 * write pins the claimed status, so a booking that actually moved on fails
 * as a stale update instead of being overwritten — the state machine is
 * never bypassed for throughput.
 */
export function validateBulkItem(item: BulkItem, action: BulkAction = "confirm"): BulkItemCheck {
  if (item.error || !item.id || !item.expectedStatus) {
    return {
      ok: false,
      id: item.id,
      code: "invalid_request",
      error: item.error ?? "This booking could not be found.",
    };
  }
  if (!isBookingStatus(item.expectedStatus)) {
    return {
      ok: false,
      id: item.id,
      code: "invalid_request",
      error: "This booking's current status is required.",
    };
  }
  if (!canApplyAction(item.expectedStatus, action)) {
    return {
      ok: false,
      id: item.id,
      code: "invalid_transition",
      error: `A ${item.expectedStatus.toLowerCase()} booking cannot be ${action}ed.`,
    };
  }
  const nextStatus = nextStatusFor(item.expectedStatus, action);
  if (!nextStatus) {
    return { ok: false, id: item.id, code: "invalid_transition", error: "This booking cannot be updated anymore." };
  }
  return { ok: true, id: item.id, expectedStatus: item.expectedStatus, nextStatus };
}
