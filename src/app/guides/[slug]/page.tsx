import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Prose, GuideCta } from "@/components/guides/GuideParts";
import { site } from "@/lib/business";
import { loadPricingAndAddons } from "@/lib/pricingServer";
import { guidePrices } from "@/lib/guidePrices";
import { allGuides, guideBySlug, isPublished, formatGuideDate, publishedGuides } from "@/lib/guides";

// Hourly: picks up rate changes, and flips a scheduled guide live on its date.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return allGuides().map((g) => ({ slug: g.meta.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) return {};
  const { meta } = g;
  return {
    title: meta.metaTitle,
    description: meta.description,
    alternates: { canonical: `/guides/${meta.slug}` },
    openGraph: { type: "article", title: meta.title, description: meta.description, url: `/guides/${meta.slug}` },
    // A scheduled guide is reachable by its URL (that is the preview) but
    // must not be indexed before its date.
    ...(isPublished(meta) ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) notFound();
  const { meta, Body } = g;
  const live = isPublished(meta);
  const { cfg } = await loadPricingAndAddons();
  const p = guidePrices(cfg);
  const url = `${site.url}/guides/${meta.slug}`;
  const more = publishedGuides().filter((o) => o.meta.slug !== meta.slug).slice(0, 3);

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: meta.title,
      description: meta.description,
      datePublished: meta.date,
      url,
      mainEntityOfPage: url,
      author: { "@id": `${site.url}/#business` },
      publisher: { "@id": `${site.url}/#business` },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${site.url}/guides` },
        { "@type": "ListItem", position: 3, name: meta.title, item: url },
      ],
    },
  ];

  return (
    <>
      <SiteHeader quoteHref={meta.cta.href} />
      <main className="bg-white">
        {!live && (
          <div className="bg-amber-100 px-5 py-3 text-center text-sm font-semibold text-amber-900">
            Preview — scheduled to go live on {formatGuideDate(meta.date)}. Not visible to Google yet.
          </div>
        )}
        <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8 lg:py-16">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-slate-900">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">›</li>
              <li>
                <Link href="/guides" className="hover:text-slate-900">
                  Guides
                </Link>
              </li>
            </ol>
          </nav>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
            {meta.title}
          </h1>
          <p className="mt-4 text-sm text-slate-500">
            {formatGuideDate(meta.date)} · {meta.readMins} min read · SAAFI Cleaning Service
          </p>
          <div className="mt-8">
            <Prose>
              <Body p={p} />
            </Prose>
          </div>
          <GuideCta href={meta.cta.href} text={meta.cta.text} />

          {more.length > 0 && (
            <aside className="mt-14 border-t border-slate-200 pt-8">
              <h2 className="font-display text-xl font-bold text-slate-900">More guides</h2>
              <ul className="mt-4 space-y-3">
                {more.map((o) => (
                  <li key={o.meta.slug}>
                    <Link href={`/guides/${o.meta.slug}`} className="font-medium text-brand-700 underline underline-offset-4">
                      {o.meta.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </article>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </main>
      <SiteFooter />
    </>
  );
}
