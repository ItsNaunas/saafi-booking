"use client";

// The dark five-panel showcase. Same layout the pricing examples used, but
// carrying the things that actually decide whether someone books and stays:
// the cleaners, the products, the standard, the promise.
//
// Every claim here is verifiable from the product itself. Vetting, insurance
// and a re-clean guarantee are the three strongest panels available and are
// deliberately absent until SAAFI confirm what they can commit to.

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Icon from "./Icon";

type Point = {
  n: string;
  title: string;
  /** One line, visible collapsed. */
  lead: string;
  /** Revealed on open. */
  detail: string;
  lead_label?: string;
};

const POINTS: Point[] = [
  {
    n: "01",
    title: "Products included",
    lead: "Everything we clean with comes with us.",
    detail:
      "Nothing to buy and nothing to leave out for us. It is already in the hourly rate, not added on at the end.",
  },
  {
    n: "02",
    title: "The same slot, every time",
    lead: "Booked in as a standing appointment.",
    detail:
      "Same day, same time, already in the diary before you have to think about it. You can plan your week around it.",
    lead_label: "Why regulars stay",
  },
  {
    n: "03",
    title: "Honest hours",
    lead: "We quote the time your home needs and we stay for it.",
    detail:
      "You are not paying for a job someone is rushing to finish early. You choose the hours up front and you can change them.",
  },
  {
    n: "04",
    title: "You approve any change",
    lead: "No surprises on the bill, ever.",
    detail:
      "If your home turns out bigger than booked we tell you and you approve the price before anything changes. If a clean simply takes us longer, that is our cost, not yours.",
  },
  {
    n: "05",
    title: "Family-run, not an agency",
    lead: "The same small local team.",
    detail:
      "Not a different stranger each week from a booking platform. You will get to know who cleans your home, and they will get to know it.",
  },
];

/** The open indicator, and the only round thing in a square-cornered section. */
function Arrow({ active = false }: { active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full transition duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
        active ? "bg-brand-400 text-slate-900" : "bg-white/15 text-white"
      }`}
    >
      <Icon glyph={ArrowUpRight} className="size-3.5" strokeWidth={2.2} />
    </span>
  );
}

export default function TrustShowcase() {
  // "The same slot" opens by default: it is the strongest reason to go regular.
  const [open, setOpen] = useState(1);

  return (
    <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-4 [scrollbar-width:none] lg:items-start lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
      {POINTS.map((p, i) => {
        const isOpen = open === i;
        return (
          <button
            key={p.n}
            type="button"
            onClick={() => setOpen(i)}
            aria-expanded={isOpen}
            aria-label={p.title}
            // flex-grow is what animates: the open panel takes roughly twice the
            // width and its neighbours give it up.
            style={{ flexGrow: isOpen ? 2.4 : 1 }}
            className="group w-[85vw] shrink-0 snap-start text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300 sm:w-[52vw] lg:w-0 lg:flex-1 lg:basis-0 lg:transition-[flex-grow] lg:duration-300 lg:ease-out"
          >
            <p className="mb-3 text-xs font-medium tabular-nums text-white/60">
              {p.n}
            </p>

            {/* The open tile lifts out of the row: a little taller, nudged up. */}
            <div
              className={`flex flex-col transition-all duration-300 ${
                isOpen ? "h-[420px] lg:-mt-2 lg:h-[444px]" : "h-[420px]"
              } ${
                isOpen
                  ? "border border-white/15 bg-white/[0.09]"
                  : "border border-white/10 bg-white/[0.05]"
              }`}
            >
              <div className="relative flex flex-1 flex-col overflow-hidden p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                    {p.lead_label ?? ""}
                  </span>
                  <Arrow active={isOpen} />
                </div>

                {/* Collapsed, the title sits low; open, it rises to the top. */}
                <div className={isOpen ? "mt-6" : "mt-auto"}>
                  <p
                    className={`font-display font-bold leading-tight text-white transition-all duration-300 ${
                      isOpen ? "text-2xl" : "text-lg"
                    }`}
                  >
                    {p.title}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/70">
                    {p.lead}
                  </p>
                </div>
              </div>

              {/* Always present on mobile, revealed by opening on desktop. */}
              <div className={isOpen ? "block" : "block lg:hidden"}>
                <p className="bg-white px-5 py-4 text-sm leading-relaxed text-slate-700">
                  {p.detail}
                </p>
              </div>

              <p className="px-5 pb-4 pt-3 text-[11px] font-medium text-white/55">
                SAAFI Cleaning
              </p>
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
