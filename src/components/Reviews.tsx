"use client";

import { useState } from "react";
import { reviews } from "@/lib/business";
import Reveal from "./Reveal";

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
//
// The supporting quotes are buttons: clicking one promotes it to the featured
// slot and demotes the current one. It costs a line of state and turns a wall
// of testimony into something you can move through — and every quote gets a
// turn at the size that actually gets read.

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
  const [featured, setFeatured] = useState(0);

  if (reviews.length === 0) return null;

  const lead = reviews[featured];
  const rest = reviews
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => i !== featured);

  return (
    <section id="reviews" className="scroll-mt-20 overflow-hidden bg-brand-950">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">
            In their words
          </p>
          <h2 className="mt-5 max-w-2xl font-display text-3xl font-bold leading-[1.08] tracking-tight text-white sm:text-4xl">
            What people say once we&apos;ve been
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-14 lg:mt-16 lg:grid-cols-12 lg:gap-x-16">
          {/* ---- the featured quote ---- */}
          <Reveal delay={80} className="lg:col-span-7">
            {/* key restarts the fade whenever a different quote is promoted,
                so the swap reads as a change rather than as text mutating. */}
            <blockquote
              key={featured}
              className="relative motion-safe:animate-[quote-in_420ms_cubic-bezier(0.16,1,0.3,1)]"
            >
              {/* Set in the display face at a size no heading on the page uses,
                  clipped by the section. Decoration, never read out. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-2 -top-16 select-none font-display text-[13rem] leading-none text-white/[0.06] sm:-top-24 sm:text-[18rem]"
              >
                &ldquo;
              </span>

              <div className="relative">
                <Ref n={featured + 1} />
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
          </Reveal>

          {/* ---- the others, each one a way back into the featured slot ---- */}
          <Reveal delay={160} className="lg:col-span-5 lg:pt-2">
            {rest.map(({ r, i }, position) => (
              <button
                key={r.name + i}
                type="button"
                onClick={() => setFeatured(i)}
                aria-label={`Read ${r.name}'s review in full`}
                className={`group block w-full cursor-pointer text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300 ${
                  position === 0
                    ? "pb-9"
                    : "border-t border-white/[0.14] pt-9"
                }`}
              >
                <blockquote>
                  <Ref n={i + 1} />
                  <p className="mt-3 text-[17px] leading-relaxed text-white/70 transition-colors duration-200 group-hover:text-white/90 lg:text-lg lg:leading-relaxed">
                    {r.quote}
                  </p>
                  <Attribution {...r} className="mt-5" />
                </blockquote>
              </button>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
