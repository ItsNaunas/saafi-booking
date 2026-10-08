import type { Metadata } from "next";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import heroCleaner from "../../public/hero-cleaner.jpg";
import livingRoomHero from "../../public/living-room-hero.jpg";
import roomKitchen from "../../public/room-kitchen.jpg";
import roomBathroom from "../../public/room-bathroom.jpg";
import roomFloors from "../../public/room-floors.jpg";
import Link from "next/link";
import TrustShowcase, { ShowcaseCta } from "@/components/TrustShowcase";
import HeroSearchBar from "@/components/HeroSearchBar";
import PriceSteps from "@/components/PriceSteps";
import VisitJourney from "@/components/VisitJourney";
import TheFamily from "@/components/TheFamily";
import SafetyChecks from "@/components/SafetyChecks";
import Reviews from "@/components/Reviews";
import ServiceArea from "@/components/ServiceArea";
import StickyQuoteBar from "@/components/StickyQuoteBar";
import StickyHeader from "@/components/StickyHeader";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import AnimatedPrice from "@/components/AnimatedPrice";
import {
  House,
  SprayCan,
  CreditCard,
  CalendarDays,
  Sparkles,
  Check,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import Icon from "@/components/Icon";
import { contact, site, address, serviceAreas as businessAreas, socials } from "@/lib/business";
import { loadPricingAndAddons } from "@/lib/pricingServer";
import { formatGBP, quotePrice, recommendedHours } from "@/lib/pricing";
import { deepPrice } from "@/lib/deepClean";

export const metadata: Metadata = {
  // The title is the strongest ranking signal on the page, so it leads with
  // the search people actually type ("cleaners Oxford") and keeps the brand.
  title: "House Cleaners in Oxford & Oxfordshire | SAAFI Cleaning Service",
  description:
    "Family-run home cleaning across Oxford, Abingdon, Witney, Bicester, Didcot and the rest of Oxfordshire. Regular, one-off and deep cleans — see your price online in under a minute.",
};

// Pricing config changes by hand, not by the minute — a 5-minute-stale price
// is a fair trade for not paying full TTFB on every hit.
export const revalidate = 300;

/** Example homes for the price table — costed from the live config, never hardcoded. */
/**
 * The four things a standard clean covers, as an editorial sequence.
 *
 * `image` is a path under /public. Three of the four are licensed Unsplash
 * stock standing in until SAAFI's own photography lands — see
 * public/IMAGE-CREDITS.md. They are rooms, not people, so nothing here makes a
 * claim about the business. Swap the path and the circle changes with it.
 */
const ROOMS: {
  n: string;
  title: string;
  copy: string;
  image?: StaticImageData;
  imagePos?: string;
  tone: string;
}[] = [
  {
    n: "01",
    title: "Kitchen",
    copy: "Surfaces, sink and hob cleaned every visit.",
    image: roomKitchen,
    imagePos: "center 55%",
    tone: "bg-brand-100",
  },
  {
    n: "02",
    title: "Bathrooms",
    copy: "Sink, toilet, bath or shower and visible surfaces cleaned thoroughly.",
    image: roomBathroom,
    imagePos: "center 42%",
    tone: "bg-slate-100",
  },
  {
    n: "03",
    title: "Hallways & landings",
    copy: "The common areas most cleaners skip — floors, bannisters and surfaces on the way through.",
    image: heroCleaner,
    // cropped low and left so it reads as a different frame to the hero above
    imagePos: "center 72%",
    tone: "bg-brand-50",
  },
  {
    n: "04",
    title: "Floors & finishing touches",
    copy: "Hard floors mopped, carpets vacuumed and bins emptied where needed.",
    image: roomFloors,
    imagePos: "center 62%",
    tone: "bg-brand-50",
  },
];

const HERO_POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: House, text: "Family-run, local team" },
  { icon: SprayCan, text: "We bring the products, or use your own" },
  { icon: CreditCard, text: "One price, agreed before we start" },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do you work out the price?",
    a: "By the time your home needs. We suggest a length based on the rooms you tell us about, you can adjust it up or down, and the price follows. Nothing is hidden and nothing is added afterwards without asking you first.",
  },
  {
    q: "When do I pay?",
    a: "You pay for the clean when you book it, and we ring you to confirm the date and time. If anything about the job changes on the day we agree it with you first and send a separate link for the difference — we never take more without asking.",
  },
  {
    q: "Who brings the cleaning products?",
    a: "Whichever you prefer, and you choose when you book. We can bring everything for £5 a visit, or use the products you already have at no extra cost — plenty of people would rather we used their own, whether that's a fabric they know or simply no bleach in the house.",
  },
  {
    q: "How long will you stay?",
    a: "The quote form suggests a length based on the rooms you tell us about, and you can adjust it. Visits run from a 2-hour minimum up to a full 8-hour day.",
  },
  {
    q: "What if I need to move a clean?",
    a: "Give us a ring as early as you can and we'll do our best to find another slot that works. As long as we know a day or so before, there's nothing to pay.",
  },
  {
    q: "Do I need to be home?",
    a: "Only if you'd rather be. Plenty of our regulars are at work when we come. We'll agree how we get in on the confirmation call — some people leave a key with us, some fit a keysafe, and some prefer to be there for the first visit and go from there once they know us.",
  },
  {
    q: "Is it the same cleaner each time?",
    a: "For regular cleans we keep you with the same person wherever we can, because a cleaner who already knows your home does a better job of it. If they're ever off, we'll tell you before the visit rather than send a stranger unannounced.",
  },
  {
    q: "What about pets?",
    a: "No problem at all. Just tell us on the call what you've got and whether they'll be loose while we're there, so whoever comes is expecting them.",
  },
  {
    q: "Which areas do you cover?",
    a: "Oxfordshire — any OX postcode, from Oxford itself out to Kidlington, Abingdon, Witney, Bicester and the towns between. Put your postcode in to start a quote and we'll confirm we can reach you when we ring to book the date.",
  },
];

export default async function Home() {
  const { cfg, addons } = await loadPricingAndAddons();

  // The DB `service_areas` prefixes ("OX") enforce coverage; the band shows
  // the human version of the same fact — town names, not outward codes.
  const areas = businessAreas;

  // The headline example: 2 bedrooms, 1 bathroom, fortnightly, own products.
  // Computed rather than written down so it tracks the live rates.
  // Same 2-bed example across the plan cards, so the three prices are
  // comparable to each other and to the hero. Hourly rates are gone from the
  // page: they were read as the cost of a whole clean.
  const exampleHours = recommendedHours(
    { bedrooms: 2, bathrooms: 1, diningRooms: 0, livingRooms: 0 },
    cfg,
  );
  const oneOffVisit = quotePrice(exampleHours, true, cfg, "one_off");
  // The same 2-bed example home, deep (Dulla's 2026-09-14 model): £235 base
  // + £58 for the second bedroom = £293.
  const deepVisit = deepPrice({ bedrooms: 2, bathrooms: 1, livingRooms: 0, diningRooms: 0, additionalRooms: 0 });
  const typicalVisit = quotePrice(
    recommendedHours({ bedrooms: 2, bathrooms: 1, diningRooms: 0, livingRooms: 0 }, cfg),
    true,
    cfg,
    "fortnightly",
  );
  // The featured card's own cadence (fortnightly = 26 visits/year), not a
  // guessed weekly rate — so the saving can't overstate the discount.
  const regularYearlySaving = (oneOffVisit - typicalVisit) * 26;

  return (
    // pb on mobile only: StickyQuoteBar is fixed to the bottom of the viewport,
    // so without it the last line of the footer sits underneath the bar and can
    // never be scrolled into view.
    <main className="min-h-screen bg-white pb-24 lg:pb-0">
      {/* ---------- hero ---------- */}
      {/* The hero ends as a rounded-bottom panel: flat straight across, curved
          only at the two corners. overflow-hidden is what clips the photograph,
          the gradient and the scrim to that shape — they are all absolute
          children of this element.

          The page's one exception to the square-corner rule, and it is the
          block being shaped rather than a box inside the layout. */}
      <section className="relative isolate flex min-h-svh flex-col overflow-hidden rounded-b-[2rem] sm:rounded-b-[2.5rem] lg:rounded-b-[3rem]">
        {/* background: photo over a gradient, so a missing/slow image still reads as design */}
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-slate-700 via-slate-800 to-brand-950" />
        {/* Was a CSS background-image, which the image optimiser cannot see:
            no AVIF, no responsive sizes, no preload, and it is the LCP
            element. As an <Image preload> it ships ~100KB of AVIF instead of
            500KB of JPEG and gets a <link rel=preload> in the head. */}
        <Image
          src={livingRoomHero}
          alt=""
          aria-hidden="true"
          fill
          preload
          sizes="100vw"
          placeholder="blur"
          className="-z-10 object-cover"
          // A room, not a flat backdrop: anchored mid-frame so the sofa and
          // fireplace read, rather than the ceiling the old 18% crop showed.
          style={{ objectPosition: "center 50%" }}
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
              <a className="outline-none transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300" href="#services">
                Services
              </a>
              <a className="outline-none transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300" href="#included">
                What&apos;s included
              </a>
              <a className="outline-none transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300" href="#pricing">
                Pricing
              </a>
              <a className="outline-none transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300" href="#how">
                How it works
              </a>
              <a className="outline-none transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300" href="#faqs">
                FAQs
              </a>
            </nav>
            <div className="flex shrink-0 items-center gap-4">
              {/* The site had no phone number anywhere. The people most likely
                  to book a cleaner are the least likely to fill in a form. */}
              <a
                href={`tel:${contact.phoneHref}`}
                className="hidden text-sm font-semibold text-white outline-none transition hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300 sm:block"
              >
                {contact.phoneDisplay}
              </a>
              <Link
                href="/quote"
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-300"
              >
                Get a quote
              </Link>
            </div>
          </div>
        </header>

        {/* Everything between the nav and the search bar grows to fill the
            viewport, so the hero is one screen on any display instead of the
            sum of a stack of fixed margins. */}
        <div className="relative z-10 flex flex-1 flex-col justify-center gap-6 py-6 sm:gap-8 sm:py-8 lg:gap-12">
          {/* headline */}
          <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
            <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
              A family-run clean, with your price agreed before you book
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/80 sm:text-lg">
              See it online in under a minute, then we ring to confirm the
              date.
            </p>
          </div>
        </div>

        {/* search bar — sits on the fold, so it is the last thing in view.
            The benefits and price share its container so they align to its
            edges and read as one group with the form, rather than floating in
            the dead space between the headline and the bar. */}
        <div className="relative z-20 mx-auto w-full max-w-5xl px-4 pb-8 sm:px-8 sm:pb-12">
          <div className="mb-8 flex flex-col items-center justify-between gap-5 sm:mb-14 sm:flex-row sm:items-end sm:gap-6">
            <ul className="space-y-2.5 sm:space-y-4">
              {HERO_POINTS.map(({ icon: glyph, text }) => (
                <li key={text} className="flex items-center gap-3 text-white sm:gap-3.5">
                  <Icon glyph={glyph} className="size-[22px]" />
                  <span className="text-[15px] font-medium leading-none">
                    {text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="shrink-0 text-center sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                2-bed home, fortnightly
              </p>
              {/* An hourly rate answers a question nobody asked. £21.75/hr was
                  read as "that's what my clean costs" — a whole-visit price for
                  a named house size can't be. Priced live from the same config
                  as the quote form, so it can never drift from what we charge. */}
              <p className="tnum mt-2 text-4xl font-bold leading-none text-white sm:text-[2.75rem]">
                <span className="text-lg font-medium text-white/85">from </span>
                <AnimatedPrice value={typicalVisit} />
                <span className="ml-0.5 text-lg font-medium text-white/85">
                  {" "}
                  a visit
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
        className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 lg:py-28"
      >
        <Reveal>
          <SectionHead
            title="Find the right clean for your home"
            sub={`Prices shown for a 2-bed home with 1 bathroom. Your own quote follows your rooms and the hours you choose.`}
          />
        </Reveal>

        {/* Regular sits centre on desktop but first in the DOM, so it also leads
            on mobile without duplicating the markup. */}
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-3">
          <PlanCard
            revealDelay={0}
            className="lg:order-2"
            featured
            icon={<Icon glyph={House} className="size-[30px]" />}
            title="Regular clean"
            price={formatGBP(typicalVisit)}
            unit=" a visit"
            note={`Save about ${formatGBP(regularYearlySaving)} a year`}
            text="Weekly or fortnightly visits — the easiest and best-value way to keep on top of your home."
            points={[
              "Best value",
              "A routine that fits yours",
              "Same standard every visit",
            ]}
          />
          <PlanCard
            revealDelay={90}
            className="lg:order-1"
            icon={<Icon glyph={CalendarDays} className="size-[30px]" />}
            title="One-off clean"
            price={formatGBP(oneOffVisit)}
            unit=" a visit"
            text="A single visit, whenever you need it — before guests arrive, after a party, or just to reset the house."
            points={[
              "No commitment",
              "Book a single date",
              "Same standard as regulars",
            ]}
          />
          <PlanCard
            revealDelay={180}
            className="lg:order-3"
            icon={<Icon glyph={Sparkles} className="size-[30px]" />}
            title="Deep clean"
            price={formatGBP(deepVisit)}
            unit=" a visit"
            text="Two cleaners, top to bottom — priced by the size of your home, with the kitchen, oven and hallways always in. For when a regular clean isn't enough."
            points={[
              "Two cleaners as standard",
              "Priced by home size, not the hour",
              "Living and dining rooms included",
            ]}
            href="/quote?service=deep"
          />
        </div>
        <p className="mt-10 text-center text-sm text-slate-600">
          More about{" "}
          <Link href="/regular-cleaning" className="font-semibold text-slate-900 underline underline-offset-4 hover:text-brand-600">
            regular cleaning
          </Link>
          ,{" "}
          <Link href="/one-off-cleaning" className="font-semibold text-slate-900 underline underline-offset-4 hover:text-brand-600">
            one-off cleans
          </Link>{" "}
          and{" "}
          <Link href="/deep-cleaning" className="font-semibold text-slate-900 underline underline-offset-4 hover:text-brand-600">
            deep &amp; end of tenancy cleaning
          </Link>
          .
        </p>
      </section>

      {/* ---------- what's included: an editorial spread, not a feature grid ----------
           Deliberately the one asymmetric section on the page. It follows the dark
           pricing block, so the jump to white and photography is the point. */}
      <section
        id="included"
        className="scroll-mt-20 bg-white py-20 lg:py-28"
      >
        <div className="mx-auto w-full max-w-6xl px-4">
          {/* Columns are placed by hand rather than auto-flowed, so no two blocks
              share a size or a baseline. */}
          {/* heading — left-aligned on purpose, unlike every other section head */}
          <Reveal className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-4xl">
              Every room, every visit
            </h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-slate-600">
                We don&apos;t just clean what&apos;s obvious. We work through your
                home properly, from kitchens and bathrooms to floors, living
              spaces and the finishing touches.
            </p>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-500">
              Ovens, fridges, inside windows and laundry sit outside a standard
              clean. Add any of them to your quote and we build the extra time
              into the visit.
            </p>
          </Reveal>

          {/* One staggered band rather than two stacked rows: the asymmetry comes
              from four different circle sizes and four different top offsets, which
              is what keeps the whole section inside a single viewport. */}
          <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-12 lg:mt-8 lg:items-start">
            <Room
              {...ROOMS[0]}
              revealDelay={0}
              size="md"
              marker="-right-1 top-6"
              className="col-span-12 sm:col-span-6 lg:col-span-3 lg:mt-10"
            />

            {/* dropped furthest to break the baseline */}
            <Room
              {...ROOMS[1]}
              flip
              revealDelay={90}
              size="sm"
              marker="-left-2 top-8"
              className="col-span-12 sm:col-span-6 lg:col-span-2 lg:mt-24"
            />

            {/* the anchor of the composition */}
            <Room
              {...ROOMS[2]}
              revealDelay={180}
              size="lg"
              marker="left-3 -bottom-3"
              className="col-span-12 sm:col-span-7 lg:col-span-4"
            />

            {/* mostly typography, in the negative space on the right */}
            <Room
              {...ROOMS[3]}
              flip
              revealDelay={270}
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
        <div className="mx-auto max-w-[1400px] px-6 py-20 sm:px-10 lg:py-28">
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

      {/* ---------- who we send into your home ----------
           The trust block above says what the service promises. This says who
           turns up to deliver it, which is the objection that actually stops
           people booking a cleaner. */}
      <SafetyChecks />

      {/* ---------- pricing ---------- */}
      <section
        id="pricing"
        className="scroll-mt-20 bg-slate-50 py-20 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <SectionHead
              title="How your price is built"
              sub="No callback, no guesswork. Here's exactly how we get to your number, the same steps the quote form walks you through."
            />
          </Reveal>
          {/* Extras now live inside the builder, on the right, so the section
              reads as one journey: rooms, hours, frequency, quote, extras. */}
          <PriceSteps cfg={cfg} addons={addons} />
        </div>
      </section>

      {/* ---------- from quote to clean ----------
           Owns its own heading block, capsule label included — see
           VisitJourney.tsx. Was "Three steps, no phone tag", which only ever
           described the booking, and the booking was never the anxious part. */}
      <VisitJourney />

      {/* ---------- the people behind it ---------- */}
      <TheFamily />

      {/* ---------- what people say ----------
           The only section on the page where somebody other than SAAFI speaks.
           Renders nothing when lib/business.ts has no reviews in it. */}
      <Reviews />

      {/* ---------- faqs ----------
           Still native <details>/<summary>: it is keyboard accessible, works
           without JS and announces its own state. The plus/minus is two spans
           where the vertical bar collapses on open, which is a real minus
           rather than a plus rotated into an ×. */}
      <section
        id="faqs"
        className="relative isolate scroll-mt-20 overflow-hidden bg-white py-20 lg:py-28"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-24 -z-10 size-[26rem] rounded-full bg-brand-50"
        />

        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
              Questions, answered
            </p>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Questions we get asked a lot
            </h2>
          </div>

          <div className="mt-12 border-t border-slate-200">
            {FAQS.map((f) => (
              <details key={f.q} className="group border-b border-slate-200">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left text-lg font-semibold text-slate-900 transition-colors hover:text-brand-700 group-open:text-brand-800 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="relative grid size-6 shrink-0 place-items-center text-slate-400 transition-colors group-hover:text-brand-600 group-open:text-brand-600"
                  >
                    <span className="absolute h-px w-[18px] bg-current" />
                    <span className="absolute h-[18px] w-px bg-current transition-transform duration-300 ease-out group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="max-w-[68ch] pb-7 pr-10 text-[15px] leading-relaxed text-slate-600 motion-safe:animate-[faq-in_240ms_ease-out]">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- where we clean ----------
           Reads the live service_areas table and only falls back to the
           placeholder list when it is empty, which it currently is. */}
      <ServiceArea areas={areas} />

      {/* ---------- closing CTA ----------
           The visual callback is the circle language from "The people behind
           it", scaled up and bled off both edges — not a second crop of the
           hero photograph, which would read as running out of pictures. No
           bottom border and no gap: the teal runs straight into the footer. */}
      <section className="relative isolate overflow-hidden bg-brand-600">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 -top-40 size-[38rem] rounded-full border border-white/15"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-56 -right-32 size-[42rem] rounded-full bg-white/[0.06]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-72 right-24 size-[34rem] rounded-full border border-white/15"
        />

        <Reveal className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
            See your price in under a minute
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-white/80">
            Just your postcode and a few details about your home. We&apos;ll ring
            to confirm the date.
          </p>

          <Link
            href="/quote"
            className="group mt-10 inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-base font-semibold text-slate-900 outline-none transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Get a quote
            <Icon
              glyph={ArrowRight}
              className="size-[18px] transition-transform duration-200 group-hover:translate-x-1"
              strokeWidth={2.2}
            />
          </Link>

          {/* Both halves are stated elsewhere on the page and true of the
              build: the quote form takes no card, and confirmation is a call
              we make, not one you wait for. */}
          <p className="mt-6 text-sm text-white/70">
            One agreed price <span className="text-white/40">·</span> Nothing
            added without asking <span className="text-white/40">·</span> No
            callback to wait for
          </p>
        </Reveal>
      </section>

      {/* ---------- footer ---------- */}
      <SiteFooter />

      {/* Mobile only — the desktop nav is always in view. */}
      <StickyQuoteBar rate={typicalVisit} />

      {/* Desktop counterpart: the hero nav scrolls away, so it comes back
          condensed once you are past it. */}
      <StickyHeader phone={contact.phoneDisplay} phoneHref={contact.phoneHref} />

      {/* LocalBusiness structured data. A local service business with none of
          this is invisible to the "cleaners near me" results that should be
          feeding it. Priced from the live config so the schema can never
          advertise a rate the site has stopped charging. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HomeAndConstructionBusiness",
            // Stable id so the service pages can point at this one business
            // rather than each declaring a new one.
            "@id": `${site.url}/#business`,
            name: site.legalName,
            url: site.url,
            openingHoursSpecification: {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
              opens: "08:00",
              closes: "18:00",
            },
            email: contact.email,
            telephone: contact.phoneHref,
            image: `${site.url}/opengraph-image`,
            description:
              "Family-run home cleaning with a clear price for every visit. See your price online in under a minute.",
            address: {
              "@type": "PostalAddress",
              addressLocality: address.locality,
              addressRegion: address.region,
              addressCountry: address.country,
            },
            // `areas` holds town names now, and the postcode rule is a single
            // prefix — one AdministrativeArea says the same thing more honestly
            // than a fake postcode range per town.
            areaServed: [
              { "@type": "AdministrativeArea", name: "Oxfordshire" },
              ...areas.map((a) => ({ "@type": "City" as const, name: a })),
            ],
            sameAs: socials.map((s) => s.url),
            priceRange: "££",
            makesOffer: [
              // Priced per visit for the page's example home, matching what a
              // visitor actually sees. An hourly unitCode would put a rate in
              // search results that the page deliberately no longer shows.
              {
                "@type": "Offer",
                name: "Regular home cleaning (2-bed, fortnightly)",
                priceSpecification: {
                  "@type": "PriceSpecification",
                  price: typicalVisit,
                  priceCurrency: "GBP",
                },
              },
              {
                "@type": "Offer",
                name: "One-off home cleaning (2-bed)",
                priceSpecification: {
                  "@type": "PriceSpecification",
                  price: oneOffVisit,
                  priceCurrency: "GBP",
                },
              },
              {
                "@type": "Offer",
                name: "Deep clean (2-bed)",
                priceSpecification: {
                  "@type": "PriceSpecification",
                  price: deepVisit,
                  priceCurrency: "GBP",
                },
              },
            ],
          }),
        }}
      />
      {/* The FAQs, read by search and AI answer engines. Google stopped showing
          FAQ rich results for most sites in 2023, so this is understanding, not
          a visible snippet. Built from the same array the accordion renders. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </main>
  );
}

/** Extras can be priced flat or purely by the time they add — render whichever applies. */
/* ---------- small presentational bits ---------- */

/** 14px, so it takes the heavier stroke the Icon wrapper documents. */
function Tick({ className = "text-brand-600" }: { className?: string }) {
  return (
    <Icon
      glyph={Check}
      className={`mt-0.5 size-3.5 ${className}`}
      strokeWidth={3}
    />
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
  revealDelay = 0,
  flip = false,
  className = "",
}: {
  n: string;
  title: string;
  copy: string;
  image?: StaticImageData;
  imagePos?: string;
  tone: string;
  size: "lg" | "md" | "sm" | "xs";
  /** Tailwind position utilities for the number, so it sits differently each time. */
  marker: string;
  /** Milliseconds behind the circle before it, so the four land in sequence. */
  revealDelay?: number;
  /**
   * Pushes the block to the right edge — but only in the single-column stack.
   * Alternating it down the page turns four left-aligned circles into a
   * zigzag, which is the closest the phone layout gets to the deliberate
   * off-baseline composition the desktop band is built on. From sm up there
   * are two columns doing that job already, so it switches itself off.
   */
  flip?: boolean;
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
    <Reveal delay={revealDelay} className={`group/room ${className}`}>
      <div
        className={`flex flex-col sm:items-start sm:text-left ${
          flip ? "items-end text-right" : "items-start text-left"
        }`}
      >
      <div className={`relative ${width}`}>
        <div className="relative aspect-square overflow-hidden rounded-full">
          {image ? (
            <Image
              src={image}
              alt={title}
              fill
              sizes={sizes}
              placeholder="blur"
              className="object-cover transition-transform duration-500 ease-out group-hover/room:scale-[1.06]"
              style={imagePos ? { objectPosition: imagePos } : undefined}
            />
          ) : (
            <div className={`h-full w-full ${tone}`} />
          )}
        </div>
        <span
          className={`absolute flex size-12 items-center justify-center rounded-full bg-white text-sm font-semibold tabular-nums text-slate-900 ring-1 ring-slate-200 transition-all duration-500 ease-out group-hover/room:ring-brand-300 group-hover/room:text-brand-700 lg:size-14 ${marker}`}
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
    </Reveal>
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
  revealDelay = 0,
  href = "/quote",
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
  revealDelay?: number;
  /** Where the card's CTA lands — the deep card opens the quote on its tab. */
  href?: string;
  className?: string;
}) {
  return (
    <Reveal
      delay={revealDelay}
      className={`relative flex flex-col border p-7 transition-[border-color,transform,box-shadow] duration-300 ease-out hover:-translate-y-1 ${
        featured
          ? "border-brand-300 bg-brand-50/70 shadow-sm hover:shadow-lg lg:-mt-4 lg:pb-9"
          : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-lg"
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
        href={href}
        className={`mt-auto block w-full rounded-full px-4 py-3 text-center text-sm font-semibold transition ${
          featured
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "border border-slate-300 bg-white text-slate-900 hover:border-slate-900 hover:bg-slate-900 hover:text-white"
        }`}
      >
        Get a quote
      </Link>
    </Reveal>
  );
}

