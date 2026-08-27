/**
 * Card on file — letting a finished clean settle itself.
 *
 * The money used to be asked for at the weakest possible moment: the job done,
 * the cleaner gone, and only then a link raised and chased. SAAFI carried the
 * credit on every visit and the payment half of the flow cost four manual actions
 * a job — over a hundred a year for one fortnightly customer.
 *
 * Two deliberate choices in how this is built:
 *
 * 1. The card is saved through Stripe's own hosted page, not through card fields
 *    embedded in the quote form. It reuses the pattern already proven here — a
 *    hosted URL plus a webhook — needs no client-side Stripe.js, and keeps card
 *    details off this application entirely. What is stored is a pair of handles.
 *
 * 2. A Stripe *subscription* would be the wrong tool despite the recurring
 *    cleans. Prices vary per visit — that is the entire point of the adjustment
 *    engine — and subscriptions want a fixed amount. Saved card plus an
 *    off-session charge for the actual agreed figure fits what the business does.
 */

import type Stripe from "stripe";
import { getStripe, toPence, siteUrl } from "./stripe";
import {
  amountDueFor,
  isPaidInFull,
  paidSoFar,
  getCustomer,
  getCustomerByEmail,
  markBookingPaid,
  finaliseBookingPaid,
  recordChargeAttempt,
  type BookingRow,
  type CustomerRow,
} from "./supabaseAdmin";

export type CardResult =
  | { ok: true; paymentIntentId: string; amount: number }
  | { ok: false; reason: string; needsCustomer?: boolean };

/** A customer with a usable saved card, or null. */
export function savedCard(
  c: CustomerRow | null | undefined
): { customerId: string; paymentMethodId: string } | null {
  if (!c?.stripe_customer_id || !c?.stripe_payment_method_id) return null;
  return { customerId: c.stripe_customer_id, paymentMethodId: c.stripe_payment_method_id };
}

/** How the card reads to a human. "Visa ending 4242", or nothing useful yet. */
export function describeCard(c: CustomerRow | null | undefined): string | null {
  if (!c?.card_last4) return null;
  const brand = (c.card_brand ?? "card").replace(/^\w/, (ch) => ch.toUpperCase());
  return `${brand} ending ${c.card_last4}`;
}

/**
 * A hosted Stripe page where the customer saves a card. Nothing is charged.
 *
 * Unlike a Payment Link this one does expire — Stripe's setup sessions last 24
 * hours — so it is raised on demand when SAAFI want to send it, not stored and
 * forgotten.
 */
export async function createCardSetupLink(
  booking: BookingRow,
  existingStripeCustomerId: string | null
): Promise<{ url: string; stripeCustomerId: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe isn't configured on this environment" };

  try {
    const customerId =
      existingStripeCustomerId ??
      (
        await stripe.customers.create({
          name: booking.customer_name,
          email: booking.customer_email,
          phone: booking.customer_phone,
          metadata: { reference: booking.reference },
        })
      ).id;

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      currency: "gbp",
      // The webhook needs to know which booking sent them, since a setup session
      // carries no payment of its own to match on.
      metadata: { booking_id: booking.id, reference: booking.reference },
      success_url: `${siteUrl()}/card-saved?ref=${encodeURIComponent(booking.reference)}`,
      cancel_url: `${siteUrl()}/card-saved?ref=${encodeURIComponent(booking.reference)}&cancelled=1`,
    });

    if (!session.url) return { error: "Stripe returned a session with no URL" };
    return { url: session.url, stripeCustomerId: customerId };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Charge a saved card for what the booking actually owes.
 *
 * `off_session` tells Stripe nobody is at the keyboard. Most cards go through;
 * some — often European ones — insist the customer is present, and Stripe says
 * so rather than silently failing. That case is not an error to hide: it means
 * fall back to sending a payment link, which still works.
 */
export async function chargeSavedCard(
  booking: BookingRow,
  card: { customerId: string; paymentMethodId: string }
): Promise<CardResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, reason: "Stripe isn't configured on this environment" };

  const amount = amountDueFor(booking);
  if (!(amount > 0)) return { ok: false, reason: `nothing to charge — the amount is ${amount}` };

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: toPence(amount),
        currency: "gbp",
        customer: card.customerId,
        payment_method: card.paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Clean on ${booking.preferred_date} — ${booking.reference}`,
        metadata: { booking_id: booking.id, reference: booking.reference },
      },
      // Two clicks, or a retry after a timeout, must not charge twice. Keyed on
      // the booking and the amount, so a repriced job can still be charged.
      { idempotencyKey: `saafi-${booking.id}-${toPence(amount)}` }
    );

    if (intent.status === "succeeded") {
      return { ok: true, paymentIntentId: intent.id, amount };
    }
    return {
      ok: false,
      reason: `Stripe left the payment ${intent.status.replace(/_/g, " ")}`,
      needsCustomer: intent.status === "requires_action",
    };
  } catch (e) {
    const err = e as Stripe.errors.StripeError;
    // A decline arrives as an exception, not a status.
    const declined = err.code === "authentication_required";
    return {
      ok: false,
      reason: err.message ?? "the card was declined",
      needsCustomer: declined,
    };
  }
}

/**
 * Settle a finished clean against the card on file, if there is one.
 *
 * Called when a booking reaches a state where the money is finally certain: the
 * work is done and the price is agreed. Anything less than that is left alone —
 * a pending adjustment means the owner has not decided yet, and charging before
 * they do would be charging a figure nobody has agreed.
 *
 * Every failure here is recoverable by falling back to a payment link, so none of
 * them throw. The reason is written to the booking so the office can see why.
 */
export async function settleBookingWithSavedCard(
  booking: BookingRow
): Promise<CardResult> {
  if (booking.status === "paid") {
    return { ok: false, reason: "already paid" };
  }
  if (booking.price_status === "pending") {
    return { ok: false, reason: "waiting on the owner to agree the price" };
  }
  // Prepaid (pay-at-booking) jobs owe nothing by the time the cleaner finishes.
  // That is not a failure to route to a payment link — it is the job graduating.
  if (amountDueFor(booking) <= 0) {
    if (booking.status === "completed" && isPaidInFull(booking)) {
      await finaliseBookingPaid(booking.id).catch((e) =>
        console.error("[card] could not finalise a prepaid booking as paid:", e)
      );
    }
    return { ok: false, reason: "nothing left to charge" };
  }

  const customer = booking.customer_id
    ? await getCustomer(booking.customer_id).catch(() => null)
    : await getCustomerByEmail(booking.customer_email).catch(() => null);

  const card = savedCard(customer);
  if (!card) return { ok: false, reason: "no card on file" };

  const result = await chargeSavedCard(booking, card);

  if (result.ok) {
    // amount_paid stores the running total: a prepaid deposit plus a charged
    // remainder must add up, not overwrite each other.
    const total = Math.round((paidSoFar(booking) + result.amount) * 100) / 100;
    await markBookingPaid(booking.id, result.paymentIntentId, total).catch(async (e) => {
      // The money is taken and the database doesn't know. This is the most
      // expensive silent failure in the system — the customer would be chased
      // for money already paid — so the office hears about it immediately.
      console.error("[card] charged but could not mark paid:", e);
      const { sendOpsAlertEmail } = await import("./email");
      await sendOpsAlertEmail({
        subject: `⚠ Charged but not recorded — ${booking.reference}`,
        heading: "A card charge went through but the booking could not be marked paid",
        lines: [
          `${booking.customer_name}'s card was charged £${result.amount} for ${booking.reference}, but writing that to the booking failed.`,
          "Do not chase this customer for payment. Mark the booking paid by hand, or the reconciliation sweep will repair it overnight.",
          `Stripe payment: ${result.paymentIntentId}`,
        ],
      }).catch(() => {});
    });
    await recordChargeAttempt(booking.id, null).catch(() => {});
  } else {
    await recordChargeAttempt(booking.id, result.reason).catch(() => {});
  }
  return result;
}
