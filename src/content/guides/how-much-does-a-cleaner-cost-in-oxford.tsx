import Link from "next/link";
import { formatGBP } from "@/lib/pricing";
import type { GuidePrices } from "@/lib/guidePrices";
import { PriceTable } from "@/components/guides/GuideParts";
import type { GuideMeta } from "@/lib/guides";

export const meta: GuideMeta = {
  slug: "how-much-does-a-cleaner-cost-in-oxford",
  title: "How much does a cleaner cost in Oxford?",
  metaTitle: "How Much Does a Cleaner Cost in Oxford? | SAAFI Cleaning",
  description:
    "Real per-visit prices for home cleaning in Oxford and Oxfordshire — one-off, weekly, fortnightly and deep cleans — and what decides the price.",
  date: "2026-10-09",
  readMins: 5,
  cta: { href: "/quote", text: "See your exact price" },
};

export default function Body({ p }: { p: GuidePrices }) {
  const two = p.twoBed;
  return (
    <>
      <p>
        <strong>The short answer:</strong> for a typical 2-bedroom home in Oxford, a one-off clean
        with us is <strong>{formatGBP(two.oneOff)}</strong>, and a fortnightly clean is{" "}
        <strong>{formatGBP(two.fortnightly)} a visit</strong>. A top-to-bottom deep clean of the same
        home is <strong>{formatGBP(two.deep)}</strong>.
      </p>
      <p>
        Those are our live prices — the same ones our quote form uses — so they&apos;re what you&apos;d
        actually pay, not a range. Below is what decides the price, and what to check before you book
        any cleaner.
      </p>

      <h2>What decides the price of a clean</h2>
      <h3>1. How long your home takes</h3>
      <p>
        A regular clean is priced by the time it needs, and the time follows your rooms: every clean
        covers the kitchen, bathrooms, hallways, landings and floors, and each bedroom or bathroom adds
        a little more. Visits run from a {p.minHours}-hour minimum to a full {p.maxHours}-hour day.
      </p>
      <h3>2. How often we come</h3>
      <p>
        Regular visits cost less than a one-off clean, because a home that&apos;s cleaned every week or
        two never gets the chance to build up.
      </p>
      <h3>3. Whose products we use</h3>
      <p>
        We can use the products you already have at no extra cost, or bring everything for{" "}
        {formatGBP(p.productSurcharge)} a visit. You choose when you book.
      </p>
      <h3>4. Any extras</h3>
      <p>
        Jobs like the inside of the oven or fridge, inside windows or laundry add time to the visit,
        and the price follows. They&apos;re priced in before you book, never added on the day.
      </p>

      <h2>Home cleaning prices in Oxford, by home size</h2>
      <p>Per visit, using your own products:</p>
      <PriceTable homes={p.homes} cols={["oneOff", "fortnightly", "weekly"]} />
      <p>
        Your own quote follows your actual rooms and the hours you choose, so it can be a little above
        or below these.
      </p>

      <h2>What a deep clean costs</h2>
      <p>
        A deep clean is priced differently: by the size of your home, not the hour, and always with
        two cleaners. {formatGBP(p.deepBase)} covers a home with one bedroom, one bathroom, a living
        room, a dining room, the kitchen with the oven, and the hallways. Each room beyond that adds{" "}
        {formatGBP(p.deepRoom)}, and extras like inside windows or the fridge are{" "}
        {formatGBP(p.deepExtra)} each.
      </p>
      <PriceTable homes={p.homes} cols={["deep"]} />
      <p>
        Not sure which you need? Our guide to{" "}
        <Link href="/guides/deep-clean-vs-regular-clean">deep cleans versus regular cleans</Link>{" "}
        explains the difference.
      </p>

      <h2>Why we quote per visit, not per hour</h2>
      <p>
        An hourly rate on its own doesn&apos;t tell you what a clean will cost — that depends on how
        long your home takes. So we show the whole price for the visit before you book, and nothing is
        added afterwards without asking you first.
      </p>

      <h2>Five things to check before booking any cleaner</h2>
      <ol>
        <li>
          <strong>Is there a minimum charge?</strong> Most cleaners have one — ours is {p.minHours}{" "}
          hours.
        </li>
        <li>
          <strong>Are products included?</strong> And if they bring them, what do they cost?
        </li>
        <li>
          <strong>What happens if the job takes longer?</strong> With us, you approve any change to the
          price before it happens.
        </li>
        <li>
          <strong>Are the cleaners checked and insured?</strong> Everyone we send is ID and
          right-to-work checked, referenced and trained, and we&apos;re insured for work in your home.
        </li>
        <li>
          <strong>Can you move a booking?</strong> Give us a day or so&apos;s notice and there&apos;s
          nothing to pay.
        </li>
      </ol>
      <p>
        We cover Oxford and every OX postcode, including Kidlington, Abingdon, Witney, Bicester, Didcot,
        Wallingford and Thame. See our{" "}
        <Link href="/regular-cleaning">regular cleaning</Link>,{" "}
        <Link href="/one-off-cleaning">one-off cleaning</Link> and{" "}
        <Link href="/deep-cleaning">deep cleaning</Link> pages for what each includes.
      </p>
    </>
  );
}
