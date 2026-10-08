"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { motion, MotionConfig } from "motion/react";
import { galleryCategories } from "@/content/navigation";
import {
  galleryPhotos,
  gallerySection,
  galleryVideos,
  galleryVideosEmpty,
} from "@/content/gallery";
import GalleryLightbox, { type LightboxItem } from "./GalleryLightbox";

interface PhotoLayout {
  span: string;
  aspect: string;
  sizes: string;
}

// Editorial grid: spans are keyed by photo id so content order can change
// without breaking the composition. Rows pair images of similar proportions
// (same span + same aspect), which keeps row heights even with only a light
// object-cover crop. An unknown id falls back to a full-width cell using the
// photo's natural aspect, so newly appended photos render without redesign.
const photoLayouts: Record<string, PhotoLayout> = {
  "entrance-pathway": {
    span: "col-span-2 md:col-span-6",
    aspect: "aspect-[1084/518]",
    sizes: "(min-width: 1152px) 1105px, (min-width: 1024px) 980px, 100vw",
  },
  "facade-night": {
    span: "col-span-1 md:col-span-2",
    aspect: "aspect-[2/3]",
    sizes: "(min-width: 1024px) 360px, (min-width: 768px) 34vw, 47vw",
  },
  "indoor-stage": {
    span: "col-span-1 md:col-span-2",
    aspect: "aspect-[2/3]",
    sizes: "(min-width: 1024px) 360px, (min-width: 768px) 34vw, 47vw",
  },
  "lawn-table": {
    span: "col-span-2 md:col-span-2",
    aspect: "aspect-[2/3]",
    sizes: "(min-width: 1024px) 360px, (min-width: 768px) 34vw, 100vw",
  },
  "entrance-gate": {
    span: "col-span-2 md:col-span-3",
    aspect: "aspect-[7/5]",
    sizes: "(min-width: 1024px) 555px, (min-width: 768px) 52vw, 100vw",
  },
  "ceremonial-canopy": {
    span: "col-span-2 md:col-span-3",
    aspect: "aspect-[7/5]",
    sizes: "(min-width: 1024px) 555px, (min-width: 768px) 52vw, 100vw",
  },
  "banquet-hall": {
    span: "col-span-2 md:col-span-6",
    aspect: "aspect-[1120/501]",
    sizes: "(min-width: 1152px) 1105px, (min-width: 1024px) 980px, 100vw",
  },
  "lawn-night": {
    span: "col-span-2 md:col-span-6",
    aspect: "aspect-[1012/555]",
    sizes: "(min-width: 1152px) 1105px, (min-width: 1024px) 980px, 100vw",
  },
};

const fallbackLayout: PhotoLayout = {
  span: "col-span-2 md:col-span-6",
  aspect: "",
  sizes: "(min-width: 1152px) 1105px, (min-width: 1024px) 980px, 100vw",
};

// Parallel to galleryCategories (["Photos", "Videos"]); ids stay readable.
const TAB_KEYS = ["photos", "videos"] as const;

interface ViewerState {
  collection: "photos" | "videos";
  index: number;
}

export default function Gallery() {
  const [activeTab, setActiveTab] = useState(0);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const photoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const videoTriggerRef = useRef<HTMLButtonElement | null>(null);

  const photoItems: LightboxItem[] = galleryPhotos.map((photo) => ({
    type: "photo",
    photo,
  }));
  const videoItems: LightboxItem[] = galleryVideos.map((video) => ({
    type: "video",
    video,
  }));

  const selectTab = (next: number, moveFocus?: boolean) => {
    setActiveTab(next);
    if (moveFocus) tabRefs.current[next]?.focus();
  };

  const handleTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = galleryCategories.length;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (activeTab + 1) % count;
    else if (event.key === "ArrowLeft") next = (activeTab - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next === null) return;
    event.preventDefault();
    selectTab(next, true);
  };

  const openPhoto = (index: number, trigger: HTMLButtonElement) => {
    photoTriggerRef.current = trigger;
    setViewer({ collection: "photos", index });
  };

  const openVideo = (index: number, trigger: HTMLButtonElement) => {
    videoTriggerRef.current = trigger;
    setViewer({ collection: "videos", index });
  };

  const closeViewer = () => {
    const trigger =
      viewer?.collection === "videos"
        ? videoTriggerRef.current
        : photoTriggerRef.current;
    setViewer(null);
    // The dialog unmounts on the next render; move focus back to the tile
    // that opened it so keyboard position is never lost.
    trigger?.focus();
  };

  return (
    <MotionConfig reducedMotion="user">
      <section id="gallery" className="bg-surface" aria-labelledby="gallery-heading">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">{gallerySection.eyebrow}</p>
              <h2
                id="gallery-heading"
                className="font-display text-section mt-4 text-primary-deep"
              >
                {gallerySection.heading}
              </h2>
              <p className="text-body mt-4 text-muted-foreground">
                {gallerySection.lede}
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Gallery categories"
              className="flex gap-6 border-b border-border"
              onKeyDown={handleTabListKeyDown}
            >
              {galleryCategories.map((label, index) => (
                <button
                  key={label}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`gallery-tab-${TAB_KEYS[index]}`}
                  aria-selected={activeTab === index}
                  aria-controls={`gallery-panel-${TAB_KEYS[index]}`}
                  tabIndex={activeTab === index ? 0 : -1}
                  onClick={() => selectTab(index)}
                  className={`-mb-px border-b-2 pb-3 font-display text-lg transition-colors duration-200 ${
                    activeTab === index
                      ? "border-primary text-primary-deep"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div
            role="tabpanel"
            id="gallery-panel-photos"
            aria-labelledby="gallery-tab-photos"
            hidden={activeTab !== 0}
          >
            <div className="mt-10 grid grid-cols-2 gap-3 md:mt-12 md:grid-cols-6 md:gap-4">
              {galleryPhotos.map((photo, index) => {
                const layout = photoLayouts[photo.id] ?? fallbackLayout;
                return (
                  <motion.button
                    key={photo.id}
                    type="button"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    onClick={(event) => openPhoto(index, event.currentTarget)}
                    className={`group relative block overflow-hidden bg-background ${layout.span} ${layout.aspect}`}
                    style={
                      layout.aspect
                        ? undefined
                        : { aspectRatio: `${photo.width} / ${photo.height}` }
                    }
                  >
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      width={photo.width}
                      height={photo.height}
                      sizes={layout.sizes}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.05]"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-primary-deep/0 transition-colors duration-300 group-hover:bg-primary-deep/10"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary-deep/75 text-ivory opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Videos — structure complete, content empty until real videos exist */}
          <div
            role="tabpanel"
            id="gallery-panel-videos"
            aria-labelledby="gallery-tab-videos"
            hidden={activeTab !== 1}
            tabIndex={0}
            className="mt-10 md:mt-12"
          >
            {galleryVideos.length === 0 ? (
              <div className="mx-auto flex min-h-[18rem] max-w-3xl flex-col items-center justify-center border border-gold-muted/60 bg-background px-6 py-14 text-center md:min-h-[24rem] md:px-12">
                <span
                  aria-hidden="true"
                  className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/60 text-gold"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="currentColor"
                  >
                    <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
                  </svg>
                </span>
                <h3 className="font-display mt-6 text-2xl text-primary-deep">
                  {galleryVideosEmpty.title}
                </h3>
                <p className="text-body mt-3 max-w-md text-muted-foreground">
                  {galleryVideosEmpty.message}
                </p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {galleryVideos.map((video, index) => (
                  <motion.button
                    key={video.id}
                    type="button"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    onClick={(event) => openVideo(index, event.currentTarget)}
                    className="group block text-left"
                  >
                    <div className="relative aspect-video overflow-hidden bg-primary-deep">
                      {video.thumbnail ? (
                        <Image
                          src={video.thumbnail}
                          alt=""
                          width={640}
                          height={360}
                          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.05]"
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-ivory/70 bg-black/45 text-ivory transition-colors duration-200 group-hover:bg-black/70">
                          <svg
                            viewBox="0 0 24 24"
                            className="ml-0.5 h-6 w-6"
                            fill="currentColor"
                          >
                            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
                          </svg>
                        </span>
                      </span>
                    </div>
                    <p className="font-display mt-3 text-lg text-primary-deep transition-colors duration-200 group-hover:text-primary">
                      {video.title}
                    </p>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {viewer && (
          <GalleryLightbox
            items={viewer.collection === "photos" ? photoItems : videoItems}
            index={viewer.index}
            onIndexChange={(index) =>
              setViewer((current) =>
                current ? { ...current, index } : current,
              )
            }
            onClose={closeViewer}
          />
        )}
      </section>
    </MotionConfig>
  );
}
