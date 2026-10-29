import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappUrl, defaultEnquiryMessage } from "./whatsapp";

// ---------------------------------------------------------------------------
// The WhatsApp follow-up is always a user-clicked link with a prefilled,
// URL-encoded message — never an automatic send. The default number must be
// the venue line 98350 63448 (with the 91 country code).
// ---------------------------------------------------------------------------

test("wa.me link uses the venue number 98350 63448 by default", () => {
  const previous = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  delete process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  try {
    assert.equal(whatsappUrl(), "https://wa.me/919835063448");
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = previous;
  }
});

test("NEXT_PUBLIC_WHATSAPP_NUMBER overrides the default number", () => {
  const previous = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "919999999999";
  try {
    assert.equal(whatsappUrl(), "https://wa.me/919999999999");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
    else process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = previous;
  }
});

test("a prefilled message is fully URL-encoded and never left raw", () => {
  const message = "Namaste, I'd like to visit — 10/11/2026 & 10:00 AM - 12:00 PM";
  const url = whatsappUrl(message);
  const previous = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  delete process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  try {
    assert.equal(
      url,
      `https://wa.me/919835063448?text=${encodeURIComponent(message)}`
    );
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = previous;
  }
  assert.ok(!url.includes(" "), "raw spaces must not survive in the URL");
  const query = url.split("?text=")[1];
  assert.ok(query, "prefilled text query missing");
  assert.ok(decodeURIComponent(query).includes("10:00 AM - 12:00 PM"));
});

test("the default enquiry message names the venue", () => {
  assert.match(defaultEnquiryMessage, /Shri Sai Vatika Banquet Hall/);
});
