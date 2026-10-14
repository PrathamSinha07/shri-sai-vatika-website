import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_RULES,
  OWNER_ACTIONS,
  availableActions,
  canApplyAction,
  isBookingStatus,
  isOwnerAction,
  nextStatusFor,
  type BookingStatus,
} from "./transitions";
import { BOOKING_STATUSES } from "../../content/booking";

test("recognizes exactly the documented booking statuses", () => {
  assert.deepEqual([...BOOKING_STATUSES], [
    "PENDING",
    "CONFIRMED",
    "RESCHEDULED",
    "COMPLETED",
    "CANCELLED",
  ]);
  for (const status of BOOKING_STATUSES) assert.equal(isBookingStatus(status), true);
  assert.equal(isBookingStatus("pending"), false);
  assert.equal(isBookingStatus("REFUNDED"), false);
  assert.equal(isBookingStatus(42), false);
});

test("recognizes only the four owner actions", () => {
  assert.deepEqual([...OWNER_ACTIONS], ["confirm", "cancel", "complete", "reschedule"]);
  for (const action of OWNER_ACTIONS) assert.equal(isOwnerAction(action), true);
  assert.equal(isOwnerAction("delete"), false);
  assert.equal(isOwnerAction(null), false);
});

test("every action writes a status the server chose", () => {
  for (const action of OWNER_ACTIONS) {
    assert.ok(isBookingStatus(ACTION_RULES[action].to), `${action} target status must be valid`);
  }
});

test("confirm is only legal for pending or rescheduled bookings", () => {
  assert.equal(canApplyAction("PENDING", "confirm"), true);
  assert.equal(canApplyAction("RESCHEDULED", "confirm"), true);
  assert.equal(canApplyAction("CONFIRMED", "confirm"), false);
  assert.equal(canApplyAction("COMPLETED", "confirm"), false);
  assert.equal(canApplyAction("CANCELLED", "confirm"), false);
  assert.equal(nextStatusFor("PENDING", "confirm"), "CONFIRMED");
  assert.equal(nextStatusFor("RESCHEDULED", "confirm"), "CONFIRMED");
});

test("complete only moves a confirmed visit to completed", () => {
  assert.equal(nextStatusFor("CONFIRMED", "complete"), "COMPLETED");
  assert.equal(canApplyAction("PENDING", "complete"), false);
  assert.equal(canApplyAction("RESCHEDULED", "complete"), false);
  assert.equal(canApplyAction("COMPLETED", "complete"), false);
});

test("COMPLETED and CANCELLED are terminal — no action can resurrect them", () => {
  for (const status of ["COMPLETED", "CANCELLED"] as BookingStatus[]) {
    assert.deepEqual(availableActions(status), [], `${status} must offer no actions`);
    for (const action of OWNER_ACTIONS) {
      assert.equal(canApplyAction(status, action), false);
      assert.equal(nextStatusFor(status, action), null);
    }
  }
});

test("cancel is eligible for every non-terminal status", () => {
  for (const status of ["PENDING", "CONFIRMED", "RESCHEDULED"] as BookingStatus[]) {
    assert.equal(nextStatusFor(status, "cancel"), "CANCELLED");
  }
});

test("reschedule keeps the booking live so the owner can still confirm it", () => {
  for (const status of ["PENDING", "CONFIRMED", "RESCHEDULED"] as BookingStatus[]) {
    assert.equal(nextStatusFor(status, "reschedule"), "RESCHEDULED");
  }
});

test("availableActions matches the action rules exactly", () => {
  for (const status of BOOKING_STATUSES) {
    assert.deepEqual(
      availableActions(status),
      OWNER_ACTIONS.filter((action) => canApplyAction(status, action))
    );
  }
});
