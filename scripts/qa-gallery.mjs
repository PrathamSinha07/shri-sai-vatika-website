import { chromium } from "playwright-core";

// Milestone 7 — Gallery QA.
// Run against a production build: QA_BASE=http://localhost:3002 node scripts/qa-gallery.mjs

const BASE = process.env.QA_BASE || "http://localhost:3002";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = ".agent-tmp/gal-shots";

const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

const EXPECTED_SRCS = [
  "/images/16.jpg",
  "/images/15.jpg",
  "/images/12.jpg",
  "/images/09.jpg",
  "/images/03.jpg",
  "/images/13.jpg",
  "/images/17.jpg",
  "/images/14.jpg",
];

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

// Walk the section viewport by viewport so lazy images load and whileInView
// animations settle, then return to the section top.
async function revealGallery(page) {
  await page.evaluate(async () => {
    const el = document.getElementById("gallery");
    if (!el) return;
    const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
    const bottom = top + el.offsetHeight;
    const step = Math.floor(window.innerHeight * 0.7);
    for (let y = top; y < bottom; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 260));
    }
    window.scrollTo({ top, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 350));
  });
  await page
    .waitForFunction(
      () => {
        const imgs = Array.from(
          document.querySelectorAll("#gallery-panel-photos img"),
        );
        return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
      },
      { timeout: 15000 },
    )
    .catch(() => {});
  await page.waitForTimeout(700);
}

const dialogOpen = (page) =>
  page.locator('[role="dialog"][aria-modal="true"]').count().then((n) => n > 0);

try {
  // ============================================================
  // A. Structure, nav link, photo grid (desktop 1440)
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    ok("Section #gallery exists", (await page.locator("#gallery").count()) === 1);
    const heading = await page.locator("#gallery-heading").textContent();
    ok("Heading is 'Gallery'", heading?.trim() === "Gallery", JSON.stringify(heading));
    const eyebrow = await page.locator("#gallery .eyebrow").first().textContent();
    ok("Eyebrow present", (eyebrow ?? "").trim().length > 0, JSON.stringify(eyebrow));

    // Navbar link scrolls to the section.
    await page.locator('header a[href="#gallery"]:visible').first().click();
    await scrollSettles(page, 7000);
    await page.waitForTimeout(400);
    const anchor = await page.evaluate(() => ({
      top: Math.round(document.getElementById("gallery")?.getBoundingClientRect().top ?? -9999),
      y: Math.round(window.scrollY),
      hash: window.location.hash,
    }));
    ok(
      "Navbar Gallery link scrolls to #gallery",
      Math.abs(anchor.top) < 400 && anchor.y > 500,
      JSON.stringify(anchor),
    );
    ok("Navbar link sets #gallery hash", anchor.hash === "#gallery", anchor.hash);

    await revealGallery(page);

    // Tabs: Photos active by default, correct panels.
    const tabs = await page.evaluate(() => {
      const photoTab = document.getElementById("gallery-tab-photos");
      const videoTab = document.getElementById("gallery-tab-videos");
      const photoPanel = document.getElementById("gallery-panel-photos");
      const videoPanel = document.getElementById("gallery-panel-videos");
      return {
        role: photoTab?.getAttribute("role"),
        photoSelected: photoTab?.getAttribute("aria-selected"),
        videoSelected: videoTab?.getAttribute("aria-selected"),
        photoHidden: photoPanel?.hasAttribute("hidden"),
        videoHidden: videoPanel?.hasAttribute("hidden"),
        controls: photoTab?.getAttribute("aria-controls"),
      };
    });
    ok(
      "Photos tab active by default (ARIA)",
      tabs.role === "tab" &&
        tabs.photoSelected === "true" &&
        tabs.videoSelected === "false" &&
        tabs.photoHidden === false &&
        tabs.videoHidden === true &&
        tabs.controls === "gallery-panel-photos",
      JSON.stringify(tabs),
    );

    // Exactly the 8 curated photos, in order; all lazy; all alt text present.
    const grid = await page.evaluate(() => {
      const imgs = Array.from(
        document.querySelectorAll("#gallery-panel-photos img"),
      );
      return {
        count: imgs.length,
        paths: imgs.map((i) => {
          const u = new URL(i.currentSrc || i.src);
          return u.pathname === "/_next/image"
            ? (u.searchParams.get("url") ?? "")
            : u.pathname;
        }),
        alts: imgs.map((i) => i.getAttribute("alt") ?? ""),
        lazy: imgs.every((i) => i.getAttribute("loading") === "lazy"),
        fetchPriority: imgs.map((i) => i.getAttribute("fetchpriority")),
        buttons: imgs.map((i) => Boolean(i.closest("button"))),
        loaded: imgs.every((i) => i.complete && i.naturalWidth > 0),
      };
    });
    ok(
      "Exactly 8 curated photos in designed order",
      grid.count === 8 &&
        JSON.stringify(grid.paths) === JSON.stringify(EXPECTED_SRCS),
      JSON.stringify(grid.paths),
    );
    ok(
      "All photos have descriptive alt text",
      grid.alts.every((a) => a.trim().length > 20),
      JSON.stringify(grid.alts.map((a) => a.slice(0, 40))),
    );
    ok("All grid images lazy, none prioritised", grid.lazy && grid.fetchPriority.every((p) => p !== "high"), JSON.stringify(grid.fetchPriority));
    ok("Every tile is a button (keyboard operable)", grid.buttons.every(Boolean));
    ok("All grid images loaded", grid.loaded);

    // Editorial rows: same span + aspect within a row => aligned boxes.
    const boxes = await page.$$eval("#gallery-panel-photos button", (els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const img = el.querySelector("img");
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top + window.scrollY),
          natW: Number(img.getAttribute("width")),
          natH: Number(img.getAttribute("height")),
        };
      }),
    );
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    ok(
      "Row 2 portraits: equal widths/heights/aligned tops",
      near(boxes[1].w, boxes[2].w, 2) && near(boxes[2].w, boxes[3].w, 2) &&
        near(boxes[1].h, boxes[2].h, 2) && near(boxes[2].h, boxes[3].h, 2) &&
        near(boxes[1].top, boxes[3].top, 2),
      JSON.stringify(boxes.slice(1, 4)),
    );
    ok(
      "Row 3 landscapes: equal widths/heights/aligned tops",
      near(boxes[4].w, boxes[5].w, 2) && near(boxes[4].h, boxes[5].h, 2) &&
        near(boxes[4].top, boxes[5].top, 2),
      JSON.stringify(boxes.slice(4, 6)),
    );
    ok(
      "Bands span the full content width",
      boxes[0].w > 1000 && boxes[6].w > 1000 && boxes[7].w > 1000,
      JSON.stringify([boxes[0].w, boxes[6].w, boxes[7].w]),
    );

    // Crop budget: cell aspect vs natural aspect must stay modest.
    const crops = boxes.map((b) => {
      const cell = b.w / b.h;
      const nat = b.natW / b.natH;
      return Math.round(Math.abs(cell / nat - 1) * 1000) / 10;
    });
    ok(
      "No tile crops more than 20% of its photo",
      crops.every((c) => c <= 20),
      `crop %: ${crops.join(", ")}`,
    );

    // ------------------------------------------------------------
    // Tabs: switch to Videos, empty state, no fake video assets
    // ------------------------------------------------------------
    const hrefBefore = await page.evaluate(() => window.location.href);
    await page.locator("#gallery-tab-videos").click();
    await page.waitForTimeout(300);
    const videos = await page.evaluate(() => {
      const photoPanel = document.getElementById("gallery-panel-photos");
      const videoPanel = document.getElementById("gallery-panel-videos");
      const title = videoPanel?.querySelector("h3")?.textContent?.trim() ?? "";
      const message = videoPanel?.querySelector("p")?.textContent?.trim() ?? "";
      const html = document.documentElement.innerHTML;
      return {
        photoHidden: photoPanel?.hasAttribute("hidden"),
        videoHidden: videoPanel?.hasAttribute("hidden"),
        selected: document.getElementById("gallery-tab-videos")?.getAttribute("aria-selected"),
        title,
        message,
        media: document.querySelectorAll("#gallery iframe, #gallery video, #gallery embed, #gallery object").length,
        fakeUrls: /youtube|youtu\.be|vimeo|\.mp4|\.webm|\.m3u8|\.mov/i.test(html),
        href: window.location.href,
        focusTag: document.activeElement?.id ?? "",
      };
    });
    ok(
      "Videos tab activates and hides Photos panel",
      videos.photoHidden === true && videos.videoHidden === false && videos.selected === "true",
      JSON.stringify(videos),
    );
    ok(
      "Empty state reads 'Videos Coming Soon'",
      videos.title === "Videos Coming Soon",
      JSON.stringify(videos.title),
    );
    ok(
      "Empty state has a supporting message",
      videos.message.length > 30 && /videos/i.test(videos.message),
      JSON.stringify(videos.message),
    );
    ok(
      "No embedded/fake video assets anywhere",
      videos.media === 0 && videos.fakeUrls === false,
      `media=${videos.media}, fakeUrls=${videos.fakeUrls}`,
    );
    ok(
      "Tab switch does not alter the URL",
      videos.href === hrefBefore,
      videos.href,
    );

    // Tab keyboard navigation: arrows + focus tracking.
    await page.locator("#gallery-tab-photos").click();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    const afterRight = await page.evaluate(() => ({
      selected: document.getElementById("gallery-tab-videos")?.getAttribute("aria-selected"),
      focus: document.activeElement?.id ?? "",
    }));
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(150);
    const afterLeft = await page.evaluate(() => ({
      selected: document.getElementById("gallery-tab-photos")?.getAttribute("aria-selected"),
      focus: document.activeElement?.id ?? "",
      videoHidden: document.getElementById("gallery-panel-videos")?.hasAttribute("hidden"),
    }));
    ok(
      "Tablist arrow keys move selection and focus",
      afterRight.selected === "true" && afterRight.focus === "gallery-tab-videos" &&
        afterLeft.selected === "true" && afterLeft.focus === "gallery-tab-photos" &&
        afterLeft.videoHidden === true,
      `${JSON.stringify(afterRight)} / ${JSON.stringify(afterLeft)}`,
    );

    // ------------------------------------------------------------
    // Lightbox: open, keys, trap, wrap, backdrop, focus restore
    // ------------------------------------------------------------
    await revealGallery(page);
    const tiles = page.locator("#gallery-panel-photos button");
    await tiles.nth(4).click();
    await page.waitForTimeout(500);

    const opened = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (!dialog) return null;
      const img = dialog.querySelector("figure img");
      return {
        label: dialog.getAttribute("aria-label"),
        counter: dialog.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? "",
        focusLabel: document.activeElement?.getAttribute("aria-label") ?? "",
        bodyOverflow: document.body.style.overflow,
        alt: img?.getAttribute("alt") ?? "",
        loaded: Boolean(img && img.complete && img.naturalWidth > 0),
        href: window.location.href,
      };
    });
    ok("Lightbox opens as aria-modal dialog", opened !== null && opened.label === "Photo viewer", JSON.stringify(opened));
    ok("Clicking the 5th tile shows counter 5 / 8", opened?.counter === "5 / 8", opened?.counter);
    ok("Focus lands on the Close button", opened?.focusLabel === "Close viewer", opened?.focusLabel);
    ok("Body scroll locked while open", opened?.bodyOverflow === "hidden", opened?.bodyOverflow);
    ok("Lightbox image loaded", opened?.loaded === true);
    ok("Lightbox does not change the URL", opened?.href === hrefBefore, opened?.href);
    const photoAlt = await page.evaluate(
      () =>
        document
          .querySelector('#gallery-panel-photos button:nth-child(5) img')
          ?.getAttribute("alt") ?? "",
    );
    ok(
      "Lightbox shows the clicked photo (alt matches tile 5)",
      opened !== null && photoAlt.length > 20 && opened.alt === photoAlt,
      JSON.stringify({ dialog: opened?.alt?.slice(0, 60), tile: photoAlt.slice(0, 60) }),
    );

    const counter = () =>
      page.locator('[role="dialog"] [aria-live="polite"]').textContent();

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    const after2 = (await counter())?.trim();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(150);
    const after1 = (await counter())?.trim();
    ok(
      "Arrow keys move next/previous",
      after2 === "7 / 8" && after1 === "6 / 8",
      `${after2} then ${after1}`,
    );

    // Walk back to 1 / 8, then confirm Previous wraps to 8 / 8.
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(250);
    const atFirst = (await counter())?.trim();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(250);
    const wrapped = (await counter())?.trim();
    ok(
      "Previous wraps around at the first photo",
      atFirst === "1 / 8" && wrapped === "8 / 8",
      `${atFirst} then ${wrapped}`,
    );

    // Focus stays inside the dialog across many tabs.
    const trap = [];
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press("Tab");
      trap.push(
        await page.evaluate(
          () => document.activeElement?.closest('[role="dialog"]') !== null,
        ),
      );
    }
    ok("Focus trapped inside the dialog", trap.every(Boolean), JSON.stringify(trap));

    // Escape closes and restores focus to the trigger tile.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
    const closed = await page.evaluate(() => ({
      dialog: Boolean(document.querySelector('[role="dialog"]')),
      bodyOverflow: document.body.style.overflow,
      focusInGrid: Boolean(
        document.activeElement?.closest?.("#gallery-panel-photos"),
      ),
      focusIndex: Array.from(
        document.querySelectorAll("#gallery-panel-photos button"),
      ).indexOf(document.activeElement),
    }));
    ok("Escape closes the lightbox", closed.dialog === false, JSON.stringify(closed));
    ok("Body scroll released on close", closed.bodyOverflow === "" || closed.bodyOverflow !== "hidden", JSON.stringify(closed.bodyOverflow));
    ok(
      "Focus returns to the tile that opened it",
      closed.focusInGrid && closed.focusIndex === 4,
      `index=${closed.focusIndex}`,
    );

    // Backdrop click dismisses.
    await tiles.nth(0).click();
    await page.waitForTimeout(350);
    ok("Lightbox reopens from the first tile", await dialogOpen(page));
    await page.mouse.click(14, 850);
    await page.waitForTimeout(350);
    ok("Backdrop click closes the lightbox", !(await dialogOpen(page)));

    await page.locator("#gallery").screenshot({ path: `${SHOTS}/desktop-photos-full.png` });
    await page.screenshot({ path: `${SHOTS}/desktop-photos-top.png` });

    await page.locator("#gallery-tab-videos").click();
    await page.waitForTimeout(400);
    await page.locator("#gallery").screenshot({ path: `${SHOTS}/desktop-videos.png` });
    await page.locator("#gallery-tab-photos").click();

    await tiles.nth(0).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/desktop-lightbox.png` });
    await page.keyboard.press("Escape");

    await ctx.close();
  }

  // ============================================================
  // B. No horizontal overflow across all nine widths
  // ============================================================
  for (const width of [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920]) {
    const height = width <= 414 ? 844 : width <= 768 ? 1024 : 900;
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await revealGallery(page);

    const photosOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok(`No horizontal overflow @${width}px (Photos)`, photosOverflow <= 1, `${photosOverflow}px`);

    await page.locator("#gallery-tab-videos").click();
    await page.waitForTimeout(250);
    const videosOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok(`No horizontal overflow @${width}px (Videos)`, videosOverflow <= 1, `${videosOverflow}px`);
    await page.locator("#gallery-tab-photos").click();
    await page.waitForTimeout(250);

    if (width === 320 || width === 1920) {
      await page.screenshot({ path: `${SHOTS}/w${width}-photos-top.png` });
    }
    await ctx.close();
  }

  // ============================================================
  // C. Mobile (390): menu link, tap targets, lightbox, shots
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
    await page.click('#mobile-menu a[href="#gallery"]');
    await scrollSettles(page, 7000);
    await page.waitForTimeout(500);
    const mobileAnchor = await page.evaluate(() => ({
      top: Math.round(document.getElementById("gallery")?.getBoundingClientRect().top ?? -9999),
      menuOpen: Boolean(document.getElementById("mobile-menu")),
      overflow: document.body.style.overflow,
    }));
    ok(
      "Mobile menu link scrolls to #gallery and closes",
      Math.abs(mobileAnchor.top) < 500 &&
        !mobileAnchor.menuOpen &&
        mobileAnchor.overflow !== "hidden",
      JSON.stringify(mobileAnchor),
    );

    await revealGallery(page);

    // Mobile grid: single-pair row for portraits, bands full width.
    const mobileBoxes = await page.$$eval("#gallery-panel-photos button", (els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), top: Math.round(r.top + window.scrollY) };
      }),
    );
    const vw = 390;
    ok(
      "Mobile: bands fill the viewport width",
      Math.abs(mobileBoxes[0].w - vw) < 40 &&
        Math.abs(mobileBoxes[6].w - vw) < 40 &&
        Math.abs(mobileBoxes[7].w - vw) < 40,
      JSON.stringify([mobileBoxes[0].w, mobileBoxes[6].w, mobileBoxes[7].w]),
    );
    ok(
      "Mobile: the two portraits share a row",
      Math.abs(mobileBoxes[1].w - mobileBoxes[2].w) < 3 &&
        mobileBoxes[1].top === mobileBoxes[2].top,
      JSON.stringify(mobileBoxes.slice(1, 3)),
    );

    await page.screenshot({ path: `${SHOTS}/mobile-photos-top.png` });
    await page.locator("#gallery").screenshot({ path: `${SHOTS}/mobile-photos-full.png` });

    // Tap to open, next/prev buttons, close button.
    await page.locator("#gallery-panel-photos button").nth(1).tap();
    await page.waitForTimeout(500);
    const mOpen = await page.evaluate(() => ({
      dialog: Boolean(document.querySelector('[role="dialog"]')),
      counter: document.querySelector('[role="dialog"] [aria-live="polite"]')?.textContent?.trim() ?? "",
      closeBox: (() => {
        const btn = document.querySelector('[role="dialog"] button[aria-label="Close viewer"]');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      })(),
      nextBox: (() => {
        const btn = document.querySelector('[role="dialog"] button[aria-label="Next photo"]');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      })(),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    ok(
      "Mobile lightbox opens from a tap (2 / 8)",
      mOpen.dialog && mOpen.counter === "2 / 8",
      JSON.stringify(mOpen),
    );
    ok(
      "Mobile lightbox controls are >= 44px touch targets",
      mOpen.closeBox && mOpen.closeBox.w >= 44 && mOpen.closeBox.h >= 44 &&
        mOpen.nextBox && mOpen.nextBox.w >= 44 && mOpen.nextBox.h >= 44,
      JSON.stringify({ close: mOpen.closeBox, next: mOpen.nextBox }),
    );
    ok("No overflow with lightbox open @390", mOpen.overflow <= 1, `${mOpen.overflow}px`);
    await page.screenshot({ path: `${SHOTS}/mobile-lightbox.png` });

    await page.locator('[role="dialog"] button[aria-label="Close viewer"]').tap();
    await page.waitForTimeout(350);
    ok("Mobile close button dismisses", !(await dialogOpen(page)));

    await ctx.close();
  }

  // ============================================================
  // D. Reduced motion: content still fully visible
  // ============================================================
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await revealGallery(page);
    const visible = await page.$$eval("#gallery-panel-photos button", (els) =>
      els.every((el) => Number(getComputedStyle(el).opacity) > 0.95),
    );
    ok("Reduced motion: all photos visible (no stuck fades)", visible);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok("Reduced motion: no horizontal overflow", overflow <= 1, `${overflow}px`);
    await ctx.close();
  }

  // ============================================================
  // E. Sibling sections still present (order preserved)
  // ============================================================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const ids = await page.evaluate(() =>
      ["top", "venue", "facilities", "services", "gallery", "book-a-visit"]
        .map((id) => ({ id, present: Boolean(document.getElementById(id)) })),
    );
    ok(
      "All expected section anchors present",
      ids.every((i) => i.present),
      JSON.stringify(ids),
    );
    const order = await page.evaluate(() => {
      const at = (id) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + window.scrollY : -1;
      };
      return {
        services: at("services"),
        gallery: at("gallery"),
        book: at("book-a-visit"),
      };
    });
    ok(
      "Gallery sits between Services and Book a Visit",
      order.services < order.gallery && order.gallery < order.book,
      JSON.stringify(order),
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
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
