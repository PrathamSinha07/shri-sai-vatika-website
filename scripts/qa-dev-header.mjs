import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await chromium.launch({ executablePath: EDGE, headless: true });

const state = (page) =>
  page.evaluate(() => {
    const header = document.querySelector("header");
    const hero = document.querySelector('section[aria-label="Introduction"]');
    const cs = getComputedStyle(header);
    return {
      scrollY: Math.round(window.scrollY),
      bg: cs.backgroundColor,
      heroTop: hero ? Math.round(hero.getBoundingClientRect().top) : null,
      heroImgTop: document.querySelector('section[aria-label="Introduction"] img')
        ? Math.round(document.querySelector('section[aria-label="Introduction"] img').getBoundingClientRect().top)
        : null,
      heroImgComplete: document.querySelector('section[aria-label="Introduction"] img')?.complete ?? null,
      heroImgNatural: document.querySelector('section[aria-label="Introduction"] img')?.naturalWidth ?? null,
      headerClass: header.className.slice(0, 120),
    };
  });

for (const [label, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${label} pageerror]`, e.message));
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(4000);
  console.log(`${label} initial:`, JSON.stringify(await state(page)));
  await page.screenshot({ path: `.agent-tmp/verify-top-${label}.png` });

  // refresh while scrolled
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(600);
  console.log(`${label} scrolled:`, JSON.stringify(await state(page)));
  await page.reload({ waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(3500);
  console.log(`${label} after refresh:`, JSON.stringify(await state(page)));

  await ctx.close();
}

await browser.close();
