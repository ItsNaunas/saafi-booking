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
// booking still showing unpaid.

import { getStripe, fromPence } from "./stripe";
import {
  getBookingByPaymentLink,
  getBooking,
  paidSoFar,
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
  const total = Math.round((paidSoFar(booking) + amount) * 100) / 100;
  if (booking.status === "completed") {
    await markBookingPaid(booking.id, paymentIntent, total);
  } else {
    await recordBookingPayment(booking.id, paymentIntent, total);
  }
}

/**
 * Sweep the last `days` of Stripe activity and repair unpaid-looking bookings.
 * Throws only if Stripe itself is unreachable — individual mismatches are
 * reported, not fatal.
 */
export async function reconcileStripePayments(days = 3): Promise<ReconcileResult> {
  const stripe = getStripe();
  const out: ReconcileResult = { repaired: [], unmatched: [] };
  if (!stripe) return out;

  const since = Math.floor(Date.now() / 1000) - days * 86_400;

  // Checkout sessions cover payment links (link payments carry no metadata of
  // their own — the join key is the payment_link id saved on the booking).
  const sessions = await stripe.checkout.sessions.list({
    created: { gte: since },
    limit: 100,
  });
  for (const s of sessions.data) {
    if (s.mode === "setup" || s.payment_status !== "paid") continue;
    const linkId = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
    if (!linkId) continue;
    const booking = await getBookingByPaymentLink(linkId).catch(() => null);
    if (!booking) {
      out.unmatched.push(`session ${s.id} (link ${linkId})`);
      continue;
    }
    if (booking.paid_at) continue; // already recorded
    const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? "");
    await repair(booking, pi, fromPence(s.amount_total ?? 0));
    out.repaired.push(booking.reference);
  }

  // Payment intents cover card-on-file charges — those DO carry booking_id in
  // metadata, written by chargeSavedCard.
  const intents = await stripe.paymentIntents.list({ created: { gte: since }, limit: 100 });
  for (const pi of intents.data) {
    if (pi.status !== "succeeded") continue;
    const bookingId = pi.metadata?.booking_id;
    if (!bookingId) continue; // link payments handled above via sessions
    const booking = await getBooking(bookingId).catch(() => null);
    if (!booking) {
      out.unmatched.push(`payment ${pi.id} (booking ${bookingId} missing)`);
      continue;
    }
    if (booking.paid_at) continue;
    await repair(booking, pi.id, fromPence(pi.amount_received ?? pi.amount));
    out.repaired.push(booking.reference);
  }

  return out;
}
