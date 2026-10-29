import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Hero brand-line guard. The hero's presentation sizing has no unit-testable
// logic, so — like the SQL invariants in migration-capacity.test.ts — this
// pins the source: the brand line must stay fluid and readable (no return to
// the old ~0.78rem sizing, no nowrap that could overflow small screens)
// while keeping the approved gold identity.
// ---------------------------------------------------------------------------

const source = readFileSync(new URL("./Hero.tsx", import.meta.url), "utf8");

// Class list of the <p> that renders {site.shortName}.
function brandLineClass(): string {
  const lines = source.split("\n");
  const idx = lines.findIndex((l) => l.includes("{site.shortName}"));
  assert.ok(idx > 0, "brand line rendering site.shortName not found");
  const host = lines
    .slice(Math.max(0, idx - 3), idx)
    .reverse()
    .find((l) => l.includes("<p className="));
  assert.ok(host, "brand line <p> not found above {site.shortName}");
  const match = host.match(/<p className="([^"]*)"/);
  assert.ok(match, "brand line className not captured");
  return match[1];
}

test("hero brand line uses fluid sizing with a readable minimum", () => {
  const cls = brandLineClass();
  const clamp = cls.match(/text-\[clamp\(([\d.]+)rem,/);
  assert.ok(clamp, `expected a clamped font size, got: ${cls}`);
  assert.ok(
    Number.parseFloat(clamp[1]) >= 1,
    `clamp minimum too small (${clamp[1]}rem) — the old 0.78rem sizing must not return`
  );
  assert.doesNotMatch(source, /text-\[0\.78rem\]|sm:text-\[0\.84rem\]/);
});

test("hero brand line keeps the approved gold identity", () => {
  const cls = brandLineClass();
  assert.match(cls, /text-gold-rich/);
  assert.match(cls, /uppercase/);
  assert.match(cls, /tracking-\[0\.3em\]/);
  assert.match(cls, /font-bold/);
});

test("hero brand line cannot overflow small screens", () => {
  const cls = brandLineClass();
  // nowrap would force horizontal overflow instead of wrapping in the
  // gutter; the surrounding section already clips with overflow-hidden.
  assert.doesNotMatch(cls, /whitespace-nowrap/);
  // The decorative rule must not shrink the text out of the container.
  assert.match(source, /<span aria-hidden="true" className="h-px[^"]*shrink-0/);
});

test("hero brand line stays legible over the photograph", () => {
  // A scrim-coloured text shadow lifts the gold off bright photo areas
  // without changing the brand colour.
  assert.match(brandLineClass(), /text-shadow:/);
});
