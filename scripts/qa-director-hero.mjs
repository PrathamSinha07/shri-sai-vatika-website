import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3002";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

const hero = await page.evaluate(() => {
  const img = document.querySelector('section[aria-label="Introduction"] img');
  const picture = document.querySelector('section[aria-label="Introduction"] picture');
  return {
    attrs: img ? Object.fromEntries([...img.attributes].map((a) => [a.name, a.value])) : null,
    sources: picture ? [...picture.querySelectorAll("source")].map((s) => s.getAttribute("media")) : null,
  };
});
console.log("HERO IMG:", JSON.stringify(hero, null, 2));

const headerSSR = await page.evaluate(() => {
  const h = document.querySelector("header");
  return { class: h.className, bg: getComputedStyle(h).backgroundColor };
});
console.log("HEADER AT TOP:", JSON.stringify(headerSSR));

const dir = page.locator('img[src*="director"]');
await dir.scrollIntoViewIfNeeded();
await page.waitForFunction(
  () => {
    const i = document.querySelector('img[src*="director"]');
    return !!i && i.complete && i.naturalWidth > 0;
  },
  null,
  { timeout: 10000 },
);
await page.waitForTimeout(600);
await dir.screenshot({ path: ".agent-tmp/verify-director-rendered.png" });
console.log(
  "DIRECTOR:",
  JSON.stringify(
    await page.evaluate(() => {
      const i = document.querySelector('img[src*="director"]');
      const r = i.getBoundingClientRect();
      return {
        src: i.getAttribute("src"),
        srcsetSample: (i.getAttribute("srcset") || "").slice(0, 90),
        natural: `${i.naturalWidth}x${i.naturalHeight}`,
        rendered: `${Math.round(r.width)}x${Math.round(r.height)}`,
        complete: i.complete,
      };
    }),
  ),
);

await ctx.close();
await browser.close();
