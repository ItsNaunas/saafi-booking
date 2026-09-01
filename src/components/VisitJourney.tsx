// The full arc, in two acts: booking it, then the visit itself.
//
// Replaced "Three steps, no phone tag", which only ever described the booking —
// the part nobody is anxious about. The unanswered question was always what
// happens once we are in the house, so the two acts now sit as a pair of softly
// tinted panels with one continuous 01–07 sequence running through them.
//
// Every beat is true of the system as built: the confirmation call, the agreed
// slot, the approve-before-we-charge rule in lib/adjustments.ts, and the fact
// that no card is taken anywhere in the quote flow.
//
// The section owns its own heading block because of the capsule label, which
// SectionHead in page.tsx does not carry and should not grow for one caller.

import {
  CalendarDays,
  SprayCan,
  House,
  Tag,
  Phone,
  Clock,
  Sparkles,
  ShieldCheck,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import Icon from "./Icon";

/* ---------- content ---------- */

type Beat = { title: string; text: string; icon: LucideIcon };

const BEFORE: Beat[] = [
  {
    icon: House,
    title: "Tell us about your home",
    text: "Postcode, how many rooms, and how long you'd like us to stay.",
  },
  {
    icon: Tag,
    title: "See your price straight away",
    text: "A real number on screen before you commit. Not a callback, not an estimate by email.",
  },
  {
    icon: Phone,
    title: "We ring to confirm",
    text: "We lock in the date and time, check we've got your home right, and answer anything you're unsure about.",
  },
];

const ON_THE_DAY: Beat[] = [
  {
    icon: Clock,
    title: "We arrive in the slot we agreed",
    text: "You know the day and the time before we set off, because we settled both on the call.",
  },
  {
    icon: Sparkles,
    title: "We work through the rooms you booked",
    text: "Kitchen, bathrooms, living spaces and floors, for the hours you chose. Products and equipment come with us.",
  },
  {
    icon: ShieldCheck,
    title: "Anything bigger gets asked, not billed",
    text: "If your home turns out to be more than we quoted for, you approve the new price before we carry on. If we're simply slower than expected, that's our cost.",
  },
  {
    icon: CreditCard,
    title: "You already know the total",
    text: "You paid when you booked, so there's nothing to hand over on the day — no card machine, no invoice, just the clean you agreed to.",
  },
];

/**
 * A panel's tonal set. One object per panel so the tint, the rules and the icon
 * wells can never drift apart — the separation between the two acts is carried
 * entirely by tone, with no border doing the work.
 *
 * Ivory is the one warm note on the site. It exists so the two panels read as a
 * pair of different moments rather than two copies of the same block, and it is
 * held at a tint faint enough that the page still reads as white behind it.
 */
type Tone = {
  panel: string;
  /** Rules under the panel heading and between rows. */
  rule: string;
  /** The well behind each icon: one step down in lightness from the panel. */
  well: string;
  /** The dashed thread running down the number column. */
  thread: string;
};

const IVORY: Tone = {
  panel: "bg-[#faf7f1]",
  rule: "border-[#e9e1d3]",
  well: "bg-[#f1eade]",
  thread: "border-[#ddd2bd]",
};

const MINT: Tone = {
  panel: "bg-brand-50",
  rule: "border-brand-200/70",
  well: "bg-brand-100/70",
  thread: "border-brand-200",
};

function Panel({
  label,
  icon: Glyph,
  beats,
  offset,
  tone,
}: {
  label: string;
  icon: LucideIcon;
  beats: Beat[];
  offset: number;
  tone: Tone;
}) {
  return (
    <div className={`${tone.panel} p-5 sm:p-8 lg:p-10`}>
      <div className="flex items-center gap-3 text-brand-700">
        <Icon glyph={Glyph} />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">
          {label}
        </h3>
      </div>
      <div className={`mt-5 border-t ${tone.rule}`} />

      <ol>
        {beats.map((b, i) => {
          const BeatGlyph = b.icon;
          return (
            <li
              key={b.title}
              className="grid grid-cols-[1.75rem_1fr] gap-x-2.5 sm:grid-cols-[2.75rem_1fr] sm:gap-x-4"
            >
              {/* Number column. The dashed thread under each number is what makes
                  seven separate rows read as one sequence. */}
              <div className="flex flex-col items-start">
                <span className="pt-5 text-base font-bold leading-none tabular-nums text-brand-700 sm:pt-6 sm:text-xl">
                  {String(offset + i + 1).padStart(2, "0")}
                </span>
                {i < beats.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`ml-2 mt-3 w-px flex-1 border-l border-dashed sm:ml-3 ${tone.thread}`}
                  />
                )}
              </div>

              {/* Rules span the content, not the numbers, so the thread reads through. */}
              <div
                className={`flex gap-3.5 py-5 sm:gap-5 sm:py-6 ${
                  i > 0 ? `border-t ${tone.rule}` : ""
                }`}
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-brand-600 ${tone.well}`}
                >
                  <Icon glyph={BeatGlyph} />
                </span>
                <div>
                  <p className="font-semibold leading-snug text-slate-900">
                    {b.title}
                  </p>
                  <p className="mt-1.5 max-w-[42ch] text-sm leading-relaxed text-slate-600">
                    {b.text}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function VisitJourney() {
  return (
    <section id="how" className="scroll-mt-20 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
            The SAAFI experience
          </p>
          <h2 className="mt-5 font-display text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-4xl">
            From your quote to a clean home
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-500 sm:text-base">
            The booking takes about a minute. This is everything that happens
            after it.
          </p>
        </div>

        {/* Stacks below lg, so tablet portrait gets full-width panels rather than
            two columns squeezed to the point the copy ladders. */}
        <div className="mt-14 grid gap-6 lg:mt-16 lg:grid-cols-2 lg:gap-8">
          <Panel
            label="Booking it"
            icon={CalendarDays}
            beats={BEFORE}
            offset={0}
            tone={IVORY}
          />
          <Panel
            label="On the day"
            icon={SprayCan}
            beats={ON_THE_DAY}
            offset={BEFORE.length}
            tone={MINT}
          />
        </div>
      </div>
    </section>
  );
}
