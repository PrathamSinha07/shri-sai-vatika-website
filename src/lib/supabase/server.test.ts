import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BookingStoreError,
  SlotUnavailableError,
  countActiveBookings,
  getSlotAvailability,
  insertVisitBooking,
} from "./server";
import { BOOKING_TIME_SLOTS } from "../../content/booking";
import type { NormalizedBooking } from "../booking/validate";

const SLOT = BOOKING_TIME_SLOTS[0];
const SLOT_2 = BOOKING_TIME_SLOTS[1];

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.BOOKING_SLOT_CAPACITY = "2";

type Stub = { url: string; init?: RequestInit }[];
let calls: Stub = [];
const realFetch = global.fetch;

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
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

const booking: NormalizedBooking = {
  customerName: "Test Customer",
  phone: "9835063448",
  email: "customer@example.com",
  eventType: "Wedding",
  visitDate: "2026-10-20",
  timeSlot: SLOT,
  message: null,
};

test("availability counts only capacity-consuming bookings and derives full/remaining", async () => {
  try {
    stubFetch((url) => {
      assert.ok(url.includes("status=neq.CANCELLED"), "cancelled bookings must not consume capacity");
      assert.ok(url.includes("visit_date=eq.2026-10-20"));
      return new Response(JSON.stringify([{ time_slot: SLOT }, { time_slot: SLOT }, { time_slot: SLOT_2 }]), {
        status: 200,
      });
    });
    const availability = await getSlotAvailability("2026-10-20");
    assert.equal(availability.capacity, 2);
    assert.equal(availability.counts[SLOT], 2);
    assert.equal(availability.remaining[SLOT], 0);
    assert.equal(availability.remaining[SLOT_2], 1);
    assert.deepEqual(availability.booked, [SLOT]);
  } finally {
    restore();
  }
});

test("countActiveBookings counts the slot's active bookings (cancelled excluded)", async () => {
  try {
    stubFetch((url) => {
      assert.ok(url.includes(`time_slot=eq.${encodeURIComponent(SLOT)}`));
      assert.ok(url.includes("status=neq.CANCELLED"));
      return new Response(JSON.stringify([{ id: "a" }, { id: "b" }]), { status: 200 });
    });
    assert.equal(await countActiveBookings("2026-10-20", SLOT), 2);

    stubFetch(() => new Response("[]", { status: 200 }));
    assert.equal(await countActiveBookings("2026-10-20", SLOT), 0);

    stubFetch(() => new Response("boom", { status: 500 }));
    await assert.rejects(countActiveBookings("2026-10-20", SLOT), BookingStoreError);
  } finally {
    restore();
  }
});

test("a successful insert returns the new booking id", async () => {
  try {
    stubFetch(() => new Response(JSON.stringify([{ id: "new-id", created_at: "2026-10-06T10:00:00Z" }]), { status: 201 }));
    const result = await insertVisitBooking(booking);
    assert.deepEqual(result, { id: "new-id", createdAt: "2026-10-06T10:00:00Z" });
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.status, "PENDING");
  } finally {
    restore();
  }
});

test("concurrent booking attempts that lose the capacity race surface as SlotUnavailableError", async () => {
  // What PostgreSQL reports when the atomic trigger refuses an over-capacity
  // insert: HTTP 400 carrying the trigger's marker message.
  try {
    stubFetch(
      () =>
        new Response(JSON.stringify({ code: "23514", message: "visit_bookings slot capacity exceeded (2)" }), {
          status: 400,
        })
    );
    await assert.rejects(insertVisitBooking(booking), SlotUnavailableError);
  } finally {
    restore();
  }
});

test("legacy unique violations and HTTP 409 also map to SlotUnavailableError", async () => {
  try {
    stubFetch(() => new Response(JSON.stringify({ code: "23505", message: "duplicate key" }), { status: 400 }));
    await assert.rejects(insertVisitBooking(booking), SlotUnavailableError);

    stubFetch(() => new Response("conflict", { status: 409 }));
    await assert.rejects(insertVisitBooking(booking), SlotUnavailableError);
  } finally {
    restore();
  }
});

test("other store failures stay generic and never leak raw errors", async () => {
  try {
    stubFetch(() => new Response("connection reset by peer", { status: 500 }));
    await assert.rejects(insertVisitBooking(booking), BookingStoreError);
  } finally {
    restore();
  }
});
