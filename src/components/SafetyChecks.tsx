import { checks } from "@/lib/business";
import { UserCheck, House, ClipboardCheck, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PlaceholderNote from "./PlaceholderNote";
import Icon from "./Icon";

// The objection the page never addressed: it isn't price, it's letting a
// stranger into your house. Sits straight after the dark trust block, which
// covers what the service promises — this covers who turns up to deliver it.
//
// Deliberately documentary rather than reassuring in tone. A credentials list
// that tries to sound warm reads as though it is compensating for something.
//
// The claims themselves come from lib/business.ts and are unchanged here. This
// component styles them and adds nothing: no extra check, no guarantee, no
// implied screening the business has not told us it does. See the notes on
// `checks` before this goes near a live site — "insured" is a representation,
// not a mood.

/**
 * Icons by position rather than by claim text, so editing the wording in
 * lib/business.ts can never leave a row wearing the wrong glyph — and a fifth
 * check falls back rather than crashing.
 */
const GLYPHS: LucideIcon[] = [UserCheck, ClipboardCheck, ShieldCheck, House];

export default function SafetyChecks() {
  if (checks.length === 0) return null;

  return (
    <section id="safety" className="relative isolate scroll-mt-20 overflow-hidden bg-white py-20 lg:py-28">
      {/* One faint tonal shape, bled off the left edge. The section is otherwise
          pure white and would sit flat between two tinted neighbours. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-1/2 -z-10 size-[34rem] -translate-y-1/2 rounded-full bg-brand-50"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* ---- the statement ---- */}
          <div className="lg:col-span-5">
            <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl">
              Who we send into your home
            </h2>
            <p className="mt-6 max-w-sm text-xl font-medium leading-snug text-brand-800 sm:text-[1.375rem]">
              People we&apos;d trust in our own homes.
            </p>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-slate-600">
              The hardest part of booking a cleaner has never been the price.
              It&apos;s handing your front door to someone you have not met. So
              here is exactly what we do before anyone is sent to a customer.
            </p>
          </div>

          {/* ---- the record ---- */}
          <ul className="lg:col-span-7">
            {checks.map((c, i) => {
              const glyph = GLYPHS[i % GLYPHS.length];
              return (
                <li
                  key={c.title}
                  className="flex gap-5 border-b border-slate-200 py-6 first:pt-0 sm:gap-6"
                >
                  <Icon
                    glyph={glyph}
                    className="mt-1 size-[22px] text-brand-600"
                  />
                  <div>
                    <h3 className="font-semibold leading-snug text-slate-900">
                      {c.title}
                    </h3>
                    <p className="mt-1.5 max-w-[54ch] text-sm leading-relaxed text-slate-500">
                      {c.text}
                    </p>
                  </div>
                </li>
              );
            })}

            <PlaceholderNote>
              none of these checks are confirmed by SAAFI yet. Confirm or delete
              each one before launch.
            </PlaceholderNote>
          </ul>
        </div>
      </div>
    </section>
  );
}
