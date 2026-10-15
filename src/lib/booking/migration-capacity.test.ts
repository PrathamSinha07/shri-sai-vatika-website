import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSlotCapacity } from "./capacity";

const sql = readFileSync(
  new URL("../../../supabase/migrations/0003_slot_capacity.sql", import.meta.url),
  "utf8"
);

// ---------------------------------------------------------------------------
// Migration invariants: the capacity migration must stay additive, atomic,
// and capacity-aware. These guard the documented locking approach against
// accidental regressions in the SQL.
// ---------------------------------------------------------------------------

test("migration drops the one-booking-per-slot unique index (no data is touched)", () => {
  assert.match(sql, /drop index if exists public\.visit_bookings_date_slot_key/i);
  assert.doesNotMatch(sql, /delete\s+from|truncate|drop table/i);
});

test("migration installs every replacement object before dropping the old unique index", () => {
  const at = (pattern: RegExp) => {
    const match = sql.match(pattern);
    assert.ok(match, `required statement missing: ${pattern}`);
    return match.index ?? -1;
  };
  const partialIndex = at(/create index if not exists visit_bookings_slot_active_idx/i);
  const capacityFn = at(/create or replace function public\.visit_bookings_slot_capacity\(\)/i);
  const triggerFn = at(/create or replace function public\.visit_bookings_enforce_slot_capacity\(\)/i);
  const trigger = at(/create trigger visit_bookings_capacity/i);
  const drop = at(/drop index if exists public\.visit_bookings_date_slot_key/i);
  // Until the trigger exists the old unique index still protects every slot;
  // after it exists both arbors are active until the drop. Reversing any of
  // these would open an unprotected window under autocommit application.
  assert.ok(partialIndex < drop, "partial capacity index must be created before the drop");
  assert.ok(capacityFn < drop, "capacity function must be created before the drop");
  assert.ok(triggerFn < drop, "trigger function must be created before the drop");
  assert.ok(trigger < drop, "capacity trigger must be created before the drop");
});

test("migration enforces capacity under an advisory lock on the exact slot", () => {
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /hashtextextended/i);
  assert.match(sql, /'visit_slot:' \|\| new\.visit_date::text \|\| '\|' \|\| new\.time_slot/i);
});

test("only CANCELLED bookings release capacity — every other status consumes it", () => {
  assert.match(sql, /status <> 'CANCELLED'/);
  // The count must exclude the booking being updated, never other bookings.
  assert.match(sql, /and id <> new\.id/i);
});

test("capacity is configurable with a documented default of 2, clamped 1..100", () => {
  assert.match(sql, /current_setting\('app\.slot_capacity', true\)/);
  assert.match(sql, /greatest\(1, least\(100,/);
  // The fallback default when the setting is unset.
  assert.match(sql, /,\s*2\s*\)/);
});

test("capacity function never casts the raw setting without a regex guard", () => {
  // The setting value is only cast inside the guard (bare optional-signed
  // integer, at most 9 digits so the cast cannot overflow int4). A malformed
  // app.slot_capacity must fall back to 2 — not fail every capacity-checked
  // write with 22P02 or 22003.
  assert.ok(
    sql.includes("~ '^[+-]?[0-9]{1,9}$'"),
    "raw app.slot_capacity value must be regex-guarded before the integer cast"
  );
  assert.ok(
    sql.includes("coalesce(btrim(current_setting('app.slot_capacity', true)), '')"),
    "unset/empty settings must normalize to '' before the guard"
  );
});

test("violations raise a recognizable, atomic statement-level error", () => {
  assert.match(sql, /slot capacity exceeded/i);
  assert.match(sql, /using errcode = '23514'/);
  // Trigger runs BEFORE the write, on every row, for the relevant columns.
  assert.match(sql, /before insert or update of visit_date, time_slot, status/i);
  assert.match(sql, /for each row/i);
});

test("cancellation and slot-unchanged owner actions bypass the capacity check", () => {
  // CANCELLED short-circuits first (cancel can never be blocked).
  assert.match(sql, /if new\.status = 'CANCELLED' then\s+return new;\s+end if;/i);
  // Confirm/complete keep the slot and stay active: no check, no lock.
  assert.match(
    sql,
    /new\.visit_date = old\.visit_date\s+and new\.time_slot = old\.time_slot\s+and old\.status <> 'CANCELLED'/i
  );
});

// ---------------------------------------------------------------------------
// Documented semantics model. The advisory lock serializes concurrent
// writers for a date + slot, so the real database behaves exactly like this
// sequential model applied in lock order. These tests pin the semantics the
// app and docs promise: capacity is capped, cancelled bookings free their
// slot, reschedules exclude the moving booking, and confirm/complete never
// consult capacity.
// ---------------------------------------------------------------------------

interface ModelRow {
  id: string;
  visitDate: string;
  timeSlot: string;
  status: string;
}

const CAPACITY = 2;

/** Mirrors visit_bookings_enforce_slot_capacity() + the write itself. */
function modelWrite(
  rows: ModelRow[],
  next: { id: string; visitDate: string; timeSlot: string; status: string; existed: boolean },
  capacity = CAPACITY
): { ok: true } | { ok: false; reason: "slot_capacity_exceeded" } {
  const old = next.existed ? rows.find((r) => r.id === next.id) : undefined;

  if (next.status !== "CANCELLED") {
    const slotUnchangedAndActive =
      old !== undefined &&
      old.visitDate === next.visitDate &&
      old.timeSlot === next.timeSlot &&
      old.status !== "CANCELLED";
    if (!slotUnchangedAndActive) {
      const active = rows.filter(
        (r) =>
          r.visitDate === next.visitDate &&
          r.timeSlot === next.timeSlot &&
          r.status !== "CANCELLED" &&
          r.id !== next.id
      );
      if (active.length >= capacity) return { ok: false, reason: "slot_capacity_exceeded" };
    }
  }

  if (old) Object.assign(old, { visitDate: next.visitDate, timeSlot: next.timeSlot, status: next.status });
  else rows.push({ id: next.id, visitDate: next.visitDate, timeSlot: next.timeSlot, status: next.status });
  return { ok: true };
}

test("model: concurrent booking attempts fill a slot exactly to capacity", () => {
  const rows: ModelRow[] = [];
  // Three "simultaneous" requests, serialized by the advisory lock.
  assert.equal(modelWrite(rows, { id: "a", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING", existed: false }).ok, true);
  assert.equal(modelWrite(rows, { id: "b", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING", existed: false }).ok, true);
  const third = modelWrite(rows, { id: "c", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING", existed: false });
  assert.deepEqual(third, { ok: false, reason: "slot_capacity_exceeded" });
  assert.equal(rows.length, 2);
});

test("model: cancelling frees the slot for a new customer", () => {
  const rows: ModelRow[] = [
    { id: "a", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING" },
    { id: "b", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING" },
  ];
  // Cancel must never be blocked by capacity.
  assert.equal(modelWrite(rows, { id: "a", visitDate: "2026-10-20", timeSlot: "S1", status: "CANCELLED", existed: true }).ok, true);
  const reuse = modelWrite(rows, { id: "c", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING", existed: false });
  assert.equal(reuse.ok, true);
  assert.equal(rows.filter((r) => r.status !== "CANCELLED").length, 2);
});

test("model: reschedule checks the destination excluding the moving booking", () => {
  const rows: ModelRow[] = [
    { id: "a", visitDate: "2026-10-20", timeSlot: "S1", status: "CONFIRMED" },
    { id: "b", visitDate: "2026-10-21", timeSlot: "S2", status: "PENDING" },
  ];
  // One other booking at the destination: room for the mover.
  assert.equal(
    modelWrite(rows, { id: "a", visitDate: "2026-10-21", timeSlot: "S2", status: "RESCHEDULED", existed: true }).ok,
    true
  );
  // A second mover into the now-full destination is refused.
  const rows2: ModelRow[] = [
    { id: "a", visitDate: "2026-10-21", timeSlot: "S2", status: "RESCHEDULED" },
    { id: "b", visitDate: "2026-10-21", timeSlot: "S2", status: "PENDING" },
    { id: "c", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING" },
  ];
  assert.deepEqual(
    modelWrite(rows2, { id: "c", visitDate: "2026-10-21", timeSlot: "S2", status: "RESCHEDULED", existed: true }),
    { ok: false, reason: "slot_capacity_exceeded" }
  );
  // The refused booking stays exactly where it was — no partial update.
  assert.equal(rows2.find((r) => r.id === "c")?.visitDate, "2026-10-20");
});

test("model: confirm and complete never consult capacity", () => {
  const rows: ModelRow[] = [
    { id: "a", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING" },
    { id: "b", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING" },
    { id: "c", visitDate: "2026-10-20", timeSlot: "S1", status: "PENDING" }, // over capacity if lowered later
  ];
  assert.equal(modelWrite(rows, { id: "a", visitDate: "2026-10-20", timeSlot: "S1", status: "CONFIRMED", existed: true }).ok, true);
  assert.equal(modelWrite(rows, { id: "a", visitDate: "2026-10-20", timeSlot: "S1", status: "COMPLETED", existed: true }).ok, true);
  assert.equal(rows.find((r) => r.id === "a")?.status, "COMPLETED");
});

// ---------------------------------------------------------------------------
// Capacity-configuration parse rule. visit_bookings_slot_capacity() must
// never fail on a malformed app.slot_capacity: it falls back to the
// documented default of 2, casting only bare integers (bounded so the cast
// cannot overflow int4) before the 1..100 clamp. The model below mirrors
// the SQL expression; the final test pins it to the app-side parser
// (src/lib/booking/capacity.ts) so display and enforcement cannot drift.
// ---------------------------------------------------------------------------

/** Mirrors visit_bookings_slot_capacity()'s parse rule (btrim strips spaces only). */
function modelCapacitySetting(raw: string | null): number {
  const value = (raw ?? "").replace(/^ +| +$/g, "");
  if (!/^[+-]?[0-9]{1,9}$/.test(value)) return 2;
  return Math.min(100, Math.max(1, Number.parseInt(value, 10)));
}

test("model: malformed app.slot_capacity values fall back to 2, valid integers clamp 1..100", () => {
  assert.equal(modelCapacitySetting(null), 2); // setting missing
  assert.equal(modelCapacitySetting(""), 2); // empty string
  assert.equal(modelCapacitySetting("  "), 2); // blank
  assert.equal(modelCapacitySetting("abc"), 2); // non-integer text
  assert.equal(modelCapacitySetting("2.5"), 2); // decimal
  assert.equal(modelCapacitySetting("1e3"), 2); // scientific notation
  assert.equal(modelCapacitySetting("0123456789"), 2); // 10 digits: would overflow int4
  assert.equal(modelCapacitySetting("4"), 4);
  assert.equal(modelCapacitySetting(" 4 "), 4); // surrounding spaces trimmed
  assert.equal(modelCapacitySetting("+3"), 3);
  assert.equal(modelCapacitySetting("0"), 1); // clamped up
  assert.equal(modelCapacitySetting("-3"), 1); // clamped up
  assert.equal(modelCapacitySetting("1000"), 100); // clamped down
  assert.equal(modelCapacitySetting("999999999"), 100); // 9 digits fits int4, clamped
});

test("model: the database parse rule matches the app-side capacity parser", () => {
  const inputs: Array<string | null | undefined> = [
    undefined, null, "", "  ", "2", " 7 ", "+5", "0", "-3",
    "2.5", "3.5", "1e3", "abc", "4abc", "1000", "999999999", "1234567890",
  ];
  for (const input of inputs) {
    assert.equal(
      modelCapacitySetting(input ?? null),
      parseSlotCapacity(input),
      `DB/app parse mismatch for ${JSON.stringify(input)}`
    );
  }
});
