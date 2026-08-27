// Raising a Stripe payment link for a booking, shared by the admin's manual
// button, the pay-at-booking flow and the auto-invoice on completion.
//
// Failure returns null and is never fatal: a booking that couldn't get a link
// is exactly what the system was before this existed — settled by phone.
//
// A link is only reused while it still charges the right amount. Prices move
// (an approved adjustment, a prepayment covering part of the bill), and the
// old failure mode was an email stating £X that linked to a Stripe page
// charging £Y — the stale link is deactivated and a fresh one raised instead.

import { getStripe, toPence, siteUrl } from "@/lib/stripe";
import {
  amountDueFor,
  getBooking,
  saveBookingPaymentLink,
  clearBookingPaymentLink,
  markPaymentLinkSent,
  type BookingRow,
} from "@/lib/supabaseAdmin";

export async function raiseBookingPaymentLink(booking: BookingRow): Promise<string | null> {
  if (booking.status === "paid") return null;

  const stripe = getStripe();
  if (!stripe) return null;

  const amount = amountDueFor(booking);
  if (!(amount > 0)) return null;

  if (booking.stripe_payment_link_url) {
    const linkAmount = booking.payment_link_amount;
    // Pre-migration rows carry no recorded amount — reuse rather than churn.
    if (linkAmount == null || Math.abs(Number(linkAmount) - amount) < 0.005) {
      return booking.stripe_payment_link_url;
    }
    await deactivatePaymentLink(booking);
  }

  try {
    const price = await stripe.prices.create({
      currency: "gbp",
      unit_amount: toPence(amount),
      product_data: { name: `Clean on ${booking.preferred_date} — ${booking.reference}` },
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { booking_id: booking.id, reference: booking.reference },
      after_completion: {
        type: "redirect",
        redirect: { url: `${siteUrl()}/paid?ref=${encodeURIComponent(booking.reference)}` },
      },
    });
    await saveBookingPaymentLink(booking.id, link.id, link.url, amount);
    return link.url;
  } catch (e) {
    console.error(`[stripe] payment link for ${booking.reference} failed:`, e);
    return null;
  }
}

/**
 * Kill the booking's live payment link on Stripe and forget it locally.
 * Called when a booking is cancelled or paid — a live payable link for a clean
 * that won't happen (or already settled) is how you get paid twice.
 * Best-effort: a failure leaves the old behaviour, never breaks the caller.
 */
/**
 * A finished clean with no card on file invoices itself: raise (or refresh)
 * the link and send the "your clean is done" email. One implementation shared
 * by the admin completion path and the cleaner's finish button — the two
 * hand-rolled copies had already drifted apart on their guards.
 *
 * Re-reads the booking so it acts on post-completion state, skips anything
 * already settled or still waiting on a price decision, and never throws.
 */
export async function autoInvoiceIfUnpaid(bookingId: string): Promise<void> {
  try {
    const fresh = await getBooking(bookingId);
    if (!fresh || fresh.status !== "completed" || fresh.price_status === "pending") return;
    const amount = amountDueFor(fresh);
    if (!(amount > 0)) return;
    const url = await raiseBookingPaymentLink(fresh);
    if (!url) return;
    const { sendCleanCompletedEmail } = await import("./email");
    await sendCleanCompletedEmail(fresh, amount, url);
    await markPaymentLinkSent(fresh.id).catch(() => {});
  } catch (e) {
    console.error(`[stripe] auto-invoice for booking ${bookingId} failed:`, e);
  }
}

export async function deactivatePaymentLink(booking: BookingRow): Promise<void> {
  if (!booking.stripe_payment_link_id) return;
  const stripe = getStripe();
  try {
    if (stripe) {
      await stripe.paymentLinks.update(booking.stripe_payment_link_id, { active: false });
    }
    await clearBookingPaymentLink(booking.id);
  } catch (e) {
    console.error(`[stripe] could not deactivate link for ${booking.reference}:`, e);
  }
}
