import { NextResponse } from "next/server";
import { authorizeApi, applySessionCookies } from "@/lib/admin/session";
import {
  canApplyAction,
  isBookingStatus,
  isOwnerAction,
  nextStatusFor,
  type OwnerAction,
} from "@/lib/admin/transitions";
import {
  BookingConflictError,
  BookingNotFoundError,
  BookingStaleError,
  applyBookingAction,
  getBooking,
  isSlotFree,
} from "@/lib/admin/bookings";
import { isAllowedSlot, isBookableDate } from "@/lib/booking/validate";
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
// from the action and the booking's current status, and every write is a
// compare-and-swap against the state the owner was looking at.
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
  const expected = (input.expected ?? null) as Record<string, unknown> | null;

  if (!isOwnerAction(input.action)) return error("Unknown booking action.", 400);
  if (!expected || !isBookingStatus(expected.status)) {
    return error("This booking's current status is required.", 400);
  }

  const action: OwnerAction = input.action;

  let booking;
  try {
    booking = await getBooking(id);
  } catch (err) {
    console.error("Admin booking action lookup failed", err instanceof Error ? err.message : err);
    return error("We couldn't update this booking right now.", 500);
  }
  if (!booking) return error("This booking could not be found.", 404);

  // The owner's view is stale — refuse rather than overwrite newer state.
  if (booking.status !== expected.status) {
    return error("This booking has changed since you opened it. Please refresh.", 409);
  }
  if (!canApplyAction(booking.status, action)) {
    return error(`A ${booking.status.toLowerCase()} booking cannot be ${action}ed.`, 409);
  }

  const nextStatus = nextStatusFor(booking.status, action);
  let visitDate: string | undefined;
  let timeSlot: string | undefined;

  if (action === "reschedule") {
    visitDate = typeof input.visitDate === "string" ? input.visitDate : "";
    timeSlot = typeof input.timeSlot === "string" ? input.timeSlot : "";

    if (expected.visitDate !== booking.visitDate || expected.timeSlot !== booking.timeSlot) {
      return error("This booking has changed since you opened it. Please refresh.", 409);
    }
    if (!isAllowedSlot(timeSlot)) return error("Please choose one of the fixed visit slots.", 400);
    if (!isBookableDate(visitDate)) {
      return error("Visits can only be rescheduled from tomorrow onwards.", 400);
    }
    if (visitDate === booking.visitDate && timeSlot === booking.timeSlot) {
      return error("Please choose a different date or time slot.", 400);
    }

    let free = false;
    try {
      free = await isSlotFree(visitDate, timeSlot, booking.id);
    } catch (err) {
      console.error("Admin reschedule availability check failed", err instanceof Error ? err.message : err);
      return error("We couldn't reschedule this booking right now.", 500);
    }
    if (!free) return error("That date and time slot is already taken.", 409);
  }

  if (!nextStatus) return error("This booking cannot be updated anymore.", 409);

  try {
    const updated = await applyBookingAction({
      id: booking.id,
      action,
      expected: {
        status: booking.status,
        visitDate: booking.visitDate,
        timeSlot: booking.timeSlot,
      },
      nextStatus,
      visitDate,
      timeSlot,
    });

    const response = NextResponse.json({ ok: true, booking: updated }, { headers: NO_STORE });
    if (auth.refreshed) applySessionCookies(response, auth.refreshed, request);
    return response;
  } catch (err) {
    if (err instanceof BookingStaleError || err instanceof BookingConflictError) {
      return error(
        err instanceof BookingStaleError
          ? "This booking has changed since you opened it. Please refresh."
          : "That date and time slot is already taken.",
        409
      );
    }
    if (err instanceof BookingNotFoundError) return error("This booking could not be found.", 404);
    console.error("Admin booking action error", err instanceof Error ? err.message : err);
    return error("We couldn't update this booking right now.", 500);
  }
}
