import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { site } from "@/lib/business";

/**
 * Self-hosted so the site never depends on a third-party font host at render
 * time. Both faces are Fontshare (ITF Free Font License, commercial use OK).
 */
const generalSans = localFont({
  src: [
    { path: "./fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/GeneralSans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

const cabinetGrotesk = localFont({
  src: [
    { path: "./fonts/CabinetGrotesk-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/CabinetGrotesk-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  // metadataBase is what lets the generated OG image resolve to an absolute
  // URL. Without it, shares render as a grey box — which matters more than
  // usual here, because this business shares its own link over WhatsApp.
  metadataBase: new URL(site.url),
  title: "SAAFI Cleaning Service — book your home clean",
  description:
    "Family-run cleaning service. Get an instant quote and book your home clean in minutes.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "en_GB",
    url: site.url,
    title: "SAAFI Cleaning Service — home cleaning with a price you see before you book",
    description:
      "Family-run home cleaning. See your price online in under a minute — clear per-visit prices, no hidden extras, nothing to pay upfront.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${generalSans.variable} ${cabinetGrotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
