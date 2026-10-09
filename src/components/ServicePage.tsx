import Link from "next/link";
import { Check, Phone } from "lucide-react";
import Icon from "@/components/Icon";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { contact, site, serviceAreas } from "@/lib/business";
import { loadPricingAndAddons } from "@/lib/pricingServer";
import { formatGBP, quotePrice, recommendedHours } from "@/lib/pricing";
import { deepConfig, deepPrice, DEEP_EXTRAS } from "@/lib/deepClean";
import { SERVICES, type ServiceSlug } from "@/lib/services";

/**
 * One template for every service page. Prices come from the live pricing
 * config and lib/deepClean, exactly as on the home page, so a rate change in
 * /admin/pricing reaches these pages too — nothing here can advertise a price
 * the business has stopped charging.
 */

// The same four things the home page's "Every room, every visit" lists.
const STANDARD_INCLUDED = [
  { title: "Kitchen", text: "Surfaces, sink and hob cleaned every visit." },
  { title: "Bathrooms", text: "Sink, toilet, bath or shower and visible surfaces cleaned thoroughly." },
  { title: "Hallways & landings", text: "Floors, bannisters and surfaces on the way through — the common areas most cleaners skip." },
  { title: "Floors & finishing touches", text: "Hard floors mopped, carpets vacuumed and bins emptied where needed." },
];

const DEEP_INCLUDED = [
  { title: "Kitchen and oven", text: "The oven is part of every deep clean, never an extra." },
  { title: "Bedroom and bathroom", text: "Top to bottom, not just the visible surfaces." },
  { title: "Living and dining rooms", text: "Included in a deep clean as standard." },
  { title: "Hallways & landings", text: "Floors, bannisters and every surface on the way through." },
];

const EXAMPLE_ROOMS = { bedrooms: 2, bathrooms: 1, diningRooms: 0, livingRooms: 0 };

const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white outline-none transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300";
const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 outline-none transition hover:border-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300";

export default async function ServicePage({ slug }: { slug: ServiceSlug }) {
  const s = SERVICES[slug];
  const isDeep = slug === "deep-cleaning";
  const { cfg, addons } = await loadPricingAndAddons();

  const hours = recommendedHours(EXAMPLE_ROOMS, cfg);
  const regularVisit = quotePrice(hours, true, cfg, "fortnightly");
  const oneOffVisit = quotePrice(hours, true, cfg, "one_off");
  const deepVisit = deepPrice({ ...EXAMPLE_ROOMS, additionalRooms: 0 });

  const price = isDeep
    ? { label: "Deep clean, 2-bed home", amount: deepVisit }
    : slug === "regular-cleaning"
      ? { label: "2-bed home, fortnightly", amount: regularVisit }
      : { label: "2-bed home, one visit", amount: oneOffVisit };

  const url = `${site.url}/${slug}`;
  const included = isDeep ? DEEP_INCLUDED : STANDARD_INCLUDED;
  const extras = isDeep ? DEEP_EXTRAS.map((e) => e.label) : addons.map((a) => a.label);

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${s.name} in Oxford & Oxfordshire`,
      serviceType: s.name,
      url,
      description: s.metaDescription,
      provider: { "@id": `${site.url}/#business` },
      areaServed: [
        { "@type": "AdministrativeArea", name: "Oxfordshire" },
        ...serviceAreas.map((a) => ({ "@type": "City", name: a })),
      ],
      offers: {
        "@type": "Offer",
        name: price.label,
        priceSpecification: { "@type": "PriceSpecification", price: price.amount, priceCurrency: "GBP" },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: s.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: s.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <SiteHeader quoteHref={s.quoteHref} />

      <main className="bg-white">
        {/* breadcrumb */}
        <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-5 pt-6 text-sm text-slate-500 sm:px-8">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-slate-900">
                Home
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-slate-900">
              {s.name}
            </li>
          </ol>
        </nav>

        {/* hero */}
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_20rem] lg:py-16">
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
              {s.h1}
            </h1>
            {s.intro.map((p) => (
              <p key={p} className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                {p}
              </p>
            ))}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={s.quoteHref} className={BTN_PRIMARY}>
                See your price
              </Link>
              <a href={`tel:${contact.phoneHref}`} className={BTN_SECONDARY}>
                <Icon glyph={Phone} className="size-4" />
                {contact.phoneDisplay}
              </a>
            </div>
          </div>
          <aside className="self-start bg-brand-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{price.label}</p>
            <p className="tnum mt-2 text-4xl font-bold text-slate-900">
              <span className="text-lg font-medium text-slate-600">from </span>
              {formatGBP(price.amount)}
            </p>
            {isDeep ? (
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                <li>{formatGBP(deepConfig.basePrice)} covers 1 bed, 1 bath, living, dining, kitchen + oven</li>
                <li>+{formatGBP(deepConfig.additionalRoomPrice)} for each room beyond that</li>
                <li>Two cleaners as standard</li>
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                Your own quote follows your rooms and the hours you choose.
              </p>
            )}
          </aside>
        </section>

        {/* what's included */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
              What&apos;s included
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {included.map((i) => (
                <div key={i.title} className="bg-white p-6">
                  <h3 className="font-semibold text-slate-900">{i.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{i.text}</p>
                </div>
              ))}
            </div>
            {extras.length > 0 && (
              <p className="mt-8 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">Extras you can add: </span>
                {extras.join(", ")}
                {isDeep && ` — ${formatGBP(deepConfig.extraPrice)} each`}.
              </p>
            )}
          </div>
        </section>

        {/* who it's for */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            {isDeep ? "When people book a deep clean" : "Who it suits"}
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {s.goodFor.map((g, i) => (
              <div
                key={g.title}
                // The footer links straight to the end-of-tenancy card.
                id={isDeep && i === 0 ? "end-of-tenancy" : undefined}
                className="flex scroll-mt-20 gap-4"
              >
                <Icon glyph={Check} className="mt-1 size-5 shrink-0 text-brand-600" />
                <div>
                  <h3 className="font-semibold text-slate-900">{g.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{g.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* areas */}
        <section className="bg-brand-950 py-14 text-white">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 className="font-display text-2xl font-bold tracking-tight">Where we clean</h2>
            <p className="mt-3 max-w-2xl text-white/80">
              Any OX postcode — Oxford itself and the towns around it:
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {serviceAreas.map((a) => (
                <li key={a} className="rounded-full border border-white/25 px-4 py-1.5 text-sm">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* faqs */}
        <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">Questions</h2>
          <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
            {s.faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">
                  {f.q}
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* closing cta */}
        <section className="bg-brand-50 py-14 text-center">
          <div className="mx-auto max-w-2xl px-5">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
              See your price in under a minute
            </h2>
            <p className="mt-3 text-slate-600">Pick your rooms, see the price, and we ring to confirm the date.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={s.quoteHref} className={BTN_PRIMARY}>
                Get your quote
              </Link>
              <Link href="/" className={BTN_SECONDARY}>
                Back to home
              </Link>
            </div>
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
