import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { facilityGroups, type FacilityIcon } from "./facilities";
import { facilities as flatFacilities } from "./site";

// ---------------------------------------------------------------------------
// Client-approved facilities revision: "Varmala" and the "30-Piece Baraat
// Welcome Mala" are not listed, and the old combined gate/passage entry is
// two separate entries. These tests pin the approved list so a copy edit
// cannot silently reintroduce or drop facilities.
// ---------------------------------------------------------------------------

const labels = facilityGroups.flatMap((g) => g.items.map((i) => i.label));

test("Celebration Details matches the client-approved list exactly", () => {
  const celebration = facilityGroups.find((g) => g.title === "Celebration Details");
  assert.ok(celebration, "Celebration Details group missing");
  assert.deepEqual(
    celebration.items.map((i) => i.label),
    [
      "Stage",
      "Gate Decoration",
      "Passage Decoration",
      "Food Stall",
      "Selfie Point",
    ]
  );
});

test("no removed facility reappears anywhere in the structured list", () => {
  for (const label of labels) {
    assert.doesNotMatch(label, /varmala/i, `removed facility present: ${label}`);
    assert.doesNotMatch(label, /baraat/i, `removed facility present: ${label}`);
    assert.doesNotMatch(label, /^gate\s*\/\s*passage/i, `combined entry present: ${label}`);
  }
});

test("Gate and Passage decorations are separate entries", () => {
  assert.ok(labels.includes("Gate Decoration"));
  assert.ok(labels.includes("Passage Decoration"));
});

test("the other approved facilities and their order are unchanged", () => {
  const spaces = facilityGroups.find((g) => g.title === "The Spaces");
  assert.ok(spaces);
  assert.deepEqual(
    spaces.items.map((i) => i.label),
    ["3000 sq.ft. AC Hall", "8000 sq.ft. Lawn", "4 Deluxe AC Rooms"]
  );
  const comforts = facilityGroups.find((g) => g.title === "Guest Comforts");
  assert.ok(comforts);
  assert.deepEqual(
    comforts.items.map((i) => i.label),
    [
      "Parking",
      "CCTV Surveillance",
      "Wi-Fi",
      "Security Guard",
      "Fire Safety",
      "Purified Water",
      "Power Backup",
    ]
  );
});

test("every facility icon has a matching icon case in the Facilities section", () => {
  const source = readFileSync(
    new URL("../components/sections/Facilities.tsx", import.meta.url),
    "utf8"
  );
  const icons = new Set<FacilityIcon>(
    facilityGroups.flatMap((g) => g.items.map((i) => i.icon))
  );
  for (const icon of icons) {
    assert.match(
      source,
      new RegExp(`case "${icon}"`),
      `no icon drawn for "${icon}" in Facilities.tsx`
    );
  }
});

test("the compatibility flat list mirrors the approved facilities", () => {
  const flat = flatFacilities as readonly string[];
  assert.ok(flat.includes("Gate decoration"));
  assert.ok(flat.includes("Passage decoration"));
  for (const entry of flat) {
    assert.doesNotMatch(entry, /varmala/i, `removed facility present: ${entry}`);
    assert.doesNotMatch(entry, /baraat/i, `removed facility present: ${entry}`);
    assert.doesNotMatch(entry, /gate\s*\/\s*passage/i, `combined entry present: ${entry}`);
  }
});
