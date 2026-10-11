import { venueHighlights } from "@/content/announcements";

function HighlightList({ duplicate }: { duplicate?: boolean }) {
  return (
    <ul
      className={`flex shrink-0 items-center${duplicate ? " marquee-duplicate" : ""}`}
      {...(duplicate ? { "aria-hidden": true } : {})}
    >
      {venueHighlights.map((item, index) => (
        <li
          key={item}
          className="flex items-center whitespace-nowrap px-5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ivory sm:px-7 sm:text-xs"
        >
          {index > 0 && (
            <span aria-hidden="true" className="mr-5 text-gold-rich sm:mr-7">
              ✦
            </span>
          )}
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function AnnouncementStrip() {
  return (
    <section
      aria-label="Venue highlights"
      className="overflow-hidden border-y border-gold-rich/25 bg-primary"
    >
      <div className="py-4 sm:py-4.5">
        <div className="marquee-track flex w-max items-center">
          <HighlightList />
          <HighlightList duplicate />
        </div>
      </div>
    </section>
  );
}
