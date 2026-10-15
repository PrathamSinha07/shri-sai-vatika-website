import { NextResponse } from "next/server";
import { authorizeApi, applySessionCookies } from "@/lib/admin/session";
import { planOwnerAction } from "@/lib/admin/actions";
import {
  BookingConflictError,
  BookingNotFoundError,
  BookingStaleError,
  AdminBookingStoreError,
  applyBookingAction,
  countOtherActiveBookings,
  getBooking,
} from "@/lib/admin/bookings";
import { isSlotFull, slotCapacity } from "@/lib/booking/capacity";
import { sendOwnerActionEmail } from "@/lib/email/notify";
import { NO_STORE } from "@/lib/admin/paths";

type RouteParams = { params: Promise<{ id: string }> };

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: NO_STORE });
}

// Private booking detail.
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const booking = await getBooking(id);
    if (!booking) return error("This booking could not be found.", 404);

    const response = NextResponse.json({ ok: true, booking }, { headers: NO_STORE });
    if (auth.refreshed) applySessionCookies(response, auth.refreshed, request);
    return response;
  } catch (err) {
    console.error("Admin booking detail error", err instanceof Error ? err.message : err);
    return error("We couldn't load this booking right now.", 500);
  }
}

// Owner actions: confirm / cancel / complete / reschedule.
// The client never chooses the resulting status — it is derived server-side
// from the action and the booking's current status (src/lib/admin/actions.ts),
// and every write is a compare-and-swap against the state the owner was
// looking at. Confirm/cancel/complete are pure status changes and never run
// a slot-availability (capacity) check; only rescheduling checks the
// destination slot, counting OTHER capacity-consuming bookings and excluding
// this one. The database trigger (migration 0003) is the atomic arbiter.
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Please submit the form again.", 400);
  }
  const input = (body ?? {}) as Record<string, unknown>;

  let booking;
  try {
    booking = await getBooking(id);
  } catch (err) {
    console.error("Admin booking action lookup failed", err instanceof Error ? err.message : err);
    return error("We couldn't update this booking right now.", 500);
  }
  if (!booking) return error("This booking could not be found.", 404);

  const plan = planOwnerAction(booking, input);
  if (!plan.ok) return error(plan.error, plan.status);

  if (plan.plan.requiresSlotCapacityCheck) {
    const visitDate = plan.plan.visitDate!;
    const timeSlot = plan.plan.timeSlot!;
    let taken = 0;
    try {
      taken = await countOtherActiveBookings(visitDate, timeSlot, booking.id);
    } catch (err) {
      console.error("Admin reschedule availability check failed", err instanceof Error ? err.message : err);
      return error("We couldn't reschedule this booking right now.", 500);
    }
    if (isSlotFull(taken, slotCapacity())) {
      return error("That date and time slot has no visit spots left.", 409);
    }
  }

  try {
    const updated = await applyBookingAction({
      id: booking.id,
      action: plan.plan.action,
      expected: {
        status: booking.status,
        visitDate: booking.visitDate,
        timeSlot: booking.timeSlot,
      },
      nextStatus: plan.plan.nextStatus,
      visitDate: plan.plan.visitDate,
      timeSlot: plan.plan.timeSlot,
    });

    // Customer notification. Sent only after the update succeeded; an email
    // failure is reported separately and never rolls anything back.
    let emailIssue = false;
    try {
      emailIssue = (
        await sendOwnerActionEmail({
          action: plan.plan.action,
          booking: updated,
          previous: { visitDate: booking.visitDate, timeSlot: booking.timeSlot },
        })
      ).emailIssue;
    } catch (err) {
      console.error("Owner-action email step failed", err instanceof Error ? err.message : err);
      emailIssue = true;
    }

    const response = NextResponse.json(
      { ok: true, booking: updated, emailIssue },
      { headers: NO_STORE }
    );
    if (auth.refreshed) applySessionCookies(response, auth.refreshed, request);
    return response;
  } catch (err) {
    if (err instanceof BookingStaleError || err instanceof BookingConflictError) {
      return error(
        err instanceof BookingStaleError
          ? "This booking has changed since you opened it. Please refresh."
          : "That date and time slot has no visit spots left.",
        409
      );
    }
    if (err instanceof BookingNotFoundError) return error("This booking could not be found.", 404);
    if (err instanceof AdminBookingStoreError) {
      return error("We couldn't update this booking right now.", 500);
    }
    console.error("Admin booking action error", err instanceof Error ? err.message : err);
    return error("We couldn't update this booking right now.", 500);
  }
}
