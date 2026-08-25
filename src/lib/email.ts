// Customer-facing emails via Resend. No-ops silently until RESEND_API_KEY is set.

import type { BookingRow } from "./supabaseAdmin";
import { secret } from "./env";
import { formatTimeRange } from "@/lib/scheduling";

export async function sendConfirmationEmail(booking: BookingRow): Promise<void> {
  const key = secret("RESEND_API_KEY");
  if (!key) return;
  const from = process.env.ALERT_EMAIL_FROM ?? "bookings@saaficleaningservice.com";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `SAAFI Cleaning Service <${from}>`,
      to: [booking.customer_email],
      subject: `Your clean is confirmed — ${booking.preferred_date} (${booking.reference})`,
      text: [
        `Hi ${booking.customer_name.split(" ")[0]},`,
        ``,
        `Good news — your clean is confirmed!`,
        ``,
        `Date:     ${booking.preferred_date}`,
        booking.start_time
          ? `Time:     ${formatTimeRange(booking.start_time, Number(booking.hours))}`
          : `Time:     we'll agree this with you`,
        `Duration: ${booking.hours} hours`,
        `Address:  ${booking.address_line}, ${booking.postcode}`,
        `Price:    £${booking.quoted_price}`,
        `Products: ${booking.customer_provides_products ? "you provide" : "we bring ours"}`,
        `Reference: ${booking.reference}`,
        ``,
        `Need to change anything? Just reply to this email or give us a call.`,
        ``,
        `SAAFI Cleaning Service`,
        `saaficleaningservice.com`,
      ].join("\n"),
    }),
  });
}

/**
 * Tell the customer their price changed, and why. Sent only after the owner has
 * approved the adjustment — nothing reaches a customer automatically.
 */
export async function sendAdjustmentEmail(
  booking: BookingRow,
  adj: { from_hours: number; to_hours: number; from_price: number; to_price: number; reason_code: string; note: string | null }
): Promise<void> {
  const key = secret("RESEND_API_KEY");
  if (!key) return;
  const from = process.env.ALERT_EMAIL_FROM ?? "bookings@saaficleaningservice.com";
  const replyTo = process.env.ALERT_EMAIL_TO ?? "info@saaficleaningservice.com";

  const { reasonLabel } = await import("./adjustments");
  const extra = Math.round((Number(adj.to_hours) - Number(adj.from_hours)) * 100) / 100;
  const diff = Math.round((Number(adj.to_price) - Number(adj.from_price)) * 100) / 100;
  const longer = extra > 0;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `SAAFI Cleaning Service <${from}>`,
      reply_to: replyTo,
      to: [booking.customer_email],
      subject: `Your clean on ${booking.preferred_date} — updated total £${adj.to_price}`,
      text: [
        `Hi ${booking.customer_name.split(" ")[0]},`,
        ``,
        longer
          ? `Your clean took a bit longer than booked, so your total has changed.`
          : `Your clean finished sooner than booked, so we've reduced your total.`,
        ``,
        `Booked:  ${adj.from_hours} hours — £${adj.from_price}`,
        `Actual:  ${adj.to_hours} hours — £${adj.to_price}`,
        `Reason:  ${reasonLabel(adj.reason_code as never)}`,
        adj.note ? `Note:    ${adj.note}` : ``,
        ``,
        longer
          ? `That's ${extra} extra hour${extra === 1 ? "" : "s"}, so £${Math.abs(diff)} more than quoted.`
          : `That's £${Math.abs(diff)} less than quoted.`,
        ``,
        `Reference: ${booking.reference}`,
        ``,
        `Any questions, just reply to this email or give us a call.`,
        ``,
        `SAAFI Cleaning Service`,
        `saaficleaningservice.com`,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  });
}

/**
 * Send the customer their payment link.
 *
 * Never sent automatically when the link is raised — the owner triggers it, so
 * they get a chance to check the amount before it reaches a customer, and can
 * still send it over WhatsApp instead if that suits that customer better.
 */
export async function sendPaymentLinkEmail(
  booking: BookingRow,
  amount: number
): Promise<{ ok: boolean; reason?: string }> {
  const key = secret("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "email isn't configured" };
  if (!booking.stripe_payment_link_url) return { ok: false, reason: "no payment link yet" };
  if (!looksLikeARealAddress(booking.customer_email)) {
    return { ok: false, reason: "that booking has no real email address" };
  }

  const from = process.env.ALERT_EMAIL_FROM ?? "bookings@saaficleaningservice.com";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `SAAFI Cleaning Service <${from}>`,
      to: [booking.customer_email],
      subject: `Your clean on ${booking.preferred_date} — £${amount} (${booking.reference})`,
      text: [
        `Hi ${booking.customer_name.split(" ")[0]},`,
        ``,
        `Here's the link to pay for your clean.`,
        ``,
        `Date:     ${booking.preferred_date}`,
        booking.start_time
          ? `Time:     ${formatTimeRange(booking.start_time, Number(booking.hours))}`
          : `Time:     to be agreed`,
        `Address:  ${booking.address_line}, ${booking.postcode}`,
        `Total:    £${amount}`,
        `Reference: ${booking.reference}`,
        ``,
        booking.stripe_payment_link_url,
        ``,
        `The link stays valid, so there's no rush — pay whenever suits you.`,
        `Anything look wrong? Just reply to this email.`,
        ``,
        `SAAFI Cleaning Service`,
        `saaficleaningservice.com`,
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    console.error("[email] payment link send failed:", res.status, await res.text());
    return { ok: false, reason: "the email provider rejected it" };
  }
  return { ok: true };
}

/**
 * Phone bookings taken without an email get a synthesised `<digits>@phone.saafi`
 * address so the row is valid. Sending there would hard-bounce against a domain
 * that does not exist, which costs real deliverability on the addresses that do.
 */
function looksLikeARealAddress(email: string): boolean {
  if (email.endsWith("@phone.saafi")) return false;
  return /^\S+@\S+\.\S+$/.test(email);
}
