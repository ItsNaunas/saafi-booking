import { checks } from "@/lib/business";
import { CircleCheck } from "lucide-react";
import PlaceholderNote from "./PlaceholderNote";
import Icon from "./Icon";

// The objection the page never addressed: it isn't price, it's letting a
// stranger into your house. Sits straight after the dark trust block, which
// covers what the service promises — this covers who turns up to deliver it.
//
// Deliberately documentary rather than reassuring in tone. A credentials list
// that tries to sound warm reads as though it is compensating for something.
//
// Every claim comes from lib/business.ts and is UNCONFIRMED until SAAFI say
// otherwise. See the notes on `checks` there before this goes anywhere near a
// live site — "insured" is a representation, not a mood.

export default function SafetyChecks() {
  if (checks.length === 0) return null;

  return (
    <section id="safety" className="scroll-mt-20 bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Asymmetric 5/7 so it reads as a statement answered by a record,
            rather than as another balanced two-column block. */}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl">
              Who we send into your home
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-600">
              The hardest part of booking a cleaner has never been the price.
              It&apos;s handing your front door to someone you have not met. So
              here is exactly what we do before anyone is sent to a customer.
            </p>
          </div>

          <ul className="lg:col-span-7">
            {checks.map((c, i) => (
              <li
                key={c.title}
                className={`flex gap-4 py-5 ${
                  i > 0 ? "border-t border-slate-200" : "lg:pt-0"
                }`}
              >
                <Icon glyph={CircleCheck} className="mt-0.5 size-5 text-brand-600" />
                <div>
                  <h3 className="font-semibold leading-snug text-slate-900">
                    {c.title}
                  </h3>
                  <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-slate-600">
                    {c.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center lg:text-left">
          <PlaceholderNote>
            none of these checks are confirmed by SAAFI yet. Confirm or delete
            each one before launch.
          </PlaceholderNote>
        </div>
      </div>
    </section>
  );
}
