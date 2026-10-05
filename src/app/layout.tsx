import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Shri Sai Vatika Banquet Hall | Danapur, Patna",
    template: "%s | Shri Sai Vatika Banquet Hall",
  },
  description:
    "Shri Sai Vatika Banquet Hall, Danapur (Patna) — wedding and event venue with a 3000 sq.ft. AC hall, 8000 sq.ft. lawn, and elegant in-house services. Where Celebrations Become Memories.",
  openGraph: {
    title: "Shri Sai Vatika Banquet Hall",
    description:
      "Premium wedding and event venue in Danapur, Patna. Where Celebrations Become Memories.",
    url: siteUrl,
    siteName: "Shri Sai Vatika Banquet Hall",
    images: [{ url: "/og-image.jpg", width: 1200, height: 800, alt: "Shri Sai Vatika Banquet Hall" }],
    locale: "en_IN",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf3e3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full`}>
      <body id="top" className="min-h-full flex flex-col bg-background text-foreground font-sans antialiased">
        <SiteHeader />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-primary focus:text-surface focus:px-4 focus:py-2 focus:rounded-sm"
        >
          Skip to content
        </a>
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <WhatsAppButton />
      </body>
    </html>
  );
}
