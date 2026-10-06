import { NextResponse } from "next/server";
import { validateBookingInput } from "@/lib/booking/validate";
import {
  insertVisitBooking,
  isSlotAvailable,
  BookingStoreError,
  SlotUnavailableError,
} from "@/lib/supabase/server";
import { sendEmail, customerConfirmationEmail, ownerNotificationEmail } from "@/lib/email/resend";

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
    if (!(await isSlotAvailable(data.visitDate, data.timeSlot))) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This time slot is no longer available. Please choose another slot.",
        },
        { status: 409 }
      );
    }

    const booking = await insertVisitBooking(data);

    // Emails are independent of the booking lifecycle: failures are logged
    // and reported, never rolled back.
    let emailIssue = false;
    try {
      const customerMail = customerConfirmationEmail(data);
      const ownerMail = ownerNotificationEmail({
        ...data,
        bookingId: booking.id,
        submittedAt: new Date(booking.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
      });
      const ownerEmail =
        process.env.BOOKING_NOTIFY_EMAIL ?? process.env.ENQUIRY_NOTIFY_EMAIL;
      const missingConfig: string[] = [];
      if (!process.env.RESEND_API_KEY) missingConfig.push("RESEND_API_KEY");
      if (!process.env.RESEND_FROM_EMAIL) missingConfig.push("RESEND_FROM_EMAIL");
      if (!ownerEmail)
        missingConfig.push("BOOKING_NOTIFY_EMAIL (or ENQUIRY_NOTIFY_EMAIL)");
      if (missingConfig.length > 0) {
        console.error(
          `Email not fully configured. Missing env var(s): ${missingConfig.join(", ")}`
        );
        emailIssue = true;
      }
      const results = await Promise.all([
        sendEmail({ to: data.email, ...customerMail }),
        ownerEmail
          ? sendEmail({ to: ownerEmail, ...ownerMail })
          : Promise.resolve({ ok: false } as const),
      ]);
      if (!ownerEmail) {
        console.error("BOOKING_NOTIFY_EMAIL is not configured");
        emailIssue = true;
      }
      if (results.some((r) => !r.ok)) emailIssue = true;
    } catch (err) {
      console.error("Email step failed", err);
      emailIssue = true;
    }

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
            "This time slot has just been booked. Please select another slot.",
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
