import Link from "next/link";
import { formatGBP } from "@/lib/pricing";
import { contact } from "@/lib/business";
import type { GuidePrices } from "@/lib/guidePrices";
import { PriceTable } from "@/components/guides/GuideParts";
import type { GuideMeta } from "@/lib/guides";

export const meta: GuideMeta = {
  slug: "deep-clean-vs-regular-clean",
  title: "Deep clean vs regular clean: which do you need?",
  metaTitle: "Deep Clean vs Regular Clean: Which Do You Need? | SAAFI",
  description:
    "What a regular home clean covers, what a deep clean adds, when you need each, and what they cost in Oxford and Oxfordshire.",
  date: "2026-10-09",
  readMins: 4,
  cta: { href: "/quote", text: "Price both for your home" },
};

export default function Body({ p }: { p: GuidePrices }) {
  const two = p.twoBed;
  return (
    <>
      <p>
        <strong>In short:</strong> a regular clean keeps a home on top of itself. A deep clean resets
        it — two cleaners going through the whole home top to bottom. Most homes need a regular clean;
        a deep clean is for specific moments, like moving out or when it&apos;s been a while.
      </p>

      <h2>What a regular clean covers</h2>
      <p>Every regular or one-off clean we do includes:</p>
      <ul>
        <li>
          <strong>Kitchen</strong> — surfaces, sink and hob.
        </li>
        <li>
          <strong>Bathrooms</strong> — sink, toilet, bath or shower and visible surfaces.
        </li>
        <li>
          <strong>Hallways and landings</strong> — floors, bannisters and surfaces on the way through.
        </li>
        <li>
          <strong>Floors and finishing touches</strong> — hard floors mopped, carpets vacuumed, bins
          emptied where needed.
        </li>
      </ul>
      <p>
        It&apos;s priced by the time your home needs, and regular visits — weekly or fortnightly — cost
        less than a one-off.
      </p>

      <h2>What a deep clean adds</h2>
      <ul>
        <li>
          <strong>Two cleaners</strong>, working through the whole home top to bottom, not just the
          visible surfaces.
        </li>
        <li>
          <strong>The oven</strong>, as part of every deep clean rather than an extra.
        </li>
        <li>
          <strong>Living and dining rooms</strong>, included as standard.
        </li>
        <li>
          <strong>A fixed price by home size</strong>, not by the hour, so you know the whole cost
          before we arrive.
        </li>
      </ul>

      <h2>When you need a deep clean</h2>
      <ul>
        <li>
          <strong>Moving out</strong> — leaving a rented home clean for the end-of-tenancy check. Our{" "}
          <Link href="/guides/end-of-tenancy-cleaning-checklist">end of tenancy checklist</Link> covers
          what&apos;s usually inspected.
        </li>
        <li>
          <strong>Just moved in</strong> — starting in a home that&apos;s been cleaned properly before
          your things go in.
        </li>
        <li>
          <strong>After building or decorating work</strong> — when dust has got into every corner.
        </li>
        <li>
          <strong>When it&apos;s been a while</strong> — to bring a home back to a standard a regular
          clean can then keep.
        </li>
      </ul>
      <p>
        A common approach is one deep clean to reset the house, then regular visits to keep it there.
      </p>

      <h2>What each costs</h2>
      <p>
        For a 2-bed home: a deep clean is <strong>{formatGBP(two.deep)}</strong>, a one-off regular
        clean is <strong>{formatGBP(two.oneOff)}</strong>, and a fortnightly clean is{" "}
        <strong>{formatGBP(two.fortnightly)} a visit</strong>.
      </p>
      <PriceTable homes={p.homes} cols={["oneOff", "fortnightly", "deep"]} />
      <p>
        Deep cleans start at {formatGBP(p.deepBase)}, which covers a home with one bedroom, one
        bathroom, a living room, a dining room, the kitchen with the oven and the hallways; each room
        beyond that adds {formatGBP(p.deepRoom)}. More detail in{" "}
        <Link href="/guides/how-much-does-a-cleaner-cost-in-oxford">
          how much a cleaner costs in Oxford
        </Link>
        .
      </p>

      <h2>Still not sure?</h2>
      <p>
        When you book a deep clean we ask why you need one, so we know what we&apos;re preparing for.
        If you&apos;re unsure which fits, ring us on {contact.phoneDisplay} and describe the home. See
        the{" "}
        <Link href="/regular-cleaning">regular cleaning</Link> and{" "}
        <Link href="/deep-cleaning">deep cleaning</Link> pages for the full detail.
      </p>
    </>
  );
}
