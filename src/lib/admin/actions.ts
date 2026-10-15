// Pure owner-action planning, shared by PATCH /api/admin/bookings/{id} and
// the bulk-confirmation route. Everything here is validation only — no
// availability lookups and no writes — so the rule that confirm/cancel/
// complete never run a slot-availability (capacity) check is explicit and
// unit-testable: only rescheduling sets requiresSlotCapacityCheck.
import { isAllowedSlot, isBookableDate } from "@/lib/booking/validate";
import {
  canApplyAction,
  isBookingStatus,
  isOwnerAction,
  nextStatusFor,
  type BookingStatus,
  type OwnerAction,
} from "@/lib/admin/transitions";

export interface PlanableBooking {
  status: BookingStatus;
  visitDate: string;
  timeSlot: string;
}

export interface OwnerActionInput {
  action?: unknown;
  expected?: unknown;
  visitDate?: unknown;
  timeSlot?: unknown;
}

export interface ActionPlan {
  action: OwnerAction;
  nextStatus: BookingStatus;
  /** True only for reschedule: the destination slot's capacity must be checked. */
  requiresSlotCapacityCheck: boolean;
  /** New destination (reschedule only). */
  visitDate?: string;
  timeSlot?: string;
}

export type PlanOutcome =
  | { ok: true; plan: ActionPlan }
  | { ok: false; status: number; error: string };

const STALE = "This booking has changed since you opened it. Please refresh.";

/**
 * Validates an owner action against the booking's current state and the
 * compare-and-swap expectations the owner was looking at. The resulting
 * status is always derived server-side — never taken from the client.
 */
export function planOwnerAction(
  booking: PlanableBooking,
  input: OwnerActionInput,
  now: Date = new Date()
): PlanOutcome {
  if (!isOwnerAction(input.action)) {
    return { ok: false, status: 400, error: "Unknown booking action." };
  }
  const expected = (input.expected ?? null) as Record<string, unknown> | null;
  if (!expected || !isBookingStatus(expected.status)) {
    return { ok: false, status: 400, error: "This booking's current status is required." };
  }

  const action: OwnerAction = input.action;

  // The owner's view is stale — refuse rather than overwrite newer state.
  if (booking.status !== expected.status) {
    return { ok: false, status: 409, error: STALE };
  }
  if (!canApplyAction(booking.status, action)) {
    return { ok: false, status: 409, error: `A ${booking.status.toLowerCase()} booking cannot be ${action}ed.` };
  }

  const nextStatus = nextStatusFor(booking.status, action);
  if (!nextStatus) return { ok: false, status: 409, error: "This booking cannot be updated anymore." };

  if (action !== "reschedule") {
    // Confirm / cancel / complete: a pure status change. They must never run
    // a slot-availability check — in particular, cancelling a booking always
    // succeeds and releases its slot.
    return { ok: true, plan: { action, nextStatus, requiresSlotCapacityCheck: false } };
  }

  const visitDate = typeof input.visitDate === "string" ? input.visitDate : "";
  const timeSlot = typeof input.timeSlot === "string" ? input.timeSlot : "";

  if (expected.visitDate !== booking.visitDate || expected.timeSlot !== booking.timeSlot) {
    return { ok: false, status: 409, error: STALE };
  }
  if (!isAllowedSlot(timeSlot)) {
    return { ok: false, status: 400, error: "Please choose one of the fixed visit slots." };
  }
  if (!isBookableDate(visitDate, now)) {
    return { ok: false, status: 400, error: "Visits can only be rescheduled from tomorrow onwards." };
  }
  if (visitDate === booking.visitDate && timeSlot === booking.timeSlot) {
    return { ok: false, status: 400, error: "Please choose a different date or time slot." };
  }

  return {
    ok: true,
    plan: { action, nextStatus, requiresSlotCapacityCheck: true, visitDate, timeSlot },
  };
}
