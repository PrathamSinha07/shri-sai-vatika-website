// Customer emails for owner actions (confirm / cancel / reschedule).
// Runs strictly AFTER a successful database update — an email failure is
// never a reason to roll back or fail the update. Delivery problems are
// reported separately through the returned { emailIssue } flag.
import {
  customerCancelledEmail,
  customerConfirmedEmail,
  customerRescheduledEmail,
  sendEmail,
} from "@/lib/email/resend";
import type { AdminBooking } from "@/lib/admin/bookings";
import type { OwnerAction } from "@/lib/admin/transitions";

export interface EmailSender {
  (params: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean }>;
}

export interface NotifyDeps {
  /** Injectable sender (tests); defaults to the Resend integration. */
  send?: EmailSender;
  /** Injectable Resend configuration probe (tests). */
  isConfigured?: () => boolean;
}

export interface OwnerActionEmailInput {
  action: OwnerAction;
  /** The booking as stored AFTER the update. */
  booking: AdminBooking;
  /** Pre-update date/slot — required for reschedule emails, ignored otherwise. */
  previous?: { visitDate: string; timeSlot: string };
  deps?: NotifyDeps;
}

function envConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/**
 * Sends the customer notification for a completed owner action.
 * `complete` intentionally sends nothing. Returns { emailIssue: true } on any
 * delivery/configuration problem; never throws, never affects the booking.
 */
export async function sendOwnerActionEmail({
  action,
  booking,
  previous,
  deps = {},
}: OwnerActionEmailInput): Promise<{ emailIssue: boolean }> {
  if (action === "complete") return { emailIssue: false };

  const email =
    action === "confirm"
      ? customerConfirmedEmail(booking)
      : action === "cancel"
        ? customerCancelledEmail(booking)
        : customerRescheduledEmail({
            customerName: booking.customerName,
            eventType: booking.eventType,
            // The reschedule email must carry the new date/time — and the
            // previous one for context.
            oldVisitDate: previous?.visitDate ?? "",
            oldTimeSlot: previous?.timeSlot ?? "",
            visitDate: booking.visitDate,
            timeSlot: booking.timeSlot,
          });

  try {
    const configured = deps.isConfigured ? deps.isConfigured() : envConfigured();
    if (!configured) {
      console.error("Email not fully configured. Missing env var(s): RESEND_API_KEY, RESEND_FROM_EMAIL");
      return { emailIssue: true };
    }
    const send = deps.send ?? sendEmail;
    const result = await send({ to: booking.email, ...email });
    if (!result.ok) {
      console.error(`Owner-action email delivery failed (${action})`);
      return { emailIssue: true };
    }
    return { emailIssue: false };
  } catch (err) {
    console.error(`Owner-action email step failed (${action})`, err);
    return { emailIssue: true };
  }
}
