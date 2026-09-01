// The one place that knows what a booking owes.
//
// Payment used to be a status ("paid") woven into the workflow, which meant a
// customer who paid at booking time froze their booking solid: `paid` had no
// exits, the cleaner couldn't see the job, and a recurring series never got
// created. Money and workflow are different facts about a booking — these
// helpers read the money fact, and `status` keeps describing the work.
//
// Leaf module on purpose: imported by the data layer, the email layer and the
// Stripe code alike, so the figure in an email can never drift from the figure
// Stripe charges. PostgREST returns numeric columns as strings, so everything
// coerces through Number() before arithmetic.

import type { BookingRow } from "./supabaseAdmin";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The agreed figure for the job: the adjusted price once agreed, else the quote. */
export function agreedPriceFor(b: BookingRow): number {
  return b.price_status === "agreed" && b.final_price != null
    ? Number(b.final_price)
    : Number(b.quoted_price);
}

/** Gross money taken, before any refunds. This is what `amount_paid` stores —
 *  payment recording accumulates on this figure, never the net one. */
export function grossPaidFor(b: BookingRow): number {
  return Number(b.amount_paid ?? 0) || 0;
}

/** Money returned to the customer so far. */
export function refundedFor(b: BookingRow): number {
  return Number(b.refund_amount ?? 0) || 0;
}

/**
 * What the customer has actually parted with: gross minus refunds. A refunded
 * booking used to still read "paid in full" everywhere except reports, which
 * quietly did its own subtraction — the netting lives here now, once.
 */
export function paidSoFar(b: BookingRow): number {
  return Math.max(0, round2(grossPaidFor(b) - refundedFor(b)));
}

/** Money in beyond the agreed price — a refund conversation, surfaced not clamped. */
export function overpaidBy(b: BookingRow): number {
  return Math.max(0, round2(paidSoFar(b) - agreedPriceFor(b)));
}

/**
 * What is left to charge: the agreed price minus anything already taken.
 * Never negative — an overpayment is a refund conversation, not a negative bill.
 */
export function amountDueFor(b: BookingRow): number {
  return Math.max(0, round2(agreedPriceFor(b) - paidSoFar(b)));
}

/** Money has moved and covers the whole agreed price. */
export function isPaidInFull(b: BookingRow): boolean {
  return b.paid_at != null && amountDueFor(b) <= 0;
}

/** Money has moved but not all of it — the office needs to see this, not guess. */
export function isPartPaid(b: BookingRow): boolean {
  return b.paid_at != null && paidSoFar(b) > 0 && amountDueFor(b) > 0;
}
