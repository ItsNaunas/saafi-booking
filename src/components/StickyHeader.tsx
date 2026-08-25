"use client";

// The hero's nav sits on the photograph and scrolls away with it, which leaves
// the whole middle of the page with no way to navigate and no visible phone
// number. This brings both back, condensed, once you are past the hero.
//
// Desktop only: on a phone the same job is done by StickyQuoteBar at the foot,
// and running two persistent bars at once would eat a third of a small screen.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import Icon from "./Icon";

const LINKS = [
  { href: "#services", label: "Services" },
  { href: "#included", label: "What's included" },
  { href: "#pricing", label: "Pricing" },
  { href: "#how", label: "How it works" },
  { href: "#faqs", label: "FAQs" },
];

export default function StickyHeader({
  phone,
  phoneHref,
}: {
  phone: string;
  phoneHref: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      // Hidden from assistive tech and removed from the tab order while it is
      // off-screen: every link in here already exists in the page and the
      // footer, so announcing it twice is noise, not help.
      aria-hidden={!shown}
      className={`fixed inset-x-0 top-0 z-40 hidden border-b border-slate-200 bg-white/90 backdrop-blur transition-transform duration-300 ease-out lg:block ${
        shown ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3 sm:px-8">
        <Link
          href="/"
          tabIndex={shown ? 0 : -1}
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          SAAFI
        </Link>

        <nav className="flex items-center gap-7 text-sm font-medium text-slate-600">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              tabIndex={shown ? 0 : -1}
              className="transition-colors hover:text-brand-700"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <a
            href={`tel:${phoneHref}`}
            tabIndex={shown ? 0 : -1}
            className="flex items-center gap-2 text-sm font-semibold text-slate-900 transition-colors hover:text-brand-700"
          >
            <Icon glyph={Phone} className="size-4 text-brand-600" />
            {phone}
          </a>
          <Link
            href="/quote"
            tabIndex={shown ? 0 : -1}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Get a quote
          </Link>
        </div>
      </div>
    </div>
  );
}
