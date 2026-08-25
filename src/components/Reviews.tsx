import { reviews } from "@/lib/business";
import PlaceholderNote from "./PlaceholderNote";

// The one thing the page could not do for itself: let somebody other than
// SAAFI speak. Everything else on the site is SAAFI's own account of SAAFI.
//
// Renders nothing at all when the array is empty, so shipping without reviews
// is a safe default rather than a broken layout — emptying lib/business.ts is
// always a valid way to launch.
//
// Deep teal rather than the slate used by the trust block: this is the only
// other dark band on the page and it should not read as a repeat of it.
//
// Composition is deliberately uneven — one quote given real size, the other two
// kept deliberately quiet beside it. Three matched quotes is the layout that
// makes testimonials look bought, and the hierarchy is doing the arguing here.
//
// No rating, no star row, no "verified" badge: there is no review platform
// behind this and inventing the furniture of one would be the dishonest part,
// not the design.

function Attribution({
  name,
  area,
  plan,
  className = "",
}: {
  name: string;
  area: string;
  plan: string;
  className?: string;
}) {
  return (
    <footer className={`text-sm ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <cite className="font-semibold not-italic text-white">{name}</cite>
        <span aria-hidden="true" className="text-white/25">
          ·
        </span>
        <span className="text-white/55">{area}</span>
      </div>
      <p className="mt-1 text-[13px] font-medium uppercase tracking-[0.12em] text-brand-300">
        {plan}
      </p>
    </footer>
  );
}

/** The sequence marker. Small, tabular, and the only numeral in the section. */
function Ref({ n }: { n: number }) {
  return (
    <span className="text-xs font-semibold tabular-nums text-white/35">
      {String(n).padStart(2, "0")}
    </span>
  );
}

export default function Reviews() {
  if (reviews.length === 0) return null;

  const [lead, ...rest] = reviews;

  return (
    <section
      id="reviews"
      className="scroll-mt-20 overflow-hidden bg-brand-950"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">
          In their words
        </p>
        <h2 className="mt-5 max-w-2xl font-display text-3xl font-bold leading-[1.08] tracking-tight text-white sm:text-4xl">
          What people say once we&apos;ve been
        </h2>

        <div className="mt-14 grid gap-14 lg:mt-16 lg:grid-cols-12 lg:gap-x-16">
          {/* ---- the featured quote ---- */}
          <blockquote className="relative lg:col-span-7">
            {/* Set in the display face at a size no heading on the page uses,
                clipped by the section. Decoration, so it is never read out. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-2 -top-16 select-none font-display text-[13rem] leading-none text-white/[0.06] sm:-top-24 sm:text-[18rem]"
            >
              &ldquo;
            </span>

            <div className="relative">
              <Ref n={1} />
              <p className="mt-4 text-[26px] font-medium leading-[1.38] text-white/95 sm:text-[30px] lg:text-[34px] lg:leading-[1.35]">
                {lead.quote}
              </p>
              <span
                aria-hidden="true"
                className="mt-8 block h-px w-12 bg-brand-400"
              />
              <Attribution {...lead} className="mt-6" />
            </div>
          </blockquote>

          {/* ---- the two supporting quotes ---- */}
          <div className="lg:col-span-5 lg:pt-2">
            {rest.map((r, i) => (
              <blockquote
                key={`${r.name}-${i}`}
                className={
                  i === 0
                    ? "pb-9"
                    : "border-t border-white/[0.14] pt-9"
                }
              >
                <Ref n={i + 2} />
                <p className="mt-3 text-[17px] leading-relaxed text-white/70 lg:text-lg lg:leading-relaxed">
                  {r.quote}
                </p>
                <Attribution {...r} className="mt-5" />
              </blockquote>
            ))}
          </div>
        </div>

        <PlaceholderNote>
          sample text, not real customers. Publishing invented reviews is a
          banned practice under the DMCC Act — replace or delete before launch.
        </PlaceholderNote>
      </div>
    </section>
  );
}
