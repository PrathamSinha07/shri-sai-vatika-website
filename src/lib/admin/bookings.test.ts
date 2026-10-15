import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AdminBookingStoreError,
  BookingConflictError,
  BookingStaleError,
  applyBookingAction,
  countOtherActiveBookings,
} from "./bookings";
import { BOOKING_TIME_SLOTS } from "../../content/booking";

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
const realFetch = global.fetch;

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  calls = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
}

// Restores the network stub only; the test env stays set for the whole file
// (each test file runs in its own process under the node test runner).
function restore() {
  global.fetch = realFetch;
}

const row = {
  id: BOOKING_ID,
  created_at: "2026-10-06T10:00:00Z",
  updated_at: "2026-10-06T10:00:00Z",
  customer_name: "Test Customer",
  phone: "9835063448",
  email: "customer@example.com",
  event_type: "Wedding",
  event_date: null,
  visit_date: "2026-10-20",
  time_slot: BOOKING_TIME_SLOTS[0],
  message: null,
  status: "PENDING",
  owner_notes: null,
  rescheduled_from: null,
  source: "website",
};

test("reschedule conflict check counts OTHER capacity-consuming bookings, excluding the current one", async () => {
  try {
    stubFetch((url) => {
      assert.ok(url.includes("status=neq.CANCELLED"), "cancelled bookings release capacity");
      assert.ok(url.includes(`id=neq.${BOOKING_ID}`), "the booking being rescheduled must be excluded");
      assert.ok(url.includes(`time_slot=eq.${encodeURIComponent(BOOKING_TIME_SLOTS[1])}`));
      return new Response(JSON.stringify([{ id: "other" }]), { status: 200 });
    });
    const taken = await countOtherActiveBookings("2026-10-21", BOOKING_TIME_SLOTS[1], BOOKING_ID);
    assert.equal(taken, 1);

    stubFetch(() => new Response("[]", { status: 200 }));
    assert.equal(await countOtherActiveBookings("2026-10-21", BOOKING_TIME_SLOTS[1], BOOKING_ID), 0);

    stubFetch(() => new Response("down", { status: 503 }));
    await assert.rejects(
      countOtherActiveBookings("2026-10-21", BOOKING_TIME_SLOTS[1], BOOKING_ID),
      AdminBookingStoreError
    );
  } finally {
    restore();
  }
});

test("reschedule write is a compare-and-swap that pins status, date and slot", async () => {
  try {
    stubFetch(() => new Response(JSON.stringify([{ ...row, status: "RESCHEDULED", visit_date: "2026-10-21" }]), { status: 200 }));
    await applyBookingAction({
      id: BOOKING_ID,
      action: "reschedule",
      expected: { status: "PENDING", visitDate: "2026-10-20", timeSlot: BOOKING_TIME_SLOTS[0] },
      nextStatus: "RESCHEDULED",
      visitDate: "2026-10-21",
      timeSlot: BOOKING_TIME_SLOTS[1],
    });
    const { url, init } = calls[0];
    assert.ok(url.includes(`id=eq.${BOOKING_ID}`));
    assert.ok(url.includes("status=eq.PENDING"));
    assert.ok(url.includes("visit_date=eq.2026-10-20"));
    assert.ok(url.includes(`time_slot=eq.${encodeURIComponent(BOOKING_TIME_SLOTS[0])}`));
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, {
      status: "RESCHEDULED",
      visit_date: "2026-10-21",
      time_slot: BOOKING_TIME_SLOTS[1],
    });
  } finally {
    restore();
  }
});

test("confirm/cancel/complete writes carry only the status — no date/slot fields", async () => {
  try {
    for (const [nextStatus, status] of [
      ["CONFIRMED", "PENDING"],
      ["CANCELLED", "PENDING"],
      ["COMPLETED", "CONFIRMED"],
    ] as const) {
      stubFetch(() => new Response(JSON.stringify([{ ...row, status: nextStatus }]), { status: 200 }));
      await applyBookingAction({
        id: BOOKING_ID,
        action: nextStatus === "CANCELLED" ? "cancel" : nextStatus === "COMPLETED" ? "complete" : "confirm",
        expected: { status },
        nextStatus,
      });
      const body = JSON.parse(String(calls[0].init?.body));
      assert.deepEqual(body, { status: nextStatus });
    }
  } finally {
    restore();
  }
});

test("a full destination slot aborts the reschedule atomically (capacity conflict)", async () => {
  try {
    stubFetch(
      () =>
        new Response(JSON.stringify({ code: "23514", message: "visit_bookings slot capacity exceeded (2)" }), {
          status: 400,
        })
    );
    await assert.rejects(
      applyBookingAction({
        id: BOOKING_ID,
        action: "reschedule",
        expected: { status: "PENDING", visitDate: "2026-10-20", timeSlot: BOOKING_TIME_SLOTS[0] },
        nextStatus: "RESCHEDULED",
        visitDate: "2026-10-21",
        timeSlot: BOOKING_TIME_SLOTS[1],
      }),
      BookingConflictError
    );
  } finally {
    restore();
  }
});

test("unique violations and check violations map to conflicts, other errors stay generic", async () => {
  try {
    stubFetch(() => new Response(JSON.stringify({ code: "23505" }), { status: 400 }));
    await assert.rejects(
      applyBookingAction({ id: BOOKING_ID, action: "confirm", expected: { status: "PENDING" }, nextStatus: "CONFIRMED" }),
      BookingConflictError
    );

    stubFetch(() => new Response(JSON.stringify({ code: "23514", message: "visit_date check violated" }), { status: 400 }));
    await assert.rejects(
      applyBookingAction({ id: BOOKING_ID, action: "confirm", expected: { status: "PENDING" }, nextStatus: "CONFIRMED" }),
      (err: unknown) => err instanceof BookingConflictError && err.message === "booking_rule_violation"
    );

    stubFetch(() => new Response("boom", { status: 500 }));
    await assert.rejects(
      applyBookingAction({ id: BOOKING_ID, action: "confirm", expected: { status: "PENDING" }, nextStatus: "CONFIRMED" }),
      AdminBookingStoreError
    );
  } finally {
    restore();
  }
});

test("zero matched rows means the booking moved on — never a silent overwrite", async () => {
  try {
    stubFetch(() => new Response("[]", { status: 200 }));
    await assert.rejects(
      applyBookingAction({ id: BOOKING_ID, action: "confirm", expected: { status: "PENDING" }, nextStatus: "CONFIRMED" }),
      BookingStaleError
    );
  } finally {
    restore();
  }
});
