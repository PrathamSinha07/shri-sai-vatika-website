import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BULK_ITEMS,
  parseBulkConfirmBody,
  validateBulkItem,
  type BulkItem,
} from "./bulk";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function body(bookings: unknown[], action: unknown = "confirm") {
  return { action, bookings };
}

test("bulk limit is 10 and is independent of slot capacity", () => {
  assert.equal(MAX_BULK_ITEMS, 10);
});

test("only bulk confirmation is supported", () => {
  const cancel = parseBulkConfirmBody(body([{ id: ID_A, expectedStatus: "PENDING" }], "cancel"));
  assert.equal(cancel.ok, false);
  if (!cancel.ok) assert.match(cancel.error, /only bulk confirmation/i);

  const unknown = parseBulkConfirmBody(body([{ id: ID_A }], "delete"));
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.status, 400);
});

test("the whole request is rejected for envelope problems", () => {
  for (const bad of [undefined, null, {}, { action: "confirm" }, { action: "confirm", bookings: [] }, { bookings: [] }]) {
    const result = parseBulkConfirmBody(bad);
    assert.equal(result.ok, false, JSON.stringify(bad));
  }
  const eleven = parseBulkConfirmBody(
    body(Array.from({ length: MAX_BULK_ITEMS + 1 }, () => ({ id: ID_A, expectedStatus: "PENDING" })))
  );
  assert.equal(eleven.ok, false);
  if (!eleven.ok) {
    assert.equal(eleven.status, 400);
    assert.match(eleven.error, new RegExp(`${MAX_BULK_ITEMS} bookings`));
  }
});

test("exactly the limit parses, and per-item shape problems stay per-item", () => {
  const ten = parseBulkConfirmBody(
    body(Array.from({ length: MAX_BULK_ITEMS }, () => ({ id: ID_A, expectedStatus: "PENDING" })))
  );
  assert.equal(ten.ok, true);

  const mixed = parseBulkConfirmBody(
    body([
      { id: ID_A, expectedStatus: "PENDING" },
      { id: "not-a-uuid", expectedStatus: "PENDING" },
      { id: ID_B },
      { expectedStatus: "PENDING" },
    ])
  );
  assert.equal(mixed.ok, true);
  if (mixed.ok) {
    assert.equal(mixed.items.length, 4);
    assert.equal(mixed.items[0].error, null);
    assert.ok(mixed.items[1].error); // bad uuid → reported for that booking only
    assert.ok(mixed.items[2].error); // missing expected status
    assert.ok(mixed.items[3].error); // missing id
  }
});

test("bulk items may never bypass the transition rules", () => {
  const item = (expectedStatus: string): BulkItem => ({ id: ID_A, expectedStatus, error: null });

  for (const status of ["PENDING", "RESCHEDULED"]) {
    const check = validateBulkItem(item(status));
    assert.equal(check.ok, true, status);
    if (check.ok) {
      assert.equal(check.expectedStatus, status);
      assert.equal(check.nextStatus, "CONFIRMED"); // server-chosen, never client-chosen
    }
  }

  for (const status of ["CONFIRMED", "COMPLETED", "CANCELLED"]) {
    const check = validateBulkItem(item(status));
    assert.equal(check.ok, false, status);
    if (!check.ok) {
      assert.equal(check.code, "invalid_transition");
      assert.match(check.error, new RegExp(status.toLowerCase()));
    }
  }
});

test("malformed items fail as invalid requests, not as crashes", () => {
  const badId = validateBulkItem({ id: "nope", expectedStatus: "PENDING", error: "This booking could not be found." });
  assert.equal(badId.ok, false);
  if (!badId.ok) assert.equal(badId.code, "invalid_request");

  const badStatus = validateBulkItem({ id: ID_A, expectedStatus: "pending", error: null });
  assert.equal(badStatus.ok, false);
  if (!badStatus.ok) assert.equal(badStatus.code, "invalid_request");
});

test("a partial failure is expressible: good and bad items coexist", () => {
  const parsed = parseBulkConfirmBody(
    body([
      { id: ID_A, expectedStatus: "PENDING" },
      { id: ID_B, expectedStatus: "COMPLETED" }, // terminal → per-booking failure
    ])
  );
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const results = parsed.items.map((item) => validateBulkItem(item, parsed.action));
    assert.equal(results[0].ok, true);
    assert.equal(results[1].ok, false);
  }
});
