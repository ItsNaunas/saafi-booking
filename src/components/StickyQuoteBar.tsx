"use client";

// Between leaving the hero and reaching the closing block there was no way to
// act, and on a phone that is most of the page. This is the answer to that, and
// it is mobile-only on purpose: the desktop nav is always in view, so a second
// persistent CTA there would only be noise.
//
// Two actions, because the two customers are different people. The form suits
// whoever wants to see a number before speaking to anyone; the phone suits
// whoever was never going to fill in a form at all, and the site had no way of
// serving them until now.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import Icon from "./Icon";
import { contact } from "@/lib/business";
import { formatGBP } from "@/lib/pricing";

/** `rate` is a whole-visit price for the page's example home, not an hourly rate. */
export default function StickyQuoteBar({ rate }: { rate: number }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // A sentinel would be tidier, but it would have to live in page.tsx and
    // this way the bar owns its own trigger. Passive listener, one boolean.
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      // Hidden from assistive tech while off-screen so it is not announced
      // twice — the same two actions already exist in the page.
      aria-hidden={!shown}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur transition-transform duration-300 ease-out lg:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            2-bed, fortnightly
          </p>
          <p className="tnum text-lg font-bold leading-tight text-slate-900">
            <span className="text-sm font-medium text-slate-500">from </span>
            {formatGBP(rate)}
          </p>
        </div>

        <a
          href={`tel:${contact.phoneHref}`}
          aria-label={`Call SAAFI on ${contact.phoneDisplay}`}
          tabIndex={shown ? 0 : -1}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
        >
          <Icon glyph={Phone} />
        </a>

        <Link
          href="/quote"
          tabIndex={shown ? 0 : -1}
          className="shrink-0 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Get a quote
        </Link>
      </div>
    </div>
  );
}
