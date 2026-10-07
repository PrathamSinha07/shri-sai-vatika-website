import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { services } from "@/content/services";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Services",
  description: `Wedding and celebration services at ${site.name}, Danapur, Patna — catering, decoration, entertainment, and more.`,
};

export default function ServicesIndexPage() {
  return (
    <div className="bg-background">
      <section className="mx-auto max-w-6xl px-4 pt-24 pb-14 sm:px-6 md:pt-32 md:pb-20">
        <div className="max-w-2xl">
          <p className="eyebrow">Services</p>
          <h1 className="font-display text-section mt-4 text-primary-deep">
            Everything your celebration needs
          </h1>
          <p className="text-body mt-4 text-muted-foreground">
            From catering to the band baja baraat, each element of your
            celebration is thoughtfully arranged at {site.name}.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.slug}
              href={`/services/${service.slug}`}
              className="group block"
              aria-label={`Learn more about ${service.title}`}
            >
              <div className="relative overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.imageAlt}
                  width={600}
                  height={450}
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-primary-deep/0 transition-colors duration-300 group-hover:bg-primary-deep/10"
                />
              </div>
              <h2 className="font-display mt-4 text-xl text-primary-deep transition-colors group-hover:text-primary">
                {service.title}
              </h2>
              <p className="text-body mt-1 text-muted-foreground">
                {service.tagline}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
