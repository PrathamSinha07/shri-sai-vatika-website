import { test } from "node:test";
import assert from "node:assert/strict";
import { sendOwnerActionEmail, type EmailSender } from "./notify";
import type { AdminBooking } from "@/lib/admin/bookings";
import { BOOKING_TIME_SLOTS } from "../../content/booking";

const booking: AdminBooking = {
  id: "11111111-1111-4111-8111-111111111111",
  customerName: "Rahul Kumar",
  phone: "9835063448",
  email: "rahul@example.com",
  eventType: "Wedding",
  eventDate: null,
  visitDate: "2026-10-20",
  timeSlot: BOOKING_TIME_SLOTS[0],
  message: null,
  status: "CONFIRMED",
  ownerNotes: null,
  rescheduledFrom: null,
  source: "website",
  createdAt: "2026-10-06T10:00:00Z",
  updatedAt: "2026-10-06T10:00:00Z",
};

function recordingSender(result: { ok: boolean } = { ok: true }) {
  const sent: Array<{ to: string; subject: string; html: string; text: string }> = [];
  const send: EmailSender = async (params) => {
    sent.push(params);
    return result;
  };
  return { sent, send };
}

test("confirm sends the customer a confirmation email", async () => {
  const { sent, send } = recordingSender();
  const outcome = await sendOwnerActionEmail({
    action: "confirm",
    booking,
    deps: { send, isConfigured: () => true },
  });
  assert.deepEqual(outcome, { emailIssue: false });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "rahul@example.com");
  assert.match(sent[0].subject, /confirmed/i);
  assert.ok(sent[0].text.includes(booking.visitDate));
  assert.ok(sent[0].text.includes(booking.timeSlot));
});

test("cancel sends the customer a cancellation email", async () => {
  const { sent, send } = recordingSender();
  const outcome = await sendOwnerActionEmail({
    action: "cancel",
    booking: { ...booking, status: "CANCELLED" },
    deps: { send, isConfigured: () => true },
  });
  assert.deepEqual(outcome, { emailIssue: false });
  assert.match(sent[0].subject, /cancelled/i);
  assert.ok(sent[0].text.includes("cancelled"));
});

test("reschedule emails include the NEW date/time and the previous one", async () => {
  const { sent, send } = recordingSender();
  const outcome = await sendOwnerActionEmail({
    action: "reschedule",
    booking: { ...booking, status: "RESCHEDULED", visitDate: "2026-10-25", timeSlot: BOOKING_TIME_SLOTS[2] },
    previous: { visitDate: "2026-10-20", timeSlot: BOOKING_TIME_SLOTS[0] },
    deps: { send, isConfigured: () => true },
  });
  assert.deepEqual(outcome, { emailIssue: false });
  assert.match(sent[0].subject, /rescheduled/i);
  for (const body of [sent[0].text, sent[0].html]) {
    assert.ok(body.includes("2026-10-25"), "new date");
    assert.ok(body.includes(BOOKING_TIME_SLOTS[2]), "new time slot");
    assert.ok(body.includes("2026-10-20"), "previous date");
    assert.ok(body.includes(BOOKING_TIME_SLOTS[0]), "previous time slot");
  }
});

test("completion sends no customer email at all", async () => {
  const { sent, send } = recordingSender();
  const outcome = await sendOwnerActionEmail({
    action: "complete",
    booking: { ...booking, status: "COMPLETED" },
    deps: { send, isConfigured: () => true },
  });
  assert.deepEqual(outcome, { emailIssue: false });
  assert.equal(sent.length, 0);
});

test("a delivery failure is reported, never thrown — the update is never rolled back", async () => {
  const { send } = recordingSender({ ok: false });
  const outcome = await sendOwnerActionEmail({
    action: "confirm",
    booking,
    deps: { send, isConfigured: () => true },
  });
  assert.deepEqual(outcome, { emailIssue: true });
});

test("a throwing sender is caught and reported as an email issue", async () => {
  const outcome = await sendOwnerActionEmail({
    action: "confirm",
    booking,
    deps: {
      send: async () => {
        throw new Error("network down");
      },
      isConfigured: () => true,
    },
  });
  assert.deepEqual(outcome, { emailIssue: true });
});

test("missing Resend configuration reports an email issue without sending", async () => {
  const { sent, send } = recordingSender();
  const outcome = await sendOwnerActionEmail({
    action: "confirm",
    booking,
    deps: { send, isConfigured: () => false },
  });
  assert.deepEqual(outcome, { emailIssue: true });
  assert.equal(sent.length, 0);
});
