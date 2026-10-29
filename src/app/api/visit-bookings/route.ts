import { NextResponse } from "next/server";
import { validateBookingInput } from "@/lib/booking/validate";
import { isSlotFull, slotCapacity } from "@/lib/booking/capacity";
import {
  countActiveBookings,
  insertVisitBooking,
  BookingStoreError,
  SlotUnavailableError,
} from "@/lib/supabase/server";
import { sendNewBookingEmails } from "@/lib/email/booking-notify";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Please submit the form again." },
      { status: 400 }
    );
  }

  const result = validateBookingInput((body ?? {}) as Record<string, unknown>);
  if (!result.ok) {
    if (result.errors.website === "spam") {
      // Honeypot triggered: pretend success, store nothing.
      return NextResponse.json({ ok: true, emailIssue: false });
    }
    return NextResponse.json(
      { ok: false, errors: result.errors },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    // Friendly capacity pre-check. The slot-capacity trigger inside
    // PostgreSQL is the atomic final arbiter: if a concurrent request wins
    // the race, the insert below fails with SlotUnavailableError.
    if (isSlotFull(await countActiveBookings(data.visitDate, data.timeSlot), slotCapacity())) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This time slot is fully booked. Please choose another slot.",
        },
        { status: 409 }
      );
    }

    const booking = await insertVisitBooking(data);

    // Emails are independent of the booking lifecycle: failures (including
    // a missing Resend configuration on a temporary launch domain) are
    // logged and reported, never rolled back. The booking above is already
    // saved and visible in the owner dashboard regardless of the outcome.
    const { emailIssue } = await sendNewBookingEmails({
      data,
      bookingId: booking.id,
      submittedAt: new Date(booking.createdAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
    });

    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      emailIssue,
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This time slot has just filled up. Please select another slot.",
        },
        { status: 409 }
      );
    }
    if (err instanceof BookingStoreError) {
      return NextResponse.json(
        {
          ok: false,
          error: "We couldn't submit your request right now. Please try again.",
        },
        { status: 500 }
      );
    }
    console.error("Booking error", err);
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't submit your request right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
