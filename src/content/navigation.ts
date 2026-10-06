// Single source of truth for navigation targets.
// Sections not yet built render no anchor; future milestones add the
// matching section id without restructuring the layout.

export const sectionIds = {
  home: "top",
  venue: "venue",
  facilities: "facilities",
  services: "services",
  gallery: "gallery",
  packages: "packages",
  location: "location",
  bookVisit: "book-a-visit",
  contact: "contact",
} as const;

export const navLinks = [
  { label: "Venue", href: `#${sectionIds.venue}` },
  { label: "Facilities", href: `#${sectionIds.facilities}` },
  { label: "Services", href: `#${sectionIds.services}` },
  { label: "Gallery", href: `#${sectionIds.gallery}` },
  { label: "Packages", href: `#${sectionIds.packages}` },
  { label: "Location", href: `#${sectionIds.location}` },
  { label: "Contact", href: `#${sectionIds.contact}` },
] as const;

export const bookVisitHref = `#${sectionIds.bookVisit}`;

// Future gallery taxonomy (implemented in a later milestone):
// PHOTOS and VIDEOS must remain clearly separated categories.
export const galleryCategories = ["Photos", "Videos"] as const;
