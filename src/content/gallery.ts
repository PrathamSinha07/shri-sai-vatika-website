// Milestone 7 — Gallery content.
//
// Photos are real client-provided venue photographs in public/images/.
// The homepage selection is curated: a representative set of the venue's
// spaces rather than every available image, and none that already carry a
// section of their own (Hero, Venue, Director, Services). Alt text
// describes only what is visibly present in each photograph.
//
// Videos are intentionally empty. Entries may be added only when the client
// supplies real video URLs — never placeholder, stock or invented links.
// Each entry carries a title, a source ("youtube" | "vimeo" | "file"), the
// url (embed URL for youtube/vimeo, direct media file for "file") and an
// optional thumbnail. Appending an entry is all that is needed for the
// section to render it — no component changes required.

export interface GalleryPhoto {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

export type GalleryVideoSource = "youtube" | "vimeo" | "file";

export interface GalleryVideo {
  id: string;
  title: string;
  source: GalleryVideoSource;
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export const gallerySection = {
  eyebrow: "Photos & Videos",
  heading: "Gallery",
  lede: "Browse photographs from across the venue — the entrance, the lawns and the hall — with videos to follow.",
} as const;

export const galleryVideosEmpty = {
  title: "Videos Coming Soon",
  message:
    "A selection of event and venue videos will be added here soon. In the meantime, browse the photographs in the Photos tab.",
} as const;

// Order matters: it is both the reading order on mobile and the lightbox
// order. Keep it as a deliberate sequence — entrance, spaces, lawns.
export const galleryPhotos: readonly GalleryPhoto[] = [
  {
    id: "entrance-pathway",
    src: "/images/16.jpg",
    alt: "Entrance pathway at Shri Sai Vatika at night, lined with yellow drapes and hanging flower decorations, with a red carpet leading towards the canopy",
    width: 1084,
    height: 518,
  },
  {
    id: "facade-night",
    src: "/images/15.jpg",
    alt: "Ornate facade of Shri Sai Vatika illuminated at night, with rows of chairs dressed on the lawn in front",
    width: 636,
    height: 883,
  },
  {
    id: "indoor-stage",
    src: "/images/12.jpg",
    alt: "Indoor stage with a white and gold seat beneath pink blossom garlands, a red carpet and rows of chairs with black bows",
    width: 569,
    height: 987,
  },
  {
    id: "lawn-table",
    src: "/images/09.jpg",
    alt: "Lawn at night with a round table dressed in purple velvet and cream chair covers, and white flowers in the foreground",
    width: 561,
    height: 1002,
  },
  {
    id: "entrance-gate",
    src: "/images/03.jpg",
    alt: "Decorated entrance gate of Shri Sai Vatika at night with pink drapes, hanging flowers and chandeliers",
    width: 919,
    height: 611,
  },
  {
    id: "ceremonial-canopy",
    src: "/images/13.jpg",
    alt: "Ceremonial canopy draped in yellow fabric with a border of yellow flowers and hanging greenery",
    width: 840,
    height: 669,
  },
  {
    id: "banquet-hall",
    src: "/images/17.jpg",
    alt: "Wide view of the banquet hall with rows of chairs, a red carpet aisle and the stage at the far end",
    width: 1120,
    height: 501,
  },
  {
    id: "lawn-night",
    src: "/images/14.jpg",
    alt: "Lawn at night set with tables and chairs before a gold scalloped backdrop and yellow drapes",
    width: 1012,
    height: 555,
  },
];

// Empty by design until real client videos exist — see header comment.
export const galleryVideos: readonly GalleryVideo[] = [];
