import type { Metadata } from "next";
import ServicePage from "@/components/ServicePage";
import { SERVICES } from "@/lib/services";

const s = SERVICES["regular-cleaning"];

export const metadata: Metadata = {
  title: s.metaTitle,
  description: s.metaDescription,
  alternates: { canonical: "/regular-cleaning" },
  openGraph: { title: s.metaTitle, description: s.metaDescription, url: "/regular-cleaning" },
};

// Prices come from the live config; same freshness as the home page.
export const revalidate = 300;

export default function Page() {
  return <ServicePage slug="regular-cleaning" />;
}