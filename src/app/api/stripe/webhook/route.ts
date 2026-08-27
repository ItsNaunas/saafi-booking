import { NextResponse } from "next/server";
import { getStripe, fromPence } from "@/lib/stripe";
import type Stripe from "stripe";
import {
  getBookingByPaymentLink,
  getBookingByPaymentIntent,
  markBookingPaid,
  recordBookingPayment,
  recordBookingRefund,
  recordStripeEvent,
  getBooking,
  getCustomer,
  getCustomerByEmail,
  getCustomerByPaymentMethod,
  saveCustomerCard,
  clearCustomerCard,
  amountDueFor,
  paidSoFar,
  isPaidInFull,
} from "@/lib/supabaseAdmin";
import { deactivatePaymentLink } from "@/lib/paymentLink";
import { sendPaymentReceivedEmails, sendOpsAlertEmail } from "@/lib/email";

// Stripe needs the raw body to verify the signature, so this route must never
// be statically optimised or have its body parsed for us.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    // Misconfigured rather than malicious — don't make Stripe retry forever.
    console.error("[stripe] webhook hit but STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET missing");
    return NextResponse.json({ error: "stripe not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  // Raw text, not req.json() — parsing would change the bytes the signature covers.
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (e) {
    // An unverified body is the one thing we must never act on.
    console.error("[stripe] signature verification failed:", (e as Error).message);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Replay guard: Stripe redelivers events, and each handler below is also
  // individually idempotent — this just saves the round-trips and gives an
  // answer to "which events did we see last Tuesday".
  const firstSighting = await recordStripeEvent(event.id, event.type);
  if (!firstSighting) {
    return NextResponse.json({ received: true, ignored: "duplicate event" });
  }

  try {
    if (event.type === "charge.refunded") {
      return handleRefund(event.data.object);
    }
    if (event.type === "charge.dispute.created") {
      return handleDispute(event.data.object);
    }
    if (event.type === "payment_method.detached") {
      return handleCardDetached(event.data.object);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // A setup session carries no payment at all — it is somebody saving a card
      // for later. Different shape, different meaning, handled separately.
      if (session.mode === "setup") {
        return handleCardSaved(session);
      }

      // Only settle when the money is actually there. `complete` sessions can
      // still be unpaid (e.g. a delayed payment method).
      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true, ignored: "not yet paid" });
      }

      const linkId =
        typeof session.payment_link === "string"
          ? session.payment_link
          : (session.payment_link?.id ?? null);

      if (!linkId) {
        return NextResponse.json({ received: true, ignored: "no payment link on session" });
      }

      const booking = await getBookingByPaymentLink(linkId);
      if (!booking) {
        // Money was taken and no booking claims it. The nightly reconciliation
        // sweep will retry the match, but a human should know now.
        console.error("[stripe] no booking matches payment link", linkId);
        await sendOpsAlertEmail({
          subject: "⚠ A payment arrived that no booking claims",
          heading: "Stripe took a payment we can't match to a booking",
          lines: [
            `Payment link ${linkId} was paid, but no booking carries that link.`,
            "Check the Stripe dashboard for the customer's details before anyone chases them.",
          ],
        }).catch(() => {});
        return NextResponse.json({ received: true, ignored: "no matching booking" });
      }

      // Stripe retries on any non-2xx, so this has to be idempotent.
      if (isPaidInFull(booking)) {
        return NextResponse.json({ received: true, ignored: "already paid" });
      }

      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? "");

      const thisPayment = fromPence(session.amount_total ?? 0);
      // Running total: a prepayment and a later remainder must add, not overwrite.
      const total = Math.round((paidSoFar(booking) + thisPayment) * 100) / 100;

      // Payment and workflow are different facts. A finished job that gets its
      // money graduates to `paid`; a job still to be confirmed or cleaned keeps
      // its place in the pipeline and simply carries the money with it — the
      // old behaviour (status jumped straight to `paid`) froze prepaid
      // bookings where the cleaner could never see them.
      if (booking.status === "completed") {
        await markBookingPaid(booking.id, paymentIntent, total);
      } else {
        await recordBookingPayment(booking.id, paymentIntent, total);
      }
      console.log(`[stripe] booking ${booking.reference} payment recorded (£${total})`);

      // The link did its job — a live payable page for a settled clean is how
      // you get paid twice. Best-effort.
      await deactivatePaymentLink({ ...booking, amount_paid: total }).catch(() => {});

      // A short payment is a conversation, not a settled bill.
      const stillOwed = amountDueFor({ ...booking, amount_paid: total });
      if (stillOwed > 0) {
        await sendOpsAlertEmail({
          subject: `⚠ Part payment on ${booking.reference}`,
          heading: "A booking was paid short",
          lines: [
            `${booking.customer_name} paid £${thisPayment} against ${booking.reference}; £${stillOwed} is still outstanding.`,
          ],
        }).catch(() => {});
      }

      // Thank the customer, and tell the office without them refreshing Stripe.
      await sendPaymentReceivedEmails(booking, thisPayment).catch(
        (e) => console.error("[stripe] payment emails failed:", e)
      );
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    // Returning 500 asks Stripe to retry, which is what we want for a transient
    // database failure — the handler above is idempotent so a replay is safe.
    console.error("[stripe] handler failed:", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

/**
 * A refund was issued — usually from the Stripe dashboard, where the admin
 * refund button ends up, but also covers one issued by hand. Without this, a
 * dashboard refund left the booking claiming the money was still in.
 */
async function handleRefund(charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return NextResponse.json({ received: true, ignored: "refund with no payment intent" });

  const booking = await getBookingByPaymentIntent(pi);
  const refunded = fromPence(charge.amount_refunded ?? 0);
  if (booking) {
    await recordBookingRefund(booking.id, refunded).catch((e) =>
      console.error("[stripe] could not record refund (column not migrated yet?):", e)
    );
  }
  await sendOpsAlertEmail({
    subject: `Refund issued${booking ? ` — ${booking.reference}` : ""}`,
    heading: "A payment was refunded on Stripe",
    lines: [
      booking
        ? `£${refunded} went back to ${booking.customer_name} for ${booking.reference}.`
        : `£${refunded} was refunded on payment ${pi}, which matches no booking here.`,
    ],
  }).catch(() => {});
  return NextResponse.json({ received: true, refund: true });
}

/** A chargeback. Rare, expensive, and invisible until now. */
async function handleDispute(dispute: Stripe.Dispute) {
  const pi = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  const booking = pi ? await getBookingByPaymentIntent(pi) : null;
  await sendOpsAlertEmail({
    subject: `⚠ Chargeback opened${booking ? ` — ${booking.reference}` : ""}`,
    heading: "A customer's bank has opened a dispute",
    lines: [
      booking
        ? `${booking.customer_name} (${booking.reference}) has disputed £${fromPence(dispute.amount)}.`
        : `A dispute for £${fromPence(dispute.amount)} was opened on payment ${pi ?? "(unknown)"}.`,
      "Respond in the Stripe dashboard before the deadline — an unanswered dispute is an automatic loss.",
    ],
  }).catch(() => {});
  return NextResponse.json({ received: true, dispute: true });
}

/**
 * The customer's saved card is gone on Stripe's side. Keeping the stale handle
 * meant every future off-session charge quietly declined forever.
 */
async function handleCardDetached(pm: Stripe.PaymentMethod) {
  const customer = await getCustomerByPaymentMethod(pm.id);
  if (!customer) return NextResponse.json({ received: true, ignored: "card unknown here" });

  await clearCustomerCard(customer.id);
  await sendOpsAlertEmail({
    subject: `Card removed — ${customer.name}`,
    heading: "A saved card is no longer available",
    lines: [
      `${customer.name}'s ${pm.card?.brand ?? "card"} ending ${pm.card?.last4 ?? "????"} was removed on Stripe.`,
      "Their future cleans will settle by payment link until a new card is saved.",
    ],
  }).catch(() => {});
  return NextResponse.json({ received: true, cardCleared: true });
}

/**
 * Somebody finished saving a card on Stripe's hosted page.
 *
 * The session itself only carries a setup_intent id, so the payment method has
 * to be fetched to learn anything human-readable about it. Storing the brand and
 * last four is not decoration: it is how the office and the customer both confirm
 * they are talking about the same card.
 */
async function handleCardSaved(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) {
    return NextResponse.json({ received: true, ignored: "setup session with no booking" });
  }

  const booking = await getBooking(bookingId);
  if (!booking) {
    console.error("[stripe] card saved for a booking that does not exist", bookingId);
    return NextResponse.json({ received: true, ignored: "no matching booking" });
  }

  const stripe = getStripe();
  const setupIntentId =
    typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
  if (!stripe || !setupIntentId) {
    return NextResponse.json({ received: true, ignored: "no setup intent on the session" });
  }

  const intent = await stripe.setupIntents.retrieve(setupIntentId);
  const pmId =
    typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!pmId || !customerId) {
    return NextResponse.json({ received: true, ignored: "setup completed without a card" });
  }

  const pm = await stripe.paymentMethods.retrieve(pmId);

  // The card belongs to the person, not this one visit — so every future clean in
  // the series can settle against it too.
  const customer = booking.customer_id
    ? await getCustomer(booking.customer_id).catch(() => null)
    : await getCustomerByEmail(booking.customer_email).catch(() => null);

  if (!customer) {
    console.error("[stripe] card saved but no customer row to attach it to", booking.reference);
    return NextResponse.json({ received: true, ignored: "no customer row" });
  }

  await saveCustomerCard(customer.id, {
    stripe_customer_id: customerId,
    stripe_payment_method_id: pmId,
    card_brand: pm.card?.brand ?? null,
    card_last4: pm.card?.last4 ?? null,
  });

  console.log(`[stripe] card saved for ${booking.customer_name} (${booking.reference})`);
  return NextResponse.json({ received: true, saved: "card" });
}
