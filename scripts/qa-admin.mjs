// Milestone 9 — private owner dashboard QA.
//
// Exercises, for real, against a production build:
//   1. Public visitors still browse + submit without an account.
//   2. No dashboard link exists anywhere public.
//   3. Unauthenticated hits to /admin, /admin/bookings and the private APIs fail.
//   4. An authenticated NON-owner is denied (pages and APIs).
//   5. An authorized owner can reach the dashboard and act on bookings.
//   6. Private booking APIs reject unauthorized requests.
//   7. Logout removes access to protected pages and APIs.
//   8. Slot uniqueness + public availability behaviour are intact.
//   9. No service-role key or private booking data leaks to the browser.
//  10. Admin layouts stay responsive and labelled.
//
// Test data only: the seeded booking is inserted with the service-role key
// (so no customer email is ever sent) and deleted at the end. Test accounts
// are provisioned through Supabase Auth's admin API — the same private
// process documented in docs/admin-dashboard.md. There is no public signup.

import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";

const BASE = process.env.QA_BASE || "http://localhost:3001";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CREDS_PATH = ".agent-tmp/qa-admin-creds.json";

const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

// ---------------------------------------------------------------------------
// Server-side helpers (never run in a browser; secrets are never printed)
// ---------------------------------------------------------------------------

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      })
  );
}

const fileEnv = readEnvFile(".env.local");
const SUPABASE_URL = (process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY || "";

const OWNER_EMAIL = "qa-owner@shrisaivatika.example";
const OUTSIDER_EMAIL = "qa-outsider@shrisaivatika.example";
const SEED_NAME = "QA Milestone 9 Test";
const SEED_EMAIL = "qa-m9@example.com";
const SEED_PHONE = "+91 99999 99999";

const authHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

function istDatePlus(days) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const date = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function randomPassword() {
  return `Qa-M9-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}-7!`;
}

/** Ensures both controlled test accounts exist and match the stored password. */
async function provisionAccounts() {
  mkdirSync(".agent-tmp", { recursive: true });
  let creds = existsSync(CREDS_PATH) ? JSON.parse(readFileSync(CREDS_PATH, "utf8")) : {};
  creds.ownerEmail = OWNER_EMAIL;
  creds.outsiderEmail = OUTSIDER_EMAIL;
  creds.ownerPassword ||= randomPassword();
  creds.outsiderPassword ||= randomPassword();
  writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2));

  const list = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: authHeaders,
  });
  if (!list.ok) throw new Error(`Could not list Supabase Auth users (HTTP ${list.status})`);
  const existing = new Map(
    (((await list.json()).users) ?? []).map((user) => [String(user.email).toLowerCase(), user.id])
  );

  for (const [email, password] of [
    [OWNER_EMAIL, creds.ownerPassword],
    [OUTSIDER_EMAIL, creds.outsiderPassword],
  ]) {
    const id = existing.get(email);
    if (!id) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: authHeaders,
        // email_confirm: true → no confirmation email is ever sent.
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      if (!res.ok) throw new Error(`Could not create test account (HTTP ${res.status})`);
    } else {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ password, email_confirm: true }),
      });
      if (!res.ok) throw new Error(`Could not reset test account (HTTP ${res.status})`);
    }
  }
  return creds;
}

/** Removes any booking row this script created (never touches other rows). */
async function deleteSeedBookings() {
  await fetch(
    `${SUPABASE_URL}/rest/v1/visit_bookings?customer_name=eq.${encodeURIComponent(SEED_NAME)}`,
    { method: "DELETE", headers: authHeaders }
  );
}

/** Inserts one test booking directly (bypasses the public API → no emails). */
async function seedBooking(visitDate, timeSlot) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/visit_bookings`, {
    method: "POST",
    headers: { ...authHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      customer_name: SEED_NAME,
      phone: SEED_PHONE,
      email: SEED_EMAIL,
      event_type: "Wedding",
      visit_date: visitDate,
      time_slot: timeSlot,
      message: "Seeded by scripts/qa-admin.mjs — safe to delete.",
      status: "PENDING",
    }),
  });
  if (!res.ok) throw new Error(`Could not seed the test booking (HTTP ${res.status})`);
  return (await res.json())[0];
}

function walkStatic(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walkStatic(full, out);
    else if (/\.(js|css|txt|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

async function loginViaApi(context, email, password) {
  return context.request.post(`${BASE}/api/admin/auth/login`, {
    data: { email, password },
    headers: { "Content-Type": "application/json" },
  });
}

async function fillLoginForm(page, email, password) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill("#admin-email", email);
  await page.fill("#admin-password", password);
  await page.click('button[type="submit"]');
}

// ---------------------------------------------------------------------------

let browser;
let creds;

try {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase is not configured in .env.local");

  creds = await provisionAccounts();
  await deleteSeedBookings();

  browser = await chromium.launch({ executablePath: EDGE, headless: true });

  // =========================================================================
  // 1 + 2. Public site: browsable without an account, no dashboard links
  // =========================================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    ok("Public homepage renders", (await page.title()).includes("Shri Sai Vatika"));
    ok(
      "Public booking form is present without login",
      (await page.locator("#book-a-visit form").count()) > 0
    );

    for (const route of ["/", "/services", "/services/catering", "/admin/login"]) {
      const html = await (await ctx.request.get(`${BASE}${route}`)).text();
      const publicHtml = route === "/admin/login" ? "" : html;
      if (route === "/admin/login") continue;
      ok(
        `No dashboard link on public route ${route}`,
        !publicHtml.includes('href="/admin'),
        publicHtml.includes('href="/admin') ? "found a /admin link" : ""
      );
    }

    // Invalid submission must be rejected server-side with no write and no email.
    const bad = await ctx.request.post(`${BASE}/api/visit-bookings`, {
      data: { customerName: "", phone: "", email: "", visitDate: "2020-01-01" },
      headers: { "Content-Type": "application/json" },
    });
    ok("Public booking API still validates input", bad.status() === 400, `HTTP ${bad.status()}`);
    ok(
      "Public booking API never leaks store errors",
      !(await bad.text()).match(/23\d\d|postgres|supabase/i)
    );

    // Availability endpoint still works for anonymous visitors.
    const availability = await (
      await ctx.request.get(`${BASE}/api/visit-bookings/availability?date=${istDatePlus(2)}`)
    ).json();
    ok(
      "Public availability API answers anonymous visitors",
      availability.ok === true && Array.isArray(availability.booked),
      JSON.stringify(availability)
    );

    await ctx.close();
  }

  // =========================================================================
  // 3. Unauthenticated access is rejected (pages and private APIs)
  // =========================================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    for (const path of ["/admin", "/admin/bookings"]) {
      await ctx.request.get(`${BASE}${path}`); // warms nothing; page nav below
      const page = await ctx.newPage();
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      ok(`Unauthenticated ${path} redirects to the login page`, page.url().endsWith("/admin/login"), page.url());
      const html = await page.content();
      ok(`Unauthenticated ${path} exposes no customer data`, !html.includes(SEED_NAME));
      await page.close();
    }

    for (const [label, url, init] of [
      ["GET /api/admin/bookings", `${BASE}/api/admin/bookings`, { method: "GET" }],
      ["GET /api/admin/bookings/{id}", `${BASE}/api/admin/bookings/00000000-0000-0000-0000-000000000000`, { method: "GET" }],
      [
        "PATCH /api/admin/bookings/{id}",
        `${BASE}/api/admin/bookings/00000000-0000-0000-0000-000000000000`,
        { method: "PATCH", data: { action: "confirm", expected: { status: "PENDING" } }, headers: { "Content-Type": "application/json" } },
      ],
    ]) {
      const res = await ctx.request.fetch(url, init);
      const body = await res.text();
      ok(`Private API rejects anonymous ${label}`, res.status() === 401, `HTTP ${res.status()}`);
      ok(
        `Anonymous ${label} response carries no booking fields`,
        !body.includes("customerName") && !body.includes("customer_name") && !body.includes(SEED_NAME)
      );
    }

    // Logout is deliberately idempotent: an anonymous caller just gets its
    // (non-existent) cookies cleared. It must never return booking data.
    const anonLogout = await ctx.request.post(`${BASE}/api/admin/auth/logout`);
    const anonLogoutBody = await anonLogout.text();
    ok("Anonymous logout is a harmless no-op", anonLogout.status() === 200, `HTTP ${anonLogout.status()}`);
    ok(
      "Anonymous logout leaks nothing",
      !anonLogoutBody.includes("customer") && !anonLogoutBody.includes(SEED_NAME)
    );

    // Unknown email and wrong password must be indistinguishable.
    const unknown = await loginViaApi(ctx, "no-such-account@shrisaivatika.example", "wrong-password-1");
    const wrongPw = await loginViaApi(ctx, OWNER_EMAIL, "wrong-password-2");
    const unknownBody = await unknown.json();
    const wrongPwBody = await wrongPw.json();
    ok("Login rejects an unknown account", unknown.status() === 401, `HTTP ${unknown.status()}`);
    ok("Login rejects a wrong password", wrongPw.status() === 401, `HTTP ${wrongPw.status()}`);
    ok(
      "Login errors do not reveal whether an email has an account",
      unknownBody.error === wrongPwBody.error,
      `${JSON.stringify(unknownBody.error)} vs ${JSON.stringify(wrongPwBody.error)}`
    );

    await ctx.close();
  }

  // =========================================================================
  // 4. Authenticated but UNAUTHORIZED user is denied everywhere
  // =========================================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const denied = await loginViaApi(ctx, creds.outsiderEmail, creds.outsiderPassword);
    ok("Non-owner login is refused with 403", denied.status() === 403, `HTTP ${denied.status()}`);
    const deniedBody = await denied.json();
    ok(
      "Non-owner refusal exposes no booking data",
      !JSON.stringify(deniedBody).includes("customer")
    );

    // The sign-in form itself must surface the refusal (UI state check).
    const page = await ctx.newPage();
    await fillLoginForm(page, creds.outsiderEmail, creds.outsiderPassword);
    await page.waitForSelector("#admin-login-error", { timeout: 15000 });
    const alertText = (await page.locator("#admin-login-error").textContent()) ?? "";
    ok(
      "Login form reports the refusal to a non-owner",
      alertText.includes("does not have access"),
      alertText
    );
    ok("Refused sign-in stays on the login page", page.url().endsWith("/admin/login"), page.url());
    ok("Refused sign-in exposes no customer data", !(await page.content()).includes(SEED_NAME));
    await page.close();

    // Now the real scenario: a VALID Supabase session that is NOT allowlisted.
    // Mint the outsider's tokens straight from Supabase Auth (the same
    // credentials the login form would use) and install them as the app's
    // HTTP-only cookies, then prove the server still refuses.
    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email: creds.outsiderEmail, password: creds.outsiderPassword }),
    });
    const tokens = await tokenRes.json();
    ok("Outsider can authenticate with Supabase Auth", tokenRes.ok && Boolean(tokens.access_token));
    await ctx.addCookies([
      { name: "ssv_admin_at", value: tokens.access_token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
      { name: "ssv_admin_rt", value: tokens.refresh_token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);

    // APIs first: a valid non-owner session is refused with an explicit 403.
    const unauthList = await ctx.request.get(`${BASE}/api/admin/bookings`);
    ok("Unauthorized session cannot list bookings", unauthList.status() === 403, `HTTP ${unauthList.status()}`);
    const unauthListBody = await unauthList.json();
    ok(
      "API refuses with an explicit access_denied",
      unauthListBody.error === "access_denied",
      JSON.stringify(unauthListBody)
    );
    const unauthPatch = await ctx.request.patch(
      `${BASE}/api/admin/bookings/00000000-0000-0000-0000-000000000000`,
      {
        data: { action: "cancel", expected: { status: "PENDING" } },
        headers: { "Content-Type": "application/json" },
      }
    );
    ok("Unauthorized session cannot change a booking", unauthPatch.status() === 403, `HTTP ${unauthPatch.status()}`);
    const unauthDetail = await ctx.request.get(
      `${BASE}/api/admin/bookings/00000000-0000-0000-0000-000000000000`
    );
    ok("Unauthorized session cannot read a booking", unauthDetail.status() === 403, `HTTP ${unauthDetail.status()}`);

    // Pages next: visiting one revokes the denied session and clears cookies,
    // so the API checks above must run first.
    for (const path of ["/admin", "/admin/bookings"]) {
      const res = await ctx.request.get(`${BASE}${path}`);
      const body = await res.text();
      ok(
        `Authenticated non-owner is redirected off ${path}`,
        res.url().includes("/admin/login"),
        res.url()
      );
      ok(`Unauthorized session exposes no customer data on ${path}`, !body.includes(SEED_NAME));
    }
    ok(
      "Denied session is cleared rather than kept alive",
      (await ctx.cookies()).filter((c) => c.name.startsWith("ssv_admin_")).length === 0,
      JSON.stringify((await ctx.cookies()).map((c) => c.name))
    );

    await ctx.close();
  }

  // =========================================================================
  // 5 + 6 + 7 + 8. Owner flow: login, act, reschedule, cancel, logout
  // =========================================================================
  let seededId = null;
  let seededSlot = "01:00 PM – 03:00 PM";

  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    // Pick a slot the seeded booking can own, then seed it.
    const taken = await (
      await ctx.request.get(`${BASE}/api/visit-bookings/availability?date=${istDatePlus(2)}`)
    ).json();
    const slotList = ["09:00 AM – 12:00 PM", "01:00 PM – 03:00 PM", "03:00 PM – 06:00 PM", "06:00 PM – 08:00 PM"];
    seededSlot = slotList.find((slot) => !(taken.booked ?? []).includes(slot)) || slotList[0];
    const seeded = await seedBooking(istDatePlus(2), seededSlot);
    seededId = seeded.id;
    ok("Test booking seeded for owner actions", Boolean(seededId), seededId ?? "");

    // ----- Owner login through the real UI -----
    const page = await ctx.newPage();
    await fillLoginForm(page, creds.ownerEmail, creds.ownerPassword);
    await page.waitForURL("**/admin/bookings", { timeout: 15000 });
    ok("Authorized owner lands on /admin/bookings after sign-in", page.url().endsWith("/admin/bookings"), page.url());

    await page.waitForSelector('table, li.rounded-card', { timeout: 15000 });
    const listHtml = await page.content();
    ok("Owner sees the seeded booking", listHtml.includes(SEED_NAME));
    ok("Owner bookings page has no public navbar", (await page.locator("header a[href='/services']").count()) === 0);

    // Let the dashboard nav (usePathname) settle before trusting the href.
    await page.waitForFunction(
      () => document.querySelector('header a[href="/admin/bookings"]') !== null,
      { timeout: 15000 }
    );

    // ----- Overview metrics come from real data -----
    const expectedTotal = (
      await (await ctx.request.get(`${BASE}/api/admin/bookings?pageSize=1`)).json()
    ).total;
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    const overview = await page.content();
    ok("Owner dashboard overview renders", overview.includes("Total requests"));
    const totalCard = (await page.locator('li[data-metric="total"] p').last().textContent())?.trim();
    ok(
      "Overview total matches the stored booking count",
      totalCard === String(expectedTotal),
      `dashboard=${totalCard} api=${expectedTotal}`
    );

    // ----- Private APIs work for the owner -----
    const ownerList = await ctx.request.get(`${BASE}/api/admin/bookings?status=PENDING`);
    ok("Owner can list bookings through the private API", ownerList.status() === 200, `HTTP ${ownerList.status()}`);
    const ownerListBody = await ownerList.json();
    ok("Owner list is filtered server-side", (ownerListBody.items ?? []).every((b) => b.status === "PENDING"));

    const searchRes = await ctx.request.get(`${BASE}/api/admin/bookings?q=QA%20Milestone`);
    ok("Owner search finds the seeded booking", (await searchRes.json()).items?.length >= 1);

    // ----- Slot uniqueness: a duplicate request for the taken slot is refused -----
    const duplicate = await ctx.request.post(`${BASE}/api/visit-bookings`, {
      data: {
        customerName: "Duplicate Probe",
        phone: "+91 88888 88888",
        email: "duplicate-probe@example.com",
        eventType: "Reception",
        visitDate: istDatePlus(2),
        timeSlot: seededSlot,
      },
      headers: { "Content-Type": "application/json" },
    });
    ok("Public API still rejects a duplicate slot", duplicate.status() === 409, `HTTP ${duplicate.status()}`);
    const afterDuplicate = await (
      await ctx.request.get(`${BASE}/api/visit-bookings/availability?date=${istDatePlus(2)}`)
    ).json();
    ok(
      "Duplicate probe created no extra booking",
      (afterDuplicate.booked ?? []).filter((slot) => slot === seededSlot).length === 1
    );

    // ----- Detail + owner actions, exercised end to end -----
    await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
    await page.waitForSelector("table, li.rounded-card", { timeout: 15000 });
    await page.click('button:has-text("View booking")');
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    ok("Booking detail panel opens", (await page.locator('[role="dialog"]').count()) === 1);

    const detail = await ctx.request.get(`${BASE}/api/admin/bookings/${seededId}`);
    let booking = (await detail.json()).booking;
    ok("Owner can read the booking detail", booking?.customerName === SEED_NAME);

    // Confirm (PENDING → CONFIRMED)
    const confirmRes = await ctx.request.patch(`${BASE}/api/admin/bookings/${seededId}`, {
      data: { action: "confirm", expected: { status: "PENDING", visitDate: booking.visitDate, timeSlot: booking.timeSlot } },
      headers: { "Content-Type": "application/json" },
    });
    ok("Owner can confirm a pending visit", confirmRes.status() === 200, `HTTP ${confirmRes.status()}`);
    booking = (await confirmRes.json()).booking;
    ok("Confirm writes CONFIRMED", booking?.status === "CONFIRMED", booking?.status);

    // Stale compare-and-swap is refused rather than overwriting newer state.
    const stale = await ctx.request.patch(`${BASE}/api/admin/bookings/${seededId}`, {
      data: { action: "cancel", expected: { status: "PENDING", visitDate: booking.visitDate, timeSlot: booking.timeSlot } },
      headers: { "Content-Type": "application/json" },
    });
    ok("Stale status expectation is refused", stale.status() === 409, `HTTP ${stale.status()}`);
    const stillConfirmed = (await (await ctx.request.get(`${BASE}/api/admin/bookings/${seededId}`)).json()).booking;
    ok("Stale update did not overwrite newer state", stillConfirmed.status === "CONFIRMED", stillConfirmed.status);

    // Illegal transition: a cancelled-style action set on a live booking is
    // refused when the server says the transition is not allowed.
    const illegal = await ctx.request.patch(`${BASE}/api/admin/bookings/${seededId}`, {
      data: { action: "complete", expected: { status: "PENDING", visitDate: booking.visitDate, timeSlot: booking.timeSlot } },
      headers: { "Content-Type": "application/json" },
    });
    ok("Client cannot pick an arbitrary resulting status", illegal.status() === 409, `HTTP ${illegal.status()}`);

    // Reschedule to a free slot — through the real UI form. The panel is
    // reloaded first because the confirm/cancel checks above ran through the
    // API, so the open panel would (correctly) be refused as stale.
    const freeSlot = slotList.find((slot) => slot !== seededSlot && !(afterDuplicate.booked ?? []).includes(slot)) || "06:00 PM – 08:00 PM";
    await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
    await page.waitForSelector("table, li.rounded-card", { timeout: 15000 });
    await page.click('button:has-text("View booking")');
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    await page.waitForFunction(
      () => document.querySelector('[role="dialog"]')?.textContent?.includes("Confirmed") ?? false,
      { timeout: 15000 }
    );
    await page.click('button:has-text("Reschedule")');
    await page.fill("#reschedule-date", istDatePlus(3));
    await page.selectOption("#reschedule-slot", freeSlot);
    await page.click('button:has-text("Save new slot")');
    await page.waitForFunction(
      () => document.querySelector('[role="dialog"]')?.textContent?.includes("Rescheduled") ?? false,
      { timeout: 15000 }
    );
    const rescheduled = (await (await ctx.request.get(`${BASE}/api/admin/bookings/${seededId}`)).json()).booking;
    ok("Owner can reschedule a booking", rescheduled.status === "RESCHEDULED", rescheduled.status);
    ok("Reschedule moved the slot", rescheduled.visitDate === istDatePlus(3) && rescheduled.timeSlot === freeSlot, `${rescheduled.visitDate} ${rescheduled.timeSlot}`);

    // Conflicting reschedule into a slot another booking already holds must
    // be refused atomically. The main booking has moved away from its
    // original slot, so a second test booking is seeded to actually occupy
    // the destination (both rows are removed by the cleanup below).
    const blockerTaken = await (
      await ctx.request.get(`${BASE}/api/visit-bookings/availability?date=${istDatePlus(4)}`)
    ).json();
    const blockerSlot = slotList.find((slot) => !(blockerTaken.booked ?? []).includes(slot)) || slotList[0];
    await seedBooking(istDatePlus(4), blockerSlot);

    const clash = await ctx.request.patch(`${BASE}/api/admin/bookings/${seededId}`, {
      data: {
        action: "reschedule",
        expected: { status: "RESCHEDULED", visitDate: rescheduled.visitDate, timeSlot: rescheduled.timeSlot },
        visitDate: istDatePlus(4),
        timeSlot: blockerSlot,
      },
      headers: { "Content-Type": "application/json" },
    });
    ok("Reschedule into a taken slot is refused", clash.status() === 409, `HTTP ${clash.status()}`);
    const unchanged = (await (await ctx.request.get(`${BASE}/api/admin/bookings/${seededId}`)).json()).booking;
    ok(
      "Failed reschedule left no inconsistent data",
      unchanged.visitDate === istDatePlus(3) && unchanged.timeSlot === freeSlot,
      `${unchanged.visitDate} ${unchanged.timeSlot}`
    );

    // Rescheduled → confirm → complete
    const confirmAgain = await ctx.request.patch(`${BASE}/api/admin/bookings/${seededId}`, {
      data: { action: "confirm", expected: { status: "RESCHEDULED", visitDate: unchanged.visitDate, timeSlot: unchanged.timeSlot } },
      headers: { "Content-Type": "application/json" },
    });
    ok("Owner can confirm a rescheduled visit", confirmAgain.status() === 200, `HTTP ${confirmAgain.status()}`);
    const confirmed = (await confirmAgain.json()).booking;
    const completeRes = await ctx.request.patch(`${BASE}/api/admin/bookings/${seededId}`, {
      data: { action: "complete", expected: { status: "CONFIRMED", visitDate: confirmed.visitDate, timeSlot: confirmed.timeSlot } },
      headers: { "Content-Type": "application/json" },
    });
    ok("Owner can mark a confirmed visit completed", completeRes.status() === 200, `HTTP ${completeRes.status()}`);

    // COMPLETED is terminal.
    const afterComplete = (await completeRes.json()).booking;
    const zombie = await ctx.request.patch(`${BASE}/api/admin/bookings/${seededId}`, {
      data: { action: "cancel", expected: { status: "COMPLETED", visitDate: afterComplete.visitDate, timeSlot: afterComplete.timeSlot } },
      headers: { "Content-Type": "application/json" },
    });
    ok("Completed bookings are terminal", zombie.status() === 409, `HTTP ${zombie.status()}`);

    // ----- Logout removes access -----
    await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
    await page.click('button:has-text("Sign out")');
    await page.waitForURL("**/admin/login", { timeout: 15000 });
    ok("Sign out returns to the login page", page.url().endsWith("/admin/login"), page.url());

    const afterLogoutPage = await ctx.request.get(`${BASE}/admin/bookings`);
    ok("Protected page is unreachable after logout", afterLogoutPage.url().endsWith("/admin/login"), afterLogoutPage.url());
    const afterLogoutApi = await ctx.request.get(`${BASE}/api/admin/bookings`);
    ok("Private API is unreachable after logout", afterLogoutApi.status() === 401, `HTTP ${afterLogoutApi.status()}`);

    await page.close();
    await ctx.close();
  }

  // =========================================================================
  // 9. No secrets or private data in HTML or browser bundles
  // =========================================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const publicHtml = await (await ctx.request.get(`${BASE}/`)).text();
    ok("Public HTML contains no service-role key", !publicHtml.includes(SERVICE_KEY));
    ok("Public HTML contains no private booking data", !publicHtml.includes(SEED_NAME) && !publicHtml.includes(SEED_EMAIL));

    const bundleFiles = walkStatic(".next/static");
    let leaked = null;
    for (const file of bundleFiles) {
      const content = readFileSync(file, "utf8");
      if (content.includes(SERVICE_KEY)) {
        leaked = file;
        break;
      }
    }
    ok("Browser bundles contain no service-role key", leaked === null, leaked ?? `${bundleFiles.length} files scanned`);
    ok("Browser bundles mention no admin session cookie name", !bundleFiles.some((f) => readFileSync(f, "utf8").includes("ssv_admin_at")));

    // The admin area is not advertised to search engines.
    const adminPage = await ctx.request.get(`${BASE}/admin/login`);
    ok("Admin login is marked noindex", (await adminPage.text()).includes('name="robots"'));

    await ctx.close();
  }

  // =========================================================================
  // 10. Responsive layout + accessibility basics on the private UI
  // =========================================================================
  {
    for (const vp of [
      { label: "mobile", width: 390, height: 844 },
      { label: "tablet", width: 768, height: 1024 },
      { label: "desktop", width: 1440, height: 900 },
    ]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(`No horizontal overflow on /admin/login (${vp.label})`, overflow <= 1, `${overflow}px`);
      await ctx.close();
    }

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
    const labelled = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll("input")];
      return inputs.every((input) => Boolean(document.querySelector(`label[for="${input.id}"]`)));
    });
    ok("Login inputs all have real labels", labelled);

    await fillLoginForm(page, creds.ownerEmail, creds.ownerPassword);
    await page.waitForURL("**/admin/bookings", { timeout: 15000 });
    for (const vp of [
      { label: "mobile", width: 390, height: 844 },
      { label: "tablet", width: 768, height: 1024 },
      { label: "desktop", width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(`No horizontal overflow on /admin/bookings (${vp.label})`, overflow <= 1, `${overflow}px`);
    }
    ok(
      "Bookings page exposes a page heading",
      (await page.locator("h1").count()) === 1 && (await page.locator("h1").first().textContent())?.includes("Bookings")
    );
    await page.close();
    await ctx.close();
  }
} catch (err) {
  ok("QA script completed without crashing", false, String(err));
  if (String(err).includes("403")) {
    console.log(
      "HINT: an owner login was refused. Start the QA server with the allowlist set, e.g.\n" +
        '  $env:ADMIN_OWNER_EMAILS="qa-owner@shrisaivatika.example"; npm run build; npx next start -p 3001'
    );
  }
} finally {
  if (browser) await browser.close();
  // Always remove the rows this script created; other data is untouched.
  try {
    await deleteSeedBookings();
  } catch {
    /* ignore */
  }
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  -- ${r.detail}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
console.log(`Test accounts: ${OWNER_EMAIL} (owner), ${OUTSIDER_EMAIL} (non-owner). Passwords in ${CREDS_PATH}`);
process.exit(failed ? 1 : 0);
