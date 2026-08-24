import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import TrustShowcase, { ShowcaseCta } from "@/components/TrustShowcase";
import HeroSearchBar from "@/components/HeroSearchBar";
import PriceSteps from "@/components/PriceSteps";
import { loadPricingAndAddons } from "@/lib/pricingServer";
import {
  formatGBP,
} from "@/lib/pricing";

export const metadata: Metadata = {
  title: "SAAFI Cleaning Service — home cleaning with an honest hourly price",
  description:
    "Family-run home cleaning. See your price online in under a minute — clear hourly rates, no hidden extras, nothing to pay upfront.",
};

export const dynamic = "force-dynamic";

/** Example homes for the price table — costed from the live config, never hardcoded. */
/**
 * The four things a standard clean covers, as an editorial sequence.
 *
 * `image` is a path under /public. Only the living-spaces circle has a photo so
 * far; the rest render as tonal circles until real photography lands, which is a
 * deliberate design state rather than a broken one. Drop a file in and set the
 * path here and it becomes a photograph with no other change.
 */
const ROOMS: {
  n: string;
  title: string;
  copy: string;
  image?: string;
  imagePos?: string;
  tone: string;
}[] = [
  {
    n: "01",
    title: "Kitchen",
    copy: "Surfaces, sink and hob cleaned every visit.",
    tone: "bg-brand-100",
  },
  {
    n: "02",
    title: "Bathrooms",
    copy: "Sink, toilet, bath or shower and visible surfaces cleaned thoroughly.",
    tone: "bg-slate-100",
  },
  {
    n: "03",
    title: "Living spaces",
    copy: "Dusting, vacuuming and surfaces wiped down throughout your main living areas.",
    image: "/hero-cleaner.jpg",
    // cropped low and left so it reads as a different frame to the hero above
    imagePos: "center 72%",
    tone: "bg-brand-50",
  },
  {
    n: "04",
    title: "Floors & finishing touches",
    copy: "Hard floors mopped, carpets vacuumed and bins emptied where needed.",
    tone: "bg-brand-50",
  },
];

const HERO_POINTS: { icon: () => React.ReactElement; text: string }[] = [
  { icon: HomeIcon, text: "Family-run, local team" },
  { icon: SprayIcon, text: "Cleaning products included" },
  { icon: CardIcon, text: "Nothing to pay upfront" },
];

const STEPS = [
  {
    n: "1",
    title: "Tell us about your home",
    text: "Postcode, how many rooms, and how long you'd like us to stay. Takes about a minute.",
  },
  {
    n: "2",
    title: "See your price straight away",
    text: "A real number on screen before you commit — not a callback, not an estimate by email.",
  },
  {
    n: "3",
    title: "We call to confirm",
    text: "A quick chat to lock in your date and time, check we've got your home right, and answer anything you're unsure about.",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do you work out the price?",
    a: "It's an hourly rate — we suggest how long your home is likely to need based on the rooms you tell us about, and you can adjust it up or down before you book. Nothing is hidden and nothing is added afterwards.",
  },
  {
    q: "Do I have to pay online?",
    a: "No. The quote form doesn't take a card. You'll get your price, we'll ring you to confirm the date, and you settle up with us directly.",
  },
  {
    q: "Who brings the cleaning products?",
    a: "We do — they're included in the hourly rate, so there's nothing extra to pay. If you'd rather we used your own products, just tell us on the confirmation call and we'll bring the equipment only.",
  },
  {
    q: "How long will you stay?",
    a: "The quote form suggests a length based on the rooms you tell us about, and you can adjust it. Visits run from a 2-hour minimum up to a full 8-hour day.",
  },
  {
    q: "What if I need to move a clean?",
    a: "Give us a ring as early as you can and we'll do our best to find another slot that works.",
  },
  {
    q: "Which areas do you cover?",
    a: "We're covering more of the area all the time. Put your postcode in to start a quote and we'll confirm we can reach you when we ring to book the date.",
  },
];

export default async function Home() {
  const { cfg, addons } = await loadPricingAndAddons();

  const recurringRate =
    Math.round(
      cfg.hourlyRate * (1 - (cfg.discounts.fortnightly ?? 0) / 100) * 100,
    ) / 100;
  const areas = cfg.serviceAreaPrefixes;

  return (
    <main className="min-h-screen bg-white">
      {/* ---------- hero ---------- */}
      <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
        {/* background: photo over a gradient, so a missing/slow image still reads as design */}
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-slate-700 via-slate-800 to-brand-950" />
        <div
          className="absolute inset-0 -z-10 bg-cover bg-[position:center_18%]"
          style={{ backgroundImage: "url('/hero-cleaner.jpg')" }}
        />
        {/* scrim — keeps the copy legible whatever the photo does */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/35 to-black/65" />

        {/* nav, over the image */}
        <header className="relative z-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-white"
            >
              SAAFI
            </Link>
            <nav className="hidden items-center gap-8 text-sm font-medium text-white/85 md:flex">
              <a className="transition hover:text-white" href="#services">
                Services
              </a>
              <a className="transition hover:text-white" href="#included">
                What&apos;s included
              </a>
              <a className="transition hover:text-white" href="#pricing">
                Pricing
              </a>
              <a className="transition hover:text-white" href="#faqs">
                FAQs
              </a>
            </nav>
            <Link
              href="/quote"
              className="shrink-0 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Get a quote
            </Link>
          </div>
        </header>

        {/* Everything between the nav and the search bar grows to fill the
            viewport, so the hero is one screen on any display instead of the
            sum of a stack of fixed margins. */}
        <div className="relative z-10 flex flex-1 flex-col justify-center gap-8 py-8 lg:gap-12">
          {/* headline */}
          <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
            <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
              A Spotless Home, Without Lifting a Finger
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/80 sm:text-lg">
              Family-run home cleaning with an honest hourly rate — see your
              price online in under a minute.
            </p>
          </div>
        </div>

        {/* search bar — sits on the fold, so it is the last thing in view.
            The benefits and price share its container so they align to its
            edges and read as one group with the form, rather than floating in
            the dead space between the headline and the bar. */}
        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-6 sm:px-8 sm:pb-8">
          <div className="mb-14 flex flex-col items-center justify-between gap-7 sm:flex-row sm:items-end sm:gap-6">
            <ul className="space-y-4">
              {HERO_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3.5 text-white">
                  <Icon />
                  <span className="text-[15px] font-medium leading-none">
                    {text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="shrink-0 text-center sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                Regular cleans from
              </p>
              <p className="tnum mt-2 text-4xl font-bold leading-none text-white sm:text-[2.75rem]">
                {formatGBP(recurringRate)}
                <span className="ml-0.5 text-lg font-medium text-white/85">
                  /hr
                </span>
              </p>
              <span
                aria-hidden="true"
                className="mx-auto mt-3 block h-[5px] w-16 rounded-full bg-brand-200 sm:mr-0"
              />
            </div>
          </div>

          <HeroSearchBar />
        </div>
      </section>

      {/* ---------- plan picker ---------- */}
      <section
        id="services"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20"
      >
        <SectionHead
          title="Find the right clean for your home"
          sub="Simple pricing. The same high standard, however often you need us."
        />

        {/* Regular sits centre on desktop but first in the DOM, so it also leads
            on mobile without duplicating the markup. */}
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-3">
          <PlanCard
            className="lg:order-2"
            featured
            icon={<HomeLine />}
            title="Regular clean"
            price={formatGBP(recurringRate)}
            unit="/hr"
            note={`Save ${formatGBP(cfg.hourlyRate - recurringRate)}/hr`}
            text="Weekly or fortnightly visits — the easiest and best-value way to keep on top of your home."
            points={[
              "Best value",
              "A routine that fits yours",
              "Same standard every visit",
            ]}
          />
          <PlanCard
            className="lg:order-1"
            icon={<CalendarLine />}
            title="One-off clean"
            price={formatGBP(cfg.hourlyRate)}
            unit="/hr"
            text="A single visit, whenever you need it — before guests arrive, after a party, or just to reset the house."
            points={[
              "No commitment",
              "Book a single date",
              "Same standard as regulars",
            ]}
          />
          <PlanCard
            className="lg:order-3"
            icon={<SparkleLine />}
            title="Deep clean"
            price="Call for a price"
            text="For when a regular clean isn't enough. We'll agree exactly what's covered with you first, then price it for your property."
            points={[
              "Scope agreed upfront",
              "Priced on a quick call",
              "Book around your dates",
            ]}
          />
        </div>
      </section>

      {/* ---------- what's included: an editorial spread, not a feature grid ----------
           Deliberately the one asymmetric section on the page. It follows the dark
           pricing block, so the jump to white and photography is the point. */}
      <section
        id="included"
        className="flex min-h-svh scroll-mt-20 flex-col justify-center bg-white py-14 lg:py-16"
      >
        <div className="mx-auto w-full max-w-6xl px-4">
          {/* Columns are placed by hand rather than auto-flowed, so no two blocks
              share a size or a baseline. */}
          {/* heading — left-aligned on purpose, unlike every other section head */}
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 lg:text-4xl">
              Every room, every visit
            </h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-slate-600">
                We don&apos;t just clean what&apos;s obvious. We work through your
                home properly, from kitchens and bathrooms to floors, living
              spaces and the finishing touches.
            </p>
          </div>

          {/* One staggered band rather than two stacked rows: the asymmetry comes
              from four different circle sizes and four different top offsets, which
              is what keeps the whole section inside a single viewport. */}
          <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-12 lg:mt-8 lg:items-start">
            <Room
              {...ROOMS[0]}
              size="md"
              marker="-right-1 top-6"
              className="col-span-12 sm:col-span-6 lg:col-span-3 lg:mt-10"
            />

            {/* dropped furthest to break the baseline */}
            <Room
              {...ROOMS[1]}
              size="sm"
              marker="-left-2 top-8"
              className="col-span-12 sm:col-span-6 lg:col-span-2 lg:mt-24"
            />

            {/* the anchor of the composition */}
            <Room
              {...ROOMS[2]}
              size="lg"
              marker="left-3 -bottom-3"
              className="col-span-12 sm:col-span-7 lg:col-span-4"
            />

            {/* mostly typography, in the negative space on the right */}
            <Room
              {...ROOMS[3]}
              size="xs"
              marker="-right-2 bottom-1"
              className="col-span-12 sm:col-span-5 lg:col-span-3 lg:mt-16"
            />
          </div>
        </div>
      </section>

      {/* ---------- what you can count on ----------
           Stays dark so it still separates the two light sections either side.
           This block used to repeat the pricing above it; it now carries the
           reasons to book that have nothing to do with the number. */}
      <section className="bg-slate-900">
        <div className="mx-auto max-w-[1400px] px-6 py-20 sm:px-10 sm:py-24">
          <h2 className="mx-auto max-w-3xl text-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            What you can count on
          </h2>
          <div className="mt-7 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-12">
            <p className="max-w-md text-[15px] leading-relaxed text-white/70 sm:text-left">
              Getting the price right is the easy part. These are the things
              that decide whether you keep us.
            </p>
            <ShowcaseCta />
          </div>

          {/* Click to expand: the wide "featured" panel is just the open one. */}
          <div className="mt-12 lg:mt-14">
            <TrustShowcase />
          </div>

        </div>
      </section>

      {/* ---------- pricing ---------- */}
      <section id="pricing" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHead
            title="How your price is built"
            sub="No callback, no guesswork. Here's exactly how we get to your number, the same steps the quote form walks you through."
          />
          {/* Extras now live inside the builder, on the right, so the section
              reads as one journey: rooms, hours, frequency, quote, extras. */}
          <PriceSteps cfg={cfg} addons={addons} />
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section
        id="how"
        className="scroll-mt-20 py-16"
      >
        <div className="mx-auto max-w-6xl px-4">
          <SectionHead title="Three steps, no phone tag" />
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white shadow-sm">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- faqs ---------- */}
      <section id="faqs" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20">
        <SectionHead title="Questions we get asked a lot" />
        <div className="mt-8 divide-y divide-slate-100 overflow-hidden ring-1 ring-slate-200">
          {FAQS.map((f) => (
            <details key={f.q} className="group bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-slate-900 transition hover:bg-slate-50">
                {f.q}
                <span className="shrink-0 text-xl font-normal text-brand-600 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- closing CTA ---------- */}
      <section className="border-t border-slate-100 bg-brand-600">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            See your price in under a minute
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-50">
            No card, no commitment — just your postcode and a few details about
            your home.
          </p>
          <Link
            href="/quote"
            className="mt-8 inline-block rounded-full bg-white px-8 py-3.5 text-base font-semibold text-brand-700 shadow-md transition hover:bg-brand-50"
          >
            Start my quote
          </Link>
        </div>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              SAAFI <span className="text-brand-400">Cleaning</span>
            </span>
            <p className="mt-3 text-sm leading-relaxed">
              Family-run home cleaning with straightforward hourly pricing and
              no surprises on the bill.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
              Services
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/quote" className="transition hover:text-brand-400">
                  Regular cleaning
                </Link>
              </li>
              <li>
                <Link href="/quote" className="transition hover:text-brand-400">
                  One-off cleaning
                </Link>
              </li>
              <li>
                <a href="#services" className="transition hover:text-brand-400">
                  Deep cleaning
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
              Company
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#how" className="transition hover:text-brand-400">
                  How it works
                </a>
              </li>
              <li>
                <a href="#pricing" className="transition hover:text-brand-400">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#faqs" className="transition hover:text-brand-400">
                  FAQs
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
              Get in touch
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href="mailto:info@saaficleaningservice.com"
                  className="transition hover:text-brand-400"
                >
                  info@saaficleaningservice.com
                </a>
              </li>
              <li>saaficleaningservice.com</li>
              {areas.length > 0 && (
                <li className="pt-2 text-xs">
                  Covering {areas.join(", ")} and surrounding areas
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs">
            © {new Date().getFullYear()} SAAFI Cleaning Service. All rights
            reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}

/** Extras can be priced flat or purely by the time they add — render whichever applies. */
/* ---------- small presentational bits ---------- */

function Tick({ className = "text-brand-600" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`mt-0.5 shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d="M3 8.5 6.2 12 13 4.5" />
    </svg>
  );
}

/**
 * One block of the editorial spread: a circle, an annotation number, a heading
 * and a line of copy. Size and marker placement are passed in so no two blocks
 * in the composition look alike.
 */
function Room({
  n,
  title,
  copy,
  image,
  imagePos,
  tone,
  size,
  marker,
  className = "",
}: {
  n: string;
  title: string;
  copy: string;
  image?: string;
  imagePos?: string;
  tone: string;
  size: "lg" | "md" | "sm" | "xs";
  /** Tailwind position utilities for the number, so it sits differently each time. */
  marker: string;
  className?: string;
}) {
  // Circles are viewport-width on mobile and capped per size on larger screens,
  // so they scale down instead of overflowing.
  const { width, sizes } = {
    lg: {
      width: "w-[76vw] max-w-[280px] sm:max-w-[300px] lg:max-w-[320px]",
      sizes: "(max-width: 640px) 76vw, 320px",
    },
    md: {
      width: "w-[62vw] max-w-[230px] lg:max-w-[240px]",
      sizes: "(max-width: 640px) 62vw, 240px",
    },
    sm: {
      width: "w-[50vw] max-w-[170px]",
      sizes: "(max-width: 640px) 50vw, 170px",
    },
    xs: {
      width: "w-[44vw] max-w-[150px]",
      sizes: "(max-width: 640px) 44vw, 150px",
    },
  }[size];

  return (
    <div className={className}>
      <div className={`relative ${width}`}>
        <div className="relative aspect-square overflow-hidden rounded-full">
          {image ? (
            <Image
              src={image}
              alt={title}
              fill
              sizes={sizes}
              className="object-cover"
              style={imagePos ? { objectPosition: imagePos } : undefined}
            />
          ) : (
            <div className={`h-full w-full ${tone}`} />
          )}
        </div>
        <span
          className={`absolute flex size-12 items-center justify-center rounded-full bg-white text-sm font-semibold tabular-nums text-slate-900 ring-1 ring-slate-200 lg:size-14 ${marker}`}
        >
          {n}
        </span>
      </div>
      <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-slate-900 lg:text-xl">
        {title}
      </h3>
      <p className="mt-1.5 max-w-[15rem] text-sm leading-relaxed text-slate-600">
        {copy}
      </p>
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {title}
      </h2>
      {sub && <p className="mx-auto mt-3 max-w-2xl text-slate-600">{sub}</p>}
    </div>
  );
}

function PlanCard({
  icon,
  title,
  price,
  unit,
  note,
  text,
  points,
  featured,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  price: string;
  unit?: string;
  note?: string;
  text: string;
  points: string[];
  featured?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative flex flex-col  border p-7 ${
        featured
          ? "border-brand-300 bg-brand-50/70 shadow-sm lg:-mt-4 lg:pb-9"
          : "border-slate-200 bg-white"
      } ${className}`}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
          Most popular
        </span>
      )}

      <span className="text-brand-600">{icon}</span>

      <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>

      <p className="mt-2 flex items-baseline gap-1">
        <span
          className={`tnum font-extrabold tracking-tight text-brand-700 ${
            unit ? "text-3xl" : "text-2xl"
          }`}
        >
          {price}
        </span>
        {unit && (
          <span className="text-base font-medium text-brand-700/75">
            {unit}
          </span>
        )}
      </p>
      {note ? (
        <p className="mt-1.5 text-xs font-semibold text-brand-700">{note}</p>
      ) : (
        <p className="mt-1.5 text-xs text-transparent" aria-hidden="true">
          &nbsp;
        </p>
      )}

      <p className="mt-5 text-sm leading-relaxed text-slate-600">{text}</p>

      <ul className="mt-6 mb-8 space-y-3 text-sm text-slate-700">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5">
            <Tick />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/quote"
        className={`mt-auto block w-full rounded-full px-4 py-3 text-center text-sm font-semibold transition ${
          featured
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "border border-slate-300 bg-white text-slate-900 hover:border-slate-900 hover:bg-slate-900 hover:text-white"
        }`}
      >
        Get a quote
      </Link>
    </div>
  );
}

/* ---------- hero benefit icons (SVG Repo assets, recoloured via currentColor) ---------- */

function HomeIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M12 3.1 1.8 11.4a1 1 0 0 0 1.26 1.55l.44-.36V20a1.4 1.4 0 0 0 1.4 1.4h4.3v-5.3h5.6v5.3h4.3A1.4 1.4 0 0 0 20.5 20v-7.41l.44.36a1 1 0 0 0 1.26-1.55L12 3.1Z" />
    </svg>
  );
}

function SprayIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="-14.94 0 122.88 122.88"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M14.6,43.74h15.78c4.87,0,6.1,3.36,6.1,7.71c0,2.02-0.29,4.29-0.58,6.49c-0.47,3.64-0.91,7.06,0.09,8.3 c1.67,2.08,4.08,4.49,6.66,7.07c6.39,6.4,13.77,13.79,14.32,20.41c0.33,4.05,0.4,9.27-0.33,14.09c-0.56,3.72-1.61,7.23-3.38,9.85 c-0.91,1.34-1.97,2.54-3.33,3.46c-1.37,0.92-3.02,1.55-5.09,1.74c-0.03,0-0.07,0-0.1,0v0H18.08c-0.05,0-0.1,0-0.14-0.01 c-2.84-0.16-5.4-0.81-7.55-2.13c-2.21-1.36-3.95-3.41-5.1-6.34c-0.03-0.08-0.05-0.16-0.06-0.24c-2.42-11.87-3.41-23.7-2.25-35.36 c1.16-11.71,4.48-23.25,10.68-34.47C13.84,43.95,14.22,43.75,14.6,43.74L14.6,43.74L14.6,43.74z M4.75,84.84 c18.15,4.31,27.95-9.61,44.29-1.6c-2.41-2.85-5.26-5.71-7.92-8.38c-2.62-2.62-5.07-5.08-6.82-7.24c-1.59-1.97-1.09-5.84-0.56-9.95 c0.27-2.1,0.55-4.27,0.55-6.21c0-3.1-0.79-5.51-3.91-5.51H15.25C9.41,56.72,6.26,67.78,5.15,79C4.95,80.94,4.82,82.89,4.75,84.84 L4.75,84.84z M46.12,6.97L46,20.87c0,0.5-0.34,0.92-0.8,1.04l0,0c-3.35,0.95-6.3,2.23-8.56,4.22c-2.2,1.94-3.78,4.6-4.49,8.36v4.75 c0,0.61-0.49,1.1-1.1,1.1H15.12c-0.95,0.09-1.71-0.13-2.3-0.72c-0.54-0.55-0.83-1.39-0.84-2.57c0-0.04,0-0.08,0-0.11 c0.36-3.9-0.44-6.81-2.28-9.08c-1.89-2.32-4.93-4.05-8.98-5.52c-0.57-0.21-0.86-0.83-0.66-1.4l0-0.01h0c2.19-5.8,5.57-9.5,9.8-11.8 c4.18-2.27,9.16-3.13,14.62-3.28c3.41-0.09,6.84-0.16,10.28-0.17c3.44-0.01,6.87,0.03,10.29,0.16C45.67,5.85,46.14,6.36,46.12,6.97 L46.12,6.97L46.12,6.97z M43.82,20.04l0.1-12.05c-3.06-0.1-6.11-0.13-9.15-0.12c-3.4,0.01-6.81,0.08-10.23,0.17 c-5.14,0.14-9.79,0.94-13.63,3.02c-3.54,1.92-6.41,4.96-8.39,9.63c3.9,1.52,6.88,3.35,8.88,5.8c2.21,2.71,3.17,6.11,2.77,10.6 c0.01,0.55,0.09,0.88,0.22,1.02c0.07,0.07,0.25,0.09,0.52,0.07c0.06-0.01,0.12-0.02,0.18-0.02h14.87v-3.73h0 c0-0.06,0.01-0.13,0.02-0.19c0.8-4.36,2.63-7.45,5.21-9.73C37.56,22.41,40.5,21.04,43.82,20.04L43.82,20.04z M48.36,6.65 l0.09,13.36h6.53c0.92,0.03,1.39-0.74,1.17-2.73V8.9c-0.02-0.73-0.32-1.21-0.88-1.46L48.36,6.65L48.36,6.65z M70.11,10.99 c1.89,0,3.42,1.29,3.42,2.89c0,1.6-1.53,2.89-3.42,2.89c-1.89,0-3.42-1.29-3.42-2.89C66.69,12.28,68.22,10.99,70.11,10.99 L70.11,10.99z M89.58,10.7c1.89,0,3.42,1.29,3.42,2.89c0,1.6-1.53,2.89-3.42,2.89c-1.89,0-3.42-1.29-3.42-2.89 C86.16,11.99,87.69,10.7,89.58,10.7L89.58,10.7z M89.2,21.59c1.89,0,3.42,1.29,3.42,2.89c0,1.6-1.53,2.89-3.42,2.89 s-3.42-1.29-3.42-2.89C85.78,22.88,87.31,21.59,89.2,21.59L89.2,21.59z M79.75,16.48c1.89,0,3.42,1.29,3.42,2.89 c0,1.6-1.53,2.89-3.42,2.89c-1.89,0-3.42-1.29-3.42-2.89C76.33,17.78,77.86,16.48,79.75,16.48L79.75,16.48z M89.58,0 C91.47,0,93,1.29,93,2.89c0,1.6-1.53,2.89-3.42,2.89c-1.89,0-3.42-1.29-3.42-2.89C86.16,1.29,87.69,0,89.58,0L89.58,0z M79.85,5.49 c1.89,0,3.42,1.29,3.42,2.89c0,1.6-1.53,2.89-3.42,2.89c-1.89,0-3.42-1.29-3.42-2.89C76.42,6.79,77.96,5.49,79.85,5.49L79.85,5.49z M36.89,35.65c1.16-4.65,3.94-7.71,8.62-8.9c1.05,7.48,3.33,13.49,6.51,18.38c1.94,2.74-1.21,5.57-3.48,2.68l-7.36-12.04 L36.89,35.65L36.89,35.65z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="46" y="40" width="6" height="4" />
      <rect y="20" width="64" height="8" />
      <path d="M64,18v-6c0-2.211-1.789-4-4-4H4c-2.211,0-4,1.789-4,4v6H64z" />
      <path d="M0,30v22c0,2.211,1.789,4,4,4h56c2.211,0,4-1.789,4-4V30H0z M21,46H11c-0.553,0-1-0.447-1-1s0.447-1,1-1h10 c0.553,0,1,0.447,1,1S21.553,46,21,46z M25,40H11c-0.553,0-1-0.447-1-1s0.447-1,1-1h14c0.553,0,1,0.447,1,1S25.553,40,25,40z M35,40h-6c-0.553,0-1-0.447-1-1s0.447-1,1-1h6c0.553,0,1,0.447,1,1S35.553,40,35,40z M54,45c0,0.553-0.447,1-1,1h-8 c-0.553,0-1-0.447-1-1v-6c0-0.553,0.447-1,1-1h8c0.553,0,1,0.447,1,1V45z" />
    </svg>
  );
}

/* ---------- plan icons: thin line, teal, ~30px ---------- */

const PLAN_ICON = {
  width: 30,
  height: 30,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
} as const;

function CalendarLine() {
  return (
    <svg {...PLAN_ICON}>
      <rect x="3.2" y="5" width="17.6" height="16" rx="2.4" />
      <path d="M3.2 9.8h17.6M8 3v4M16 3v4" />
    </svg>
  );
}

function HomeLine() {
  return (
    <svg {...PLAN_ICON}>
      <path d="M3.4 10.7 12 4l8.6 6.7" />
      <path d="M5.9 9.6V20h12.2V9.6" />
      <path d="M10 20v-4.6h4V20" />
    </svg>
  );
}

function SparkleLine() {
  return (
    <svg {...PLAN_ICON}>
      <path d="M12 3.2 13.7 8l4.8 1.7-4.8 1.7L12 16.2l-1.7-4.8L5.5 9.7 10.3 8 12 3.2Z" />
      <path d="M18.6 15.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" />
    </svg>
  );
}
