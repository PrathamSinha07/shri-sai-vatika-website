// Official service categories as supplied by the client.
// Each service has a dedicated page at /services/[slug].
// Content is based ONLY on client-provided information — no invented
// pricing, inclusions, or claims. Where the client has not supplied
// pricing, the page directs visitors to enquire rather than showing a figure.

export interface Service {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  image: string;
  imageAlt: string;
  details: string[];
  price?: string;
  priceNote?: string;
}

export const services: readonly Service[] = [
  {
    slug: "catering",
    title: "Catering",
    tagline: "Food that brings everyone together",
    description:
      "Catering is at the heart of every celebration at Shri Sai Vatika. From intimate family gatherings to grand weddings, the food served becomes a memory in itself — prepared with care, presented with warmth, and planned around the people it brings together.",
    image: "/images/07.jpg",
    imageAlt: "Catering buffet counter at Shri Sai Vatika with illuminated front panel and chafing dishes",
    details: [
      "In-house catering for weddings, receptions, and family celebrations of every size",
      "Per-plate catering options, planned around your guest count and menu",
      "Deluxe and Royal catering choices to suit the occasion you are hosting",
      "Food stall facility for guests, adding variety and delight to the spread",
      "Dishes prepared with care and presented with warmth, so the meal becomes a memory in itself",
    ],
    price: "₹849/person",
    priceNote: "Deluxe Catering per-plate rate. Royal Catering also available at ₹1,099/person.",
  },
  {
    slug: "flowering-lighting",
    title: "Flowering & Lighting",
    tagline: "Spaces transformed by flowers and light",
    description:
      "The art of decoration at Shri Sai Vatika lies in understanding that flowers and lighting do more than adorn — they set the mood, define the space, and create the atmosphere your celebration deserves. Every arrangement is composed to suit the occasion, the setting, and the people it welcomes.",
    image: "/images/08.jpg",
    imageAlt: "Elaborate floral stage decoration with golden arch and white sofa at Shri Sai Vatika",
    details: [
      "Stage decoration with fresh floral arrangements, designed for weddings and ceremonies",
      "Gate and passage decoration that gives every guest a warm and memorable welcome",
      "Ambient lighting design for both indoor halls and open outdoor lawn settings",
      "Decor composed to set the mood and define the space, not merely to fill it",
      "A coordinated approach, so flowers and light work together across the entire venue",
    ],
  },
  {
    slug: "entertainment",
    title: "Entertainment",
    tagline: "Moments that keep the celebration alive",
    description:
      "A celebration is remembered for its energy — the music, the laughter, the moments that bring guests together. Shri Sai Vatika provides the setting and support for entertainment that suits your occasion, so the atmosphere stays alive and joyful from beginning to end.",
    image: "/images/Entertainment.jpg",
    imageAlt: "Professional DJ stage with LED screen, truss lighting, speakers, and dance floor at Shri Sai Vatika",
    details: [
      "Open-air and covered performance spaces for music and live acts",
      "Sound and stage support for live performances and celebrations",
      "Flexible arrangements that adapt to different event formats and performances",
      "A venue setting designed to keep guests engaged and the energy high",
      "Support throughout, so the entertainment flows naturally with the rest of the celebration",
    ],
  },
  {
    slug: "video-photography",
    title: "Video & Photography",
    tagline: "Every moment, preserved",
    description:
      "Your celebration happens once — but the memories last forever. Shri Sai Vatika's photogenic spaces, from the fountain lawn to the decorated stage, provide stunning backdrops for photography and videography, so every moment is preserved exactly as it felt.",
    image: "/images/video_photography.jpg",
    imageAlt:
      "Camera on a tripod filming a bride and groom during their wedding ceremony",
    details: [
      "Picturesque venue spaces that serve as natural backdrops for photography",
      "The fountain lawn, decorated stage, and entrance corridor, each with its own character",
      "Flexible access for professional photography and videography teams",
      "Settings composed to frame the couple, the family, and the celebration",
      "Spaces that help photographers and videographers capture the occasion as it truly unfolded",
    ],
  },
  {
    slug: "bride-groom-entry",
    title: "Bride & Groom Entry",
    tagline: "An entrance worthy of the moment",
    description:
      "The entry of the bride and groom is one of the most anticipated moments of any wedding. At Shri Sai Vatika, the entrance is designed to make that moment unforgettable — from the decorated pathway to the welcoming atmosphere that greets the couple and their guests.",
    image: "/images/Entry.jpg",
    imageAlt:
      "Bride and groom making a grand entry through a haze of dry ice and cold pyro sparks",
    details: [
      "A decorated entrance pathway laid with a red carpet for the couple's arrival",
      "Floral and fabric decorations along the entry route, composed for the occasion",
      "A dedicated passage that gives the bride and groom a grand and memorable entry",
      "A welcoming atmosphere that sets the tone for the celebration ahead",
      "An entrance designed so the moment feels cinematic, and truly their own",
    ],
  },
  {
    slug: "band-baja-baraat",
    title: "Band Baja Baraat",
    tagline: "The grand procession, celebrated in style",
    description:
      "The baraat is a celebration in itself — music, dancing, and joy that fills the streets before the ceremony even begins. Shri Sai Vatika welcomes baraats with the grandeur they deserve, providing the space and support the procession needs to arrive in style.",
    image: "/images/Baraat.jpg",
    imageAlt:
      "Groom in a cream sherwani dancing with baraatis during a night baraat procession",
    details: [
      "A grand entrance gate that gives the baraat a fitting and memorable arrival",
      "A 30-piece baraat welcome mala for the groom, arranged with tradition and care",
      "Open lawn space for the baraat to gather, dance, and celebrate together",
      "Room for the procession to unfold with the energy and grandeur it deserves",
      "A welcome that honours the joy and tradition of the baraat",
    ],
  },
  {
    slug: "jaimala-stages",
    title: "Jaimala Stages",
    tagline: "A stage for the sacred exchange",
    description:
      "The jaimala ceremony marks the beautiful beginning of a new journey together. Shri Sai Vatika's stages are designed to honour this moment — elegant, dignified, and worthy of the occasion — so the exchange feels as significant as it truly is.",
    image: "/images/jaimala.jpg",
    imageAlt:
      "Bride and groom standing beneath a white floral canopy scattered with rose petals",
    details: [
      "Elegant stage setups composed specifically for jaimala ceremonies",
      "Golden arch and floral garland decorations that frame the couple beautifully",
      "Seating arrangements for family and guests gathered around the ceremony",
      "A dignified setting that honours the sacredness of the exchange",
      "A stage designed so the first moment of the journey together feels unforgettable",
    ],
  },
] as const;

export type ServiceSlug = (typeof services)[number]["slug"];

export function getServiceBySlug(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}
