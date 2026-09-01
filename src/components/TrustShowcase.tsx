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
// State and keyboard behaviour are the same at every width: each panel is a
// real <button> carrying aria-expanded, and focus order is DOM order.
//
// The LAYOUT changes below lg, because the desktop gesture does not survive the
// trip. A horizontal snap-scroller hides four of five panels behind a swipe
// nobody is told about, on the section carrying the reasons to book. On a phone
// it is a vertical accordion instead: five visible rows, one open. Same
// component, same state, same single-open rule — only the axis differs.

import { useState } from "react";
import Image, { type StaticImageData } from "next/image";
import trustProducts from "../../public/trust-products.jpg";
import trustSlot from "../../public/trust-slot.jpg";
import trustHours from "../../public/trust-hours.jpg";
import trustApprove from "../../public/trust-approve.jpg";
import trustFamily from "../../public/trust-family.jpg";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
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
  image: StaticImageData;
  /** Focal point, so the subject survives a tall narrow crop. */
  pos: string;
};

const POINTS: Point[] = [
  {
    n: "01",
    title: "Your products or ours",
    lead: "You choose when you book, not on the doorstep.",
    detail:
      "We can bring everything for £5 a visit, or work with what you already have at no extra cost. Plenty of people would rather we used their own — a finish they know, or simply no bleach in the house.",
    kicker: "Before we arrive",
    image: trustProducts,
    pos: "center 62%",
  },
  {
    n: "02",
    title: "The same slot, every time",
    lead: "Booked in as a standing appointment.",
    detail:
      "Same day, same time, already in the diary before you have to think about it. You can plan your week around it.",
    kicker: "Why regulars stay",
    image: trustSlot,
    pos: "center 45%",
  },
  {
    n: "03",
    title: "Honest hours",
    lead: "We quote the time your home needs and we stay for it.",
    detail:
      "You are not paying for a job someone is rushing to finish early. You choose the hours up front and you can change them.",
    kicker: "How the time works",
    image: trustHours,
    pos: "center 40%",
  },
  {
    n: "04",
    title: "You approve any change",
    lead: "No surprises on the bill, ever.",
    detail:
      "If your home turns out bigger than booked we tell you and you approve the price before anything changes. If a clean simply takes us longer, that is our cost, not yours.",
    kicker: "On the bill",
    image: trustApprove,
    pos: "center 35%",
  },
  {
    n: "05",
    title: "Family-run, not an agency",
    lead: "The same small local team.",
    detail:
      "Not a different stranger each week from a booking platform. You will get to know who cleans your home, and they will get to know it.",
    kicker: "Who we are",
    image: trustFamily,
    pos: "center 38%",
  },
];

export default function TrustShowcase() {
  // "The same slot" opens by default: it is the strongest reason to go regular.
  const [open, setOpen] = useState(1);

  return (
    <div className="flex flex-col gap-2 lg:flex-row">
      {POINTS.map((p, i) => {
        const isOpen = open === i;
        return (
          <button
            key={p.n}
            type="button"
            onClick={() => setOpen(i)}
            aria-expanded={isOpen}
            // flex-grow is what animates: the open panel takes roughly two and a
            // half times the width and its neighbours give it up.
            style={{ flexGrow: isOpen ? 2.6 : 1 }}
            className="group w-full text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300 lg:w-0 lg:flex-1 lg:basis-0 lg:transition-[flex-grow] lg:duration-300 lg:ease-out"
          >
            <div
              // Fixed height from lg up, where equal-height panels are the
              // whole point of the strip. On a phone a closed row is only as
              // tall as its title, which is what makes five of them fit.
              className={`relative flex flex-col overflow-hidden border transition-colors duration-300 lg:h-[430px] ${
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
                placeholder="blur"
                className={`object-cover transition-opacity duration-300 ${
                  isOpen
                    ? "opacity-100"
                    : "opacity-0 lg:opacity-40 lg:group-hover:opacity-60"
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

              <div className="relative flex flex-1 flex-col overflow-hidden p-4 sm:p-5 lg:p-6">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`text-xs font-semibold tabular-nums transition-colors ${
                      isOpen ? "text-brand-300" : "text-white/40"
                    }`}
                  >
                    {p.n}
                  </span>
                  {/* Two indicators, because they say different things. A
                      chevron means "this opens downward"; the diagonal arrow
                      means "this expands sideways". Neither reads correctly in
                      the other layout. */}
                  <span
                    aria-hidden="true"
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full transition duration-200 lg:group-hover:translate-x-0.5 lg:group-hover:-translate-y-0.5 ${
                      isOpen
                        ? "bg-brand-400 text-slate-900"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    <Icon
                      glyph={ChevronDown}
                      className={`size-4 transition-transform duration-300 lg:hidden ${
                        isOpen ? "-rotate-180" : ""
                      }`}
                      strokeWidth={2.2}
                    />
                    <Icon
                      glyph={ArrowUpRight}
                      className="hidden size-3.5 lg:block"
                      strokeWidth={2.2}
                    />
                  </span>
                </div>

                {/* Closed, the title sits at the foot and is the whole panel.
                    Open, it rises and the argument appears beneath it. */}
                <div className={isOpen ? "mt-5 lg:mt-7" : "mt-3 lg:mt-auto"}>
                  {isOpen && (
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">
                      {p.kicker}
                    </p>
                  )}
                  <h3
                    className={`font-display font-bold leading-tight text-white transition-all duration-300 ${
                      isOpen ? "text-2xl lg:text-[1.75rem]" : "text-lg"
                    }`}
                  >
                    {p.title}
                  </h3>
                  {/* The lead belongs to the argument, not the teaser: a closed
                      panel is a number and a title and nothing else. */}
                  {isOpen && (
                    <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-white/70">
                      {p.lead}
                    </p>
                  )}
                </div>
              </div>

              {/* Belongs to the open state everywhere now. On a phone it used
                  to show on every panel because a swipe strip had no way to
                  toggle; an accordion does. */}
              <div className={`relative ${isOpen ? "block" : "hidden"}`}>
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
      Get a quote
    </Link>
  );
}
