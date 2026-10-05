# Component Boundaries

## Rule

- `components/ui/` — reusable primitives with **no venue knowledge**
  (button, input, section wrapper, heading, container). Styled via props/variants.
- `components/layout/` — site chrome (header, footer, floating WhatsApp button,
  skip link). May read `src/content/site.ts`.
- `components/sections/` — homepage/page sections (Hero, Facilities, Gallery,
  Packages, Location, EnquiryForm...). Compose `ui/` + `content/` +
  `lib/maps|whatsapp`. These are the business surfaces.
- `content/` — the single source of truth for business data.

## Conventions

- Sections receive no hard-coded copy; import from `src/content/*`.
- Motion wrappers are small client components used inside server sections.
- Prefer semantic elements (`section`, `header`, `nav`, `main`, `address`,
  `figure`) and accessible labels on icon-only links.
- Keep section components under control of size; split sub-parts only when
  reused.
