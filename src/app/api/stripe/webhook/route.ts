import { NextResponse } from "next/server";
import { getStripe, fromPence } from "@/lib/stripe";
import type Stripe from "stripe";
import {
  getBookingByPaymentLink,
  markBookingPaid,
  getBooking,
  getCustomer,
  getCustomerByEmail,
  saveCustomerCard,
} from "@/lib/supabaseAdmin";
import { sendPaymentReceivedEmails } from "@/lib/email";

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

  try {
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
        console.error("[stripe] no booking matches payment link", linkId);
        return NextResponse.json({ received: true, ignored: "no matching booking" });
      }

      // Stripe retries on any non-2xx, so this has to be idempotent.
      if (booking.status === "paid") {
        return NextResponse.json({ received: true, ignored: "already paid" });
      }

      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? "");

      await markBookingPaid(
        booking.id,
        paymentIntent,
        fromPence(session.amount_total ?? 0)
      );
      console.log(`[stripe] booking ${booking.reference} marked paid`);

      // Thank the customer, and tell the office without them refreshing Stripe.
      await sendPaymentReceivedEmails(booking, fromPence(session.amount_total ?? 0)).catch(
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
