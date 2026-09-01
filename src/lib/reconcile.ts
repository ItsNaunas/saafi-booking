// Stripe ↔ bookings reconciliation — the nightly answer to "did we take money
// the database doesn't know about?".
//
// Three known leak paths make this necessary rather than paranoid:
//   - a card charge succeeded but the mark-paid write failed
//   - a payment link was paid but its webhook delivery was missed
//   - a link existed on Stripe that never got saved to the booking
// Each one ends with a customer being chased for money already taken. This
// sweep walks Stripe's recent successful payments, joins them back to bookings
// by payment link or by the booking id carried in metadata, and repairs any
// booking whose record doesn't show that payment.
//
// A payment is "recorded" when the booking carries its payment-intent id —
// the same identity rule the webhook uses. Skipping on paid_at alone was
// wrong: a part-paid booking has paid_at set, and the *second* payment with a
// lost webhook would have been invisible to exactly the sweep built to catch it.

import { getStripe, fromPence } from "./stripe";
import {
  getBookingByPaymentLink,
  getBooking,
  grossPaidFor,
  amountDueFor,
  markBookingPaid,
  recordBookingPayment,
  type BookingRow,
} from "./supabaseAdmin";

export type ReconcileResult = {
  /** References repaired this run. */
  repaired: string[];
  /** Payments that could not be matched to any booking — humans needed. */
  unmatched: string[];
};

async function repair(booking: BookingRow, paymentIntent: string, amount: number): Promise<void> {
  const total = Math.round((grossPaidFor(booking) + amount) * 100) / 100;
  const afterThis = { ...booking, amount_paid: total };
  // Same rule as the webhook: `paid` is for finished work with the money in
  // full — a repaired part payment must not settle the whole bill.
  if (booking.status === "completed" && amountDueFor(afterThis) <= 0) {
    await markBookingPaid(booking.id, paymentIntent, total);
  } else {
    await recordBookingPayment(booking.id, paymentIntent, total);
  }
}

/** Recorded = the booking already carries this payment's intent id. */
function alreadyRecorded(booking: BookingRow, paymentIntent: string): boolean {
  return Boolean(paymentIntent) && booking.stripe_payment_intent === paymentIntent;
}

/**
 * Sweep the last `days` of Stripe activity and repair unpaid-looking bookings.
 * Throws only if Stripe itself is unreachable — individual mismatches are
 * reported, not fatal. Paginates (Stripe lists newest-first, and the oldest
 * records are exactly the ones most likely to have lost a webhook).
 */
export async function reconcileStripePayments(days = 3): Promise<ReconcileResult> {
  const stripe = getStripe();
  const out: ReconcileResult = { repaired: [], unmatched: [] };
  if (!stripe) return out;

  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  const CAP = 500; // runaway guard, far above a real 3-day volume

  // Checkout sessions cover payment links (link payments carry no metadata of
  // their own — the join key is the payment_link id saved on the booking).
  let seen = 0;
  for await (const s of stripe.checkout.sessions.list({ created: { gte: since }, limit: 100 })) {
    if (++seen > CAP) break;
    if (s.mode === "setup" || s.payment_status !== "paid") continue;
    const linkId = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
    if (!linkId) continue;
    const booking = await getBookingByPaymentLink(linkId).catch(() => null);
    if (!booking) {
      out.unmatched.push(`session ${s.id} (link ${linkId})`);
      continue;
    }
    const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? "");
    if (alreadyRecorded(booking, pi)) continue;
    if (amountDueFor(booking) <= 0) continue; // settled by other means; webhook alerts cover extras
    await repair(booking, pi, fromPence(s.amount_total ?? 0));
    out.repaired.push(booking.reference);
  }

  // Payment intents cover card-on-file charges — those DO carry booking_id in
  // metadata, written by chargeSavedCard.
  seen = 0;
  for await (const pi of stripe.paymentIntents.list({ created: { gte: since }, limit: 100 })) {
    if (++seen > CAP) break;
    if (pi.status !== "succeeded") continue;
    const bookingId = pi.metadata?.booking_id;
    if (!bookingId) continue; // link payments handled above via sessions
    const booking = await getBooking(bookingId).catch(() => null);
    if (!booking) {
      out.unmatched.push(`payment ${pi.id} (booking ${bookingId} missing)`);
      continue;
    }
    if (alreadyRecorded(booking, pi.id)) continue;
    if (amountDueFor(booking) <= 0) continue;
    await repair(booking, pi.id, fromPence(pi.amount_received ?? pi.amount));
    out.repaired.push(booking.reference);
  }

  return out;
}
