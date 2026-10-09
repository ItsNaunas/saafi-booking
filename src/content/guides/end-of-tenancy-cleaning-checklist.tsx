import Link from "next/link";
import { formatGBP } from "@/lib/pricing";
import type { GuidePrices } from "@/lib/guidePrices";
import type { GuideMeta } from "@/lib/guides";

export const meta: GuideMeta = {
  slug: "end-of-tenancy-cleaning-checklist",
  title: "End of tenancy cleaning checklist for Oxford renters",
  metaTitle: "End of Tenancy Cleaning Checklist, Oxford | SAAFI Cleaning",
  description:
    "A room-by-room end of tenancy cleaning checklist for renters in Oxford and Oxfordshire — what check-outs look at, and how to prepare.",
  date: "2026-10-23",
  readMins: 5,
  cta: { href: "/quote?service=deep", text: "Price an end of tenancy clean" },
};

// General guidance, not a promise about any deposit: what a check-out looks at
// is set by each tenancy and its check-in inventory. SAAFI vacuums carpets but
// doesn't shampoo them, so carpet cleaning is pointed elsewhere, not offered.
export default function Body({ p }: { p: GuidePrices }) {
  return (
    <>
      <p>
        When you move out of a rented home, the property is usually checked against the inventory
        taken when you moved in. Anything that was clean then is expected to be clean now. This
        checklist goes room by room through the things that get looked at most closely.
      </p>
      <p>
        <strong>Before you start:</strong> find your check-in inventory and its photos, and read the
        cleaning clause in your tenancy agreement. They tell you the standard you&apos;re being held to
        — and whether anything specific, like professional carpet cleaning, is required.
      </p>

      <h2>Kitchen</h2>
      <ul>
        <li>Inside the oven, the racks and the trays — ovens are hard to clean and easy to spot.</li>
        <li>Hob, and the extractor hood and its filter.</li>
        <li>Fridge and freezer: emptied, defrosted, cleaned inside and left with the doors ajar.</li>
        <li>Inside every cupboard and drawer, crumbs and all.</li>
        <li>Sink, taps and draining board free of limescale.</li>
        <li>Tiles, splashback and worktops wiped down, including behind appliances you can move.</li>
      </ul>

      <h2>Bathrooms</h2>
      <ul>
        <li>Limescale off taps, shower heads, screens and the bath.</li>
        <li>Toilet inside and out, including the base and behind it.</li>
        <li>Grout and sealant cleaned where it can be.</li>
        <li>Mirrors, cabinets and the extractor fan cover.</li>
      </ul>

      <h2>Bedrooms and living areas</h2>
      <ul>
        <li>Skirting boards, door frames and light switches.</li>
        <li>Inside wardrobes and drawers.</li>
        <li>Windows and sills on the inside.</li>
        <li>Radiators, and behind them where dust collects.</li>
        <li>
          Marks on walls — check the inventory first; scrubbing paint can do more harm than the mark.
        </li>
      </ul>

      <h2>Floors</h2>
      <ul>
        <li>Hard floors swept and mopped, edges and corners included.</li>
        <li>Carpets thoroughly vacuumed.</li>
        <li>
          If your tenancy requires professional carpet cleaning, that&apos;s a specialist service —
          book it separately and keep the receipt.
        </li>
      </ul>

      <h2>Timing and tips</h2>
      <ul>
        <li>
          <strong>Clean after your furniture has gone</strong> — it&apos;s the only way to reach the
          floors, skirting and walls behind it.
        </li>
        <li>
          <strong>Take your own photos</strong> once it&apos;s done, room by room, to compare against
          the check-in inventory.
        </li>
        <li>
          <strong>Don&apos;t leave it to the last day.</strong> Ovens and limescale take longer than you
          expect.
        </li>
      </ul>

      <h2>Booking an end of tenancy clean in Oxford</h2>
      <p>
        If you&apos;d rather hand it over, we do end of tenancy cleans as a deep clean: two cleaners,
        top to bottom, with the kitchen and oven always included. It&apos;s priced by the size of the
        property — from {formatGBP(p.deepBase)}, plus {formatGBP(p.deepRoom)} for each room beyond a
        one-bedroom home — and inside windows or the fridge can be added for {formatGBP(p.deepExtra)}{" "}
        each.
      </p>
      <p>
        Choose <strong>&ldquo;Moving out — end of tenancy&rdquo;</strong> when you get your quote, so
        we know what we&apos;re preparing for. More on the{" "}
        <Link href="/deep-cleaning">deep cleaning page</Link>, or see{" "}
        <Link href="/guides/deep-clean-vs-regular-clean">deep clean vs regular clean</Link>.
      </p>
    </>
  );
}
