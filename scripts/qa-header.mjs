import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3001";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

async function headerState(page) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const hero = document.querySelector('section[aria-label="Introduction"]');
    const cs = header ? getComputedStyle(header) : null;
    return {
      scrollY: Math.round(window.scrollY),
      bg: cs?.backgroundColor ?? null,
      bgImage: cs?.backgroundImage ?? "",
      border: cs?.borderBottomWidth ?? null,
      heroTop: hero ? Math.round(hero.getBoundingClientRect().top) : null,
      heroH: hero ? Math.round(hero.getBoundingClientRect().height) : null,
      docOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

const isTransparent = (s) => s.bg === "rgba(0, 0, 0, 0)" || s.bg === "transparent";
const isIvory = (s) => s.bg === "rgb(250, 243, 227)";

async function scrollSettles(page, timeout = 5000) {
  const start = Date.now();
  let last = -1;
  while (Date.now() - start < timeout) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === last) return y;
    last = y;
    await page.waitForTimeout(150);
  }
  return last;
}

try {
  // ---------- A. Fresh load: header transparent + hero at viewport top ----------
  for (const vp of [
    { label: "desktop", width: 1440, height: 900 },
    { label: "mobile", width: 390, height: 844 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const s = await headerState(page);
    ok(`Fresh / header transparent (${vp.label})`, isTransparent(s), JSON.stringify(s));
    ok(`Fresh / hero starts at viewport top (${vp.label})`, s.heroTop === 0, JSON.stringify(s));
    ok(`Fresh / scrollY is 0 (${vp.label})`, s.scrollY <= 5, JSON.stringify(s));

    // ---------- B. Scrolled: solid ivory ----------
    await page.evaluate(() => window.scrollTo(0, 1200));
    await scrollSettles(page);
    await page.waitForTimeout(400);
    const s2 = await headerState(page);
    ok(`Scrolled / header solid ivory (${vp.label})`, isIvory(s2), JSON.stringify(s2));

    // ---------- C. Back to top: transparent again ----------
    await page.evaluate(() => window.scrollTo(0, 0));
    await scrollSettles(page);
    await page.waitForTimeout(400);
    const s3 = await headerState(page);
    ok(`Returned to top / header transparent (${vp.label})`, isTransparent(s3), JSON.stringify(s3));
    await ctx.close();
  }

  // ---------- D. Scroll restoration + header state after Back ----------
  for (const slug of ["catering", "entertainment"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const settledY = await page.evaluate((s) => {
      const links = Array.from(document.querySelectorAll(`a[href="/services/${s}"]`));
      const link = links.find((el) => el.getBoundingClientRect().top > 100) ?? links[0];
      if (!link) return null;
      link.scrollIntoView({ block: "center", behavior: "instant" });
      window.scrollBy(0, 7);
      return Math.round(window.scrollY);
    }, slug);
    await scrollSettles(page);
    const anchorY = await page.evaluate(() => Math.round(window.scrollY));

    await page.click(`a[href="/services/${slug}"]`);
    await page.waitForURL(`**/services/${slug}`);
    await page.waitForTimeout(700);
    const onService = await headerState(page);
    ok(
      `Service page /services/${slug} opens at its top`,
      onService.scrollY <= 5,
      JSON.stringify(onService),
    );
    ok(
      `Service page /services/${slug} header keeps its own (transparent) style`,
      isTransparent(onService),
      JSON.stringify(onService),
    );

    await page.goBack();
    await page.waitForURL(`${BASE}/`);
    await scrollSettles(page);
    await page.waitForTimeout(500);
    const afterBack = await headerState(page);
    ok(
      `Back from /services/${slug} restores scroll`,
      settledY !== null && anchorY > 100 && Math.abs(afterBack.scrollY - anchorY) <= 25,
      `expected ${anchorY}, got ${afterBack.scrollY}`,
    );
    ok(
      `Back from /services/${slug}: header solid while scrolled`,
      isIvory(afterBack),
      JSON.stringify(afterBack),
    );

    // Now scroll to the very top and confirm the header goes transparent again.
    await page.evaluate(() => window.scrollTo(0, 0));
    await scrollSettles(page);
    await page.waitForTimeout(400);
    const topAgain = await headerState(page);
    ok(
      `Back from /services/${slug}: header transparent at top`,
      isTransparent(topAgain),
      JSON.stringify(topAgain),
    );
    await ctx.close();
  }

  // ---------- E. Refresh of "/" lands on Hero with transparent header ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, 4000));
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const s = await headerState(page);
    ok(`Refresh / lands on Hero`, s.scrollY <= 5 && s.heroTop === 0, JSON.stringify(s));
    ok(`Refresh / header transparent`, isTransparent(s), JSON.stringify(s));
    await ctx.close();
  }

  // ---------- Mobile navigation keeps working ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    await page.click('button[aria-controls="mobile-menu"]');
    const opened = await page
      .waitForSelector("#mobile-menu", { state: "visible", timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    ok(`Mobile menu opens`, opened);

    await page.click('#mobile-menu a[href="#services"]');
    await scrollSettles(page, 6000);
    await page.waitForTimeout(400);
    const closed = (await page.locator("#mobile-menu").count()) === 0;
    const svcTop = await page.evaluate(
      () => Math.round(document.getElementById("services")?.getBoundingClientRect().top ?? -999),
    );
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    ok(
      `Mobile menu link scrolls to the section and closes`,
      closed && Math.abs(svcTop) < 500 && overflow !== "hidden",
      `closed=${closed}, #services top=${svcTop}, body overflow=${overflow}`,
    );
    await ctx.close();
  }

  // ---------- F. No horizontal overflow on key routes ----------
  for (const route of ["/", "/services", "/services/catering", "/services/video-photography"]) {
    for (const vp of [
      { label: "desktop", width: 1440, height: 900 },
      { label: "mobile", width: 390, height: 844 },
    ]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(`No horizontal overflow ${route} (${vp.label})`, overflow <= 1, `${overflow}px`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  -- ${r.detail}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
