import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

// Visual refinement milestone — Hero/header, announcement strip, rounded
// cards, Packages CTAs, booking form fields, footer.
// Run against a production build: QA_BASE=http://localhost:3002 node scripts/qa-visual-refinement.mjs

const BASE = process.env.QA_BASE || "http://localhost:3002";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = ".agent-tmp/vr-shots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

try {
  // ============================================================
  // A. Hero + header at scroll zero (desktop 1440, mobile 390)
  // ============================================================
  for (const vp of [
    { label: "desktop", width: 1440, height: 900 },
    { label: "mobile", width: 390, height: 844 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const hero = await page.evaluate(() => {
      const section = document.querySelector('section[aria-label="Introduction"]');
      const h1 = section?.querySelector("h1");
      const ctas = Array.from(section?.querySelectorAll("a") ?? []).map((a) =>
        (a.textContent ?? "").trim(),
      );
      const overlays = Array.from(section?.querySelectorAll(":scope > div[aria-hidden]") ?? []);
      return {
        h1: h1?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        h1Color: h1 ? getComputedStyle(h1).color : null,
        h1Size: h1 ? getComputedStyle(h1).fontSize : null,
        ctas,
        overlayCount: overlays.length,
        hasPinkWash: overlays.some((el) => {
          const img = getComputedStyle(el).backgroundImage;
          return /107,\s*18,\s*32/.test(img); // #6b1220 in the old washed overlay
        }),
      };
    });
    ok(
      `Hero headline kept (${vp.label})`,
      /Where Celebrations/i.test(hero.h1) && /Become Memories/i.test(hero.h1),
      hero.h1,
    );
    ok(
      `Hero keeps both primary actions (${vp.label})`,
      hero.ctas.some((t) => /Plan Your Celebration/i.test(t)) &&
        hero.ctas.some((t) => /WhatsApp Us/i.test(t)),
      JSON.stringify(hero.ctas),
    );
    ok(
      `Hero has a layered overlay and no pink wash (${vp.label})`,
      hero.overlayCount >= 2 && !hero.hasPinkWash,
      `overlays=${hero.overlayCount}, pink=${hero.hasPinkWash}`,
    );

    const headerCta = await page.evaluate(() => {
      const cta = document.querySelector('header a[href="#book-a-visit"]');
      const cs = cta ? getComputedStyle(cta) : null;
      const header = document.querySelector("header");
      return {
        present: Boolean(cta),
        radius: cs?.borderRadius ?? null,
        height: cta ? Math.round(cta.getBoundingClientRect().height) : 0,
        headerBg: header ? getComputedStyle(header).backgroundColor : null,
      };
    });
    ok(
      `Header CTA present with rounded geometry (${vp.label})`,
      headerCta.present && Number.parseFloat(headerCta.radius ?? "0") > 0,
      JSON.stringify(headerCta),
    );
    if (vp.label === "desktop") {
      await page.screenshot({ path: `${SHOTS}/hero-desktop-top.png` });
    } else {
      await page.screenshot({ path: `${SHOTS}/hero-mobile-top.png` });
    }
    await ctx.close();
  }

  // ============================================================
  // A2. Header must never crowd — the full nav only appears where it fits.
  // ============================================================
  for (const width of [320, 768, 1024, 1280, 1440, 1920]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const layout = await page.evaluate(() => {
      const header = document.querySelector("header");
      const nav = header?.querySelector('nav[aria-label="Primary"]');
      const cta = header?.querySelector('a[href="#book-a-visit"]');
      const menuBtn = header?.querySelector('button[aria-controls="mobile-menu"]');
      const brand = header?.querySelector("a span");
      const navLinks = Array.from(nav?.querySelectorAll("a") ?? []).filter(
        (a) => a.getBoundingClientRect().width > 0,
      );
      const rects = navLinks.map((a) => a.getBoundingClientRect());
      let minGap = Infinity;
      for (let i = 1; i < rects.length; i++) {
        minGap = Math.min(minGap, rects[i].left - rects[i - 1].right);
      }
      const navShown = Boolean(nav && nav.getBoundingClientRect().width > 0);
      const ctaShown = Boolean(cta && cta.getBoundingClientRect().width > 0);
      const brandRect = brand?.getBoundingClientRect();
      const firstRect = rects[0];
      const lastRect = rects[rects.length - 1];
      const ctaRect = cta?.getBoundingClientRect();
      const menuShown = Boolean(menuBtn && menuBtn.getBoundingClientRect().width > 0);
      return {
        navShown,
        ctaShown,
        menuShown,
        // Nothing may touch: brand < nav < CTA, each with real breathing room.
        gapBrandToNav:
          navShown && brandRect && firstRect ? Math.round(firstRect.left - brandRect.right) : null,
        gapNavToCta:
          ctaShown && lastRect && ctaRect ? Math.round(ctaRect.left - lastRect.right) : null,
        minGapBetweenLinks: Number.isFinite(minGap) ? Math.round(minGap) : null,
        brandWrapped: brandRect ? brandRect.height > 40 : false,
        ctaWrapped: ctaRect ? ctaRect.height > 50 : false,
        overflow: header ? header.scrollWidth - header.clientWidth : 0,
      };
    });

    // Below lg the header falls back to the menu button instead of a squeezed
    // nav; at lg and above the full nav must render with clear gutters.
    if (width < 1024) {
      ok(
        `@${width}px — compact header, no squeezed nav`,
        !layout.navShown && !layout.ctaShown && layout.menuShown,
        JSON.stringify(layout),
      );
    } else {
      ok(
        `@${width}px — full nav with clear gutters`,
        layout.navShown &&
          layout.ctaShown &&
          !layout.menuShown &&
          layout.gapBrandToNav >= 24 &&
          layout.gapNavToCta >= 24 &&
          layout.minGapBetweenLinks >= 16 &&
          !layout.brandWrapped &&
          !layout.ctaWrapped &&
          layout.overflow === 0,
        JSON.stringify(layout),
      );
    }
    if (width === 768 || width === 1024) {
      await page.screenshot({ path: `${SHOTS}/header-w${width}.png` });
    }
    await ctx.close();
  }

  // ============================================================
  // B. Announcement strip: position, content, seamless loop
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const strip = await page.evaluate(() => {
      const el = document.querySelector('section[aria-label="Venue highlights"]');
      const hero = document.querySelector('section[aria-label="Introduction"]');
      const intro = document.getElementById("intro");
      const track = el?.querySelector(".marquee-track");
      const lists = track ? Array.from(track.children) : [];
      const style = el ? getComputedStyle(el) : null;
      return {
        present: Boolean(el),
        betweenHeroAndIntro:
          !!el && !!hero && !!intro &&
          hero.getBoundingClientRect().bottom <= el.getBoundingClientRect().top + 1 &&
          el.getBoundingClientRect().bottom <= intro.getBoundingClientRect().top + 1,
        listCount: lists.length,
        duplicateHidden: lists[1] ? lists[1].getAttribute("aria-hidden") === "true" : false,
        sameWidth: lists.length === 2
          ? Math.abs(lists[0].getBoundingClientRect().width - lists[1].getBoundingClientRect().width) < 2
          : false,
        animation: track ? getComputedStyle(track).animationName : null,
        animationDuration: track ? getComputedStyle(track).animationDuration : null,
        bg: style?.backgroundColor ?? null,
        text: el?.innerText ?? "",
      };
    });

    ok("Announcement strip exists between Hero and Intro", strip.present && strip.betweenHeroAndIntro, JSON.stringify(strip));
    ok(
      "Strip holds two identical lists, the duplicate hidden from AT",
      strip.listCount === 2 && strip.duplicateHidden && strip.sameWidth,
      JSON.stringify({ n: strip.listCount, hidden: strip.duplicateHidden, same: strip.sameWidth }),
    );
    ok(
      "Strip marquees via CSS animation (no JS dependency)",
      strip.animation === "marquee-x" && Number.parseFloat(strip.animationDuration) > 10,
      JSON.stringify({ a: strip.animation, d: strip.animationDuration }),
    );
    ok("Strip sits on a maroon surface", strip.bg === "rgb(107, 18, 32)", strip.bg);
    ok(
      "Strip lists only confirmed facilities and services",
      /Wedding Celebrations/i.test(strip.text) &&
        /Air-Conditioned Banquet Hall/i.test(strip.text) &&
        /Spacious Lawn/i.test(strip.text) &&
        /Deluxe AC Rooms/i.test(strip.text) &&
        /Floral Decoration/i.test(strip.text) &&
        /Photography & Videography/i.test(strip.text) &&
        /Catering Services/i.test(strip.text) &&
        !/₹|offer|discount|book now/i.test(strip.text),
      strip.text.replace(/\n/g, " | ").slice(0, 200),
    );

    // The track actually moves, and loops back without a jump.
    const motion = await page.evaluate(async () => {
      const track = document.querySelector(".marquee-track");
      if (!track) return null;
      const x1 = track.getBoundingClientRect().left;
      await new Promise((r) => setTimeout(r, 900));
      const x2 = track.getBoundingClientRect().left;
      return { x1: Math.round(x1), x2: Math.round(x2) };
    });
    ok(
      "Strip translates horizontally",
      motion !== null && motion.x2 < motion.x1,
      JSON.stringify(motion),
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok("No horizontal overflow from the strip", overflow <= 1, `${overflow}px`);
    await page.locator('section[aria-label="Venue highlights"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/strip-desktop.png` });
    await ctx.close();
  }

  // ============================================================
  // C. Rounded corner system applied to cards and controls
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const radii = await page.evaluate(() => {
      const radius = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).borderRadius : null;
      };
      return {
        venueCard: radius("#packages .rounded-panel"),
        cateringCard: radius("#packages .rounded-card"),
        contactCard: radius("#contact .rounded-card"),
        formInput: radius("#book-a-visit #customerName"),
        heroPrimary: radius('section[aria-label="Introduction"] a[href="#book-a-visit"]'),
      };
    });
    for (const [name, value] of Object.entries(radii)) {
      ok(
        `Rounded corners on ${name}`,
        value !== null && Number.parseFloat(value) > 0 && Number.parseFloat(value) <= 20,
        `${value}`,
      );
    }
    await ctx.close();
  }

  // ============================================================
  // D. Packages: one enquiry CTA, no per-card buttons
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const pkg = await page.evaluate(() => {
      const section = document.getElementById("packages");
      const waLinks = Array.from(section?.querySelectorAll('a[href^="https://wa.me/"]') ?? []);
      const btnText = Array.from(section?.querySelectorAll("a.btn-text") ?? []).map((a) =>
        (a.textContent ?? "").trim(),
      );
      const text = section?.innerText ?? "";
      return {
        waCount: waLinks.length,
        btnText,
        text,
      };
    });
    ok(
      "Packages keeps exactly one WhatsApp enquiry CTA",
      pkg.waCount === 1,
      `${pkg.waCount}`,
    );
    ok(
      "Packages still offers a separate visit-booking CTA",
      pkg.btnText.some((t) => /Book a Visit/i.test(t)),
      JSON.stringify(pkg.btnText),
    );
    ok(
      "No per-card enquiry buttons remain",
      pkg.btnText.filter((t) => /Enquire/i.test(t)).length === 1,
      JSON.stringify(pkg.btnText),
    );
    ok(
      "Pricing intact and non-veg still marked separately",
      /₹1,60,000/.test(pkg.text) && /₹849/.test(pkg.text) && /₹1,099/.test(pkg.text) &&
        /priced separately/i.test(pkg.text),
      "",
    );
    await ctx.close();
  }

  // ============================================================
  // E. Booking form: Message field removed, everything else intact
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const form = await page.evaluate(() => {
      const section = document.getElementById("book-a-visit");
      const names = Array.from(
        section?.querySelectorAll("input, select, textarea") ?? [],
      ).map((el) => el.getAttribute("name"));
      return {
        names,
        hasMessage: names.includes("message"),
        hasTextarea: (section?.querySelectorAll("textarea") ?? []).length,
        radios: (section?.querySelectorAll('input[name="timeSlot"]') ?? []).length,
        dateMin: section?.querySelector('input[type="date"]')?.getAttribute("min") ?? "",
        honeypot: section?.querySelector('input[name="website"]') !== null,
      };
    });
    ok("Booking form no longer renders a Message field", !form.hasMessage && form.hasTextarea === 0, JSON.stringify(form.names));
    ok(
      "Name/phone/email/event/date/slot fields all present",
      ["customerName", "phone", "email", "eventType", "visitDate", "timeSlot"].every((n) =>
        form.names.includes(n),
      ),
      JSON.stringify(form.names),
    );
    ok(
      "Four visit slots and the honeypot survive",
      form.radios === 4 && form.honeypot,
      JSON.stringify({ radios: form.radios, honeypot: form.honeypot }),
    );
    ok(
      "Earliest bookable date is tomorrow",
      /^\d{4}-\d{2}-\d{2}$/.test(form.dateMin),
      form.dateMin,
    );

    // Server-side: submitting without a message is still valid input, and a
    // past date is still rejected. (No row is written — invalid payloads only.)
    const missing = await page.evaluate(async () => {
      const res = await fetch("/api/visit-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: "QA Probe" }),
      });
      const json = await res.json().catch(() => null);
      return { status: res.status, errors: Object.keys(json?.errors ?? {}) };
    });
    ok(
      "API still validates the remaining fields (no message requirement)",
      missing.status === 400 &&
        ["phone", "email", "eventType", "visitDate", "timeSlot"].every((k) => missing.errors.includes(k)) &&
        !missing.errors.includes("message"),
      JSON.stringify(missing),
    );

    const past = await page.evaluate(async () => {
      const res = await fetch("/api/visit-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "QA Probe",
          phone: "9835063448",
          email: "qa@example.com",
          eventType: "Wedding",
          visitDate: "2020-01-01",
          timeSlot: "09:00 AM – 12:00 PM",
        }),
      });
      const json = await res.json().catch(() => null);
      return { status: res.status, errors: Object.keys(json?.errors ?? {}) };
    });
    ok(
      "Tomorrow-or-later rule still enforced server-side",
      past.status === 400 && past.errors.includes("visitDate"),
      JSON.stringify(past),
    );

    // Availability endpoint still answers for a future date.
    const avail = await page.evaluate(async () => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 3);
      const date = d.toISOString().slice(0, 10);
      const res = await fetch(`/api/visit-bookings/availability?date=${date}`);
      const json = await res.json().catch(() => null);
      return { status: res.status, ok: json?.ok, booked: json?.booked };
    });
    ok(
      "Availability endpoint intact",
      avail.status === 200 && avail.ok === true && Array.isArray(avail.booked),
      JSON.stringify(avail),
    );

    await page.locator("#book-a-visit").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.locator("#book-a-visit").screenshot({ path: `${SHOTS}/booking-desktop.png` });
    await ctx.close();
  }

  // ============================================================
  // E2. Booking flow states — invalid payloads hit the real API (they are
  // rejected before any write); success and slot-conflict responses are
  // mocked so no production row or email is ever created.
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const pickDate = async () => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 3);
      await page.locator("#book-a-visit input[type=date]").fill(d.toISOString().slice(0, 10));
      await page.waitForTimeout(500);
    };
    const submit = async () => {
      await page.locator('#book-a-visit button[type="submit"]').click();
      await page.waitForTimeout(700);
    };

    // 1. Server-side field errors surface inline, with no Message field.
    await page.fill("#customerName", "QA Probe");
    await page.fill("#phone", "123");
    await page.fill("#email", "not-an-email");
    await pickDate();
    await page.locator('#book-a-visit input[name="timeSlot"]').first().check({ force: true });
    await submit();
    const fieldErrors = await page.evaluate(() => ({
      alerts: Array.from(document.querySelectorAll('#book-a-visit [role="alert"]')).map(
        (el) => (el.textContent ?? "").trim(),
      ),
      hasTextarea: document.querySelectorAll("#book-a-visit textarea").length,
    }));
    ok(
      "Invalid submission shows the server's field errors inline",
      fieldErrors.alerts.some((t) => /highlighted fields/i.test(t)) && fieldErrors.hasTextarea === 0,
      JSON.stringify(fieldErrors),
    );

    // 2. Unavailable slot (409): friendly message, slots reloaded.
    await page.route("**/api/visit-bookings", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "This time slot is no longer available. Please choose another slot." }),
      });
    });
    await submit();
    const conflict = await page.evaluate(() => ({
      alerts: Array.from(document.querySelectorAll('#book-a-visit [role="alert"]')).map(
        (el) => (el.textContent ?? "").trim(),
      ),
      stillOnForm: document.querySelector('#book-a-visit button[type="submit"]') !== null,
    }));
    ok(
      "Slot conflict shows the unavailable message and stays on the form",
      conflict.stillOnForm && conflict.alerts.some((t) => /no longer available/i.test(t)),
      JSON.stringify(conflict),
    );
    await page.unroute("**/api/visit-bookings");

    // 3. Success: confirmation panel with the chosen date and slot.
    // The 409 above legitimately cleared the selected slot, so re-pick it.
    await pickDate();
    await page.locator('#book-a-visit input[name="timeSlot"]').first().check({ force: true });
    await page.route("**/api/visit-bookings", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, bookingId: "00000000-0000-0000-0000-000000000000", emailIssue: false }),
      });
    });
    await submit();
    const success = await page.evaluate(() => ({
      heading: document.querySelector("#book-a-visit h3")?.textContent?.trim() ?? "",
      text: document.getElementById("book-a-visit")?.innerText ?? "",
      waLink: document.querySelector('#book-a-visit a[href^="https://wa.me/"]') !== null,
      telLink: document.querySelector('#book-a-visit a[href^="tel:"]') !== null,
    }));
    ok(
      "Successful submission renders the confirmation state",
      /Visit Request Received/i.test(success.heading) &&
        success.waLink &&
        success.telLink &&
        /Our team will contact you/i.test(success.text),
      JSON.stringify({ heading: success.heading, wa: success.waLink, tel: success.telLink }),
    );
    ok(
      "Confirmation echoes the chosen visit date and slot",
      /\d{4}-\d{2}-\d{2}/.test(success.text) && /09:00 AM – 12:00 PM/.test(success.text),
      success.text.replace(/\n/g, " | ").slice(0, 160),
    );
    await page.unroute("**/api/visit-bookings");

    // 4. Honeypot still silently accepted by the real API (no write).
    const spam = await page.evaluate(async () => {
      const res = await fetch("/api/visit-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: "spam.example" }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    ok(
      "Honeypot submissions are still silently discarded",
      spam.status === 200 && spam.body?.ok === true,
      JSON.stringify(spam),
    );
    await ctx.close();
  }

  // ============================================================
  // F. Footer: four columns, real links, no invented details
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const footer = await page.evaluate(() => {
      const f = document.querySelector("footer");
      const headings = Array.from(f?.querySelectorAll("h2") ?? []).map((h) => (h.textContent ?? "").trim());
      const links = Array.from(f?.querySelectorAll("a") ?? []).map((a) => ({
        href: a.getAttribute("href") ?? "",
        text: (a.textContent ?? "").trim(),
      }));
      return {
        headings,
        links,
        bg: f ? getComputedStyle(f).backgroundColor : null,
        logo: f?.querySelector("img")?.getAttribute("src") ?? "",
        tagline: f?.innerText ?? "",
        forbidden: links.filter((l) => /mailto:|instagram|facebook|twitter|youtube|linkedin/.test(l.href)).length,
      };
    });

    ok(
      "Footer has Explore / Celebrations / Contact headings",
      ["Explore", "Celebrations", "Contact"].every((h) => footer.headings.includes(h)),
      JSON.stringify(footer.headings),
    );
    ok("Footer sits on the deep maroon surface", footer.bg === "rgb(74, 12, 23)", footer.bg);
    ok("Footer keeps the approved logo", footer.logo.includes("logo"), footer.logo);
    ok(
      "Footer shows the approved tagline",
      /Where Celebrations Become Memories/i.test(footer.tagline),
      "",
    );

    const serviceHrefs = [
      "/services/catering",
      "/services/flowering-lighting",
      "/services/entertainment",
      "/services/video-photography",
      "/services/bride-groom-entry",
      "/services/band-baja-baraat",
      "/services/jaimala-stages",
    ];
    ok(
      "Footer links every existing service route",
      serviceHrefs.every((h) => footer.links.some((l) => l.href === h)),
      JSON.stringify(footer.links.map((l) => l.href)),
    );
    ok(
      "Footer keeps confirmed phone, WhatsApp and directions",
      footer.links.some((l) => l.href === "tel:+919835063448") &&
        footer.links.some((l) => /^https:\/\/wa\.me\/919835063448/.test(l.href)) &&
        footer.links.some((l) => /google\.com\/maps\/dir/.test(l.href)),
      JSON.stringify(footer.links.map((l) => l.href)),
    );
    ok("No fake social or email links in the footer", footer.forbidden === 0, `${footer.forbidden}`);
    ok(
      "Footer address text present",
      /Gola Road/.test(footer.tagline) && /801503/.test(footer.tagline),
      "",
    );

    await page.locator("footer").screenshot({ path: `${SHOTS}/footer-desktop.png` });
    await ctx.close();
  }

  // ============================================================
  // G. Reduced motion: strip static and fully visible
  // ============================================================
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const rm = await page.evaluate(() => {
      const track = document.querySelector(".marquee-track");
      const dup = document.querySelector(".marquee-duplicate");
      const strip = document.querySelector('section[aria-label="Venue highlights"]');
      return {
        animation: track ? getComputedStyle(track).animationName : null,
        duplicateDisplay: dup ? getComputedStyle(dup).display : null,
        stripWidth: strip ? Math.round(strip.getBoundingClientRect().width) : 0,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    ok(
      "Reduced motion: marquee animation is off and the duplicate is hidden",
      rm.animation === "none" && rm.duplicateDisplay === "none",
      JSON.stringify(rm),
    );
    ok("Reduced motion: no horizontal overflow", rm.overflow <= 1, `${rm.overflow}px`);
    await page.screenshot({ path: `${SHOTS}/reduced-motion-top.png` });
    await ctx.close();
  }

  // ============================================================
  // H. Nine viewports: overflow + strip presence
  // ============================================================
  for (const width of [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    const height = width <= 414 ? 844 : width <= 768 ? 1024 : 900;
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const stats = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      strip: document.querySelector('section[aria-label="Venue highlights"]') !== null,
      footerCols: getComputedStyle(document.querySelector("footer > div > div")).gridTemplateColumns.split(" ").length,
    }));
    ok(`@${width}px — no horizontal overflow`, stats.overflow <= 1, `${stats.overflow}px`);
    ok(`@${width}px — strip present`, stats.strip);
    if (width === 320 || width === 1920) {
      await page.locator('section[aria-label="Venue highlights"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/w${width}-strip.png` });
      await page.locator("footer").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.locator("footer").screenshot({ path: `${SHOTS}/w${width}-footer.png` });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/w${width}-hero.png` });
    }
    await ctx.close();
  }

  // ============================================================
  // I. Mobile: menu, focus handling, footer not obscured
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
    const focusedOnOpen = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? "",
    );
    ok("Mobile menu moves focus to its close control", focusedOnOpen === "Close menu", focusedOnOpen);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const closed = (await page.locator("#mobile-menu").count()) === 0;
    const focusReturned = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-controls") === "mobile-menu",
    );
    ok("Escape closes the menu and returns focus to the trigger", closed && focusReturned, `${closed}/${focusReturned}`);

    // WhatsApp float must not cover footer links on a small screen.
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const overlap = await page.evaluate(() => {
      const btn = document.querySelector('a[aria-label*="WhatsApp"]');
      const br = btn?.getBoundingClientRect();
      if (!br) return null;
      const hits = [];
      for (const a of document.querySelectorAll("footer a")) {
        const r = a.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const overlapX = Math.min(br.right, r.right) - Math.max(br.left, r.left);
        const overlapY = Math.min(br.bottom, r.bottom) - Math.max(br.top, r.top);
        if (overlapX > 0 && overlapY > 0) hits.push((a.textContent ?? "").trim());
      }
      return hits;
    });
    ok("Floating WhatsApp button does not cover footer links", overlap !== null && overlap.length === 0, JSON.stringify(overlap));

    await page.locator("footer").screenshot({ path: `${SHOTS}/footer-mobile.png` });
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
