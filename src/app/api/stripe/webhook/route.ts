import { NextResponse } from "next/server";
import { getStripe, fromPence } from "@/lib/stripe";
import { getBookingByPaymentLink, markBookingPaid } from "@/lib/supabaseAdmin";

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
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    // Returning 500 asks Stripe to retry, which is what we want for a transient
    // database failure — the handler above is idempotent so a replay is safe.
    console.error("[stripe] handler failed:", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}
