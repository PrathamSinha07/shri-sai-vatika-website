"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type TouchEvent as ReactTouchEvent,
} from "react";
import Image from "next/image";
import type { GalleryPhoto, GalleryVideo } from "@/content/gallery";

export type LightboxItem =
  | { type: "photo"; photo: GalleryPhoto }
  | { type: "video"; video: GalleryVideo };

interface GalleryLightboxProps {
  items: LightboxItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), iframe, video[controls], [tabindex]:not([tabindex="-1"])';

// Hand-built lightbox: no dependency beyond next/image. Escape and the arrow
// keys drive it, focus is trapped inside the dialog while open, and the
// trigger element receives focus again when it closes. The video branch stays
// data-driven so real client videos render here without redesign.
export default function GalleryLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: GalleryLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const total = items.length;
  const item: LightboxItem | undefined = items[index];
  const noun = item?.type === "video" ? "video" : "photo";

  const goPrev = useCallback(() => {
    if (total > 0) onIndexChange((index - 1 + total) % total);
  }, [index, total, onIndexChange]);

  const goNext = useCallback(() => {
    if (total > 0) onIndexChange((index + 1) % total);
  }, [index, total, onIndexChange]);

  // Lock background scroll and start with focus inside the dialog.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Escape closes, arrows navigate, Tab cycles within the dialog.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && focusable.includes(active);

      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goPrev, goNext]);

  // Swiping left/right moves between items on touch devices.
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (event: ReactTouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };
  const handleTouchEnd = (event: ReactTouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const delta = event.changedTouches[0].clientX - start;
    if (Math.abs(delta) < 48) return;
    if (delta > 0) goPrev();
    else goNext();
  };

  if (!item) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${noun === "photo" ? "Photo" : "Video"} viewer`}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-primary-deep/95 p-3 sm:p-6"
      onClick={(event) => {
        // Clicks on the backdrop (this element, not its contents) dismiss.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <p
        aria-live="polite"
        className="absolute left-4 top-4 text-small font-semibold tabular-nums text-ivory/80 sm:left-6 sm:top-6"
      >
        {index + 1} / {total}
      </p>

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close viewer"
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-gold-muted/40 bg-black/40 text-ivory transition-colors hover:bg-black/70 sm:right-5 sm:top-5 sm:h-12 sm:w-12"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label={`Previous ${noun}`}
            className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-gold-muted/40 bg-black/40 text-ivory transition-colors hover:bg-black/70 sm:left-4 sm:h-14 sm:w-14"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label={`Next ${noun}`}
            className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-gold-muted/40 bg-black/40 text-ivory transition-colors hover:bg-black/70 sm:right-4 sm:h-14 sm:w-14"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <figure
        className="flex w-full max-w-5xl flex-col items-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative h-[60vh] w-full sm:h-[70vh]">
          {item.type === "photo" ? (
            <Image
              src={item.photo.src}
              alt={item.photo.alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
          ) : item.video.source === "file" ? (
            <video
              src={item.video.url}
              poster={item.video.thumbnail}
              controls
              playsInline
              className="h-full w-full bg-black object-contain"
            />
          ) : (
            <iframe
              src={item.video.url}
              title={item.video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full border-0 bg-black"
            />
          )}
        </div>
        <figcaption className="mt-4 max-w-3xl px-12 text-center text-small leading-snug text-ivory/75">
          {item.type === "photo" ? item.photo.alt : item.video.title}
        </figcaption>
      </figure>
    </div>
  );
}
