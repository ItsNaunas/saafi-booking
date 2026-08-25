"use client";

// The dark five-panel showcase. Carries the things that actually decide whether
// someone books and stays: the cleaners, the products, the standard, the promise.
//
// Every claim here is verifiable from the product itself. Vetting, insurance and
// a re-clean guarantee live in SafetyChecks and are still unconfirmed.
//
// The hierarchy is the design. Four panels are reduced to a number, a short
// title and an indicator; the open one is the only place a full argument gets
// made. Five panels of equal weight is a carousel, and a carousel is what you
// build when you have not decided what matters most.
//
// State and keyboard behaviour are unchanged: each panel is a real <button>,
// focus order is the DOM order, and the mobile fallback is the same
// snap-scrolling row rather than a second interaction model.

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Icon from "./Icon";

type Point = {
  n: string;
  title: string;
  /** One line, under the title once open. */
  lead: string;
  /** The body of the argument. */
  detail: string;
  /** Category label above an open panel's title. */
  kicker: string;
  /** Panel ground. Licensed stock — see public/IMAGE-CREDITS.md. */
  image: string;
  /** Focal point, so the subject survives a tall narrow crop. */
  pos: string;
};

const POINTS: Point[] = [
  {
    n: "01",
    title: "Products included",
    lead: "Everything we clean with comes with us.",
    detail:
      "Nothing to buy and nothing to leave out for us. It is already in the hourly rate, not added on at the end.",
    kicker: "What's in the rate",
    image: "/trust-products.jpg",
    pos: "center 62%",
  },
  {
    n: "02",
    title: "The same slot, every time",
    lead: "Booked in as a standing appointment.",
    detail:
      "Same day, same time, already in the diary before you have to think about it. You can plan your week around it.",
    kicker: "Why regulars stay",
    image: "/trust-slot.jpg",
    pos: "center 45%",
  },
  {
    n: "03",
    title: "Honest hours",
    lead: "We quote the time your home needs and we stay for it.",
    detail:
      "You are not paying for a job someone is rushing to finish early. You choose the hours up front and you can change them.",
    kicker: "How the time works",
    image: "/trust-hours.jpg",
    pos: "center 40%",
  },
  {
    n: "04",
    title: "You approve any change",
    lead: "No surprises on the bill, ever.",
    detail:
      "If your home turns out bigger than booked we tell you and you approve the price before anything changes. If a clean simply takes us longer, that is our cost, not yours.",
    kicker: "On the bill",
    image: "/trust-approve.jpg",
    pos: "center 35%",
  },
  {
    n: "05",
    title: "Family-run, not an agency",
    lead: "The same small local team.",
    detail:
      "Not a different stranger each week from a booking platform. You will get to know who cleans your home, and they will get to know it.",
    kicker: "Who we are",
    image: "/trust-family.jpg",
    pos: "center 38%",
  },
];

export default function TrustShowcase() {
  // "The same slot" opens by default: it is the strongest reason to go regular.
  const [open, setOpen] = useState(1);

  return (
    <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-4 [scrollbar-width:none] lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
      {POINTS.map((p, i) => {
        const isOpen = open === i;
        return (
          <button
            key={p.n}
            type="button"
            onClick={() => setOpen(i)}
            aria-expanded={isOpen}
            aria-label={p.title}
            // flex-grow is what animates: the open panel takes roughly two and a
            // half times the width and its neighbours give it up.
            style={{ flexGrow: isOpen ? 2.6 : 1 }}
            className="group w-[85vw] shrink-0 snap-start text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300 sm:w-[52vw] lg:w-0 lg:flex-1 lg:basis-0 lg:transition-[flex-grow] lg:duration-300 lg:ease-out"
          >
            <div
              className={`relative flex h-[430px] flex-col overflow-hidden border transition-colors duration-300 ${
                isOpen
                  ? "border-white/25"
                  : "border-white/10 group-hover:border-white/25"
              }`}
            >
              {/* The photograph carries the hierarchy alongside the width: a
                  closed panel is a dimmed texture, the open one is a picture.
                  Decorative, so it is never described — the title says it. */}
              <Image
                src={p.image}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 640px) 85vw, (max-width: 1024px) 52vw, 560px"
                className={`object-cover transition-opacity duration-300 ${
                  isOpen ? "opacity-100" : "opacity-40 group-hover:opacity-60"
                }`}
                style={{ objectPosition: p.pos }}
              />
              {/* Scrim, weighted to the foot where the type sits. Without it the
                  copy is at the mercy of whatever the photograph does. */}
              <div
                aria-hidden="true"
                className={`absolute inset-0 transition-opacity duration-300 ${
                  isOpen
                    ? "bg-gradient-to-t from-brand-950 via-brand-950/80 to-brand-950/30"
                    : "bg-gradient-to-t from-brand-950 via-brand-950/85 to-brand-950/55"
                }`}
              />

              <div className="relative flex flex-1 flex-col overflow-hidden p-5 lg:p-6">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`text-xs font-semibold tabular-nums transition-colors ${
                      isOpen ? "text-brand-300" : "text-white/40"
                    }`}
                  >
                    {p.n}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full transition duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                      isOpen
                        ? "bg-brand-400 text-slate-900"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    <Icon
                      glyph={ArrowUpRight}
                      className="size-3.5"
                      strokeWidth={2.2}
                    />
                  </span>
                </div>

                {/* Closed, the title sits at the foot and is the whole panel.
                    Open, it rises and the argument appears beneath it. */}
                <div className={isOpen ? "mt-7" : "mt-auto"}>
                  {isOpen && (
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">
                      {p.kicker}
                    </p>
                  )}
                  <p
                    className={`font-display font-bold leading-tight text-white transition-all duration-300 ${
                      isOpen ? "text-2xl lg:text-[1.75rem]" : "text-lg"
                    }`}
                  >
                    {p.title}
                  </p>
                  {/* The lead belongs to the argument, not the teaser: a closed
                      panel is a number and a title and nothing else. */}
                  {isOpen && (
                    <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-white/70">
                      {p.lead}
                    </p>
                  )}
                </div>
              </div>

              {/* Always present on mobile, revealed by opening on desktop. */}
              <div className={`relative ${isOpen ? "block" : "block lg:hidden"}`}>
                <p className="bg-white px-5 py-4 text-sm leading-relaxed text-slate-700 lg:px-6">
                  {p.detail}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** The pill CTA that sits beside the section's supporting copy. */
export function ShowcaseCta() {
  return (
    <Link
      href="/quote"
      className="shrink-0 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-brand-50"
    >
      Build my quote
    </Link>
  );
}
