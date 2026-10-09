import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

// Milestone 8 — Packages, Location & Contact QA.
// Run against a production build: QA_BASE=http://localhost:3002 node scripts/qa-milestone8.mjs

const BASE = process.env.QA_BASE || "http://localhost:3002";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = ".agent-tmp/m8-shots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

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

// Walk a section viewport by viewport so whileInView animations settle.
async function reveal(page, id) {
  await page.evaluate(async (sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
    const bottom = top + el.offsetHeight;
    const step = Math.floor(window.innerHeight * 0.7);
    for (let y = top; y < bottom; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo({ top, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 350));
  }, id);
}

// The Google Maps embed loads its tiles asynchronously; wait until the
// embed document has actually painted tiles before capturing screenshots.
async function waitForMap(page, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const frame = page.frames().find((f) => f.url().includes("maps/embed"));
    if (frame) {
      const loaded = await frame
        .evaluate(
          () =>
            Array.from(document.querySelectorAll("img")).filter(
              (i) => i.complete && i.naturalWidth > 0,
            ).length,
        )
        .catch(() => 0);
      if (loaded > 4) return;
    }
    await page.waitForTimeout(400);
  }
}

try {
  // ============================================================
  // A. Structure, anchors, section order (desktop 1440)
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    const sections = await page.evaluate(() =>
      ["packages", "location", "contact"].map((id) => ({
        id,
        count: document.querySelectorAll(`#${id}`).length,
        heading: document.querySelector(`#${id}-heading`)?.textContent?.trim() ?? "",
        labelled: document.querySelector(`#${id}`)?.getAttribute("aria-labelledby"),
      })),
    );
    ok(
      "Sections #packages/#location/#contact exist once with headings",
      sections.every((s) => s.count === 1 && s.heading.length > 5 && s.labelled === `${s.id}-heading`),
      JSON.stringify(sections),
    );

    const order = await page.evaluate(() => {
      const at = (id) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + window.scrollY : -1;
      };
      return {
        gallery: at("gallery"),
        packages: at("packages"),
        location: at("location"),
        book: at("book-a-visit"),
        contact: at("contact"),
      };
    });
    ok(
      "Order: Gallery < Packages < Location < Book a Visit < Contact",
      order.gallery > 0 &&
        order.gallery < order.packages &&
        order.packages < order.location &&
        order.location < order.book &&
        order.book < order.contact,
      JSON.stringify(order),
    );

    // Header nav anchors on the homepage stay hash-only.
    const navHrefs = await page.evaluate(() =>
      ["packages", "location", "contact"].map(
        (id) => document.querySelector(`header nav a[href="#${id}"]`) !== null,
      ),
    );
    ok("Header nav links to #packages/#location/#contact", navHrefs.every(Boolean), JSON.stringify(navHrefs));

    for (const id of ["packages", "location", "contact"]) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(200);
      await page.locator(`header nav a[href="#${id}"]`).first().click({ noWaitAfter: true });
      await scrollSettles(page, 7000);
      const landed = await page.evaluate((sectionId) => ({
        top: Math.round(document.getElementById(sectionId)?.getBoundingClientRect().top ?? -9999),
        y: Math.round(window.scrollY),
        hash: window.location.hash,
      }), id);
      ok(
        `Header nav scrolls to #${id} and sets the hash`,
        landed.y > 500 && Math.abs(landed.top) < 400 && landed.hash === `#${id}`,
        JSON.stringify(landed),
      );
    }
    await ctx.close();
  }

  // ============================================================
  // B. Packages content & integrity (desktop 1440)
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await reveal(page, "packages");

    const pkg = await page.evaluate(() => {
      const section = document.getElementById("packages");
      const text = section?.innerText ?? "";
      const prices = Array.from(
        section?.querySelectorAll(".font-display") ?? [],
      )
        .filter((el) => (el.textContent ?? "").trim().startsWith("₹"))
        .map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return {
            text: el.textContent.trim(),
            unit: el.parentElement?.textContent?.replace(el.textContent ?? "", "").trim() ?? "",
            lines: range.getClientRects().length,
          };
        });
      const waLinks = Array.from(
        section?.querySelectorAll('a[href^="https://wa.me/"]') ?? [],
      ).map((a) => {
        const url = new URL(a.href);
        return {
          number: url.pathname,
          text: url.searchParams.get("text") ?? "",
          label: a.getAttribute("aria-label") ?? "",
          target: a.getAttribute("target"),
        };
      });
      return {
        text,
        prices,
        waLinks,
        featuredBg: getComputedStyle(
          section?.querySelector(".bg-primary-deep") ?? document.body,
        ).backgroundColor,
        bookLink: section?.querySelector('a[href="#book-a-visit"]') !== null,
        emailLinks: section?.querySelectorAll('a[href^="mailto:"]').length,
      };
    });

    ok(
      "Venue package shows ₹1,60,000 as a one-time venue price",
      pkg.prices.some((p) => p.text === "₹1,60,000" && /one-time/i.test(p.unit)),
      JSON.stringify(pkg.prices),
    );
    ok(
      "Catering shows ₹849 and ₹1,099 as per-person prices",
      pkg.prices.some((p) => p.text === "₹849" && /per person/i.test(p.unit)) &&
        pkg.prices.some((p) => p.text === "₹1,099" && /per person/i.test(p.unit)),
      JSON.stringify(pkg.prices),
    );
    ok("Every price renders on a single line", pkg.prices.length === 3 && pkg.prices.every((p) => p.lines === 1), JSON.stringify(pkg.prices));
    ok("Venue package is the featured (maroon) card", pkg.featuredBg === "rgb(74, 12, 23)", pkg.featuredBg);
    ok(
      "Non-vegetarian catering is marked as priced separately",
      /non-vegetarian/i.test(pkg.text) && /priced separately/i.test(pkg.text),
      pkg.text.slice(0, 200),
    );

    const decoded = pkg.waLinks.map((l) => decodeURIComponent(l.text));
    // 4 per-offering enquiry links + the section-level "Ask a Question" link.
    const offerLinks = pkg.waLinks.filter((l) => /enquire/i.test(l.label));
    ok(
      "Four WhatsApp enquiry links, correct number, properly encoded",
      offerLinks.length === 4 &&
        pkg.waLinks.every((l) => l.number === "/919835063448" && l.text.length > 10 && l.target === "_blank"),
      JSON.stringify(pkg.waLinks.map((l) => l.number)),
    );
    ok(
      "Each WhatsApp message identifies its offering",
      decoded.some((t) => /Complete Venue Package/.test(t)) &&
        decoded.some((t) => /Deluxe Catering/.test(t)) &&
        decoded.some((t) => /Royal Catering/.test(t)) &&
        decoded.some((t) => /non-vegetarian catering/i.test(t)),
      JSON.stringify(decoded.map((t) => t.slice(0, 60))),
    );
    ok(
      "Offer enquiry links carry accessible labels",
      offerLinks.every((l) => l.label.length > 15),
      JSON.stringify(offerLinks.map((l) => l.label)),
    );
    ok(
      "No invented badges, discounts or countdowns",
      !/most popular|best seller|best value|limited time|countdown|discount|% off|save ₹|was ₹|only ₹/i.test(
        pkg.text,
      ),
      "",
    );
    ok("Packages links onward to the booking form", pkg.bookLink);
    ok("Packages shows no email links (none confirmed)", pkg.emailLinks === 0, `${pkg.emailLinks}`);

    await page.locator("#packages").screenshot({ path: `${SHOTS}/desktop-packages.png` });
    await ctx.close();
  }

  // ============================================================
  // C. Location: address, map embed, directions (desktop 1440)
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await reveal(page, "location");

    const loc = await page.evaluate(() => {
      const section = document.getElementById("location");
      const iframe = section?.querySelector("iframe");
      const dir = section?.querySelector('a[target="_blank"][href*="maps"]');
      const rect = iframe?.getBoundingClientRect();
      return {
        text: section?.innerText ?? "",
        addressLines: Array.from(section?.querySelectorAll("address p") ?? []).map((p) => p.textContent?.trim() ?? ""),
        iframe: iframe
          ? {
              title: iframe.getAttribute("title"),
              src: iframe.getAttribute("src"),
              loading: iframe.getAttribute("loading"),
              height: Math.round(rect?.height ?? 0),
              width: Math.round(rect?.width ?? 0),
            }
          : null,
        directions: dir
          ? { href: dir.getAttribute("href"), rel: dir.getAttribute("rel"), label: (dir.textContent ?? "").trim() }
          : null,
        telLinks: Array.from(section?.querySelectorAll('a[href^="tel:"]') ?? []).map((a) => a.getAttribute("href")),
        openMapHref: section?.querySelector('a[href*="google.com/maps"]')?.getAttribute("href") ?? "",
      };
    });

    ok(
      "Address block shows the confirmed address",
      loc.addressLines.includes("Near T Point, Gola Road, Danapur") &&
        loc.addressLines.some((l) => /Patna\s*-\s*801503/.test(l)),
      JSON.stringify(loc.addressLines),
    );
    ok(
      "Interactive map iframe is embedded with a descriptive title",
      !!loc.iframe &&
        (loc.iframe.src ?? "").includes("output=embed") &&
        (loc.iframe.src ?? "").includes("google.com") &&
        (loc.iframe.title ?? "").length > 20 &&
        /Gola Road/.test(loc.iframe.title ?? ""),
      JSON.stringify(loc.iframe),
    );
    ok(
      "Map is lazy-loaded, responsive and pre-sized (no layout shift)",
      !!loc.iframe && loc.iframe.loading === "lazy" && loc.iframe.height >= 280 && loc.iframe.width > 500,
      JSON.stringify(loc.iframe),
    );
    ok(
      "Get Directions opens Google Maps with the venue as destination",
      !!loc.directions &&
        /google\.com\/maps\/dir/.test(loc.directions.href ?? "") &&
        (loc.directions.href ?? "").includes("destination=") &&
        decodeURIComponent(loc.directions.href ?? "").includes("Gola Road") &&
        loc.directions.rel?.includes("noopener") === true,
      JSON.stringify(loc.directions),
    );
    ok("Location section links a call action", loc.telLinks.includes("tel:+919835063448"), JSON.stringify(loc.telLinks));
    ok("Map caption links 'Open in Google Maps'", loc.openMapHref.includes("google.com/maps"), loc.openMapHref);

    // The embed actually loads a Google Maps frame.
    await waitForMap(page);
    const frameOk = page.frames().some((f) => /google/i.test(f.url()) && f.url().includes("embed"));
    ok("Map iframe requests a Google Maps embed document", frameOk, page.frames().map((f) => f.url()).join(" | ").slice(0, 200));
    const tiles = await page
      .frames()
      .find((f) => f.url().includes("maps/embed"))
      ?.evaluate(() =>
        Array.from(document.querySelectorAll("img")).filter((i) => i.complete && i.naturalWidth > 0).length,
      )
      .catch(() => 0);
    ok("Map tiles render inside the embed", (tiles ?? 0) > 4, `${tiles} tiles`);

    await waitForMap(page);
    await page.locator("#location").screenshot({ path: `${SHOTS}/desktop-location.png` });
    await ctx.close();
  }

  // ============================================================
  // D. Contact: functional links, no invented details (desktop 1440)
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await reveal(page, "contact");

    const contact = await page.evaluate(() => {
      const section = document.getElementById("contact");
      const wa = section?.querySelector('a[href^="https://wa.me/"]');
      const waUrl = wa ? new URL(wa.href) : null;
      return {
        text: section?.innerText ?? "",
        tel: Array.from(section?.querySelectorAll('a[href^="tel:"]') ?? []).map((a) => a.getAttribute("href")),
        whatsapp: waUrl
          ? { number: waUrl.pathname, text: waUrl.searchParams.get("text") ?? "", target: wa?.getAttribute("target") }
          : null,
        bookVisit: section?.querySelector('a[href="#book-a-visit"]') !== null,
        directions: Array.from(section?.querySelectorAll('a[href*="google.com/maps"]') ?? []).map((a) => a.getAttribute("href")),
        emailOrSocial: Array.from(
          section?.querySelectorAll('a[href^="mailto:"], a[href*="instagram"], a[href*="facebook"], a[href*="twitter"]'),
        ).length,
        addressLines: Array.from(section?.querySelectorAll("address p") ?? []).map((p) => p.textContent?.trim() ?? ""),
        cardCount: section?.querySelectorAll("h3").length ?? 0,
      };
    });

    ok("Contact shows the confirmed phone on tel: links", contact.tel.includes("tel:+919835063448"), JSON.stringify(contact.tel));
    ok(
      "Contact WhatsApp link is encoded and targets the confirmed number",
      contact.whatsapp?.number === "/919835063448" &&
        (contact.whatsapp?.text ?? "").length > 10 &&
        contact.whatsapp?.target === "_blank",
      JSON.stringify(contact.whatsapp),
    );
    ok("Contact links to the existing visit booking form", contact.bookVisit);
    ok("Contact offers a directions action", contact.directions.some((h) => /google\.com\/maps/.test(h ?? "")), JSON.stringify(contact.directions));
    ok("No fabricated email or social accounts", contact.emailOrSocial === 0, `${contact.emailOrSocial}`);
    ok(
      "Contact repeats the venue address",
      contact.addressLines.some((l) => /Gola Road/.test(l)),
      JSON.stringify(contact.addressLines),
    );
    ok("Three composed contact channels", contact.cardCount === 3, `${contact.cardCount}`);
    ok(
      "Invitation copy invites an enquiry",
      /celebration/i.test(contact.text) && /(call|speak|message)/i.test(contact.text),
      contact.text.slice(0, 160),
    );

    await page.locator("#contact").screenshot({ path: `${SHOTS}/desktop-contact.png` });
    await ctx.close();
  }

  // ============================================================
  // E. Nine viewports: overflow, stacking, price wrapping, map box
  // ============================================================
  for (const width of [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    const height = width <= 414 ? 844 : width <= 768 ? 1024 : 900;
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    for (const id of ["packages", "location", "contact"]) await reveal(page, id);

    const stats = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const priceLines = Array.from(
        document.querySelectorAll('#packages .font-display'),
      )
        .filter((el) => (el.textContent ?? "").trim().startsWith("₹"))
        .map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getClientRects().length;
        });
      const map = document.querySelector("#location iframe")?.getBoundingClientRect();
      return {
        overflow,
        priceLines,
        mapHeight: map ? Math.round(map.height) : 0,
        mapWidth: map ? Math.round(map.width) : 0,
      };
    });

    ok(`@${width}px — no horizontal overflow`, stats.overflow <= 1, `${stats.overflow}px`);
    ok(`@${width}px — prices never wrap`, stats.priceLines.length === 3 && stats.priceLines.every((n) => n === 1), JSON.stringify(stats.priceLines));
    ok(`@${width}px — map has a sensible height (>=280px)`, stats.mapHeight >= 280 && stats.mapWidth <= width, `${stats.mapWidth}x${stats.mapHeight}`);

    if (width === 320 || width === 1920) {
      await waitForMap(page);
      await page.locator("#packages").screenshot({ path: `${SHOTS}/w${width}-packages.png` });
      await page.locator("#location").screenshot({ path: `${SHOTS}/w${width}-location.png` });
      await page.locator("#contact").screenshot({ path: `${SHOTS}/w${width}-contact.png` });
    }
    await ctx.close();
  }

  // ============================================================
  // F. Mobile (390, touch): menu anchors, tap targets
  // ============================================================
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    await page.click('button[aria-controls="mobile-menu"]');
    await page.waitForTimeout(400);
    const menuLinks = await page.evaluate(() =>
      ["packages", "location", "contact"].every(
        (id) => document.querySelector(`#mobile-menu a[href="#${id}"]`) !== null,
      ),
    );
    ok("Mobile menu lists Packages/Location/Contact", menuLinks);

    await page.click('#mobile-menu a[href="#packages"]');
    await scrollSettles(page, 7000);
    await page.waitForTimeout(500);
    const landed = await page.evaluate(() => ({
      top: Math.round(document.getElementById("packages")?.getBoundingClientRect().top ?? -9999),
      menuOpen: Boolean(document.getElementById("mobile-menu")),
      overflow: document.body.style.overflow,
    }));
    ok(
      "Mobile menu Packages link scrolls and closes the menu",
      Math.abs(landed.top) < 500 && !landed.menuOpen && landed.overflow !== "hidden",
      JSON.stringify(landed),
    );

    for (const id of ["packages", "location", "contact"]) await reveal(page, id);
    const targets = await page.evaluate(() => {
      const ids = ["packages", "location", "contact"];
      const ctas = [];
      const inline = [];
      for (const id of ids) {
        for (const a of document.querySelectorAll(`#${id} a`)) {
          const r = a.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const entry = { h: Math.round(r.height), w: Math.round(r.width), text: (a.textContent ?? "").trim().slice(0, 24) };
          // Button-style CTAs must be >= 44px; links embedded in a sentence
          // or caption fall under the WCAG inline-target exception.
          if (a.classList.contains("btn-text")) ctas.push({ id, ...entry });
          else if (r.height < 44) inline.push({ id, ...entry });
        }
      }
      return { ctas, inline };
    });
    const smallCtas = targets.ctas.filter((t) => t.h < 44).map((t) => `${t.id}:${JSON.stringify(t)}`);
    ok("All button-style CTAs are >= 44px touch targets", targets.ctas.length >= 6 && smallCtas.length === 0, smallCtas.join(" / ") || `${targets.ctas.length} CTAs`);
    ok(
      "Only inline sentence links are under 44px (WCAG inline exception)",
      targets.inline.every((t) => t.h >= 18),
      JSON.stringify(targets.inline),
    );

    await page.locator("#packages").screenshot({ path: `${SHOTS}/mobile-packages.png` });
    await reveal(page, "location");
    await waitForMap(page);
    await page.locator("#location").screenshot({ path: `${SHOTS}/mobile-location.png` });
    // Element screenshots of a tall section sometimes fail to composite the
    // cross-origin map iframe in headless; the iframe itself captures fine.
    await page.locator("#location iframe").screenshot({ path: `${SHOTS}/mobile-location-map.png` });
    await reveal(page, "contact");
    await page.locator("#contact").screenshot({ path: `${SHOTS}/mobile-contact.png` });
    await ctx.close();
  }

  // ============================================================
  // G. Reduced motion: sections fully visible, no overflow
  // ============================================================
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    for (const id of ["packages", "location", "contact"]) await reveal(page, id);
    const visible = await page.evaluate(() =>
      ["packages", "location", "contact"].every((id) =>
        Array.from(document.querySelectorAll(`#${id} div, #${id} p, #${id} h2, #${id} h3`)).every(
          (el) => Number(getComputedStyle(el).opacity) > 0.95,
        ),
      ),
    );
    ok("Reduced motion: new sections fully visible", visible);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok("Reduced motion: no horizontal overflow", overflow <= 1, `${overflow}px`);
    await ctx.close();
  }

  // ============================================================
  // H. Anchors from service-detail pages + fresh-load semantics
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/services/catering`, { waitUntil: "networkidle" });

    const svcHrefs = await page.evaluate(() => ({
      packages: document.querySelector('header nav a[href="/#packages"]') !== null,
      location: document.querySelector('header nav a[href="/#location"]') !== null,
      contact: document.querySelector('header nav a[href="/#contact"]') !== null,
      footerPackages: document.querySelector('footer a[href="/#packages"]') !== null,
    }));
    ok(
      "Service page header/footer links target homepage sections",
      svcHrefs.packages && svcHrefs.location && svcHrefs.contact && svcHrefs.footerPackages,
      JSON.stringify(svcHrefs),
    );

    await page.locator('header nav a[href="/#packages"]').click({ noWaitAfter: true });
    await page.waitForURL((url) => url.pathname === "/");
    await scrollSettles(page, 7000);
    const fromSvc = await page.evaluate(() => ({
      top: Math.round(document.getElementById("packages")?.getBoundingClientRect().top ?? -9999),
      y: Math.round(window.scrollY),
    }));
    ok(
      "Service page → Packages lands on #packages",
      fromSvc.y > 500 && Math.abs(fromSvc.top) < 400,
      JSON.stringify(fromSvc),
    );

    await page.goto(`${BASE}/services/catering`, { waitUntil: "networkidle" });
    await page.locator('footer a[href="/#location"]').click({ noWaitAfter: true });
    await page.waitForURL((url) => url.pathname === "/");
    await scrollSettles(page, 7000);
    const fromFooter = await page.evaluate(() => ({
      top: Math.round(document.getElementById("location")?.getBoundingClientRect().top ?? -9999),
      y: Math.round(window.scrollY),
    }));
    ok(
      "Service page footer → Location lands on #location",
      fromFooter.y > 500 && Math.abs(fromFooter.top) < 400,
      JSON.stringify(fromFooter),
    );

    // A fresh document load with a hash still lands at the Hero (ScrollReset).
    const freshCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const freshPage = await freshCtx.newPage();
    await freshPage.goto(`${BASE}/#packages`, { waitUntil: "networkidle" });
    await freshPage.waitForTimeout(900);
    const fresh = await freshPage.evaluate(() => ({
      y: Math.round(window.scrollY),
      hash: window.location.hash,
    }));
    await freshCtx.close();
    ok(
      "Fresh load with #packages still lands at the Hero and clears the hash",
      fresh.y <= 60 && fresh.hash === "",
      JSON.stringify(fresh),
    );

    await ctx.close();
  }

  // ============================================================
  // I. Regressions: header state, gallery tabs, booking form
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const topState = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector("header"));
      return { bg: cs.backgroundColor, image: cs.backgroundImage };
    });
    ok(
      "Header is transparent over the Hero at the top",
      topState.bg === "rgba(0, 0, 0, 0)" && topState.image !== "none",
      JSON.stringify(topState),
    );

    await page.evaluate(() => window.scrollTo({ top: 2500, behavior: "instant" }));
    await page.waitForTimeout(300);
    const scrolledState = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector("header"));
      return { bg: cs.backgroundColor, border: cs.borderBottomWidth };
    });
    ok(
      "Header takes the solid scrolled state",
      scrolledState.bg === "rgb(250, 243, 227)" && scrolledState.border === "1px",
      JSON.stringify(scrolledState),
    );

    // Gallery tabs + lightbox still work.
    await reveal(page, "gallery");
    await page.locator("#gallery-tab-videos").click();
    await page.waitForTimeout(300);
    const tabs = await page.evaluate(() => ({
      videoSelected: document.getElementById("gallery-tab-videos")?.getAttribute("aria-selected"),
      photosHidden: document.getElementById("gallery-panel-photos")?.hasAttribute("hidden"),
    }));
    ok("Gallery tabs still switch", tabs.videoSelected === "true" && tabs.photosHidden === true, JSON.stringify(tabs));
    await page.locator("#gallery-tab-photos").click();
    await page.waitForTimeout(250);
    await page.locator("#gallery-panel-photos button").first().click();
    await page.waitForTimeout(500);
    const lightboxOpen = await page.evaluate(
      () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
    const lightboxClosed = await page.evaluate(
      () => document.querySelector('[role="dialog"]') === null,
    );
    ok("Gallery lightbox opens and closes", lightboxOpen && lightboxClosed, `${lightboxOpen}/${lightboxClosed}`);

    // Booking form is intact below the new sections.
    const booking = await page.evaluate(() => {
      const section = document.getElementById("book-a-visit");
      const date = section?.querySelector('input[type="date"]');
      const radios = Array.from(section?.querySelectorAll('input[name="timeSlot"]') ?? []);
      return {
        present: Boolean(section && date),
        min: date?.getAttribute("min") ?? "",
        radioCount: radios.length,
        radiosDisabled: radios.every((r) => r.disabled),
      };
    });
    ok(
      "Visit booking form intact and slot-aware",
      booking.present && booking.radioCount === 4 && booking.radiosDisabled && /^\d{4}-\d{2}-\d{2}$/.test(booking.min),
      JSON.stringify(booking),
    );

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
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${SHOTS}/`);
process.exit(failed ? 1 : 0);
