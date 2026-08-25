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
// Composition is deliberately uneven — a lead quote given real size, with the
// supporting two stacked beside it. Three equal quote cards is the layout that
// makes testimonials look bought.

function Attribution({
  name,
  area,
  plan,
}: {
  name: string;
  area: string;
  plan: string;
}) {
  return (
    <footer className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <cite className="font-semibold not-italic text-white">{name}</cite>
      <span aria-hidden="true" className="text-white/30">
        ·
      </span>
      <span className="text-white/60">{area}</span>
      <span className="text-brand-300">{plan}</span>
    </footer>
  );
}

export default function Reviews() {
  if (reviews.length === 0) return null;

  const [lead, ...rest] = reviews;

  return (
    <section id="reviews" className="scroll-mt-20 bg-brand-950">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <h2 className="max-w-2xl font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl">
          What people say once we&apos;ve been
        </h2>

        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* The lead quote is set at reading size, not headline size — a
              testimonial blown up to display type stops sounding like a person. */}
          <blockquote className="lg:col-span-7">
            <p className="text-xl leading-relaxed text-white/90 sm:text-[1.375rem] sm:leading-[1.55]">
              {lead.quote}
            </p>
            <Attribution {...lead} />
          </blockquote>

          <div className="lg:col-span-5">
            {rest.map((r, i) => (
              <blockquote
                key={`${r.name}-${i}`}
                className={`border-t border-white/15 py-7 ${
                  i === 0 ? "lg:border-t-0 lg:pt-0" : ""
                } ${i === rest.length - 1 ? "pb-0" : ""}`}
              >
                <p className="text-[15px] leading-relaxed text-white/75">
                  {r.quote}
                </p>
                <Attribution {...r} />
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
