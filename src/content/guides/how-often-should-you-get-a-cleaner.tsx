import Link from "next/link";
import { formatGBP } from "@/lib/pricing";
import type { GuidePrices } from "@/lib/guidePrices";
import { PriceTable } from "@/components/guides/GuideParts";
import type { GuideMeta } from "@/lib/guides";

export const meta: GuideMeta = {
  slug: "how-often-should-you-get-a-cleaner",
  title: "How often should you get a cleaner?",
  metaTitle: "How Often Should You Get a Cleaner? | SAAFI Cleaning Oxford",
  description:
    "Weekly, fortnightly or one-off? How to choose how often to have your home cleaned, and what each costs in Oxford and Oxfordshire.",
  date: "2026-10-30",
  readMins: 4,
  cta: { href: "/quote?frequency=fortnightly", text: "Price a regular clean" },
};

export default function Body({ p }: { p: GuidePrices }) {
  const two = p.twoBed;
  return (
    <>
      <p>
        There&apos;s no single right answer — it depends on how quickly your home gets lived in. Here&apos;s
        how to think about it, and what each option costs for a typical Oxford home.
      </p>

      <h2>Weekly</h2>
      <p>
        Best for homes that are used hard: families with young children, pets, shared houses, or
        anyone working long hours who wants the house to stay reliably done. Because nothing gets the
        chance to build up, each visit goes on keeping things right rather than catching up.
      </p>

      <h2>Fortnightly</h2>
      <p>
        A popular middle ground for couples and smaller households. For many homes, two weeks is
        about as long as a kitchen and bathroom go before they need proper attention, so a fortnightly
        clean keeps on top of the jobs that matter while you handle the day-to-day tidying in between.
      </p>

      <h2>One-off</h2>
      <p>
        For a specific moment rather than a routine — before guests arrive, after a party, or just to
        reset the house after a busy spell. No commitment, and the same standard as a regular clean.
        See <Link href="/one-off-cleaning">one-off cleaning</Link>.
      </p>

      <h2>And a deep clean?</h2>
      <p>
        A deep clean isn&apos;t a frequency — it&apos;s for specific moments, like moving in or out,
        after building work, or when it&apos;s been a while. A common pattern is one deep clean to
        reset the home, then weekly or fortnightly visits to keep it there. More in{" "}
        <Link href="/guides/deep-clean-vs-regular-clean">deep clean vs regular clean</Link>.
      </p>

      <h2>What each costs</h2>
      <p>
        For a 2-bed home: weekly is <strong>{formatGBP(two.weekly)} a visit</strong>, fortnightly is{" "}
        <strong>{formatGBP(two.fortnightly)} a visit</strong>, and a one-off clean is{" "}
        <strong>{formatGBP(two.oneOff)}</strong>. Regular visits cost less per visit than a one-off.
      </p>
      <PriceTable homes={p.homes} cols={["weekly", "fortnightly", "oneOff"]} />
      <p>
        Per visit, using your own products. The full breakdown is in{" "}
        <Link href="/guides/how-much-does-a-cleaner-cost-in-oxford">
          how much a cleaner costs in Oxford
        </Link>
        .
      </p>

      <h2>The same cleaner each time</h2>
      <p>
        With a regular clean we keep you with the same person wherever we can, because a cleaner who
        already knows your home does a better job of it. If they&apos;re ever off, we tell you before
        the visit. More on <Link href="/regular-cleaning">regular cleaning</Link>.
      </p>
    </>
  );
}
