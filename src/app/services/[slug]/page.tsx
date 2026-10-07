import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { services, getServiceBySlug } from "@/content/services";
import { site } from "@/content/site";
import { whatsappUrl } from "@/lib/whatsapp";

export async function generateStaticParams() {
  return services.map((service) => ({
    slug: service.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) return {};

  return {
    title: service.title,
    description: `${service.tagline}. ${service.title} at ${site.name}, Danapur, Patna.`,
    openGraph: {
      title: `${service.title} | ${site.name}`,
      description: service.tagline,
      images: [{ url: service.image, alt: service.imageAlt }],
    },
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const enquiryMessage = `Namaste, I would like to enquire about the ${service.title} service at ${site.name}. Please share details.`;

  return (
    <article className="bg-background">
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 pt-24 pb-10 sm:px-6 md:pt-32 md:pb-14">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-2 text-small text-muted-foreground">
              <li>
                <Link href="/" className="transition-colors hover:text-primary">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/#services" className="transition-colors hover:text-primary">
                  Services
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-primary" aria-current="page">
                {service.title}
              </li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <p className="eyebrow">Services</p>
            <h1 className="font-display text-section mt-4 text-primary-deep">
              {service.title}
            </h1>
            <p className="text-body mt-4 text-muted-foreground">
              {service.description}
            </p>
          </div>
        </div>
      </section>

      {/* Image + Details */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 md:pb-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-start md:gap-14">
          <figure>
            <Image
              src={service.image}
              alt={service.imageAlt}
              width={1200}
              height={900}
              sizes="(max-width: 767px) 100vw, 50vw"
              className="h-auto w-full"
              priority
            />
          </figure>

          <div>
            <h2 className="font-display text-xl text-primary-deep">
              What this service offers
            </h2>
            <ul className="mt-5 space-y-4">
              {service.details.map((detail) => (
                <li key={detail} className="flex items-start gap-3 text-body leading-relaxed text-foreground">
                  <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {detail}
                </li>
              ))}
            </ul>

            {service.price ? (
              <div className="mt-10 border-t border-border pt-6">
                <p className="text-small font-semibold uppercase tracking-wider text-muted-foreground">
                  Pricing
                </p>
                <p className="font-display mt-2 text-2xl text-primary-deep">
                  {service.price}
                </p>
                {service.priceNote && (
                  <p className="text-small mt-2 text-muted-foreground">
                    {service.priceNote}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-10 border-t border-border pt-6">
                <p className="text-small font-semibold uppercase tracking-wider text-muted-foreground">
                  Enquire for details
                </p>
                <p className="text-body mt-2 text-muted-foreground">
                  Plan your celebration with us — reach out and we will be
                  happy to discuss how this service can be arranged for your
                  occasion.
                </p>
              </div>
            )}

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                href={whatsappUrl(enquiryMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-text inline-flex items-center justify-center bg-primary px-7 py-4 text-surface transition-colors hover:bg-primary-deep"
              >
                Enquire on WhatsApp
              </a>
              <Link
                href="/#book-a-visit"
                className="btn-text inline-flex items-center justify-center border border-primary px-7 py-4 text-primary transition-colors hover:bg-primary hover:text-surface"
              >
                Book a Visit
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Other services */}
      <section className="border-t border-border bg-surface" aria-labelledby="other-services-heading">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
          <h2 id="other-services-heading" className="font-display text-xl text-primary-deep">
            Explore other services
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services
              .filter((s) => s.slug !== service.slug)
              .map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="group flex items-center justify-between border border-border bg-background px-5 py-4 transition-colors hover:border-gold"
                  >
                    <span className="font-display text-lg text-primary-deep group-hover:text-primary">
                      {s.title}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </section>
    </article>
  );
}
