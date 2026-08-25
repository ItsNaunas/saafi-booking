// Customer-facing emails via Resend. No-ops silently until RESEND_API_KEY is set.

import type { BookingRow } from "./supabaseAdmin";
import { secret } from "./env";
import { formatTimeRange } from "@/lib/scheduling";
import { chargeableJourney, outcomeLabel, type OutcomeReason } from "./outcomes";

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

/* ------------------------------------------------------------------ *
 *  The moments that used to pass in silence.
 *
 *  Every one of these is best-effort: the caller wraps it, and a mail
 *  provider having a bad afternoon must never stop a booking, a payment
 *  or a cleaner finishing their day.
 * ------------------------------------------------------------------ */

type Mail = {
  to: string;
  subject: string;
  /** Falsy lines are dropped, so a line can be conditional inline. */
  lines: (string | false | null | undefined)[];
};

async function send(mail: Mail): Promise<{ ok: boolean; reason?: string }> {
  const key = secret("RESEND_API_KEY");
  if (!key) return { ok: false, reason: "email isn't configured" };
  if (!looksLikeARealAddress(mail.to)) return { ok: false, reason: "no real email address" };

  const from = process.env.ALERT_EMAIL_FROM ?? "bookings@saaficleaningservice.com";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `SAAFI Cleaning Service <${from}>`,
      to: [mail.to],
      subject: mail.subject,
      text: mail.lines.filter(Boolean).join("\n"),
    }),
  });

  if (!res.ok) {
    console.error(`[email] "${mail.subject}" rejected:`, res.status, await res.text());
    return { ok: false, reason: `provider returned ${res.status}` };
  }
  return { ok: true };
}

const officeAddress = () => process.env.ALERT_EMAIL_TO ?? "";

/** The visit window, or an honest admission that there isn't one yet. */
function whenLine(booking: {
  preferred_date: string;
  start_time: string | null;
  hours: number | string;
}): string {
  return booking.start_time
    ? `${booking.preferred_date}, ${formatTimeRange(booking.start_time, Number(booking.hours))}`
    : `${booking.preferred_date}, time still to be agreed`;
}

/**
 * Straight after they hit the button.
 *
 * Until this existed a customer filled in the form, saw a reference on screen,
 * and heard nothing at all until somebody rang them. Close the tab and there was
 * no evidence it had happened.
 */
export async function sendBookingReceivedEmail(opts: {
  name: string;
  email: string;
  reference: string;
  preferredDate: string;
  startTime: string | null;
  hours: number;
  price: number;
  addressLine: string;
  postcode: string;
  recurring: boolean;
}): Promise<{ ok: boolean; reason?: string }> {
  return send({
    to: opts.email,
    subject: `We've got your booking — ${opts.preferredDate} (${opts.reference})`,
    lines: [
      `Hi ${opts.name.split(" ")[0]},`,
      ``,
      `Thanks — we've got your request and we'll call shortly to confirm it.`,
      ``,
      `When:      ${
        opts.startTime
          ? `${opts.preferredDate}, ${formatTimeRange(opts.startTime, opts.hours)}`
          : `${opts.preferredDate}, time still to be agreed`
      }`,
      `Where:     ${opts.addressLine}, ${opts.postcode}`,
      `How long:  ${opts.hours} hours`,
      `Price:     £${opts.price}${opts.recurring ? " per clean" : ""}`,
      `Reference: ${opts.reference}`,
      ``,
      `Nothing is charged yet, and nothing is booked in stone until we've spoken.`,
      `If anything above looks wrong, just reply to this email.`,
      ``,
      `SAAFI Cleaning Service`,
      `saaficleaningservice.com`,
    ],
  });
}

/**
 * A cleaner has flagged extra hours and the money is waiting on a decision.
 * Goes to the office, because a pending adjustment is unbilled revenue sitting
 * still, and nothing used to chase it.
 */
export async function sendAdjustmentPendingEmail(
  booking: BookingRow,
  adj: { from_hours: number; to_hours: number; from_price: number; to_price: number; reason_code: string; note: string | null },
  cleanerName: string
): Promise<{ ok: boolean; reason?: string }> {
  const extra = Math.round((Number(adj.to_hours) - Number(adj.from_hours)) * 100) / 100;
  return send({
    to: officeAddress(),
    subject: `Approve? ${cleanerName} ran ${extra}h over at ${booking.customer_name} — £${adj.to_price}`,
    lines: [
      `${cleanerName} has finished a job that ran longer than booked.`,
      `Nothing has been charged — it needs your decision.`,
      ``,
      `Customer: ${booking.customer_name}`,
      `Where:    ${booking.address_line}, ${booking.postcode}`,
      `When:     ${whenLine(booking)}`,
      ``,
      `Booked:   ${adj.from_hours}h — £${adj.from_price}`,
      `Actual:   ${adj.to_hours}h — £${adj.to_price}`,
      `Reason:   ${adj.reason_code.replace(/_/g, " ")}`,
      adj.note && `Note:     ${adj.note}`,
      ``,
      `Approve or reject it here:`,
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://saaficleaningservice.com"}/admin/booking/${booking.id}`,
      ``,
      `Reference: ${booking.reference}`,
    ],
  });
}

/**
 * The money landed. Sent to the customer as a thank-you (Stripe sends the formal
 * receipt) and to the office, so nobody has to sit refreshing Stripe.
 */
export async function sendPaymentReceivedEmails(
  booking: BookingRow,
  amount: number
): Promise<void> {
  await send({
    to: booking.customer_email,
    subject: `Thanks — that's paid (${booking.reference})`,
    lines: [
      `Hi ${booking.customer_name.split(" ")[0]},`,
      ``,
      `That's your payment received, thank you.`,
      ``,
      `Clean:  ${whenLine(booking)}`,
      `Paid:   £${amount}`,
      `Reference: ${booking.reference}`,
      ``,
      `Your card receipt comes separately from Stripe.`,
      booking.frequency !== "one_off" &&
        `We'll see you again next time — your next visit is already booked in.`,
      ``,
      `SAAFI Cleaning Service`,
    ],
  }).catch(() => {});

  await send({
    to: officeAddress(),
    subject: `Paid — ${booking.customer_name}, £${amount} (${booking.reference})`,
    lines: [
      `${booking.customer_name} has paid £${amount}.`,
      ``,
      `Clean: ${whenLine(booking)}`,
      `Where: ${booking.address_line}, ${booking.postcode}`,
      `Reference: ${booking.reference}`,
    ],
  }).catch(() => {});
}

/**
 * A cleaner has been put on a job. They used to find out only by opening their
 * link and noticing something new was there.
 */
export async function sendCleanerAssignedEmail(
  cleaner: { name: string; email: string | null; token: string },
  booking: BookingRow
): Promise<{ ok: boolean; reason?: string }> {
  if (!cleaner.email) return { ok: false, reason: "that cleaner has no email address" };
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saaficleaningservice.com";
  return send({
    to: cleaner.email,
    subject: `New job — ${whenLine(booking)}`,
    lines: [
      `Hi ${cleaner.name.split(" ")[0]},`,
      ``,
      `You've been put on a clean.`,
      ``,
      `When:  ${whenLine(booking)}`,
      `Where: ${booking.address_line}, ${booking.postcode}`,
      `Job:   ${booking.hours} hours`,
      booking.notes && `Note:  ${booking.notes}`,
      ``,
      `It's on your jobs page along with everything else:`,
      `${base}/c/${cleaner.token}`,
      ``,
      `SAAFI`,
    ],
  });
}

/**
 * The series rolled on. Recurring customers had no idea their next visit existed
 * until somebody turned up.
 */
export async function sendNextVisitEmail(booking: BookingRow): Promise<{ ok: boolean; reason?: string }> {
  return send({
    to: booking.customer_email,
    subject: `Your next clean — ${booking.preferred_date}`,
    lines: [
      `Hi ${booking.customer_name.split(" ")[0]},`,
      ``,
      `Your next clean is booked in.`,
      ``,
      `When:  ${whenLine(booking)}`,
      `Where: ${booking.address_line}, ${booking.postcode}`,
      `Price: £${booking.quoted_price}`,
      `Reference: ${booking.reference}`,
      ``,
      `Same slot as usual. If that doesn't suit this time, give us a ring or reply`,
      `to this email and we'll move it.`,
      ``,
      `SAAFI Cleaning Service`,
    ],
  });
}

/**
 * A cleaner is standing outside a job that cannot happen.
 *
 * Goes to the office immediately rather than waiting to be noticed: there may
 * still be time to ring the customer, or to send the cleaner somewhere useful
 * instead of losing the slot entirely.
 */
export async function sendVisitFailedEmail(
  booking: BookingRow,
  reason: OutcomeReason,
  note: string | null,
  cleanerName: string
): Promise<{ ok: boolean; reason?: string }> {
  const chargeable = chargeableJourney(reason);
  return send({
    to: officeAddress(),
    subject: `Wasted journey — ${booking.customer_name}, ${outcomeLabel(reason).toLowerCase()}`,
    lines: [
      `${cleanerName} could not do a clean and is there now.`,
      ``,
      `Customer: ${booking.customer_name}`,
      `Phone:    ${booking.customer_phone}`,
      `Where:    ${booking.address_line}, ${booking.postcode}`,
      `When:     ${whenLine(booking)}`,
      ``,
      `Reason:   ${outcomeLabel(reason)}`,
      note && `They said: ${note}`,
      ``,
      chargeable
        ? `Nothing has been charged. This one is arguably the customer's to pay for —`
        : `Nothing has been charged, and this one is not the customer's fault —`,
      `you decide from the booking page whether it is cancelled or charged:`,
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://saaficleaningservice.com"}/admin/booking/${booking.id}`,
      ``,
      `Reference: ${booking.reference}`,
    ],
  });
}
