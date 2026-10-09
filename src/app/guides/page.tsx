import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { publishedGuides, formatGuideDate } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Home Cleaning Guides, Oxford | SAAFI Cleaning",
  description:
    "Straight answers on home cleaning in Oxford and Oxfordshire — what it costs, how often to book, and what a deep or end of tenancy clean involves.",
  alternates: { canonical: "/guides" },
};

// Hourly, so a guide scheduled for today appears without a deploy.
export const revalidate = 3600;

export default function GuidesIndex() {
  const guides = publishedGuides();
  return (
    <>
      <SiteHeader />
      <main className="bg-white">
        <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-20">
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Home cleaning guides
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Straight answers for homes in Oxford and Oxfordshire, with our real prices.
          </p>
          <ul className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
            {guides.map(({ meta }) => (
              <li key={meta.slug} className="py-6">
                <Link href={`/guides/${meta.slug}`} className="group block">
                  <h2 className="font-display text-xl font-bold text-slate-900 group-hover:text-brand-700">
                    {meta.title}
                  </h2>
                  <p className="mt-2 text-slate-600">{meta.description}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {formatGuideDate(meta.date)} · {meta.readMins} min read
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
