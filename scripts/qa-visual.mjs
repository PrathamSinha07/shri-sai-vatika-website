import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.QA_BASE || "http://localhost:3001";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = "scripts/qa-shots";
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

async function settle(page, timeout = 5000) {
  let last = -1;
  for (let i = 0; i < timeout / 150; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === last) return y;
    last = y;
    await page.waitForTimeout(150);
  }
  return last;
}

try {
  // ---------- Mobile scroll restoration ----------
  for (const slug of ["catering", "entertainment"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const anchorY = await page.evaluate((s) => {
      const links = Array.from(document.querySelectorAll(`a[href="/services/${s}"]`));
      const link = links.find((el) => el.getBoundingClientRect().top > 80) ?? links[0];
      if (!link) return null;
      link.scrollIntoView({ block: "center", behavior: "instant" });
      window.scrollBy(0, 5);
      return Math.round(window.scrollY);
    }, slug);
    await settle(page);
    const settledY = await page.evaluate(() => Math.round(window.scrollY));

    await page.tap(`a[href="/services/${slug}"]`).catch(() => page.click(`a[href="/services/${slug}"]`));
    await page.waitForURL(`**/services/${slug}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/mobile-service-${slug}.png` });

    await page.goBack();
    await page.waitForURL((u) => u.pathname === "/");
    await settle(page);
    const afterBack = await page.evaluate(() => Math.round(window.scrollY));
    ok(
      `MOBILE Back from /services/${slug} restores position`,
      anchorY !== null && settledY > 100 && Math.abs(afterBack - settledY) <= 25,
      `expected ${settledY}, got ${afterBack}`,
    );
    await page.screenshot({ path: `${OUT}/mobile-home-back-${slug}.png` });

    await page.goForward();
    await page.waitForURL(`**/services/${slug}`);
    await settle(page);
    const fwd = await page.evaluate(() => Math.round(window.scrollY));
    ok(`MOBILE Forward to /services/${slug} stays sane`, fwd >= 0 && fwd <= 900, `scrollY ${fwd}`);
    await ctx.close();
  }

  // ---------- Mobile refresh of homepage ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const y = await page.evaluate(() => Math.round(window.scrollY));
    ok(`MOBILE homepage refresh lands at top`, y <= 5, `scrollY ${y}`);
    await ctx.close();
  }

  // ---------- Screenshots: Director + service images ----------
  for (const [label, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const dir = page.locator('img[src*="director"]');
    await dir.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => {
        const i = document.querySelector('img[src*="director"]');
        return !!i && i.complete && i.naturalWidth > 0;
      },
      null,
      { timeout: 8000 },
    );
    await dir.screenshot({ path: `${OUT}/director-${label}.png` });

    const svc = page.locator("#services");
    await svc.scrollIntoViewIfNeeded();
    await settle(page, 3000);
    await page.screenshot({ path: `${OUT}/home-services-${label}.png` });
    await ctx.close();
  }

  for (const slug of ["video-photography", "jaimala-stages", "band-baja-baraat", "bride-groom-entry"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/services/${slug}`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => {
        const i = document.querySelector("article img");
        return !!i && i.complete && i.naturalWidth > 0;
      },
      null,
      { timeout: 8000 },
    );
    const shot = page.locator("article img").first();
    await shot.scrollIntoViewIfNeeded();
    await settle(page, 2500);
    await shot.screenshot({ path: `${OUT}/svc-${slug}.png` });
    await ctx.close();
  }
} finally {
  await browser.close();
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  -- ${r.detail}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${OUT}/`);
process.exit(failed ? 1 : 0);
