import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Phone } from "lucide-react";
import Icon from "@/components/Icon";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { contact, site } from "@/lib/business";
import { AREAS, areaBySlug } from "@/lib/areas";
import { loadPricingAndAddons } from "@/lib/pricingServer";
import { formatGBP, quotePrice, recommendedHours } from "@/lib/pricing";
import { deepPrice } from "@/lib/deepClean";
import { SERVICES, type ServiceSlug } from "@/lib/services";

/**
 * One page per town SAAFI covers. Prices are the live ones, worked out the
 * same way as the service pages, so a rate change reaches these too.
 */

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return AREAS.map((a) => ({ area: a.slug }));
}

type Props = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = areaBySlug((await params).area);
  if (!a) return {};
  const title = `Cleaners in ${a.name} | House & Deep Cleaning | SAAFI`;
  const description = `Regular, one-off, deep and end of tenancy cleaning in ${a.name} (${a.postcodes.join(", ")}) from a family-run Oxfordshire team. See your price online in a minute.`;
  const url = `/cleaners/${a.slug}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

const ROOMS = { bedrooms: 2, bathrooms: 1, diningRooms: 0, livingRooms: 0 };
const SHOWN: ServiceSlug[] = [
  "regular-cleaning",
  "one-off-cleaning",
  "deep-cleaning",
  "end-of-tenancy-cleaning",
  "airbnb-cleaning",
];

const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white outline-none transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300";
const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 outline-none transition hover:border-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300";

export default async function AreaPage({ params }: Props) {
  const a = areaBySlug((await params).area);
  if (!a) notFound();

  const { cfg } = await loadPricingAndAddons();
  const hours = recommendedHours(ROOMS, cfg);
  const priceFor = (slug: ServiceSlug) => {
    const s = SERVICES[slug];
    return s.kind === "deep"
      ? deepPrice({ ...ROOMS, additionalRooms: 0 })
      : quotePrice(hours, true, cfg, s.priceFrequency ?? "one_off");
  };
  const quoteHref = `/quote?postcode=${a.postcodes[0]}`;
  const url = `${site.url}/cleaners/${a.slug}`;

  const faqs = [
    {
      q: `Do you cover all of ${a.name}?`,
      a: `Yes — ${a.name} and the villages around it, including ${a.nearby.slice(0, 3).join(", ")}. We cover every OX postcode, so if you're in ${a.postcodes.join(" or ")} you're in our area.`,
    },
    {
      q: `How much does a cleaner cost in ${a.name}?`,
      a: `The same as anywhere else we cover — there's no extra charge for ${a.name}. Regular cleans start from ${formatGBP(priceFor("regular-cleaning"))} a visit for a 2-bed home, and a deep clean from ${formatGBP(priceFor("deep-cleaning"))}. The quote form gives your exact price before you book.`,
    },
    {
      q: "Do I need to be home?",
      a: "Only if you'd rather be. We agree how we get in on the confirmation call — a key, a keysafe, or you're there for the first visit.",
    },
  ];

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `House cleaning in ${a.name}`,
      serviceType: "House cleaning",
      url,
      provider: { "@id": `${site.url}/#business` },
      areaServed: { "@type": "City", name: a.name },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: `Cleaners in ${a.name}`, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <SiteHeader quoteHref={quoteHref} />
      <main className="bg-white">
        <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-5 pt-6 text-sm text-slate-500 sm:px-8">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-slate-900">
                Home
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-slate-900">
              Cleaners in {a.name}
            </li>
          </ol>
        </nav>

        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
            Cleaners in {a.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
            House cleaning in {a.name}, {a.where}, from SAAFI — a family-run Oxfordshire team. Regular and one-off
            cleans, deep cleans and end of tenancy cleans, with a clear price before you book.
          </p>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            We cover {a.postcodes.join(" and ")}, including {a.nearby.join(", ")}.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={quoteHref} className={BTN_PRIMARY}>
              See your price
            </Link>
            <a href={`tel:${contact.phoneHref}`} className={BTN_SECONDARY}>
              <Icon glyph={Phone} className="size-4" />
              {contact.phoneDisplay}
            </a>
          </div>
        </section>

        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
              Cleaning services in {a.name}
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SHOWN.map((slug) => {
                const s = SERVICES[slug];
                return (
                  <Link key={slug} href={`/${slug}`} className="group block bg-white p-6 transition hover:shadow-md">
                    <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">{s.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.intro[0]}</p>
                    <p className="tnum mt-4 text-sm text-slate-500">
                      {s.priceLabel}: <span className="font-semibold text-slate-900">from {formatGBP(priceFor(slug))}</span>
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            Why {a.name} households book SAAFI
          </h2>
          <ul className="mt-6 grid gap-4 text-[15px] leading-relaxed text-slate-600 sm:grid-cols-2">
            {[
              "A family-run local team based in Oxfordshire.",
              "Your price is shown online before you book — nothing added afterwards without asking you first.",
              "For regular cleans we keep you with the same cleaner wherever we can.",
              "We bring the products, or use yours — you choose when you book.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Icon glyph={Check} className="mt-1 size-4 shrink-0 text-brand-600" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">Questions</h2>
          <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
            {faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">{f.q}</summary>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-brand-950 py-14 text-white">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 className="font-display text-2xl font-bold tracking-tight">We also clean in</h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              <li>
                <Link href="/" className="inline-block rounded-full border border-white/25 px-4 py-1.5 text-sm hover:bg-white/10">
                  Oxford
                </Link>
              </li>
              {AREAS.filter((x) => x.slug !== a.slug).map((x) => (
                <li key={x.slug}>
                  <Link
                    href={`/cleaners/${x.slug}`}
                    className="inline-block rounded-full border border-white/25 px-4 py-1.5 text-sm hover:bg-white/10"
                  >
                    {x.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </main>
      <SiteFooter />
    </>
  );
}
