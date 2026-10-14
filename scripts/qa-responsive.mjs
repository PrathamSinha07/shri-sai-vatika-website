import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

// Responsive sweep + Virtual Tour CTA behaviour.
//
//   QA_BASE=http://localhost:3001 node scripts/qa-responsive.mjs
//
// Checks, for every breakpoint in WIDTHS on every route in ROUTES:
//   * no horizontal page overflow
//   * the button system stays uniform (>= 44px tall, control radius) and is
//     never applied to plain navigation/footer links
//   * the header flips between the compact bar (< 1024) and the full nav
//     (>= 1024) without crowding
//   * the Virtual Tour CTA says "Virtual Tour", points at #gallery on the
//     homepage and /#gallery from service routes, and lands on the Gallery —
//     from the desktop bar and from the mobile menu, on both route types.
// It also drops full-page screenshots into SHOTS for visual review.

const BASE = process.env.QA_BASE || "http://localhost:3002";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = ".agent-tmp/resp-shots";
mkdirSync(SHOTS, { recursive: true });

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440];
const ROUTES = ["/", "/services", "/services/catering"];

const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

/** The site sets `scroll-behavior: smooth`, so scrollY must be polled. */
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

/** Walk the page so whileInView reveals and lazy images have fired. */
async function revealAll(page) {
  await page.evaluate(async () => {
    const height = document.body.scrollHeight;
    for (let y = 0; y < height; y += 500) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(350);
}

async function galleryTop(page) {
  return page.evaluate(
    () => Math.round(document.getElementById("gallery")?.getBoundingClientRect().top ?? -9999),
  );
}

try {
  // ============================================================
  // A. Overflow + button geometry at every breakpoint on every route
  // ============================================================
  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: width <= 430 ? 844 : 900 },
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await revealAll(page);

      const stats = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        const buttons = Array.from(document.querySelectorAll(".btn-text"))
          .map((el) => {
            const cs = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
              label: (el.textContent ?? "").trim().slice(0, 22),
              h: Math.round(rect.height),
              radius: Number.parseFloat(cs.borderRadius) || 0,
              visible: rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden",
            };
          })
          .filter((b) => b.visible);
        return {
          overflow,
          tooShort: buttons.filter((b) => b.h < 44),
          unrounded: buttons.filter((b) => b.radius <= 0),
          // Button styling must not leak onto navigation or footer links.
          navButtons: document.querySelectorAll(
            'header nav a.btn-text, footer a.btn-text, a.btn-text[class*="text-small"]',
          ).length,
        };
      });

      ok(
        `@${width}px ${route} — no horizontal overflow`,
        stats.overflow <= 1,
        `${stats.overflow}px`,
      );
      ok(
        `@${width}px ${route} — every button is >= 44px tall`,
        stats.tooShort.length === 0,
        JSON.stringify(stats.tooShort),
      );
      ok(
        `@${width}px ${route} — buttons keep the control radius`,
        stats.unrounded.length === 0,
        JSON.stringify(stats.unrounded),
      );
      ok(
        `@${width}px ${route} — button styles stay off plain links`,
        stats.navButtons === 0,
        `${stats.navButtons}`,
      );
      await ctx.close();
    }
  }

  // ============================================================
  // B. Header: compact bar below lg, full nav at lg and above
  // ============================================================
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);

    const layout = await page.evaluate(() => {
      const header = document.querySelector("header");
      const nav = header?.querySelector('nav[aria-label="Primary"]');
      const cta = header?.querySelector('a.btn-text[href="#gallery"]');
      const trigger = header?.querySelector('button[aria-controls="mobile-menu"]');
      const brand = header?.querySelector("a span");
      const links = Array.from(nav?.querySelectorAll("a") ?? []).filter(
        (a) => a.getBoundingClientRect().width > 0,
      );
      const rects = links.map((a) => a.getBoundingClientRect());
      let minGap = Infinity;
      for (let i = 1; i < rects.length; i++) {
        minGap = Math.min(minGap, rects[i].left - rects[i - 1].right);
      }
      const ctaRect = cta?.getBoundingClientRect();
      const brandRect = brand?.getBoundingClientRect();
      return {
        navShown: Boolean(nav && nav.getBoundingClientRect().width > 0),
        ctaShown: Boolean(cta && cta.getBoundingClientRect().width > 0),
        triggerShown: Boolean(trigger && trigger.getBoundingClientRect().width > 0),
        triggerH: trigger ? Math.round(trigger.getBoundingClientRect().height) : 0,
        gapBrandToNav:
          rects[0] && brandRect ? Math.round(rects[0].left - brandRect.right) : null,
        gapNavToCta:
          rects.length && ctaRect ? Math.round(ctaRect.left - rects[rects.length - 1].right) : null,
        minGap: Number.isFinite(minGap) ? Math.round(minGap) : null,
        ctaH: ctaRect ? Math.round(ctaRect.height) : 0,
        overflow: header ? header.scrollWidth - header.clientWidth : 0,
      };
    });

    if (width < 1024) {
      ok(
        `@${width}px — compact header (menu trigger, no squeezed nav)`,
        !layout.navShown && !layout.ctaShown && layout.triggerShown && layout.triggerH >= 44,
        JSON.stringify(layout),
      );
    } else {
      ok(
        `@${width}px — full nav with clear gutters and a 44px CTA`,
        layout.navShown &&
          layout.ctaShown &&
          !layout.triggerShown &&
          layout.gapBrandToNav >= 24 &&
          layout.gapNavToCta >= 24 &&
          layout.minGap >= 16 &&
          layout.ctaH >= 44 &&
          layout.ctaH <= 50 &&
          layout.overflow === 0,
        JSON.stringify(layout),
      );
    }
    await ctx.close();
  }

  // ============================================================
  // C. Virtual Tour CTA — desktop bar, both route types
  // ============================================================
  {
    const homeCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const homePage = await homeCtx.newPage();
    await homePage.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const homeCta = homePage.locator('header a.btn-text[href="#gallery"]').first();
    const homeHref = await homeCta.getAttribute("href");
    const homeLabel = ((await homeCta.textContent()) ?? "").trim();
    await homeCta.click({ noWaitAfter: true });
    await scrollSettles(homePage, 5000);
    await homePage.waitForTimeout(400);
    const homeTop = await galleryTop(homePage);
    ok(
      'Desktop CTA on / says "Virtual Tour" and reaches the Gallery',
      homeHref === "#gallery" && /virtual tour/i.test(homeLabel) && homeTop > -100 && homeTop < 400,
      `href=${homeHref}, label=${homeLabel}, #gallery top=${homeTop}`,
    );
    await homeCtx.close();

    const svcCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const svcPage = await svcCtx.newPage();
    await svcPage.goto(`${BASE}/services/catering`, { waitUntil: "networkidle" });
    const svcHref = await svcPage
      .locator('header a.btn-text[href="/#gallery"]')
      .first()
      .getAttribute("href");
    await svcPage.locator('header a.btn-text[href="/#gallery"]').first().click({ noWaitAfter: true });
    await svcPage.waitForURL((url) => url.pathname === "/");
    await scrollSettles(svcPage, 5000);
    await svcPage.waitForTimeout(400);
    const svcTop = await galleryTop(svcPage);
    ok(
      "Desktop CTA from /services/catering reaches the homepage Gallery",
      svcHref === "/#gallery" && svcTop > -100 && svcTop < 400,
      `href=${svcHref}, #gallery top=${svcTop}`,
    );
    await svcCtx.close();
  }

  // ============================================================
  // D. Virtual Tour CTA — mobile menu, both route types (touch)
  // ============================================================
  for (const start of ["/", "/services/catering"]) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${start}`, { waitUntil: "networkidle" });

    await page.click('button[aria-controls="mobile-menu"]');
    const menuOpened = await page
      .waitForSelector("#mobile-menu", { state: "visible", timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    ok(`Mobile menu opens on ${start}`, menuOpened);

    const entry = await page.evaluate(() => {
      const link = Array.from(
        document.querySelectorAll('#mobile-menu a'),
      ).find((a) => /virtual tour/i.test(a.textContent ?? ""));
      if (!link) return null;
      const rect = link.getBoundingClientRect();
      return {
        label: (link.textContent ?? "").trim(),
        href: link.getAttribute("href"),
        h: Math.round(rect.height),
      };
    });
    const expectedHref = start === "/" ? "#gallery" : "/#gallery";
    ok(
      `Mobile menu offers "Virtual Tour" → ${expectedHref} on ${start}`,
      !!entry && entry.label === "Virtual Tour" && entry.href === expectedHref && entry.h >= 44,
      JSON.stringify(entry),
    );

    if (entry) {
      await page.tap('#mobile-menu a[href$="#gallery"]');
      await page.waitForURL((url) => url.pathname === "/");
      await scrollSettles(page, 6000);
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({
        top: Math.round(document.getElementById("gallery")?.getBoundingClientRect().top ?? -9999),
        menuOpen: Boolean(document.getElementById("mobile-menu")),
        overflow: document.body.style.overflow,
      }));
      ok(
        `Mobile "Virtual Tour" from ${start} closes the menu and lands on the Gallery`,
        !after.menuOpen && after.overflow !== "hidden" && after.top > -100 && after.top < 400,
        JSON.stringify(after),
      );
    }
    await ctx.close();
  }

  // ============================================================
  // E. Screenshots for visual review
  // ============================================================
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: width <= 430 ? 844 : 900 },
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await revealAll(page);
    await page.screenshot({ path: `${SHOTS}/home-w${width}.png`, fullPage: true });
    if (width === 390 || width === 1440) {
      await page.click('button[aria-controls="mobile-menu"]').catch(() => {});
      if (width === 390) {
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/home-w390-menu.png` });
      }
    }
    await ctx.close();
  }
  for (const route of ["/services", "/services/catering"]) {
    for (const width of [390, 1440]) {
      const ctx = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await revealAll(page);
      await page.screenshot({
        path: `${SHOTS}/${route.replace(/^\//, "").replace(/\//g, "-")}-w${width}.png`,
        fullPage: true,
      });
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
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${SHOTS}/`);
process.exit(failed ? 1 : 0);
