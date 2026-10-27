import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearLoginFailures,
  clientIp,
  isLoginRateLimited,
  recordLoginFailure,
} from "./rate-limit";

// The limiter keeps its counts in a module-level Map shared by every test
// in this file, so each test uses its own key. All time is injected via
// the optional `now` parameter, so nothing here depends on the wall clock.

const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 10;
const T0 = 1_700_000_000_000;

test("a key is not limited before the failure threshold", () => {
  const key = "rl-before-threshold@example.com";
  for (let i = 0; i < MAX_FAILURES - 1; i += 1) {
    recordLoginFailure(key, T0);
  }
  assert.equal(isLoginRateLimited(key, T0 + 1_000), false);
});

test("a key is limited at the threshold, inside the window", () => {
  const key = "rl-at-threshold@example.com";
  for (let i = 0; i < MAX_FAILURES; i += 1) {
    recordLoginFailure(key, T0);
  }
  assert.equal(isLoginRateLimited(key, T0), true);
  assert.equal(isLoginRateLimited(key, T0 + WINDOW_MS - 1), true);
});

test("the window expiry clears the count", () => {
  const key = "rl-window-expiry@example.com";
  for (let i = 0; i < MAX_FAILURES; i += 1) {
    recordLoginFailure(key, T0);
  }
  // Still limited strictly inside the window; the entry counts as expired
  // at exactly resetAt (T0 + WINDOW_MS) and afterwards.
  assert.equal(isLoginRateLimited(key, T0 + WINDOW_MS - 1), true);
  assert.equal(isLoginRateLimited(key, T0 + WINDOW_MS), false);
  assert.equal(isLoginRateLimited(key, T0 + WINDOW_MS + 1), false);
});

test("clearLoginFailures resets a limited key", () => {
  const key = "rl-clear@example.com";
  for (let i = 0; i < MAX_FAILURES; i += 1) {
    recordLoginFailure(key, T0);
  }
  assert.equal(isLoginRateLimited(key, T0), true);
  clearLoginFailures(key);
  assert.equal(isLoginRateLimited(key, T0), false);
});

test("failures are counted per key, never across keys", () => {
  const loud = "rl-per-key-loud@example.com";
  const quiet = "rl-per-key-quiet@example.com";
  for (let i = 0; i < MAX_FAILURES; i += 1) {
    recordLoginFailure(loud, T0);
  }
  recordLoginFailure(quiet, T0);
  assert.equal(isLoginRateLimited(loud, T0), true);
  assert.equal(isLoginRateLimited(quiet, T0), false);
});

test("clientIp prefers the first x-forwarded-for entry, trimmed", () => {
  assert.equal(
    clientIp(
      new Request("http://localhost/api/admin/auth/login", {
        headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
      })
    ),
    "203.0.113.7"
  );
  assert.equal(
    clientIp(
      new Request("http://localhost/api/admin/auth/login", {
        headers: { "x-forwarded-for": "  203.0.113.7 , 10.0.0.1" },
      })
    ),
    "203.0.113.7"
  );
});

test("clientIp falls back to x-real-ip, then to a local marker", () => {
  assert.equal(
    clientIp(
      new Request("http://localhost/api/admin/auth/login", {
        headers: { "x-real-ip": "10.1.2.3" },
      })
    ),
    "10.1.2.3"
  );
  assert.equal(clientIp(new Request("http://localhost/api/admin/auth/login")), "local");
});
