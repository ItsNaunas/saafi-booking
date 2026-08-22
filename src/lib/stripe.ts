// Server-side Stripe client. The secret key must never reach the browser, so
// nothing in here may be imported from a "use client" module.

import Stripe from "stripe";

let cached: Stripe | null = null;

/** Null when Stripe isn't configured — the rest of the app carries on without it. */
export function getStripe(): Stripe | null {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  cached = new Stripe(key);
  return cached;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Whether we're pointed at test mode — surfaced in the admin so it's never ambiguous. */
export function stripeIsTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

/** GBP pounds -> integer pence, which is what Stripe wants. */
export function toPence(amount: number): number {
  return Math.round(amount * 100);
}

export function fromPence(pence: number): number {
  return Math.round(pence) / 100;
}

/**
 * Where Stripe sends the customer after paying. Falls back to the request's own
 * origin so this works on localhost, previews and prod without extra config.
 */
export function siteUrl(fallbackOrigin?: string): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ??
    fallbackOrigin ??
    "http://localhost:3000"
  );
}
