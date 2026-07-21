// Customer-facing emails via Resend. No-ops silently until RESEND_API_KEY is set.

import type { BookingRow } from "./supabaseAdmin";

export async function sendConfirmationEmail(booking: BookingRow): Promise<void> {
  const key = process.env.RESEND_API_KEY;
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
