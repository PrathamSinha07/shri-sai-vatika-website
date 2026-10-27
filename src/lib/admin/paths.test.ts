import { test } from "node:test";
import assert from "node:assert/strict";
import { safeInternalPath } from "./paths";

// safeInternalPath guards the `?next=` redirect targets used by the
// refresh and logout routes. It is the only thing standing between a
// crafted query string and an open redirect out of the app, so both the
// keep-cases and the reject-cases are pinned here.

const FALLBACK = "/admin";

test("empty or missing next values fall back", () => {
  assert.equal(safeInternalPath(null, FALLBACK), FALLBACK);
  assert.equal(safeInternalPath(undefined, FALLBACK), FALLBACK);
  assert.equal(safeInternalPath("", FALLBACK), FALLBACK);
});

test("same-site /admin paths are kept, including query strings", () => {
  assert.equal(safeInternalPath("/admin", FALLBACK), "/admin");
  assert.equal(safeInternalPath("/admin/bookings", FALLBACK), "/admin/bookings");
  // Real callers: requireOwnerPage() sends denied/expired visitors to
  // /admin/login?denied=1 and /admin/login?expired=1 via ?next=.
  assert.equal(
    safeInternalPath("/admin/login?denied=1", FALLBACK),
    "/admin/login?denied=1"
  );
  assert.equal(
    safeInternalPath("/admin/login?expired=1", FALLBACK),
    "/admin/login?expired=1"
  );
});

test("values that could leave the app or are not admin paths fall back", () => {
  for (const value of [
    "https://evil.example.com",
    "//evil.example.com",
    "/\\evil.example.com",
    "\\\\evil.example.com",
    "/admin\\@evil.example.com",
    "/other-page",
    "/Admin",
    "admin/bookings",
    "  /admin/bookings",
  ]) {
    assert.equal(safeInternalPath(value, FALLBACK), FALLBACK, value);
  }
});
