import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SLOT_CAPACITY,
  MAX_SLOT_CAPACITY,
  MIN_SLOT_CAPACITY,
  isSlotFull,
  parseSlotCapacity,
  remainingSpots,
  slotCapacity,
} from "./capacity";

test("documented default capacity is 2 and is configurable", () => {
  assert.equal(DEFAULT_SLOT_CAPACITY, 2);
  assert.equal(parseSlotCapacity("4"), 4);
  assert.equal(parseSlotCapacity("1"), 1);
  assert.equal(parseSlotCapacity("50"), 50);
  assert.equal(parseSlotCapacity(" 7 "), 7); // surrounding whitespace trimmed
  assert.equal(parseSlotCapacity("+3"), 3); // optional sign, like the DB parse
});

test("invalid or missing capacity falls back to the default", () => {
  assert.equal(parseSlotCapacity(undefined), DEFAULT_SLOT_CAPACITY);
  assert.equal(parseSlotCapacity(null), DEFAULT_SLOT_CAPACITY);
  assert.equal(parseSlotCapacity(""), DEFAULT_SLOT_CAPACITY);
  assert.equal(parseSlotCapacity("not-a-number"), DEFAULT_SLOT_CAPACITY);
  assert.equal(parseSlotCapacity("2.5x"), DEFAULT_SLOT_CAPACITY);
  // Decimals, mixed values, and scientific notation are malformed too — the
  // database-side parse (visit_bookings_slot_capacity) falls back the same
  // way, so the display never promises more spots than the trigger enforces.
  assert.equal(parseSlotCapacity("2.5"), DEFAULT_SLOT_CAPACITY);
  assert.equal(parseSlotCapacity("3.5"), DEFAULT_SLOT_CAPACITY);
  assert.equal(parseSlotCapacity("4abc"), DEFAULT_SLOT_CAPACITY);
  assert.equal(parseSlotCapacity("1e3"), DEFAULT_SLOT_CAPACITY);
  // Digit runs too long for the database's integer type (10+ digits).
  assert.equal(parseSlotCapacity("1234567890"), DEFAULT_SLOT_CAPACITY);
});

test("capacity is clamped into the allowed 1..100 range", () => {
  assert.equal(parseSlotCapacity("0"), MIN_SLOT_CAPACITY);
  assert.equal(parseSlotCapacity("-3"), MIN_SLOT_CAPACITY);
  assert.equal(parseSlotCapacity("1000"), MAX_SLOT_CAPACITY);
});

test("slotCapacity reads BOOKING_SLOT_CAPACITY from the environment", () => {
  const original = process.env.BOOKING_SLOT_CAPACITY;
  try {
    process.env.BOOKING_SLOT_CAPACITY = "3";
    assert.equal(slotCapacity(), 3);
    delete process.env.BOOKING_SLOT_CAPACITY;
    assert.equal(slotCapacity(), DEFAULT_SLOT_CAPACITY);
    process.env.BOOKING_SLOT_CAPACITY = "garbage";
    assert.equal(slotCapacity(), DEFAULT_SLOT_CAPACITY);
  } finally {
    if (original === undefined) delete process.env.BOOKING_SLOT_CAPACITY;
    else process.env.BOOKING_SLOT_CAPACITY = original;
  }
});

test("remaining spots and fullness follow the capacity model", () => {
  assert.equal(remainingSpots(0, 2), 2);
  assert.equal(remainingSpots(1, 2), 1);
  assert.equal(remainingSpots(2, 2), 0);
  assert.equal(remainingSpots(5, 2), 0); // never negative
  assert.equal(isSlotFull(0, 2), false);
  assert.equal(isSlotFull(1, 2), false);
  assert.equal(isSlotFull(2, 2), true);
  assert.equal(isSlotFull(3, 2), true);
});
