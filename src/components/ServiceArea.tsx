import Link from "next/link";
import { contact, serviceAreas as fallbackAreas } from "@/lib/business";

// A quiet band above the closing CTA. It exists because someone two hundred
// miles away can currently complete an entire quote — `service_areas` is empty
// in Supabase, so lib/pricing.ts treats every UK postcode as coverable.
//
// `areas` comes from the live table when it has rows, and only falls back to
// the placeholder list in lib/business.ts when it does not. Filling that table
// therefore fixes both the page and the postcode check in one move, and this
// component needs no edit when it happens.

export default function ServiceArea({ areas }: { areas: string[] }) {
  const list = areas.length > 0 ? areas : fallbackAreas;
  const fromDb = areas.length > 0;

  if (list.length === 0) return null;

  return (
    <section id="areas" className="scroll-mt-20 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="lg:col-span-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Where we clean
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
            Not on the list? Give us a ring on{" "}
            <a
              href={`tel:${contact.phoneHref}`}
              className="font-semibold text-brand-700 underline decoration-brand-300 hover:decoration-brand-700"
            >
              {contact.phoneDisplay}
            </a>{" "}
            — we cover more than we can fit here and we are adding areas all the
            time.
          </p>
        </div>

        <div className="lg:col-span-8">
          <ul className="flex flex-wrap gap-2">
            {list.map((a) => (
              <li
                key={a}
                className="border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-semibold tabular-nums text-slate-700"
              >
                {a}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-slate-500">
            {fromDb ? (
              <>
                Put your postcode into{" "}
                <Link
                  href="/quote"
                  className="font-medium text-brand-700 underline decoration-brand-300 hover:decoration-brand-700"
                >
                  the quote form
                </Link>{" "}
                and it will tell you straight away.
              </>
            ) : (
              <>
                Placeholder districts — the live coverage list is still empty in
                the database, so the quote form currently accepts any UK
                postcode.
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
