import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import Icon from "./Icon";
import { contact, serviceAreas as fallbackAreas } from "@/lib/business";

// A band above the closing CTA. It exists because someone two hundred miles
// away can currently complete an entire quote — `service_areas` is empty in
// Supabase, so lib/pricing.ts treats every UK postcode as coverable.
//
// `areas` comes from the live table when it has rows, and only falls back to
// the placeholder list in lib/business.ts when it does not. Filling that table
// fixes both the page and the postcode check in one move, with no edit here.
//
// The background linework is abstract on purpose. A real map of the coverage
// area would be a factual claim drawn at a scale nobody could verify, and the
// districts are still unconfirmed — so it reads as cartography without
// asserting any geography.

/** Faint contour linework. Concentric, irregular, and deliberately of nowhere. */
function Contours() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 900 400"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
      fill="none"
      stroke="#14807b"
      strokeOpacity="0.09"
      strokeWidth="1"
    >
      <path d="M-40 300c120-70 210 20 330-30s180-140 320-120 250 90 330 60" />
      <path d="M-40 340c130-72 215 22 340-30s185-142 330-122 245 92 320 62" />
      <path d="M-40 260c110-68 205 18 320-32s175-138 310-118 255 88 340 58" />
      <path d="M-40 120c100-54 190 14 300-26s170-104 300-88 235 66 320 44" />
      <path d="M-40 80c95-52 185 12 295-28s168-102 296-86 238 64 329 42" />
      <circle cx="250" cy="196" r="3" fill="#14807b" fillOpacity="0.18" stroke="none" />
      <circle cx="612" cy="132" r="3" fill="#14807b" fillOpacity="0.18" stroke="none" />
    </svg>
  );
}

export default function ServiceArea({ areas }: { areas: string[] }) {
  const list = areas.length > 0 ? areas : fallbackAreas;
  const fromDb = areas.length > 0;

  if (list.length === 0) return null;

  return (
    <section
      id="areas"
      className="relative isolate scroll-mt-20 overflow-hidden border-t border-brand-100 bg-brand-50/60"
    >
      <Contours />

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:py-24">
        <div className="lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
            Local by design
          </p>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Where we clean
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-slate-600">
            Not on the list? Give us a ring on{" "}
            <a
              href={`tel:${contact.phoneHref}`}
              className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-700"
            >
              {contact.phoneDisplay}
            </a>{" "}
            — we cover more than we can fit here and we are adding areas all the
            time.
          </p>
        </div>

        {/* Set as a typographic run rather than a row of pills: these are places
            we go, not filters you toggle. */}
        <div className="lg:col-span-8">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-4 sm:gap-x-4">
            {list.map((a, i) => (
              <li key={a} className="flex items-center gap-3 sm:gap-4">
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className="size-1 rounded-full bg-brand-400"
                  />
                )}
                <span className="font-display text-xl font-bold tabular-nums tracking-tight text-slate-800 sm:text-2xl">
                  {a}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-brand-200 pt-6">
            <Link
              href="/quote"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:text-brand-900"
            >
              <Icon glyph={MapPin} className="size-4" />
              Check my postcode
              <Icon
                glyph={ArrowRight}
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={2.2}
              />
            </Link>

            {!fromDb && (
              <p className="text-sm text-slate-500">
                Placeholder districts — the live coverage list is still empty in
                the database, so the quote form currently accepts any UK
                postcode.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
