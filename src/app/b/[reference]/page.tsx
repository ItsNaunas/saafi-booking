import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { verifyBookingToken, cancellationRoute } from "@/lib/bookingLink";
import {
  getBookingByReference,
  amountDueFor,
  agreedPriceFor,
  paidSoFar,
  isPaidInFull,
} from "@/lib/supabaseAdmin";
import { formatTimeRange, londonWallClock } from "@/lib/scheduling";
import { formatGBP, FREQUENCY_LABEL } from "@/lib/pricing";
import { contact, site } from "@/lib/business";
import { customerPayNow, customerCancelBooking, customerRequestReschedule } from "./actions";

export const dynamic = "force-dynamic";

// A personal page behind a signed link — never something to index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATUS_LINE: Record<string, { title: string; body: string }> = {
  requested: {
    title: "We've got your request",
    body: "We'll ring you shortly to confirm the details. Nothing else needed from you right now.",
  },
  confirmed: {
    title: "Your clean is booked",
    body: "It's in our diary. We'll send a reminder the day before.",
  },
  completed: {
    title: "Your clean is done",
    body: "Thanks for having us — we hope the place feels brand new.",
  },
  paid: {
    title: "All settled",
    body: "The clean is done and paid for. Thanks for having us.",
  },
  cancelled: {
    title: "This booking is cancelled",
    body: "Nothing is happening on this date. If that's a surprise, ring us and we'll sort it.",
  },
  no_access: {
    title: "We couldn't get in",
    body: "Our cleaner couldn't do this visit. We'll be in touch to rearrange.",
  },
};

/** "2026-09-01" to "Tuesday 1 September" — year only when it isn't this one. */
function humanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const sameYear = y === new Date().getUTCFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

export default async function CustomerBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ t?: string; cancel?: string; move?: string; pay?: string }>;
}) {
  const [{ reference }, q] = await Promise.all([params, searchParams]);
  if (!q.t || !verifyBookingToken(reference, q.t)) notFound();
  const b = await getBookingByReference(reference);
  if (!b) notFound();

  const line = STATUS_LINE[b.status] ?? STATUS_LINE.requested;
  const due = amountDueFor(b);
  const paid = paidSoFar(b);
  const canCancel = cancellationRoute(b);
  const active = ["requested", "confirmed"].includes(b.status);
  const icsUrl = `/b/${encodeURIComponent(reference)}/ics?t=${q.t}`;

  // "Nothing else needed from you" reads as a lie next to a pay button.
  const bodyText =
    b.status === "requested" && due > 0
      ? "We'll ring you shortly to confirm — you can pay below to lock it in."
      : line.body;

  // Reschedule requests can't land in the past — floor the date picker at tomorrow,
  // reckoned on the London wall clock the rest of scheduling uses.
  const wall = londonWallClock(new Date());
  const minMoveDate = new Date(`${wall.date}T00:00:00Z`);
  minMoveDate.setUTCDate(minMoveDate.getUTCDate() + 1);
  const minMoveDateStr = minMoveDate.toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <p className="mb-6 text-center text-sm font-bold tracking-[0.16em] text-brand-900">
          SAAFI <span className="font-semibold text-brand-600">CLEANING SERVICE</span>
        </p>

        <div className="bg-white p-6 shadow-lg ring-1 ring-slate-200 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">{line.title}</h1>
          <p className="mt-1 text-slate-600">{bodyText}</p>

          {q.cancel === "done" && (
            <p className="mt-4 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 ring-1 ring-brand-200">
              Cancelled — you&apos;ll get an email confirming it. Nothing is charged.
            </p>
          )}
          {q.cancel === "call" && (
            <p className="mt-4 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This one&apos;s too close (or already paid) to cancel online — give us a quick ring
              on{" "}
              <a href={`tel:${contact.phoneHref}`} className="underline underline-offset-2">
                {contact.phoneDisplay}
              </a>{" "}
              and we&apos;ll sort it.
            </p>
          )}
          {q.move === "sent" && (
            <p className="mt-4 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 ring-1 ring-brand-200">
              Got it — we&apos;ll ring you to agree the new time.
            </p>
          )}
          {q.pay === "unavailable" && (
            <p className="mt-4 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Online payment isn&apos;t available just now — you can pay after the clean, or ring
              us on{" "}
              <a href={`tel:${contact.phoneHref}`} className="underline underline-offset-2">
                {contact.phoneDisplay}
              </a>
              .
            </p>
          )}

          <dl className="mt-5 space-y-2 bg-brand-50/60 p-4 text-sm">
            <Row k="Reference" v={b.reference} />
            <Row
              k="When"
              v={
                b.start_time
                  ? `${humanDate(b.preferred_date)}, ${formatTimeRange(b.start_time, Number(b.hours))}`
                  : `${humanDate(b.preferred_date)} — we'll agree the time with you`
              }
            />
            <Row k="Where" v={`${b.address_line}, ${b.postcode}`} />
            <Row k="How long" v={`${b.hours} hours`} />
            {b.frequency !== "one_off" && <Row k="Repeats" v={FREQUENCY_LABEL[b.frequency]} />}
            <Row k="Price" v={formatGBP(agreedPriceFor(b))} />
            {paid > 0 && <Row k="Paid" v={formatGBP(paid)} />}
            {b.refunded_at && b.refund_amount != null && (
              <Row k="Refunded" v={formatGBP(Number(b.refund_amount))} />
            )}
          </dl>

          {/* pay */}
          {due > 0 && b.status !== "cancelled" && b.status !== "no_access" && (
            <form action={customerPayNow} className="mt-5">
              <input type="hidden" name="reference" value={reference} />
              <input type="hidden" name="t" value={q.t} />
              <button className="w-full rounded-full bg-brand-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-brand-700">
                Pay {formatGBP(due)} securely
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Takes you to Stripe — we never see your card details.
              </p>
            </form>
          )}
          {isPaidInFull(b) && b.status !== "cancelled" && (
            <p className="mt-5 text-center text-sm font-medium text-brand-700">
              ✓ Paid in full — nothing more to do.
            </p>
          )}

          {/* calendar */}
          {active && (
            <a
              href={icsUrl}
              className="mt-4 block text-center text-sm font-semibold text-brand-700 underline underline-offset-2"
            >
              Add it to your calendar
            </a>
          )}
        </div>

        {/* change it */}
        {active && (
          <div className="mt-4 bg-white p-6 text-sm shadow-sm ring-1 ring-slate-200 sm:p-8">
            <h2 className="font-semibold text-slate-900">Need to change something?</h2>

            <form action={customerRequestReschedule} className="mt-3">
              <input type="hidden" name="reference" value={reference} />
              <input type="hidden" name="t" value={q.t} />
              <label htmlFor="new_date" className="mb-1 block font-medium text-slate-700">
                Move it to another day
              </label>
              <div className="flex gap-2">
                <input
                  id="new_date"
                  type="date"
                  name="new_date"
                  required
                  min={minMoveDateStr}
                  className="border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                />
                <button className="bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700">
                  Request
                </button>
              </div>
              <label htmlFor="note" className="mt-2 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Anything we should know? (optional)
                </span>
                <input
                  id="note"
                  type="text"
                  name="note"
                  className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
                />
              </label>
              <p className="mt-1 text-xs text-slate-500">
                We&apos;ll ring you to agree the exact time before anything moves.
              </p>
            </form>

            <div className="mt-5 border-t border-slate-100 pt-4">
              {canCancel === "self" ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-red-600">
                    Cancel this clean
                  </summary>
                  <div className="mt-2">
                    <p className="text-xs text-slate-500">
                      This cancels the visit — the cleaner is told and the slot is released.
                      Free with a day&apos;s notice — that&apos;s the deal.
                    </p>
                    <form action={customerCancelBooking} className="mt-2">
                      <input type="hidden" name="reference" value={reference} />
                      <input type="hidden" name="t" value={q.t} />
                      <button className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
                        Yes, cancel it
                      </button>
                    </form>
                  </div>
                </details>
              ) : (
                <p className="text-xs text-slate-500">
                  To cancel this one, ring us on{" "}
                  <a href={`tel:${contact.phoneHref}`} className="underline underline-offset-2">
                    {contact.phoneDisplay}
                  </a>{" "}
                  — it&apos;s{" "}
                  {paid > 0 ? "already paid, so we'll refund you properly" : "close enough that we'd rather talk"}
                  .
                </p>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Questions? Ring{" "}
          <a href={`tel:${contact.phoneHref}`} className="underline underline-offset-2">
            {contact.phoneDisplay}
          </a>{" "}
          or reply to any of our emails.
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          <a href={site.url} className="text-brand-700 hover:underline">
            {site.url.replace("https://", "")}
          </a>
        </p>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{k}</dt>
      <dd className="text-right font-semibold text-slate-900">{v}</dd>
    </div>
  );
}
