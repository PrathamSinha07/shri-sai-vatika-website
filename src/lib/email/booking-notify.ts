// New-booking emails (customer receipt + owner notification).
// Runs strictly AFTER the Supabase insert has succeeded — an email failure
// (or a missing Resend configuration) is never a reason to roll back the
// booking; it is reported separately through the returned { emailIssue }
// flag so the API can answer { ok: true, emailIssue } and the UI can be
// honest with the customer. This keeps the site launchable on a temporary
// domain where no verified email sender exists yet (see
// `docs/deployment.md`): bookings are still saved and visible in the
// owner dashboard; only the email leg degrades.
import {
  sendEmail,
  customerConfirmationEmail,
  ownerNotificationEmail,
} from "@/lib/email/resend";
import type { EmailSender } from "@/lib/email/notify";
import type { NormalizedBooking } from "@/lib/booking/validate";

export interface BookingNotifyDeps {
  /** Injectable sender (tests); defaults to the Resend integration. */
  send?: EmailSender;
  /** Injectable environment probe (tests); defaults to the real env vars. */
  env?: {
    RESEND_API_KEY?: string | undefined;
    RESEND_FROM_EMAIL?: string | undefined;
    ownerEmail?: string | undefined;
  };
}

export interface NewBookingEmailInput {
  data: NormalizedBooking;
  bookingId: string;
  /** Human-readable submission time (IST) for the owner summary. */
  submittedAt: string;
  deps?: BookingNotifyDeps;
}

function defaultEnv() {
  return {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    ownerEmail:
      process.env.BOOKING_NOTIFY_EMAIL ?? process.env.ENQUIRY_NOTIFY_EMAIL,
  };
}

/**
 * Sends the customer + owner emails for a booking that is already stored.
 * Returns { emailIssue: true } on any delivery or configuration problem;
 * never throws, never affects the booking row.
 */
export async function sendNewBookingEmails({
  data,
  bookingId,
  submittedAt,
  deps = {},
}: NewBookingEmailInput): Promise<{ emailIssue: boolean }> {
  try {
    const env = deps.env ?? defaultEnv();
    const missingConfig: string[] = [];
    if (!env.RESEND_API_KEY) missingConfig.push("RESEND_API_KEY");
    if (!env.RESEND_FROM_EMAIL) missingConfig.push("RESEND_FROM_EMAIL");
    if (!env.ownerEmail)
      missingConfig.push("BOOKING_NOTIFY_EMAIL (or ENQUIRY_NOTIFY_EMAIL)");
    if (missingConfig.length > 0) {
      // Variable names only, never values.
      console.error(
        `Email not fully configured. Missing env var(s): ${missingConfig.join(", ")}`
      );
    }

    // The customer receipt is attempted even when the owner inbox is
    // missing; `sendEmail` itself degrades to { ok: false } when the
    // Resend key/sender env vars are absent, so nothing throws here.
    const send = deps.send ?? sendEmail;
    const results = await Promise.all([
      send({ to: data.email, ...customerConfirmationEmail(data) }),
      env.ownerEmail
        ? send({
            to: env.ownerEmail,
            ...ownerNotificationEmail({ ...data, bookingId, submittedAt }),
          })
        : Promise.resolve({ ok: false } as const),
    ]);
    const deliveryFailed = results.some((r) => !r.ok);
    return { emailIssue: missingConfig.length > 0 || deliveryFailed };
  } catch (err) {
    console.error("Email step failed", err);
    return { emailIssue: true };
  }
}
