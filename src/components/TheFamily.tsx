// Who is actually behind the business.
//
// "Family-run" is claimed in the hero and again in the trust panels, and the
// page never showed it. This section is the payoff, and it is the one editorial
// composition on an otherwise rectilinear page: circles at three sizes, off the
// baseline, with the numbers riding the edges. That contrast is the point — it
// gives the reader a visual break between two functional sections.
//
// The three claims are about accountability, not continuity. The "same small
// team" claim already lives in TrustShowcase and must not be repeated here.
//
// On assets: public/ holds one photograph,
// hero-cleaner.jpg, already used by the hero and the living-spaces circle — a
// third use would read as a stock library of one, and it is a cleaner at work
// rather than the family. So the anchor circle is a brand graphic instead. It
// is a placeholder for a real photograph of the family: drop one in, swap the
// inner <div> for an <Image fill className="object-cover">, and nothing else in
// the composition has to move.

import Image from "next/image";
import familyLight from "../../public/family-light.jpg";
import { Headset, HouseHeart, ShieldCheck, Heart, type LucideIcon } from "lucide-react";
import Icon from "./Icon";

const POINTS: {
  n: string;
  title: string;
  text: string;
  icon: LucideIcon;
  /** Circle diameter. Three sizes, no two alike — this is the composition. */
  size: string;
  /** Where the numbered marker rides the circle's edge, as % of the box. */
  badge: { left: string; top: string };
  place: string;
}[] = [
  {
    n: "01",
    title: "You always get a person",
    text: "One phone call, to the family who runs it. Nothing to chase through a support form and nobody to be passed along to.",
    icon: Headset,
    size: "max-w-[340px]",
    badge: { left: "20%", top: "10%" },
    place:
      "md:justify-self-end lg:col-start-1 lg:row-start-1 lg:justify-self-start",
  },
  {
    n: "02",
    title: "We hire our own cleaners",
    text: "Not contractors picked up job by job. We choose who comes into your home, and we are answerable for them.",
    icon: HouseHeart,
    size: "max-w-[390px]",
    badge: { left: "82%", top: "12%" },
    place:
      "md:justify-self-start lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center lg:justify-self-end",
  },
  {
    n: "03",
    title: "Our name is on it",
    text: "A family name is a small thing to trade on and an easy thing to lose. That is the whole reason the standard holds.",
    icon: ShieldCheck,
    size: "max-w-[330px]",
    badge: { left: "16%", top: "14%" },
    place:
      "md:col-span-2 md:justify-self-center lg:col-span-1 lg:col-start-1 lg:row-start-2 lg:ml-[6%] lg:justify-self-start",
  },
];

/* ---------- pieces ---------- */

function Bubble({ point }: { point: (typeof POINTS)[number] }) {
  const { n, title, text, icon: Glyph, size, badge, place } = point;
  return (
    <div
      className={`relative aspect-square w-[86vw] ${size} md:w-full ${place}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full border border-brand-200 bg-white px-[15%] text-center">
        <Icon glyph={Glyph} className="size-8 text-brand-600 sm:size-9" />
        <h3 className="mt-3 text-base font-semibold leading-snug text-slate-900 sm:mt-4 sm:text-lg">
          {title}
        </h3>
        <p className="mt-1.5 text-[13px] leading-[1.55] text-slate-600 sm:mt-2 sm:text-sm sm:leading-relaxed">
          {text}
        </p>
      </div>

      {/* Sits centred on the circle's circumference, so it reads as riding the
          edge rather than as a badge parked in a corner. The coordinates are
          the real solution to x = 0.5 − √(0.25 − y²) for each y. */}
      <span
        style={{ left: badge.left, top: badge.top }}
        className="absolute flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold tabular-nums text-slate-900 sm:size-14 sm:text-sm"
      >
        {n}
      </span>
    </div>
  );
}

/**
 * The anchor.
 *
 * The reference this was built from showed a brand plate over dappled leaf
 * light, and that is what this is: a licensed Unsplash texture behind a mint
 * scrim, with the wordmark over the top. Texture rather than faces is a
 * deliberate choice — this is the one circle sitting next to copy that says
 * "the people who own it", so a stock family here would read as a claim about
 * who they are rather than as decoration.
 *
 * A real photograph of the family replaces the <Image> src and nothing else.
 */
function BrandDisc() {
  return (
    <div className="relative aspect-square w-[86vw] max-w-[440px]">
      {/* offset hairline — the one decorative line in the section */}
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-3 translate-y-3 rounded-full border border-brand-300/70"
      />

      <div className="absolute inset-0 overflow-hidden rounded-full bg-brand-100">
        <Image
          src={familyLight}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 640px) 86vw, 440px"
          placeholder="blur"
          className="object-cover"
          style={{ objectPosition: "center 38%" }}
        />
        {/* Scrim, not a filter: it tints the photo to the brand and buys the
            wordmark the contrast it needs over a variable image. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-brand-50/75"
        />

        <div className="relative flex h-full flex-col items-center justify-center">
          <p className="font-display text-3xl font-bold tracking-[0.34em] text-slate-900 sm:text-4xl">
            <span className="ml-[0.34em]">SAAFI</span>
          </p>
          <span
            aria-hidden="true"
            className="mt-4 block h-px w-14 bg-slate-900/25"
          />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Family-run home cleaning
          </p>
          {/* The one solid mark on the site: a hairline heart at this size
              reads as a mistake rather than a flourish. */}
          <Heart
            aria-hidden="true"
            className="mt-5 size-5 fill-brand-500 text-brand-500"
          />
        </div>
      </div>

      <span
        aria-hidden="true"
        className="absolute right-0 top-1/2 size-2.5 -translate-y-1/2 translate-x-1.5 rounded-full bg-brand-400"
      />
    </div>
  );
}

export default function TheFamily() {
  return (
    <section
      id="family"
      className="scroll-mt-20 overflow-hidden border-y border-brand-200 bg-brand-50"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid items-center gap-16 lg:grid-cols-[42fr_58fr] lg:gap-10 xl:gap-14">
          {/* ---- left: the statement, anchored by the disc ---- */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
              Why SAAFI
            </p>
            <span
              aria-hidden="true"
              className="mt-4 block h-px w-11 bg-brand-500"
            />

            <h2 className="mt-7 font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
              The people behind it
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-slate-700">
              SAAFI is one family&apos;s business. The people who own it are the
              same people who answer the phone, confirm your booking and stand
              behind the work that gets done in your home.
            </p>

            <div className="mt-12 lg:mt-14">
              <BrandDisc />
            </div>
          </div>

          {/* ---- right: three circles, off the baseline ----
               Mobile stacks. Tablet gives 2 + 1. Desktop puts 02 spanning both
               rows and self-centred, which is what drops it between 01 and 03
               instead of level with either. */}
          <div className="flex flex-col items-center gap-14 md:grid md:grid-cols-2 md:items-center md:gap-x-6 md:gap-y-12 lg:grid-cols-[46%_54%] lg:gap-x-0 lg:gap-y-8">
            {POINTS.map((p) => (
              <Bubble key={p.n} point={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
