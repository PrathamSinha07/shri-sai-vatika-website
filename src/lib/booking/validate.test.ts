import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateBookingInput,
  isBookableDate,
  isAllowedSlot,
  isValidEmail,
  isValidPhone,
  earliestBookableDateString,
  todayIst,
} from "./validate";
import { BOOKING_TIME_SLOTS } from "../../content/booking";

// Fixed "now": 2026-10-06T10:00:00+05:30 (IST date = 2026-10-06).
const NOW = new Date("2026-10-06T04:30:00Z");

const valid = {
  customerName: "Rahul Kumar",
  phone: "98350 63448",
  email: "rahul@example.com",
  eventType: "Wedding",
  visitDate: "2026-10-07",
  timeSlot: BOOKING_TIME_SLOTS[0],
  message: "Looking forward to visiting.",
  website: "",
};

test("today (IST) is rejected", () => {
  const r = validateBookingInput({ ...valid, visitDate: "2026-10-06" }, NOW);
  assert.equal(r.ok, false);
  assert.ok(r.ok === false && r.errors.visitDate);
});

test("tomorrow is accepted", () => {
  const r = validateBookingInput(valid, NOW);
  assert.equal(r.ok, true);
});

test("past date is rejected", () => {
  const r = validateBookingInput({ ...valid, visitDate: "2026-10-05" }, NOW);
  assert.equal(r.ok, false);
});

test("invalid slot is rejected", () => {
  const r = validateBookingInput({ ...valid, timeSlot: "10:00 AM custom" }, NOW);
  assert.equal(r.ok, false);
});

test("all four fixed slots are accepted", () => {
  for (const slot of BOOKING_TIME_SLOTS) {
    assert.equal(isAllowedSlot(slot), true);
    const r = validateBookingInput({ ...valid, timeSlot: slot }, NOW);
    assert.equal(r.ok, true);
  }
});

test("invalid email is rejected", () => {
  assert.equal(isValidEmail("not-an-email"), false);
  const r = validateBookingInput({ ...valid, email: "nope" }, NOW);
  assert.equal(r.ok, false);
});

test("invalid phone is rejected", () => {
  assert.equal(isValidPhone("12345"), false);
  const r = validateBookingInput({ ...valid, phone: "12345" }, NOW);
  assert.equal(r.ok, false);
});

test("common Indian phone formats are accepted", () => {
  for (const p of ["9835063448", "+91 98350 63448", "098350 63448", "919835063448"]) {
    assert.equal(isValidPhone(p), true, p);
  }
});

test("missing required fields are rejected", () => {
  const r = validateBookingInput({}, NOW);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.customerName);
    assert.ok(r.errors.phone);
    assert.ok(r.errors.email);
    assert.ok(r.errors.eventType);
    assert.ok(r.errors.visitDate);
    assert.ok(r.errors.timeSlot);
  }
});

test("valid booking normalizes and would be stored as PENDING", () => {
  const r = validateBookingInput({ ...valid, email: "  RAHUL@EXAMPLE.COM " }, NOW);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.email, "rahul@example.com");
});

test("Other event type requires a description", () => {
  const r = validateBookingInput({ ...valid, eventType: "Other" }, NOW);
  assert.equal(r.ok, false);
  const r2 = validateBookingInput(
    { ...valid, eventType: "Other", eventTypeOther: "Corporate dinner" },
    NOW
  );
  assert.equal(r2.ok, true);
  if (r2.ok) assert.equal(r2.data.eventType, "Other: Corporate dinner");
});

test("honeypot filled is rejected", () => {
  const r = validateBookingInput({ ...valid, website: "http://spam" }, NOW);
  assert.equal(r.ok, false);
});

test("earliest bookable date is tomorrow in IST", () => {
  assert.equal(todayIst(NOW), "2026-10-06");
  assert.equal(earliestBookableDateString(NOW), "2026-10-07");
  assert.equal(isBookableDate("2026-10-06", NOW), false);
  assert.equal(isBookableDate("2026-10-07", NOW), true);
});
