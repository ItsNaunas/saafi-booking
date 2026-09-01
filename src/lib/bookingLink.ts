// Signed customer links to /b/[reference] — the self-serve booking page.
//
// The reference alone is guessable-ish (timestamp base36 + short random tail),
// and the page shows a name and address, so every link carries an HMAC over
// the reference. Derived from SESSION_SECRET like the calendar feed: no new
// secret to provision, and rotating the secret invalidates every old link.

import { createHmac, timingSafeEqual } from "crypto";
import { siteUrl } from "./stripe";
import { londonWallClock } from "./scheduling";
import { paidSoFar } from "./money";
import type { BookingRow } from "./supabaseAdmin";

/**
 * How the customer may cancel: self-serve, by phone, or not at all.
 * The public promise is "let us know a day or so before and there's nothing to
 * pay" — self-serve honours exactly that; anything closer, or anything already
 * paid (a refund decision belongs to the office), is a phone call.
 */
export function cancellationRoute(b: BookingRow, now = new Date()): "self" | "phone" | "none" {
  if (!["requested", "confirmed"].includes(b.status)) return "none";
  // ANY money in means a refund conversation, not only a full payment.
  if (paidSoFar(b) > 0) return "phone";
  const { date: today } = londonWallClock(now);
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  // ">=" — cancelling tomorrow's clean IS "a day's notice", exactly the promise.
  return b.preferred_date >= tomorrow.toISOString().slice(0, 10) ? "self" : "phone";
}

function derive(reference: string): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret)
    .update(`booking-link-v1:${reference}`)
    .digest("hex")
    .slice(0, 32);
}

export function bookingToken(reference: string): string | null {
  return derive(reference);
}

export function verifyBookingToken(reference: string, token: string): boolean {
  const expected = derive(reference);
  if (!expected || !/^[0-9a-f]{32}$/i.test(token)) return false;
  const a = Buffer.from(token.toLowerCase(), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The full link that goes in customer emails, or null pre-configuration. */
export function bookingManageUrl(reference: string): string | null {
  const token = derive(reference);
  if (!token) return null;
  return `${siteUrl()}/b/${encodeURIComponent(reference)}?t=${token}`;
}
