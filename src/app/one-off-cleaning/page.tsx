import type { Metadata } from "next";
import ServicePage from "@/components/ServicePage";
import { SERVICES } from "@/lib/services";

const s = SERVICES["one-off-cleaning"];

export const metadata: Metadata = {
  title: s.metaTitle,
  description: s.metaDescription,
  alternates: { canonical: "/one-off-cleaning" },
  openGraph: { title: s.metaTitle, description: s.metaDescription, url: "/one-off-cleaning" },
};

// Prices come from the live config; same freshness as the home page.
export const revalidate = 300;

export default function Page() {
  return <ServicePage slug="one-off-cleaning" />;
}