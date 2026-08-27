// Raising a Stripe payment link for a booking, shared by the admin's manual
// button and the pay-at-booking flow (2026-08-25 review: "you book it, you pay
// for it, it's requested, and then it's confirmed").
//
// Failure returns null and is never fatal: a booking that couldn't get a link
// is exactly what the system was before this existed — settled by phone.

import { getStripe, toPence, siteUrl } from "@/lib/stripe";
import { amountDueFor, saveBookingPaymentLink, type BookingRow } from "@/lib/supabaseAdmin";

export async function raiseBookingPaymentLink(booking: BookingRow): Promise<string | null> {
  if (booking.stripe_payment_link_url) return booking.stripe_payment_link_url;
  if (booking.status === "paid") return null;

  const stripe = getStripe();
  if (!stripe) return null;

  const amount = amountDueFor(booking);
  if (!(amount > 0)) return null;

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
    await saveBookingPaymentLink(booking.id, link.id, link.url);
    return link.url;
  } catch (e) {
    console.error(`[stripe] payment link for ${booking.reference} failed:`, e);
    return null;
  }
}
