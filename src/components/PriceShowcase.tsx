"use client";

// Expandable pricing showcase. Every panel is the same component; the "featured"
// look is simply the open one, so which example leads is a state change rather
// than a separate design. Client-side because the page is a server component and
// this needs click state.

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatGBP, formatDuration } from "@/lib/pricing";

export type ShowcaseExample = {
  label: string;
  sub: string;
  hours: number;
  oneOff: number;
  recurring: number;
  /** Path under /public. Undefined until real photography exists. */
  image?: string;
};

export type ShowcaseAddon = { key: string; label: string; hours: number };

type Panel =
  | { kind: "home"; n: string; example: ShowcaseExample; lead?: boolean }
  | { kind: "extras"; n: string }
  | { kind: "saving"; n: string };

/** The expand affordance, and the only round thing in a square-cornered section. */
function Arrow({
  variant = "light",
  className = "",
}: {
  variant?: "light" | "dark" | "solid";
  className?: string;
}) {
  const skin = {
    light: "bg-white/15 text-white",
    dark: "bg-slate-900/10 text-slate-900",
    solid: "bg-slate-900 text-white",
  }[variant];
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full transition duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${skin} ${className}`}
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          d="M4 12L12 4M12 4H6M12 4v6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function PriceShowcase({
  examples,
  addons,
  hourlyRate,
  recurringRate,
}: {
  examples: ShowcaseExample[];
  addons: ShowcaseAddon[];
  hourlyRate: number;
  recurringRate: number;
}) {
  // The 2-bed opens by default, as the most representative home.
  const [open, setOpen] = useState(1);

  const panels: Panel[] = [
    { kind: "home", n: "01", example: examples[0] },
    { kind: "home", n: "02", example: examples[1], lead: true },
    { kind: "home", n: "03", example: examples[2] },
    { kind: "extras", n: "04" },
    { kind: "saving", n: "05" },
  ];

  const shown = addons.slice(0, 4);
  const perHour = formatGBP(hourlyRate - recurringRate);

  return (
    <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-4 [scrollbar-width:none] lg:items-start lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
      {panels.map((p, i) => {
        const isOpen = open === i;
        const title =
          p.kind === "home"
            ? p.example.label
            : p.kind === "extras"
              ? "Optional extras"
              : "Regulars save more";
        const image = p.kind === "home" ? p.example.image : undefined;
        const hasDetail = p.kind !== "saving";

        return (
          <button
            key={p.n}
            type="button"
            onClick={() => setOpen(i)}
            aria-expanded={isOpen}
            aria-label={`Show pricing for ${title}`}
            // flex-grow is what animates: the open panel takes roughly twice the
            // width and its neighbours give it up.
            style={{ flexGrow: isOpen ? 2.4 : 1 }}
            className="group w-[85vw] shrink-0 snap-start text-left sm:w-[52vw] lg:w-0 lg:flex-1 lg:basis-0 lg:transition-[flex-grow] lg:duration-300 lg:ease-out"
          >
            <p className="mb-3 text-xs font-medium tabular-nums text-white/45">
              {p.n}
            </p>

            {/* The open tile lifts out of the row: a little taller, nudged up, so
                it breaks the top and bottom line rather than only getting wider. */}
            <div
              className={`flex flex-col transition-all duration-300 ${
                isOpen
                  ? "h-[420px] lg:-mt-2 lg:h-[444px]"
                  : "h-[420px] lg:h-[420px]"
              } ${
                p.kind === "saving"
                  ? "bg-brand-400"
                  : isOpen
                    ? "border border-white/15 bg-white/[0.09]"
                    : "border border-white/10 bg-white/[0.05]"
              }`}
            >
              <div className="relative flex flex-1 flex-col overflow-hidden p-5">
                {/* Collapsed panels sit under a heavier veil; opening one lifts it. */}
                {image && (
                  <>
                    <Image
                      src={image}
                      alt={title}
                      fill
                      sizes="(max-width: 1024px) 85vw, 480px"
                      className={`object-cover transition duration-500 ${
                        isOpen ? "scale-100" : "scale-105"
                      }`}
                    />
                    <div
                      className={`absolute inset-0 transition duration-500 ${
                        isOpen ? "bg-slate-950/40" : "bg-slate-950/70"
                      }`}
                    />
                  </>
                )}

                <div className="relative flex items-start justify-between gap-3">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      p.kind === "saving"
                        ? "text-slate-900/60"
                        : "text-brand-300"
                    }`}
                  >
                    {p.kind === "home" && p.lead ? "Most common" : ""}
                  </span>
                  <Arrow variant={p.kind === "saving" ? "dark" : "light"} />
                </div>

                {/* Collapsed, the title sits low; open, it rises to the top. */}
                <div className={`relative ${isOpen ? "mt-6" : "mt-auto"}`}>
                  <p
                    className={`font-display font-bold leading-tight transition-all duration-300 ${
                      p.kind === "saving" ? "text-slate-900" : "text-white"
                    } ${isOpen ? "text-2xl" : "text-lg"}`}
                  >
                    {title}
                  </p>

                  {p.kind === "home" && (
                    <>
                      <p
                        className={`mt-1.5 text-xs leading-relaxed text-white/60 ${
                          isOpen ? "block" : "hidden"
                        }`}
                      >
                        {p.example.sub}
                      </p>
                      <p className="mt-2 text-xs text-white/60">
                        {p.example.hours} hours suggested
                      </p>
                    </>
                  )}

                  {p.kind === "saving" && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-900/70">
                      Weekly or fortnightly cleans come at our lower regular
                      rate.
                    </p>
                  )}
                </div>

                {p.kind === "extras" && (
                  <ul className="relative mt-4 space-y-2.5">
                    {shown.map((a) => (
                      <li
                        key={a.key}
                        className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-2 text-sm"
                      >
                        <span className="text-white/80">{a.label}</span>
                        <span className="shrink-0 text-xs text-white/50">
                          +{formatDuration(a.hours)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {p.kind === "saving" && (
                  <div className="relative mt-auto">
                    <p className="tnum font-display text-4xl font-bold leading-none text-slate-900">
                      {perHour}
                      <span className="text-lg font-semibold">/hr</span>
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-900/70">
                      Same standard. Lower hourly rate.
                    </p>
                  </div>
                )}
              </div>

              {/* Detail block. Always present on mobile, revealed by opening on
                  desktop, so prices are never locked behind an interaction. */}
              {hasDetail && (
                <div className={`relative ${isOpen ? "block" : "block lg:hidden"}`}>
                  {/* second action, straddling the seam — expand, then go */}
                  <Arrow
                    variant="solid"
                    className="absolute -top-4 right-5 z-10 shadow-none"
                  />

                  {p.kind === "home" && (
                    <div className="bg-white px-5 py-4">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            Regular
                          </p>
                          <p className="tnum font-display text-3xl font-bold leading-none text-slate-900">
                            {formatGBP(p.example.recurring)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            One-off
                          </p>
                          <p className="tnum text-lg font-semibold text-slate-700">
                            {formatGBP(p.example.oneOff)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2.5 text-xs font-semibold text-brand-700">
                        Save {formatGBP(p.example.oneOff - p.example.recurring)}{" "}
                        every visit
                      </p>
                    </div>
                  )}

                  {p.kind === "extras" && (
                    <p className="bg-white px-5 py-4 text-xs leading-relaxed text-slate-600">
                      {addons.length > shown.length
                        ? `${addons.length - shown.length} more in the quote builder.`
                        : "All of them are in the quote builder."}{" "}
                      Each adds its time to the visit.
                    </p>
                  )}
                </div>
              )}

              {p.kind !== "saving" && (
                <p className="px-5 pb-4 pt-3 text-[11px] font-medium text-white/40">
                  SAAFI Cleaning
                </p>
              )}
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
