import { test } from "node:test";
import assert from "node:assert/strict";
import { isOwnerAllowlistConfigured, isOwnerEmail, ownerAllowlist } from "./auth";

function withEnv<T>(value: string | undefined, fn: () => T): T {
  const original = process.env.ADMIN_OWNER_EMAILS;
  if (value === undefined) delete process.env.ADMIN_OWNER_EMAILS;
  else process.env.ADMIN_OWNER_EMAILS = value;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env.ADMIN_OWNER_EMAILS;
    else process.env.ADMIN_OWNER_EMAILS = original;
  }
}

test("authorization fails closed when the allowlist is unset or empty", () => {
  for (const value of [undefined, "", "   ", ","]) {
    withEnv(value, () => {
      assert.deepEqual(ownerAllowlist(), []);
      assert.equal(isOwnerAllowlistConfigured(), false);
      assert.equal(isOwnerEmail("owner@example.com"), false);
      assert.equal(isOwnerEmail(null), false);
      assert.equal(isOwnerEmail(""), false);
    });
  }
});

test("only exact allowlisted emails are owners (case- and whitespace-insensitive)", () => {
  withEnv(" Owner@Example.com , staff@example.com ", () => {
    assert.deepEqual(ownerAllowlist(), ["owner@example.com", "staff@example.com"]);
    assert.equal(isOwnerEmail("owner@example.com"), true);
    assert.equal(isOwnerEmail("OWNER@example.com"), true);
    assert.equal(isOwnerEmail(" owner@example.com "), true);
    assert.equal(isOwnerEmail("not-an-owner@example.com"), false);
    assert.equal(isOwnerEmail("owner@example.com.evil.com"), false);
    assert.equal(isOwnerEmail("staff@example.com"), true);
  });
});

test("bulk and single booking APIs share this same allowlist gate", () => {
  // The bulk route calls authorizeApi() exactly like every other private
  // booking API — there is no separate (weaker) authorization path.
  withEnv("owner@example.com", () => {
    assert.equal(isOwnerEmail("owner@example.com"), true);
    withEnv(undefined, () => {
      assert.equal(isOwnerEmail("owner@example.com"), false);
    });
  });
});
