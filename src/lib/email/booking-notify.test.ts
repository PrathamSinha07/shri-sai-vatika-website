import { test } from "node:test";
import assert from "node:assert/strict";
import { sendNewBookingEmails, type BookingNotifyDeps } from "./booking-notify";
import type { EmailSender } from "./notify";
import type { NormalizedBooking } from "@/lib/booking/validate";

// ---------------------------------------------------------------------------
// New-booking email orchestration. The booking is already persisted in
// Supabase before this runs, so these tests pin the no-email-launch
// contract: a missing Resend configuration or a delivery failure is
// reported as { emailIssue: true }, never thrown — the saved booking is
// never rolled back and the API can still answer { ok: true }.
// ---------------------------------------------------------------------------

const data: NormalizedBooking = {
  customerName: "Priya Sharma",
  phone: "9835063448",
  email: "priya@example.com",
  eventType: "Wedding",
  visitDate: "2026-11-10",
  timeSlot: "10:00 AM - 12:00 PM",
  message: null,
};

const configuredEnv: NonNullable<BookingNotifyDeps["env"]> = {
  RESEND_API_KEY: "re_test_key",
  RESEND_FROM_EMAIL: "bookings@example.com",
  ownerEmail: "owner@example.com",
};

function recordingSender(result: { ok: boolean } = { ok: true }) {
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const send: EmailSender = async (params) => {
    sent.push(params);
    return result;
  };
  return { sent, send };
}

function deps(send: EmailSender, env = configuredEnv): BookingNotifyDeps {
  return { send, env };
}

test("configured: customer receipt and owner summary are sent, no email issue", async () => {
  const { sent, send } = recordingSender();
  const outcome = await sendNewBookingEmails({
    data,
    bookingId: "22222222-2222-4222-8222-222222222222",
    submittedAt: "10/11/2026, 3:04:05 pm",
    deps: deps(send),
  });
  assert.deepEqual(outcome, { emailIssue: false });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].to, "priya@example.com");
  assert.match(sent[0].subject, /received/i);
  assert.equal(sent[1].to, "owner@example.com");
  assert.match(sent[1].subject, /NEW VISIT REQUEST/);
  assert.ok(sent[1].text.includes("22222222-2222-4222-8222-222222222222"));
});

test("the customer email is a PENDING receipt, never a confirmation", async () => {
  const { sent, send } = recordingSender();
  await sendNewBookingEmails({
    data,
    bookingId: "33333333-3333-4333-8333-333333333333",
    submittedAt: "10/11/2026, 3:04:05 pm",
    deps: deps(send),
  });
  assert.doesNotMatch(sent[0].subject, /confirmed/i);
  assert.ok(sent[0].text.includes("request confirmation, not a final confirmation"));
});

test("missing Resend configuration reports an email issue without throwing", async () => {
  const { send } = recordingSender();
  const outcome = await sendNewBookingEmails({
    data,
    bookingId: "44444444-4444-4444-8444-444444444444",
    submittedAt: "10/11/2026, 3:04:05 pm",
    deps: deps(send, { ...configuredEnv, RESEND_API_KEY: undefined }),
  });
  // The real sendEmail degrades to { ok: false } without the key, so the
  // outcome must be an email issue either way — and never a thrown error.
  assert.deepEqual(outcome, { emailIssue: true });
});

test("a missing owner inbox is an email issue; the customer receipt is still attempted", async () => {
  const { sent, send } = recordingSender();
  const outcome = await sendNewBookingEmails({
    data,
    bookingId: "55555555-5555-4555-8555-555555555555",
    submittedAt: "10/11/2026, 3:04:05 pm",
    deps: deps(send, { ...configuredEnv, ownerEmail: undefined }),
  });
  assert.deepEqual(outcome, { emailIssue: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "priya@example.com");
});

test("a delivery failure is reported, never thrown — the booking is never rolled back", async () => {
  const { send } = recordingSender({ ok: false });
  const outcome = await sendNewBookingEmails({
    data,
    bookingId: "66666666-6666-4666-8666-666666666666",
    submittedAt: "10/11/2026, 3:04:05 pm",
    deps: deps(send),
  });
  assert.deepEqual(outcome, { emailIssue: true });
});

test("a throwing sender is caught and reported as an email issue", async () => {
  const outcome = await sendNewBookingEmails({
    data,
    bookingId: "77777777-7777-4777-8777-777777777777",
    submittedAt: "10/11/2026, 3:04:05 pm",
    deps: deps(async () => {
      throw new Error("network down");
    }),
  });
  assert.deepEqual(outcome, { emailIssue: true });
});
