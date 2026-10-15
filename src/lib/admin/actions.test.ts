import { test } from "node:test";
import assert from "node:assert/strict";
import { planOwnerAction } from "./actions";
import type { BookingStatus } from "./transitions";
import { BOOKING_TIME_SLOTS } from "../../content/booking";

// Fixed "now": 2026-10-06T10:00:00+05:30 (IST date = 2026-10-06).
const NOW = new Date("2026-10-06T04:30:00Z");

const booking: { status: BookingStatus; visitDate: string; timeSlot: string } = {
  status: "PENDING",
  visitDate: "2026-10-08",
  timeSlot: BOOKING_TIME_SLOTS[0],
};

test("confirm, cancel and complete never require a slot-availability (capacity) check", () => {
  const cases = [
    { status: "PENDING" as BookingStatus, action: "confirm", next: "CONFIRMED" },
    { status: "PENDING" as BookingStatus, action: "cancel", next: "CANCELLED" },
    { status: "CONFIRMED" as BookingStatus, action: "cancel", next: "CANCELLED" },
    { status: "RESCHEDULED" as BookingStatus, action: "confirm", next: "CONFIRMED" },
    { status: "CONFIRMED" as BookingStatus, action: "complete", next: "COMPLETED" },
  ];
  for (const c of cases) {
    const result = planOwnerAction(
      { ...booking, status: c.status },
      { action: c.action, expected: { status: c.status } },
      NOW
    );
    assert.equal(result.ok, true, `${c.action} from ${c.status} must plan`);
    if (result.ok) {
      assert.equal(result.plan.requiresSlotCapacityCheck, false, c.action);
      assert.equal(result.plan.nextStatus, c.next);
    }
  }
});

test("cancellation of a booking in a now-full slot is still plannable", () => {
  // Even with the destination slot completely full, cancelling is a pure
  // status change — nothing to check, nothing can block it.
  const result = planOwnerAction(
    { status: "CONFIRMED", visitDate: "2026-10-08", timeSlot: BOOKING_TIME_SLOTS[1] },
    { action: "cancel", expected: { status: "CONFIRMED" } },
    NOW
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.plan.requiresSlotCapacityCheck, false);
});

test("reschedule requires a capacity check and carries the new destination", () => {
  const result = planOwnerAction(
    booking,
    {
      action: "reschedule",
      expected: { status: "PENDING", visitDate: booking.visitDate, timeSlot: booking.timeSlot },
      visitDate: "2026-10-09",
      timeSlot: BOOKING_TIME_SLOTS[2],
    },
    NOW
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.requiresSlotCapacityCheck, true);
    assert.equal(result.plan.nextStatus, "RESCHEDULED");
    assert.equal(result.plan.visitDate, "2026-10-09");
    assert.equal(result.plan.timeSlot, BOOKING_TIME_SLOTS[2]);
  }
});

test("unknown actions and missing expectations are refused before any write", () => {
  assert.deepEqual(planOwnerAction(booking, { action: "delete", expected: { status: "PENDING" } }, NOW), {
    ok: false,
    status: 400,
    error: "Unknown booking action.",
  });
  assert.equal(planOwnerAction(booking, { action: "confirm" }, NOW).ok, false);
  const noStatus = planOwnerAction(booking, { action: "confirm", expected: {} }, NOW);
  assert.equal(noStatus.ok, false);
  if (!noStatus.ok) assert.equal(noStatus.status, 400);
});

test("stale expectations are refused with 409 instead of overwriting", () => {
  const staleStatus = planOwnerAction(
    { ...booking, status: "CONFIRMED" },
    { action: "cancel", expected: { status: "PENDING" } },
    NOW
  );
  assert.equal(staleStatus.ok, false);
  if (!staleStatus.ok) assert.equal(staleStatus.status, 409);

  const staleSlot = planOwnerAction(
    booking,
    {
      action: "reschedule",
      expected: { status: "PENDING", visitDate: booking.visitDate, timeSlot: BOOKING_TIME_SLOTS[1] },
      visitDate: "2026-10-09",
      timeSlot: BOOKING_TIME_SLOTS[2],
    },
    NOW
  );
  assert.equal(staleSlot.ok, false);
  if (!staleSlot.ok) assert.equal(staleSlot.status, 409);
});

test("illegal transitions are refused for every terminal or wrong state", () => {
  for (const status of ["COMPLETED", "CANCELLED"] as BookingStatus[]) {
    for (const action of ["confirm", "cancel", "complete", "reschedule"] as const) {
      const result = planOwnerAction(
        { ...booking, status },
        { action, expected: { status }, visitDate: "2026-10-09", timeSlot: BOOKING_TIME_SLOTS[0] },
        NOW
      );
      assert.equal(result.ok, false, `${action} from ${status}`);
      if (!result.ok) assert.equal(result.status, 409);
    }
  }
  const completePending = planOwnerAction(
    booking,
    { action: "complete", expected: { status: "PENDING" } },
    NOW
  );
  assert.equal(completePending.ok, false);
});

test("reschedule validation reuses the public booking rules", () => {
  const base = {
    action: "reschedule",
    expected: { status: "PENDING", visitDate: booking.visitDate, timeSlot: booking.timeSlot },
  } as const;

  const badSlot = planOwnerAction(booking, { ...base, visitDate: "2026-10-09", timeSlot: "10:00 PM" }, NOW);
  assert.equal(badSlot.ok, false);
  if (!badSlot.ok) assert.equal(badSlot.status, 400);

  const pastDate = planOwnerAction(booking, { ...base, visitDate: "2026-10-06", timeSlot: BOOKING_TIME_SLOTS[0] }, NOW);
  assert.equal(pastDate.ok, false);

  // Same-slot reschedules are refused — the booking already holds this slot.
  const sameSlot = planOwnerAction(
    booking,
    { ...base, visitDate: booking.visitDate, timeSlot: booking.timeSlot },
    NOW
  );
  assert.equal(sameSlot.ok, false);
  if (!sameSlot.ok) {
    assert.equal(sameSlot.status, 400);
    assert.match(sameSlot.error, /different date or time slot/i);
  }
});
