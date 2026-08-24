"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  recommendedHours,
  quotePrice,
  clampHours,
  addonsHours,
  formatGBP,
  formatDuration,
  FREQUENCY_LABEL,
  type PricingConfig,
  type Frequency,
  type RoomCounts,
  type Addon,
} from "@/lib/pricing";

/**
 * "How your price is built" — a live miniature of the quote wizard, laid out as
 * a guided journey: the step rail on the left, the controls in the middle, the
 * payoff on the right.
 *
 * The controls are the real thing, running the same pricing functions the
 * wizard and the booking API use, so the number on the right is a genuine quote
 * rather than an illustration. Whatever the visitor lands on carries into
 * /quote, add-ons included.
 *
 * The quote card is the only dark object in a pale section. That is what makes
 * it read as the destination, rather than a fourth white card in a row of them.
 */

/* ---------- icons: authored here, one stroke weight, no new dependency ---------- */

function Ico({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const BedIcon = () => (
  <Ico>
    <path d="M3 19v-8h16a2 2 0 0 1 2 2v6" />
    <path d="M3 19h18M3 15h18M3 11V6" />
    <path d="M7 11V9.5A1.5 1.5 0 0 1 8.5 8h3A1.5 1.5 0 0 1 13 9.5V11" />
  </Ico>
);
const BathIcon = () => (
  <Ico>
    <path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2Z" />
    <path d="M6 12V6.5A2.5 2.5 0 0 1 10.4 5" />
    <path d="M9.5 7.5h2" />
    <path d="M7.5 19.5 6.5 22M16.5 19.5l1 2.5" />
  </Ico>
);
const OvenIcon = () => (
  <Ico>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M4 9h16M7.5 6h.01M11 6h.01" />
    <rect x="8" y="12.5" width="8" height="5.5" rx="1" />
  </Ico>
);
const FridgeIcon = () => (
  <Ico>
    <rect x="6" y="2" width="12" height="20" rx="1" />
    <path d="M6 10h12M9 5.5v2.5M9 13v3" />
  </Ico>
);
const WindowIcon = () => (
  <Ico>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M12 3v18M4 12h16" />
  </Ico>
);
const LaundryIcon = () => (
  <Ico>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <circle cx="12" cy="14" r="3.8" />
    <path d="M7.5 6.5h.01M10.5 6.5h.01" />
  </Ico>
);
const DustIcon = () => (
  <Ico>
    <path d="M14.5 2.5 21 9l-5.5 5.5L9 8l5.5-5.5Z" />
    <path d="M9 8l-4.5 4.5a3 3 0 0 0 4 4L13 12" />
    <path d="M3 21.5h5" />
  </Ico>
);
const CheckIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-3"
    aria-hidden="true"
  >
    <path d="M3 8.5l3.2 3.2L13 5" />
  </svg>
);

/** Falls back to the dusting glyph so an unknown add-on key still gets an icon. */
function ExtraIcon({ id }: { id: string }) {
  const map: Record<string, () => React.ReactElement> = {
    oven: OvenIcon,
    fridge: FridgeIcon,
    windows: WindowIcon,
    ironing: LaundryIcon,
    laundry: LaundryIcon,
    dusting: DustIcon,
    cupboards: OvenIcon,
  };
  const Icon = map[id] ?? DustIcon;
  return <Icon />;
}

/** One dash language for the whole section, so the connectors read as a system. */
const DASH = "border-l border-dashed border-brand-300";

/* ---------- section ---------- */

export default function PriceSteps({
  cfg,
  addons = [],
}: {
  cfg: PricingConfig;
  addons?: Addon[];
}) {
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [hours, setHours] = useState<number | null>(null); // null = follow the recommendation
  const [frequency, setFrequency] = useState<Frequency>("fortnightly");
  const [extras, setExtras] = useState<string[]>([]);

  const rooms: RoomCounts = { bedrooms, bathrooms, diningRooms: 0, livingRooms: 1 };
  const recommended = recommendedHours(rooms, cfg);
  const chosenHours = hours ?? recommended;

  const chosen = useMemo(
    () => addons.filter((a) => extras.includes(a.key)),
    [addons, extras],
  );
  const extraHours = addonsHours(chosen);
  const extrasTotal = chosen.reduce((s, a) => s + a.price, 0);
  const totalHours = chosenHours + extraHours;

  // The same call the wizard and the booking API make.
  const price = quotePrice(totalHours, true, cfg, frequency, extrasTotal);

  const recurringRate =
    Math.round(cfg.hourlyRate * (1 - (cfg.discounts.fortnightly ?? 0) / 100) * 100) / 100;
  const hourlySaving = Math.round((cfg.hourlyRate - recurringRate) * 100) / 100;

  const quoteHref = `/quote?${new URLSearchParams({
    bedrooms: String(bedrooms),
    bathrooms: String(bathrooms),
    frequency,
    ...(extras.length ? { addons: extras.join(",") } : {}),
  })}`;

  const steps = [
    { n: "01", title: "Your rooms", sub: "Tell us what we're cleaning." },
    { n: "02", title: "We suggest the hours", sub: "Adjustable, you stay in control." },
    {
      n: "03",
      title: "You pick how often",
      sub: `Regular visits save ${formatGBP(hourlySaving)} an hour.`,
    },
  ];

  return (
    <div className="relative mt-12">
      {/* Contour linework, pushed out past the content so the cards don't sit on
          top of it. Decorative, desktop only. */}
      <svg
        className="pointer-events-none absolute -left-24 -right-24 -top-10 hidden h-[calc(100%+5rem)] w-[calc(100%+12rem)] xl:block"
        viewBox="0 0 1400 660"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g fill="none" stroke="#14807b" strokeOpacity="0.1" strokeWidth="1">
          <path d="M-20 120C60 44 140 30 196 112s118 108 176 74" />
          <path d="M-20 152C60 76 140 62 196 144s118 108 176 74" />
          <path d="M-20 184C60 108 140 94 196 176s118 108 176 74" />
          <path d="M1420 500c-90 62-176 50-236-24s-124-96-186-58" />
          <path d="M1420 532c-90 62-176 50-236-24s-124-96-186-58" />
          <path d="M1420 564c-90 62-176 50-236-24s-124-96-186-58" />
        </g>
      </svg>

      <div className="relative grid grid-cols-12 gap-x-10 gap-y-10">
        {/* ---------- left rail + centre controls ---------- */}
        <div className="col-span-12 lg:col-span-8">
          <div className="grid">
            {/* Each row pairs a step with its card, so the rail always lines up
                with the control it describes. */}
            <StepRow step={steps[0]}>
              <Card>
                <RoomRow
                  icon={<BedIcon />}
                  label="Bedrooms"
                  value={bedrooms}
                  onChange={(n) => setBedrooms(Math.min(6, Math.max(0, n)))}
                  max={6}
                />
                <div className="my-3 h-px bg-slate-100" />
                <RoomRow
                  icon={<BathIcon />}
                  label="Bathrooms"
                  value={bathrooms}
                  onChange={(n) => setBathrooms(Math.min(4, Math.max(0, n)))}
                  max={4}
                />
              </Card>
            </StepRow>

            {/* Tallest of the three: this is the calculation moment. */}
            <StepRow step={steps[1]}>
              <Card className="flex items-center justify-center gap-6 py-9">
                <Stepper
                  label="Fewer hours"
                  disabled={chosenHours <= cfg.minHours}
                  onClick={() => setHours(clampHours(chosenHours - 0.5, cfg))}
                >
                  −
                </Stepper>
                <div className="text-center">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    Suggested time
                  </p>
                  <p className="tnum mt-1.5 font-display text-6xl font-extrabold leading-none tracking-tight text-slate-900">
                    {chosenHours}
                    <span className="text-3xl font-bold">h</span>
                  </p>
                  {hours === null || hours === recommended ? (
                    <span className="mt-3 inline-block bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                      recommended
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setHours(null)}
                      className="mt-3 inline-block bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    >
                      reset to {recommended}h
                    </button>
                  )}
                </div>
                <Stepper
                  label="More hours"
                  disabled={chosenHours >= cfg.maxHours}
                  onClick={() => setHours(clampHours(chosenHours + 0.5, cfg))}
                >
                  +
                </Stepper>
              </Card>
            </StepRow>

            <StepRow step={steps[2]} last>
              <Card className="space-y-2">
                {(["one_off", "fortnightly", "weekly"] as Frequency[]).map((f) => (
                  <FrequencyOption
                    key={f}
                    label={FREQUENCY_LABEL[f]}
                    badge={f === "fortnightly" ? "Best value" : undefined}
                    selected={frequency === f}
                    onClick={() => setFrequency(f)}
                  />
                ))}
              </Card>
            </StepRow>
          </div>
        </div>

        {/* ---------- right: the payoff ---------- */}
        <div className="col-span-12 lg:col-span-4">
          {/* The one dark object in a pale section. No background wash needed:
              the contrast does the anchoring on its own. */}
          <div className="bg-brand-900 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-200/80">
              Your quote
            </p>
            <p className="tnum mt-2 font-display text-6xl font-extrabold leading-none tracking-tight text-brand-300">
              {formatGBP(price)}
            </p>
            <p className="mt-3 text-sm text-white/70">
              {bedrooms} bed · {totalHours} hours ·{" "}
              {FREQUENCY_LABEL[frequency].toLowerCase()}
            </p>
            <Link
              href={quoteHref}
              className="group mt-6 flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            >
              Book this clean
              <svg
                viewBox="0 0 16 16"
                className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" />
              </svg>
            </Link>
          </div>

          {/* Butted straight against the quote, no gap: price then what you can
              add to it is one thought, not two panels. */}
          {addons.length > 0 && (
            <div className="border border-t-0 border-slate-200 bg-white p-5">
              <div className="flex items-baseline gap-2.5">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Add a little extra
                </h3>
                <span className="bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Optional
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Only add what you need. We&apos;ll include the time and the
                price.
              </p>

              <div className="mt-4 space-y-1.5">
                {addons.map((a) => {
                  const on = extras.includes(a.key);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setExtras(
                          on
                            ? extras.filter((k) => k !== a.key)
                            : [...extras, a.key],
                        )
                      }
                      className={`flex w-full items-center gap-3 border px-3.5 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                        on
                          ? "border-brand-300 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/40"
                      }`}
                    >
                      <span className={on ? "text-brand-700" : "text-slate-400"}>
                        <ExtraIcon id={a.key} />
                      </span>
                      <span
                        className={`flex-1 text-sm font-medium ${
                          on ? "text-brand-900" : "text-slate-700"
                        }`}
                      >
                        {a.label}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {a.price > 0
                          ? `+${formatGBP(a.price)}`
                          : a.hours > 0
                            ? `+${formatDuration(a.hours)}`
                            : "Ask us"}
                      </span>
                      <span
                        className={`flex size-[18px] shrink-0 items-center justify-center border ${
                          on
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-slate-300 bg-white text-transparent"
                        }`}
                      >
                        <CheckIcon />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- layout pieces ---------- */

/** A step marker and its copy, paired with the control it describes. */
function StepRow({
  step,
  last,
  children,
}: {
  step: { n: string; title: string; sub: string };
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 items-stretch gap-x-6 gap-y-4">
      <div className="col-span-12 lg:col-span-4">
        <div className="flex h-full gap-3.5">
          <div className="flex flex-col items-center">
            <span className="tnum flex size-11 shrink-0 items-center justify-center rounded-full border border-brand-300 bg-white text-sm font-bold text-brand-700">
              {step.n}
            </span>
            {/* The rail runs flush between markers so it reads as one line. */}
            {!last && (
              <span aria-hidden="true" className={`w-px flex-1 ${DASH} hidden lg:block`} />
            )}
          </div>
          <div className="max-w-[15rem] pt-1.5">
            <p className="font-display text-base font-bold leading-snug text-slate-900">
              {step.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{step.sub}</p>
          </div>
        </div>
      </div>

      {/* Card capped well short of the column so it fits its contents rather
          than stretching, and the slack becomes breathing room before the quote. */}
      <div className="col-span-12 lg:col-span-8">
        <div className="max-w-[470px]">
          {children}
          {/* Same dash language as the rail, continuing the sequence. */}
          {!last && (
            <span
              aria-hidden="true"
              className={`mx-auto my-3 hidden h-7 w-px lg:block ${DASH}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function RoomRow({
  icon,
  label,
  value,
  onChange,
  max,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (n: number) => void;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1 text-sm font-medium text-slate-600">{label}</span>
      <span className="flex items-center gap-2.5">
        <Stepper
          label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
        >
          −
        </Stepper>
        <span className="tnum w-5 text-center text-lg font-bold text-slate-900">
          {value}
        </span>
        <Stepper
          label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </Stepper>
      </span>
    </div>
  );
}

function Stepper({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
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
      className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-base font-bold text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-90 disabled:opacity-35 disabled:hover:border-slate-200 disabled:hover:bg-slate-50 disabled:hover:text-slate-600"
    >
      {children}
    </button>
  );
}

function FrequencyOption({
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
      className={`flex w-full items-center justify-between gap-3 border px-3.5 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
        selected
          ? "border-brand-300 bg-brand-50 font-semibold text-brand-900"
          : "border-transparent bg-slate-50 font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      <span>{label}</span>
      {badge && (
        <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
