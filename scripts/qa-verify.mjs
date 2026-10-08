import { chromium } from "playwright-core";

const BASE = process.env.QA_BASE || "http://localhost:3001";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

/** The site sets `scroll-behavior: smooth`, so scrollY must be polled. */
async function scrollSettles(page, timeout = 4000) {
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
  // ---------- A. Director image ----------
  for (const viewport of [
    { label: "desktop", width: 1440, height: 900 },
    { label: "mobile", width: 390, height: 844 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    // The Director photo is below the fold and lazy-loaded — scroll to it.
    await page.locator('img[src*="director"]').scrollIntoViewIfNeeded().catch(() => {});
    await page
      .waitForFunction(() => {
        const i = document.querySelector('img[src*="director"]');
        return !!i && i.complete && i.naturalWidth > 0;
      }, null, { timeout: 8000 })
      .catch(() => {});
    const director = await page.evaluate(() => {
      const img = document.querySelector('img[src*="director"]');
      if (!img) return null;
      return {
        src: img.getAttribute("src"),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
      };
    });
    ok(
      `Director image visible (${viewport.label})`,
      !!director && director.complete && director.naturalWidth > 0,
      JSON.stringify(director),
    );
    // The rendered bitmap is resized by next/image, so assert the intrinsic
    // aspect ratio: 1062x886 = 1.1987 (the old file was 1152x2048 = 0.5625).
    ok(
      `Director image is the NEW crop (${viewport.label})`,
      !!director && director.complete && director.naturalWidth > 0 &&
        Math.abs(director.naturalWidth / director.naturalHeight - 1062 / 886) < 0.03,
      `${director?.naturalWidth}x${director?.naturalHeight} (want ratio ~1.199)`,
    );
    await ctx.close();
  }

  // ---------- B. Scroll restoration (both service flows) ----------
  for (const slug of ["catering", "entertainment"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const anchorY = await page.evaluate((s) => {
      const links = Array.from(document.querySelectorAll(`a[href="/services/${s}"]`));
      const link = links.find((el) => el.getBoundingClientRect().top > 100) ?? links[0];
      if (!link) return null;
      link.scrollIntoView({ block: "center", behavior: "instant" });
      window.scrollBy(0, 7);
      return Math.round(window.scrollY);
    }, slug);
    await scrollSettles(page);
    const settledY = await page.evaluate(() => Math.round(window.scrollY));

    await page.click(`a[href="/services/${slug}"]`);
    await page.waitForURL(`**/services/${slug}`);
    await page.waitForTimeout(600);

    // Scroll somewhere on the service page so Forward has a real position to
    // come back to.
    const onService = await page.evaluate(() => {
      const y = Math.min(300, Math.max(0, document.body.scrollHeight - window.innerHeight));
      window.scrollTo({ top: y, behavior: "instant" });
      return Math.round(window.scrollY);
    });
    await scrollSettles(page);

    await page.goBack();
    await page.waitForURL(`${BASE}/`);
    await scrollSettles(page);

    const afterBack = await page.evaluate(() => Math.round(window.scrollY));
    const delta = Math.abs(afterBack - settledY);
    ok(
      `Back from /services/${slug} restores Services position`,
      anchorY !== null && settledY > 100 && delta <= 25,
      `expected ${settledY}, got ${afterBack} (delta ${delta})`,
    );

    // Forward should return to the service page at the position the visitor
    // left it at (here: the top, since they never scrolled it) — not clamp the
    // deeper homepage offset onto a shorter page.
    await page.goForward();
    await page.waitForURL(`**/services/${slug}`);
    await scrollSettles(page, 5000);
    const forwardY = await page.evaluate(() => Math.round(window.scrollY));
    const serviceH = await page.evaluate(() => document.body.scrollHeight);
    ok(
      `Forward to /services/${slug} returns to its own position`,
      forwardY >= 0 && forwardY <= serviceH && Math.abs(forwardY - onService) <= 25,
      `scrollY ${forwardY} / docHeight ${serviceH} (expected ~${onService})`,
    );

    // Back again should restore homepage position a second time
    await page.goBack();
    await page.waitForURL(`${BASE}/`);
    await scrollSettles(page);
    const backTwice = await page.evaluate(() => Math.round(window.scrollY));
    ok(
      `Second Back to / restores again`,
      anchorY !== null && Math.abs(backTwice - settledY) <= 25,
      `expected ${settledY}, got ${backTwice}`,
    );

    await ctx.close();
  }

  // ---------- Refresh of homepage must still land on Hero ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, 4000));
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const y = await page.evaluate(() => Math.round(window.scrollY));
    ok(`Homepage refresh lands at the top`, y <= 5, `scrollY ${y}`);
    await ctx.close();
  }

  // ---------- Direct service URL open + service refresh ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/services/catering`, { waitUntil: "networkidle" });
    const y1 = await page.evaluate(() => Math.round(window.scrollY));
    ok(`Direct /services/catering open starts at top`, y1 <= 5, `scrollY ${y1}`);

    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const y2 = await page.evaluate(() => Math.round(window.scrollY));
    ok(`Service page refresh is normal (not reset by ScrollReset)`, y2 >= 0, `scrollY ${y2}`);
    await ctx.close();
  }

  // ---------- Anchor navigation still works ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // a) Same-page anchor: header logo "#top" from a scrolled homepage.
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo({ top: 3000, behavior: "instant" }));
    await page.waitForTimeout(300);
    await page.locator('a[href="#top"]').first().click({ noWaitAfter: true }).catch(() => {});
    await scrollSettles(page, 5000);
    const logoY = await page.evaluate(() => Math.round(window.scrollY));
    ok(`Same-page anchor #top scrolls to top`, logoY <= 5, `scrollY ${logoY}`);

    // b) Same-page header nav anchor: "#services".
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(250);
    const navAnchor = page.locator('header nav a[href="#services"]').first();
    const navFound = (await navAnchor.count()) > 0;
    if (navFound) {
      await navAnchor.click({ noWaitAfter: true }).catch(() => {});
      await scrollSettles(page, 5000);
    }
    const navY = await page.evaluate(() => Math.round(window.scrollY));
    const navTop = await page.evaluate(
      () => Math.round(document.getElementById("services")?.getBoundingClientRect().top ?? -999),
    );
    ok(
      `Same-page header anchor #services scrolls to the section`,
      navFound && navY > 100 && Math.abs(navTop) < 400,
      `scrollY ${navY}, #services top ${navTop}`,
    );

    // c) Cross-page anchor: service breadcrumb "/#services".
    await page.goto(`${BASE}/services/catering`, { waitUntil: "networkidle" });
    await page.locator('nav[aria-label="Breadcrumb"] a[href="/#services"]').click({ noWaitAfter: true });
    await page.waitForURL((url) => url.pathname === "/" );
    await scrollSettles(page, 5000);
    const crumbY = await page.evaluate(() => Math.round(window.scrollY));
    const crumbTop = await page.evaluate(
      () => Math.round(document.getElementById("services")?.getBoundingClientRect().top ?? -999),
    );
    ok(
      `Cross-page anchor /#services reaches the Services section`,
      crumbY > 100 && Math.abs(crumbTop) < 400,
      `scrollY ${crumbY}, #services top ${crumbTop}`,
    );

    // d) Cross-page anchor: service CTA "/#book-a-visit".
    await page.goto(`${BASE}/services/catering`, { waitUntil: "networkidle" });
    await page.locator('a[href="/#book-a-visit"]').first().click({ noWaitAfter: true });
    await page.waitForURL((url) => url.pathname === "/");
    await scrollSettles(page, 5000);
    const ctaY = await page.evaluate(() => Math.round(window.scrollY));
    const ctaTop = await page.evaluate(
      () => Math.round(document.getElementById("book-a-visit")?.getBoundingClientRect().top ?? -999),
    );
    ok(
      `Cross-page anchor /#book-a-visit reaches the booking section`,
      ctaY > 100 && Math.abs(ctaTop) < 400,
      `scrollY ${ctaY}, #book-a-visit top ${ctaTop}`,
    );

    // e) A genuine fresh document load with a hash must still land at the Hero
    //    with the hash cleared (probe showed goto() from "/" is only a
    //    fragment jump, so this needs a brand-new page).
    const freshCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const freshPage = await freshCtx.newPage();
    await freshPage.goto(`${BASE}/#services`, { waitUntil: "networkidle" });
    await freshPage.waitForTimeout(900);
    const refY = await freshPage.evaluate(() => Math.round(window.scrollY));
    const refHash = await freshPage.evaluate(() => window.location.hash);
    await freshCtx.close();
    ok(
      `Fresh load with #hash lands at the Hero and clears the hash`,
      refY <= 60 && refHash === "",
      `scrollY ${refY}, hash "${refHash}"`,
    );

    // f) Refresh (reload) of a hash URL must also land at the Hero.
    const rlCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const rlPage = await rlCtx.newPage();
    await rlPage.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await rlPage.evaluate(() => window.history.replaceState(null, "", "/#services"));
    await rlPage.reload({ waitUntil: "networkidle" });
    await rlPage.waitForTimeout(900);
    const rlY = await rlPage.evaluate(() => Math.round(window.scrollY));
    const rlHash = await rlPage.evaluate(() => window.location.hash);
    await rlCtx.close();
    ok(
      `Refresh of a #hash URL lands at the Hero and clears the hash`,
      rlY <= 60 && rlHash === "",
      `scrollY ${rlY}, hash "${rlHash}"`,
    );

    await ctx.close();
  }

  // ---------- C. Four service images ----------
  const expected = {
    "video-photography": "/images/video_photography.jpg",
    "jaimala-stages": "/images/jaimala.jpg",
    "band-baja-baraat": "/images/Baraat.jpg",
    "bride-groom-entry": "/images/Entry.jpg",
    catering: "/images/07.jpg",
    "flowering-lighting": "/images/08.jpg",
    entertainment: "/images/Entertainment.jpg",
  };

  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    for (const [slug, image] of Object.entries(expected)) {
      await page.goto(`${BASE}/services/${slug}`, { waitUntil: "networkidle" });
      const info = await page.evaluate(() => {
        // The detail hero image lives inside <article>; the header logo does not.
        const img = document.querySelector("article img");
        return img
          ? { src: decodeURIComponent(img.getAttribute("src") || ""), nw: img.naturalWidth, nh: img.naturalHeight, complete: img.complete }
          : null;
      });
      const srcOk = !!info && (info.src.includes(image) || info.src.includes(encodeURIComponent(image)));
      const loadedOk = !!info && info.complete && info.nw > 0;
      ok(`Image for /services/${slug}`, srcOk && loadedOk, `expected ${image} -> ${JSON.stringify(info)}`);
    }

    // Homepage services section images
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const homeImgs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="/services/"] img')).map((i) => ({
        href: i.closest("a")?.getAttribute("href"),
        src: decodeURIComponent(i.getAttribute("src") || ""),
        nw: i.naturalWidth,
      })),
    );
    for (const [slug, image] of Object.entries(expected)) {
      const hit = homeImgs.find((h) => h.href === `/services/${slug}`);
      ok(
        `Homepage card image for ${slug}`,
        !!hit && hit.src.includes(image) && hit.nw > 0,
        JSON.stringify(hit),
      );
    }
    await ctx.close();
  }

  // ---------- Mobile sanity: no horizontal overflow ----------
  for (const route of ["/", "/services/catering", "/services/jaimala-stages"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`No horizontal overflow on mobile ${route}`, overflow <= 1, `overflow ${overflow}px`);
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
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
