"use client";

import { useState } from "react";
import Link from "next/link";
import {
  recommendedHours,
  quotePrice,
  clampHours,
  formatGBP,
  FREQUENCY_LABEL,
  type PricingConfig,
  type Frequency,
  type RoomCounts,
} from "@/lib/pricing";

/**
 * "How your price is built" — a live miniature of the quote wizard. The panels
 * are the real controls, running the same pricing functions the wizard and the
 * admin CRM use, so the number on the right is a genuine quote rather than an
 * illustration. Whatever the visitor lands on carries into /quote.
 */
export default function PriceSteps({ cfg }: { cfg: PricingConfig }) {
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [hours, setHours] = useState<number | null>(null); // null = follow the recommendation
  const [frequency, setFrequency] = useState<Frequency>("fortnightly");

  const rooms: RoomCounts = { bedrooms, bathrooms, diningRooms: 0, livingRooms: 1 };
  const recommended = recommendedHours(rooms, cfg);
  const chosenHours = hours ?? recommended;
  const price = quotePrice(chosenHours, true, cfg, frequency);

  const recurringRate =
    Math.round(cfg.hourlyRate * (1 - (cfg.discounts.fortnightly ?? 0) / 100) * 100) / 100;
  const hourlySaving = Math.round((cfg.hourlyRate - recurringRate) * 100) / 100;

  const quoteHref = `/quote?${new URLSearchParams({
    bedrooms: String(bedrooms),
    bathrooms: String(bathrooms),
    frequency,
  })}`;

  const panels = [
    {
      label: "Your rooms",
      sub: "Tell us what we're cleaning.",
      body: (
        <div className="space-y-2.5">
          <MiniRow
            label="Bedrooms"
            value={bedrooms}
            onChange={(n) => setBedrooms(Math.min(6, Math.max(0, n)))}
          />
          <MiniRow
            label="Bathrooms"
            value={bathrooms}
            onChange={(n) => setBathrooms(Math.min(4, Math.max(0, n)))}
          />
        </div>
      ),
    },
    {
      label: "We suggest the hours",
      sub: "Adjustable — you stay in control.",
      body: (
        <div className="flex items-center justify-center gap-4 py-3">
          <MiniStep
            label="Fewer hours"
            disabled={chosenHours <= cfg.minHours}
            onClick={() => setHours(clampHours(chosenHours - 0.5, cfg))}
          >
            −
          </MiniStep>
          <div className="text-center">
            <p className="tnum text-3xl font-extrabold tracking-tight text-slate-900">
              {chosenHours}h
            </p>
            {hours === null || hours === recommended ? (
              <p className="text-[11px] font-semibold text-brand-600">recommended</p>
            ) : (
              <button
                onClick={() => setHours(null)}
                className="text-[11px] font-semibold text-slate-400 underline underline-offset-2 transition hover:text-brand-600"
              >
                reset to {recommended}h
              </button>
            )}
          </div>
          <MiniStep
            label="More hours"
            disabled={chosenHours >= cfg.maxHours}
            onClick={() => setHours(clampHours(chosenHours + 0.5, cfg))}
          >
            +
          </MiniStep>
        </div>
      ),
    },
    {
      label: "You pick how often",
      sub: `Regular visits save ${formatGBP(hourlySaving)} an hour.`,
      body: (
        <div className="space-y-1.5">
          {(["one_off", "fortnightly", "weekly"] as Frequency[]).map((f) => (
            <MiniOption
              key={f}
              label={FREQUENCY_LABEL[f]}
              badge={f === "fortnightly" ? "Best value" : undefined}
              selected={frequency === f}
              onClick={() => setFrequency(f)}
            />
          ))}
        </div>
      ),
    },
    {
      label: "That's your price",
      sub: "Shown before you commit.",
      body: (
        <div className="py-2 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
            Your quote
          </p>
          <p className="tnum mt-1 text-3xl font-extrabold tracking-tight text-brand-700">
            {formatGBP(price)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {bedrooms} bed · {chosenHours} hours · {FREQUENCY_LABEL[frequency].toLowerCase()}
          </p>
          <Link
            href={quoteHref}
            className="mt-3 inline-block rounded-lg bg-brand-600 px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-brand-700"
          >
            Book this clean
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="relative mt-12">
      {/* Connectors sit behind the panels and their labels, and are routed to
          stay in the panel band so they never cross a caption. */}
      <svg
        className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block"
        viewBox="0 0 1000 400"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="step-arrow"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="#6fe2da" />
          </marker>
        </defs>
        <g
          fill="none"
          stroke="#6fe2da"
          strokeWidth="2"
          strokeDasharray="2 8"
          strokeLinecap="round"
          markerEnd="url(#step-arrow)"
        >
          <path d="M232 95 C 285 25, 320 40, 352 150" />
          <path d="M478 215 C 520 195, 552 150, 604 128" />
          <path d="M732 95 C 785 25, 820 40, 858 150" />
        </g>
      </svg>

      <Reveal>
        <ol className="relative z-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          {panels.map((p, i) => (
            <li key={p.label} className={`step-rise ${i % 2 === 1 ? "lg:mt-24" : ""}`}>
              <div className="flex min-h-[132px] items-center rounded-2xl bg-white p-4 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200">
                <div className="w-full">{p.body}</div>
              </div>
              <p className="mt-4 text-sm font-bold text-slate-900">
                <span className="text-brand-600">{i + 1}.</span> {p.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{p.sub}</p>
            </li>
          ))}
        </ol>
      </Reveal>
    </div>
  );
}

/* ---------- controls ---------- */

function MiniRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className="flex items-center gap-2">
        <MiniStep small label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(value - 1)}>
          −
        </MiniStep>
        <span className="tnum w-4 text-center text-sm font-bold text-slate-900">{value}</span>
        <MiniStep small label={`More ${label.toLowerCase()}`} onClick={() => onChange(value + 1)}>
          +
        </MiniStep>
      </span>
    </div>
  );
}

function MiniStep({
  children,
  small,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  small?: boolean;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500 transition hover:bg-brand-100 hover:text-brand-700 active:scale-90 disabled:opacity-35 disabled:hover:bg-slate-100 disabled:hover:text-slate-500 ${
        small ? "h-5 w-5 text-[11px]" : "h-8 w-8 text-sm"
      }`}
    >
      {children}
    </button>
  );
}

function MiniOption({
  label,
  badge,
  selected,
  onClick,
}: {
  label: string;
  badge?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
        selected
          ? "bg-brand-50 font-bold text-brand-800 ring-1 ring-brand-300"
          : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      <span>{label}</span>
      {badge && (
        <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

/* Local copy of the reveal wrapper so this component is self-contained. */
function Reveal({ children }: { children: React.ReactNode }) {
  const [seen, setSeen] = useState(false);
  return (
    <div
      ref={(el) => {
        if (!el || seen || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              setSeen(true);
              io.disconnect();
            }
          },
          { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
        );
        io.observe(el);
      }}
      data-reveal={seen ? "in" : undefined}
    >
      {children}
    </div>
  );
}
