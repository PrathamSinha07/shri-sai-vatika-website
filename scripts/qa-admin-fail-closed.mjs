// Verifies the documented fail-closed behaviour: with ADMIN_OWNER_EMAILS
// unset, a perfectly valid Supabase login must still be refused and no
// booking data may be reachable. Run this against a server started WITHOUT
// the allowlist variable:
//   $env:ADMIN_OWNER_EMAILS=$null; npx next start -p 3002
//   $env:QA_BASE="http://localhost:3002"; node scripts/qa-admin-fail-closed.mjs
import { readFileSync, existsSync } from "node:fs";

const BASE = process.env.QA_BASE || "http://localhost:3002";
const CREDS_PATH = ".agent-tmp/qa-admin-creds.json";
if (!existsSync(CREDS_PATH)) throw new Error("run scripts/qa-admin.mjs first");
const CREDS = JSON.parse(readFileSync(CREDS_PATH, "utf8"));

let failed = 0;
const ok = (name, pass, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
};

const login = await fetch(`${BASE}/api/admin/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: CREDS.ownerEmail, password: CREDS.ownerPassword }),
});
ok("Valid owner login is refused when no allowlist is configured", login.status === 403, `HTTP ${login.status}`);
ok(
  "Refusal names no account",
  !(await login.text()).includes(CREDS.ownerEmail)
);

const list = await fetch(`${BASE}/api/admin/bookings`);
ok("Private booking API is unreachable without an allowlist", list.status === 401, `HTTP ${list.status}`);

const page = await fetch(`${BASE}/admin/bookings`, { redirect: "manual" });
const location = page.headers.get("location") ?? "";
ok(
  "Protected page redirects without an allowlist",
  page.status === 307 && location.startsWith("/admin/login"),
  `HTTP ${page.status} → ${location}`
);

const rendered = await (await fetch(`${BASE}/admin/bookings`)).text();
ok(
  "Protected page never renders booking data without an allowlist",
  !rendered.includes("customerName") && !rendered.includes("Visit booking requests")
);

console.log(`\n${failed === 0 ? "all passed" : `${failed} failed`}`);
process.exit(failed ? 1 : 0);
