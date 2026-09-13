// Customer-facing emails via Resend. No-ops silently until RESEND_API_KEY is set.
//
// Every email is built from ONE template: dark header with the wordmark, a
// white card with the message, a key/value table for the details, one button
// when there is something to click, and a footer that carries the contact
// details and reference. Content is structured (heading / intro / rows / cta /
// outro) and rendered twice — once as HTML, once as the plain-text part — so
// the two can never say different things.
//
// Email HTML is written for email clients, not browsers: tables, inline
// styles, system fonts, no external assets. Square corners, per the site.

import type { BookingRow } from "./supabaseAdmin";
import { agreedPriceFor, paidSoFar } from "./money";
import { secret } from "./env";
import { formatTime, formatTimeRange } from "@/lib/scheduling";
import { chargeableJourney, outcomeLabel, type OutcomeReason } from "./outcomes";
import { site, contact } from "./business";
import { bookingManageUrl } from "./bookingLink";

/* ------------------------------------------------------------------ *
 *  The template
 * ------------------------------------------------------------------ */

type Row = [label: string, value: string];

type Mail = {
  to: string;
  subject: string;
  /** First name or full greeting line; omitted for office mail. */
  greeting?: string;
  /** The one-line headline inside the card. */
  heading: string;
  /** Paragraphs before the details. Falsy entries drop out. */
  intro?: (string | false | null | undefined)[];
  /** The details table. Falsy entries drop out. */
  rows?: (Row | false | null | undefined)[];
  /** The single action, when there is one. */
  cta?: { label: string; url: string } | null;
  /** Paragraphs after the details. Falsy entries drop out. */
  outro?: (string | false | null | undefined)[];
  reference?: string;
  replyTo?: string;
};

const BRAND = {
  ink: "#0d2a48", // brand-950 — header
  blue: "#1273c4", // brand-600 — button, accents
  tint: "#eff7fe", // brand-50 — details table ground
  text: "#0f172a", // slate-900
  muted: "#64748b", // slate-500
  faint: "#94a3b8", // slate-400
  page: "#f1f5f9", // slate-100 — page ground
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const compact = <T,>(xs: (T | false | null | undefined)[] | undefined): T[] =>
  (xs ?? []).filter(Boolean) as T[];

function renderHtml(m: Mail): string {
  const intro = compact(m.intro);
  const rows = compact(m.rows);
  const outro = compact(m.outro);
  const font =
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

  const para = (t: string, color = BRAND.text) =>
    `<p style="margin:0 0 14px;${font}font-size:15px;line-height:1.6;color:${color};">${esc(t)}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:${BRAND.page};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">

        <!-- header -->
        <tr><td style="background:${BRAND.ink};padding:22px 28px;">
          <span style="${font}font-size:20px;font-weight:700;letter-spacing:0.16em;color:#ffffff;">SAAFI</span>
          <span style="${font}font-size:11px;font-weight:600;letter-spacing:0.18em;color:#86c5f7;"> &nbsp;CLEANING SERVICE</span>
        </td></tr>

        <!-- card -->
        <tr><td style="background:#ffffff;padding:28px;">
          ${m.greeting ? para(`Hi ${m.greeting},`, BRAND.muted) : ""}
          <p style="margin:0 0 16px;${font}font-size:19px;line-height:1.35;font-weight:700;color:${BRAND.text};">${esc(m.heading)}</p>
          ${intro.map((t) => para(t)).join("")}

          ${
            rows.length
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.tint};margin:6px 0 18px;">
                  ${rows
                    .map(
                      ([k, v], i) => `<tr>
                        <td style="padding:9px 14px ${i === rows.length - 1 ? "12px" : "0"};${font}font-size:13px;color:${BRAND.muted};white-space:nowrap;vertical-align:top;${i === 0 ? "padding-top:12px;" : ""}">${esc(k)}</td>
                        <td align="right" style="padding:9px 14px ${i === rows.length - 1 ? "12px" : "0"};${font}font-size:14px;font-weight:600;color:${BRAND.text};${i === 0 ? "padding-top:12px;" : ""}">${esc(v)}</td>
                      </tr>`,
                    )
                    .join("")}
                </table>`
              : ""
          }

          ${
            m.cta
              ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;">
                  <tr><td style="background:${BRAND.blue};">
                    <a href="${esc(m.cta.url)}" style="display:inline-block;padding:13px 26px;${font}font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(m.cta.label)}</a>
                  </td></tr>
                </table>
                <p style="margin:-8px 0 16px;${font}font-size:12px;color:${BRAND.faint};">Button not working? ${esc(m.cta.url)}</p>`
              : ""
          }

          ${outro.map((t) => para(t, BRAND.muted)).join("")}
        </td></tr>

        <!-- footer -->
        <tr><td style="padding:18px 28px;">
          <p style="margin:0 0 4px;${font}font-size:12px;line-height:1.6;color:${BRAND.faint};">
            ${esc(site.name)} &nbsp;·&nbsp; <a href="tel:${esc(contact.phoneHref)}" style="color:${BRAND.blue};text-decoration:none;">${esc(contact.phoneDisplay)}</a> &nbsp;·&nbsp; <a href="mailto:${esc(contact.email)}" style="color:${BRAND.blue};text-decoration:none;">${esc(contact.email)}</a>
          </p>
          <p style="margin:0;${font}font-size:12px;color:${BRAND.faint};">
            ${m.reference ? `Reference ${esc(m.reference)} &nbsp;·&nbsp; ` : ""}${esc(site.url.replace("https://", ""))}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** The same content as readable plain text — the multipart fallback. */
function renderText(m: Mail): string {
  const rows = compact(m.rows);
  const pad = Math.max(0, ...rows.map(([k]) => k.length));
  return [
    m.greeting ? `Hi ${m.greeting},` : null,
    m.greeting ? "" : null,
    m.heading,
    "",
    ...compact(m.intro).flatMap((t) => [t, ""]),
    ...rows.map(([k, v]) => `${(k + ":").padEnd(pad + 2)}${v}`),
    rows.length ? "" : null,
    m.cta ? `${m.cta.label}: ${m.cta.url}` : null,
    m.cta ? "" : null,
    ...compact(m.outro).flatMap((t) => [t, ""]),
    site.name,
    m.reference ? `Reference: ${m.reference}` : null,
    site.url.replace("https://", ""),
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
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

/** The self-serve line customers get in every booking email. Null pre-config. */
function manageLine(reference: string): string | null {
  const url = bookingManageUrl(reference);
  return url ? `View, pay for, or change this booking any time: ${url}` : null;
}

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
      // Replies go to the address on the business card, which someone reads —
      // not the sending address, which may not be a real mailbox at all.
      reply_to: mail.replyTo ?? contact.email,
      subject: mail.subject,
      html: renderHtml(mail),
      text: renderText(mail),
    }),
  });

  if (!res.ok) {
    console.error(`[email] "${mail.subject}" rejected:`, res.status, await res.text());
    return { ok: false, reason: `provider returned ${res.status}` };
  }
  return { ok: true };
}

const officeAddress = () => process.env.ALERT_EMAIL_TO ?? "";
const first = (name: string) => name.split(" ")[0];
const adminUrl = (id: string) =>
  `${process.env.NEXT_PUBLIC_SITE_URL ?? site.url}/admin/booking/${id}`;

/**
 * The visit window, or an honest admission that there isn't one yet.
 *
 * Deep cleans show a start and no end — how long the crew stays is SAAFI's
 * business, never the customer's ("time taken for a deep clean should NOT be
 * visible", Dulla 2026-09-03). Cleaner emails share this line, but cleaners
 * get their hours from their own rows and portal.
 */
function whenLine(booking: {
  preferred_date: string;
  start_time: string | null;
  hours: number | string;
  service_type?: "standard" | "deep";
}): string {
  if (!booking.start_time) return `${booking.preferred_date}, time still to be agreed`;
  if (booking.service_type === "deep")
    return `${booking.preferred_date}, from ${formatTime(booking.start_time)}`;
  return `${booking.preferred_date}, ${formatTimeRange(booking.start_time, Number(booking.hours))}`;
}

/* ------------------------------------------------------------------ *
 *  The emails. Same signatures as before — only the rendering changed.
 *  Every one is best-effort: a mail provider having a bad afternoon
 *  must never stop a booking, a payment or a cleaner's day.
 * ------------------------------------------------------------------ */

export async function sendConfirmationEmail(booking: BookingRow): Promise<void> {
  await send({
    to: booking.customer_email,
    subject: `Your clean is confirmed — ${booking.preferred_date} (${booking.reference})`,
    greeting: first(booking.customer_name),
    heading: "Your clean is confirmed",
    rows: [
      ["When", whenLine(booking)],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
      booking.service_type === "deep"
        ? ["Service", "Deep clean — the whole house, top to bottom"]
        : ["Duration", `${booking.hours} hours`],
      ["Price", `£${agreedPriceFor(booking)}`],
      ["Products", booking.customer_provides_products ? "you provide" : "we bring ours"],
    ],
    outro: [
      "Need to change anything? Just reply to this email or give us a call.",
      manageLine(booking.reference),
    ],
    reference: booking.reference,
  }).catch(() => {});
}

/**
 * Tell the customer their price changed, and why. Sent only after the owner has
 * approved the adjustment — nothing reaches a customer automatically.
 */
export async function sendAdjustmentEmail(
  booking: BookingRow,
  adj: {
    from_hours: number;
    to_hours: number;
    from_price: number;
    to_price: number;
    reason_code: string;
    note: string | null;
  },
): Promise<void> {
  const { reasonLabel } = await import("./adjustments");
  const extra = Math.round((Number(adj.to_hours) - Number(adj.from_hours)) * 100) / 100;
  const diff = Math.round((Number(adj.to_price) - Number(adj.from_price)) * 100) / 100;
  const longer = extra > 0;
  // Deep-clean hours are internal (Dulla 2026-09-03) — the customer sees the
  // prices moving, never the hours behind them.
  const deep = booking.service_type === "deep";

  await send({
    to: booking.customer_email,
    subject: `Your clean on ${booking.preferred_date} — updated total £${adj.to_price}`,
    replyTo: process.env.ALERT_EMAIL_TO ?? contact.email,
    greeting: first(booking.customer_name),
    heading: longer ? "Your total has changed" : "We've reduced your total",
    intro: [
      longer
        ? deep
          ? "There was more to your deep clean than booked, so your total has changed."
          : "Your clean took a bit longer than booked, so your total has changed."
        : deep
          ? "There was less to your deep clean than booked, so we've reduced your total."
          : "Your clean finished sooner than booked, so we've reduced your total.",
    ],
    rows: [
      ["Booked", deep ? `£${adj.from_price}` : `${adj.from_hours} hours — £${adj.from_price}`],
      ["Actual", deep ? `£${adj.to_price}` : `${adj.to_hours} hours — £${adj.to_price}`],
      ["Reason", reasonLabel(adj.reason_code as never)],
      adj.note ? ["Note", adj.note] : null,
      [
        "Difference",
        longer ? `£${Math.abs(diff)} more than quoted` : `£${Math.abs(diff)} less than quoted`,
      ],
    ],
    outro: ["Any questions, just reply to this email or give us a call."],
    reference: booking.reference,
  }).catch(() => {});
}

export async function sendPaymentLinkEmail(
  booking: BookingRow,
  amount: number,
): Promise<{ ok: boolean; reason?: string }> {
  if (!booking.stripe_payment_link_url) return { ok: false, reason: "no payment link yet" };
  return send({
    to: booking.customer_email,
    subject: `Your clean on ${booking.preferred_date} — £${amount} (${booking.reference})`,
    greeting: first(booking.customer_name),
    heading: "Here's the link to pay for your clean",
    rows: [
      ["When", whenLine(booking)],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
      ["Total", `£${amount}`],
    ],
    cta: { label: "Pay for your clean", url: booking.stripe_payment_link_url },
    outro: [
      "The link stays valid, so there's no rush — pay whenever suits you.",
      "Anything look wrong? Just reply to this email.",
    ],
    reference: booking.reference,
  });
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
  /** Deep cleans show no hours anywhere a customer looks (Dulla 2026-09-03). */
  serviceType?: "standard" | "deep";
  /** Pay-at-booking link; absent falls back to the settle-by-phone wording. */
  payUrl?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const deep = opts.serviceType === "deep";
  return send({
    to: opts.email,
    subject: `We've got your booking — ${opts.preferredDate} (${opts.reference})`,
    greeting: first(opts.name),
    heading: "We've got your booking",
    intro: [
      opts.payUrl
        ? "Thanks — we've got your request. Pay below to lock it in, and we'll call to confirm your slot."
        : "Thanks — we've got your request and we'll call shortly to confirm it.",
    ],
    rows: [
      [
        "When",
        opts.startTime
          ? deep
            ? `${opts.preferredDate}, from ${formatTime(opts.startTime)}`
            : `${opts.preferredDate}, ${formatTimeRange(opts.startTime, opts.hours)}`
          : `${opts.preferredDate}, time still to be agreed`,
      ],
      ["Where", `${opts.addressLine}, ${opts.postcode}`],
      deep
        ? ["Service", "Deep clean — the whole house, top to bottom"]
        : ["How long", `${opts.hours} hours`],
      ["Price", `£${opts.price}${opts.recurring ? " per clean" : ""}`],
    ],
    cta: opts.payUrl ? { label: "Pay for your clean", url: opts.payUrl } : null,
    outro: [
      "Nothing is booked in stone until we've spoken.",
      "If anything above looks wrong, just reply to this email.",
      manageLine(opts.reference),
    ],
    reference: opts.reference,
  });
}

/**
 * A cleaner has flagged extra hours and the money is waiting on a decision.
 * Goes to the office, because a pending adjustment is unbilled revenue sitting
 * still, and nothing used to chase it.
 */
export async function sendAdjustmentPendingEmail(
  booking: BookingRow,
  adj: {
    from_hours: number;
    to_hours: number;
    from_price: number;
    to_price: number;
    reason_code: string;
    note: string | null;
  },
  cleanerName: string,
): Promise<{ ok: boolean; reason?: string }> {
  const extra = Math.round((Number(adj.to_hours) - Number(adj.from_hours)) * 100) / 100;
  return send({
    to: officeAddress(),
    subject: `Approve? ${cleanerName} ran ${extra}h over at ${booking.customer_name} — £${adj.to_price}`,
    heading: `${cleanerName} ran over — your decision needed`,
    intro: [
      `${cleanerName} has finished a job that ran longer than booked. Nothing has been charged — it needs your decision.`,
    ],
    rows: [
      ["Customer", booking.customer_name],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
      ["When", whenLine(booking)],
      ["Booked", `${adj.from_hours}h — £${adj.from_price}`],
      ["Actual", `${adj.to_hours}h — £${adj.to_price}`],
      ["Reason", adj.reason_code.replace(/_/g, " ")],
      adj.note ? ["Note", adj.note] : null,
    ],
    cta: { label: "Approve or reject it", url: adminUrl(booking.id) },
    reference: booking.reference,
  });
}

/**
 * The money landed. Sent to the customer as a thank-you (Stripe sends the formal
 * receipt) and to the office, so nobody has to sit refreshing Stripe.
 */
export async function sendPaymentReceivedEmails(
  booking: BookingRow,
  amount: number,
): Promise<void> {
  await send({
    to: booking.customer_email,
    subject: `Thanks — that's paid (${booking.reference})`,
    greeting: first(booking.customer_name),
    heading: "That's your payment received — thank you",
    rows: [
      ["Clean", whenLine(booking)],
      ["Paid", `£${amount}`],
    ],
    outro: [
      "Your card receipt comes separately from Stripe.",
      booking.frequency !== "one_off" && "We'll confirm your next visit with you.",
    ],
    reference: booking.reference,
  }).catch(() => {});

  await send({
    to: officeAddress(),
    subject: `Paid — ${booking.customer_name}, £${amount} (${booking.reference})`,
    heading: `${booking.customer_name} has paid £${amount}`,
    rows: [
      ["Clean", whenLine(booking)],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
    ],
    reference: booking.reference,
  }).catch(() => {});
}

/**
 * A cleaner has been put on a job. They used to find out only by opening their
 * link and noticing something new was there.
 */
export async function sendCleanerAssignedEmail(
  cleaner: { name: string; email: string | null; token: string },
  booking: BookingRow,
): Promise<{ ok: boolean; reason?: string }> {
  if (!cleaner.email) return { ok: false, reason: "that cleaner has no email address" };
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? site.url;
  return send({
    to: cleaner.email,
    subject: `New job — ${whenLine(booking)}`,
    greeting: first(cleaner.name),
    heading: "You've been put on a clean",
    rows: [
      ["When", whenLine(booking)],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
      ["Job", `${booking.hours} hours`],
      booking.notes ? ["Note", booking.notes] : null,
    ],
    cta: { label: "Open your jobs page", url: `${base}/c/${cleaner.token}` },
  });
}

/**
 * The day-before chase for a job nobody has tapped "Got it" on. The pipeline's
 * "not seen yet" chip only helps if someone acts on it; this acts on it.
 */
export async function sendCleanerNudgeEmail(
  cleaner: { name: string; email: string | null; token: string },
  booking: BookingRow,
): Promise<void> {
  if (!cleaner.email) return;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? site.url;
  await send({
    to: cleaner.email,
    subject: `Tomorrow: ${whenLine(booking)} — please confirm you've seen it`,
    greeting: first(cleaner.name),
    heading: "You're on a job tomorrow",
    intro: ["It's still showing as not seen — one tap on your jobs page tells the office you're on it."],
    rows: [
      ["When", whenLine(booking)],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
      ["Job", `${booking.hours} hours`],
    ],
    cta: { label: "Open your jobs page and press Got it", url: `${base}/c/${cleaner.token}` },
  }).catch(() => {});
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
  cleanerName: string,
): Promise<{ ok: boolean; reason?: string }> {
  const chargeable = chargeableJourney(reason);
  return send({
    to: officeAddress(),
    subject: `Wasted journey — ${booking.customer_name}, ${outcomeLabel(reason).toLowerCase()}`,
    heading: `${cleanerName} could not do a clean and is there now`,
    rows: [
      ["Customer", booking.customer_name],
      ["Phone", booking.customer_phone],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
      ["When", whenLine(booking)],
      ["Reason", outcomeLabel(reason)],
      note ? ["They said", note] : null,
    ],
    intro: [
      chargeable
        ? "Nothing has been charged. This one is arguably the customer's to pay for — you decide from the booking page whether it is cancelled or charged."
        : "Nothing has been charged, and this one is not the customer's fault — you decide from the booking page whether it is cancelled or charged.",
    ],
    cta: { label: "Open the booking", url: adminUrl(booking.id) },
    reference: booking.reference,
  });
}

/**
 * "Your next few cleans are booked."
 *
 * Takes the whole batch, because filling eight weeks of a weekly series at once
 * would otherwise mean eight separate emails — a reliable way to teach somebody
 * to ignore you.
 */
export async function sendSeriesBookedEmail(
  bookings: BookingRow[],
): Promise<{ ok: boolean; reason?: string }> {
  const firstBooking = bookings[0];
  if (!firstBooking) return { ok: false, reason: "nothing to tell them about" };
  const many = bookings.length > 1;

  return send({
    to: firstBooking.customer_email,
    subject: many
      ? `Your next ${bookings.length} cleans are booked`
      : `Your next clean — ${firstBooking.preferred_date}`,
    greeting: first(firstBooking.customer_name),
    heading: many ? "Your regular cleans are booked in" : "Your next clean is booked in",
    rows: [
      ...bookings.map((b, i): Row => [many ? `Visit ${i + 1}` : "When", whenLine(b)]),
      ["Where", `${firstBooking.address_line}, ${firstBooking.postcode}`],
      ["Price", `£${firstBooking.quoted_price} per clean`],
    ],
    outro: [
      "Same slot each time. If one of those doesn't suit, give us a ring or reply to this email and we'll move it — no need to change the rest.",
    ],
    reference: firstBooking.reference,
  });
}

/**
 * Invite the customer to put a card on file.
 *
 * Sold as convenience because that is what it is for them — no link to chase
 * after every clean — while being the thing that takes SAAFI out of the chasing
 * business entirely.
 */
export async function sendCardSetupEmail(
  booking: BookingRow,
  url: string,
): Promise<{ ok: boolean; reason?: string }> {
  return send({
    to: booking.customer_email,
    subject: `Save a card for your cleans — ${booking.reference}`,
    greeting: first(booking.customer_name),
    heading: "Save a card once, skip the payment links",
    intro: [
      "If you'd rather not deal with a payment link after every clean, you can save a card once and we'll charge it when the job's done — for whatever the visit actually came to, never more.",
    ],
    cta: { label: "Save a card", url },
    outro: [
      "Nothing is charged now. The page is Stripe's own, so we never see your card details, and you can stop at any time by telling us.",
    ],
    reference: booking.reference,
  });
}

/**
 * The clean is off. The status existed and the admin used it, but the customer
 * used to find out when nobody turned up — the exact failure this email layer
 * exists to prevent.
 */
export async function sendBookingCancelledEmail(
  booking: BookingRow,
  opts?: { refundedAmount?: number },
): Promise<void> {
  const paid = paidSoFar(booking);
  await send({
    to: booking.customer_email,
    subject: `Your clean on ${booking.preferred_date} is cancelled (${booking.reference})`,
    greeting: first(booking.customer_name),
    heading: "Your clean has been cancelled",
    rows: [
      ["Was booked for", whenLine(booking)],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
      opts?.refundedAmount != null && ["Refunded", `£${opts.refundedAmount}`],
    ],
    outro: [
      // The old fixed line here said "nothing further is charged" to customers
      // who had already paid — which read as a lie. Say what is actually true.
      opts?.refundedAmount != null
        ? "Your payment has been refunded to the card you paid with — it usually appears within 5 to 10 working days."
        : paid > 0
          ? `You've paid £${paid} for this visit — we'll be in touch about your refund.`
          : "Nothing further is charged for this visit.",
      "If this wasn't what you expected, or you'd like to rebook, just reply to this email or give us a call.",
    ],
    reference: booking.reference,
  }).catch(() => {});
}

/**
 * The booking moved under them. Usually agreed on the phone first — this is the
 * written record that kills "you said Thursday" before it exists.
 */
export async function sendBookingChangedEmail(
  booking: BookingRow,
  changes: Row[],
): Promise<void> {
  await send({
    to: booking.customer_email,
    subject: `Your clean has changed — now ${booking.preferred_date} (${booking.reference})`,
    greeting: first(booking.customer_name),
    heading: "Your booking has been updated",
    intro: ["As agreed, here are your new details:"],
    rows: [
      ["Now", whenLine(booking)],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
      booking.service_type === "deep"
        ? ["Service", "Deep clean — the whole house, top to bottom"]
        : ["Duration", `${booking.hours} hours`],
      ["Price", `£${agreedPriceFor(booking)}`],
      paidSoFar(booking) > 0 && ["Already paid", `£${paidSoFar(booking)}`],
      ...changes,
    ],
    outro: [
      "If any of this doesn't match what we agreed, reply to this email and we'll sort it.",
      manageLine(booking.reference),
    ],
    reference: booking.reference,
  }).catch(() => {});
}


/**
 * A cleaner's job moved, was cancelled, or went to someone else. The
 * assignment email told them a job existed; nothing told them it stopped
 * existing — and a cleaner at a cancelled address is a wasted journey the
 * office caused.
 */
export async function sendCleanerJobChangedEmail(
  cleaner: { name: string; email: string | null; token: string },
  booking: BookingRow,
  kind: "moved" | "cancelled" | "reassigned",
): Promise<void> {
  if (!cleaner.email) return;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? site.url;
  const headline = {
    moved: "One of your jobs has moved",
    cancelled: "One of your jobs is cancelled",
    reassigned: "You've been taken off a job",
  }[kind];
  await send({
    to: cleaner.email,
    subject: `${headline} — ${booking.preferred_date}`,
    greeting: first(cleaner.name),
    heading: headline,
    rows: [
      [kind === "moved" ? "Now" : "Was", whenLine(booking)],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
    ],
    intro:
      kind === "cancelled"
        ? ["Don't travel for this one — it's off."]
        : kind === "reassigned"
          ? ["No action needed — it's been covered by someone else."]
          : undefined,
    cta: { label: "Check your jobs page", url: `${base}/c/${cleaner.token}` },
  }).catch(() => {});
}

/**
 * The clean is done and there is no card on file to settle it, so the payment
 * link goes out by itself — closing the gap where a completed job sat unbilled
 * until somebody remembered to press the button.
 */
export async function sendCleanCompletedEmail(
  booking: BookingRow,
  amount: number,
  payUrl: string,
): Promise<void> {
  await send({
    to: booking.customer_email,
    subject: `Your clean is done — £${amount} to settle (${booking.reference})`,
    greeting: first(booking.customer_name),
    heading: "Your clean is done — thanks for having us",
    rows: [
      ["Clean", whenLine(booking)],
      ["To pay", `£${amount}`],
    ],
    cta: { label: "Pay for your clean", url: payUrl },
    outro: [
      "The link stays valid, so pay whenever suits you.",
      "Anything not right with the clean? Reply to this email — we'd rather fix it than not know.",
      manageLine(booking.reference),
    ],
    reference: booking.reference,
  }).catch(() => {});
}

/**
 * The office alert on a new booking — the eleventh email, previously living in
 * the bookings route as raw text on its own send path.
 */
export async function sendNewBookingAlertEmail(opts: {
  name: string;
  phone: string;
  email: string;
  addressLine: string;
  postcode: string;
  preferredDate: string;
  startTime: string | null;
  hours: number;
  serviceType: "standard" | "deep";
  cleanersNeeded: number;
  frequency: string;
  quotedPrice: number;
  addonLabels: string[];
  /** Deep cleans: the customer's stated reason, already human-labelled. */
  deepReason?: string | null;
  notes: string;
  reference: string;
}): Promise<void> {
  await send({
    to: officeAddress(),
    subject: `New booking request — ${opts.name}, ${opts.preferredDate} (£${opts.quotedPrice})`,
    heading: `New booking — ${opts.name}`,
    rows: [
      ["Phone", opts.phone],
      ["Email", opts.email],
      ["Address", `${opts.addressLine}, ${opts.postcode}`],
      [
        "Date",
        opts.startTime
          ? `${opts.preferredDate}, ${formatTimeRange(opts.startTime, opts.hours)}`
          : `${opts.preferredDate} — NO TIME SET, agree one on the call`,
      ],
      [
        "Service",
        opts.serviceType === "deep"
          ? `Deep clean — ${opts.cleanersNeeded} cleaners, ${opts.hours}h on site`
          : `Standard, ${opts.hours}h`,
      ],
      ["Frequency", opts.frequency.replace(/_/g, " ")],
      ["Price", `£${opts.quotedPrice}`],
      opts.addonLabels.length ? ["Extras", opts.addonLabels.join(", ")] : null,
      opts.deepReason ? ["Why a deep clean", opts.deepReason] : null,
      opts.notes ? ["Notes", opts.notes] : null,
    ],
    reference: opts.reference,
  }).catch(() => {});
}

/* ------------------------------------------------------------------ *
 *  The daily notify cron's emails (/api/notify/daily)
 * ------------------------------------------------------------------ */

/**
 * The day-before reminder — the single best defence against the no-access
 * wasted journeys the whole outcome flow exists to mop up AFTER the fact.
 */
export async function sendDayBeforeReminderEmail(booking: BookingRow): Promise<void> {
  await send({
    to: booking.customer_email,
    subject: `We're coming tomorrow — ${whenLine(booking)}`,
    greeting: first(booking.customer_name),
    heading: "Your clean is tomorrow",
    rows: [
      ["When", whenLine(booking)],
      ["Where", `${booking.address_line}, ${booking.postcode}`],
      ["Products", booking.customer_provides_products ? "you're providing them" : "we bring everything"],
    ],
    outro: [
      "If nobody will be in, make sure we can get in the way we agreed — or reply now and we'll sort it.",
      "Need to move it? The sooner we know, the easier that is.",
      manageLine(booking.reference),
    ],
    reference: booking.reference,
  }).catch(() => {});
}

/** The one unpaid-link nudge. Sent once, ever — after this it's a phone call. */
export async function sendPaymentChaseEmail(booking: BookingRow, amount: number): Promise<void> {
  if (!booking.stripe_payment_link_url) return;
  await send({
    to: booking.customer_email,
    subject: `A gentle nudge — £${amount} for your clean (${booking.reference})`,
    greeting: first(booking.customer_name),
    heading: "Just a nudge about your clean",
    intro: [
      "We cleaned for you a few days ago and the payment link hasn't been used yet — easily missed, so here it is again.",
    ],
    rows: [
      ["Clean", whenLine(booking)],
      ["To pay", `£${amount}`],
    ],
    cta: { label: "Pay for your clean", url: booking.stripe_payment_link_url },
    outro: [
      "Already sorted it with us another way, or something not right? Reply and we'll straighten it out — this is the only reminder we send.",
      manageLine(booking.reference),
    ],
    reference: booking.reference,
  }).catch(() => {});
}

/** A cleaner's whole day in one email, first job to last. */
export async function sendCleanerDaySheetEmail(
  cleaner: { name: string; email: string | null; token: string },
  jobs: BookingRow[],
): Promise<void> {
  if (!cleaner.email || jobs.length === 0) return;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? site.url;
  await send({
    to: cleaner.email,
    subject: `Today: ${jobs.length} ${jobs.length === 1 ? "clean" : "cleans"} — ${jobs[0].preferred_date}`,
    greeting: first(cleaner.name),
    heading: jobs.length === 1 ? "One clean today" : `${jobs.length} cleans today`,
    rows: jobs.flatMap((j, i): Row[] => [
      [
        `Job ${i + 1}`,
        j.start_time
          ? `${formatTimeRange(j.start_time, Number(j.hours))} — ${j.customer_name}`
          : `time TBC — ${j.customer_name}`,
      ],
      ["", `${j.address_line}, ${j.postcode}`],
    ]),
    cta: { label: "Open your jobs page", url: `${base}/c/${cleaner.token}` },
    outro: ["Tap start when you arrive and finish when you leave, as usual."],
  }).catch(() => {});
}

/**
 * The cron telling the office what it did — and, above all, when it FAILED.
 * The lesson from the June silent-failure post-mortem: a scheduler that only
 * speaks when it works is indistinguishable from one that has died.
 */
export async function sendCronReportEmail(opts: {
  date: string;
  reminders: number;
  chases: number;
  daySheets: number;
  /** Bookings the Stripe sweep found paid on Stripe but not marked here. */
  reconciled?: number;
  /** Tomorrow's jobs chased because the cleaner hadn't tapped "Got it". */
  nudges?: number;
  unseen?: string[];
  errors: string[];
}): Promise<void> {
  const reconciled = opts.reconciled ?? 0;
  const nudges = opts.nudges ?? 0;
  // Quiet days stay quiet: a daily "0/0/0 all fine" trains people to delete
  // the report unread. Send only when something happened or something broke.
  if (opts.reminders + opts.chases + opts.daySheets + reconciled + nudges === 0 && opts.errors.length === 0)
    return;
  await send({
    to: officeAddress(),
    subject: opts.errors.length
      ? `⚠ Daily emails: ${opts.errors.length} problem${opts.errors.length === 1 ? "" : "s"} — ${opts.date}`
      : `Daily emails sent — ${opts.date}`,
    heading: opts.errors.length ? "The daily emails hit a problem" : "This morning's emails",
    rows: [
      ["Day-before reminders", String(opts.reminders)],
      ["Payment nudges", String(opts.chases)],
      ["Cleaner day-sheets", String(opts.daySheets)],
      reconciled > 0 && ["Payments repaired", String(reconciled)],
      nudges > 0 && ["Cleaners chased (job not seen yet)", String(nudges)],
      ...(opts.unseen ?? []).map((u, i): Row => [`Not seen ${i + 1}`, u]),
      ...opts.errors.map((e, i): Row => [`Problem ${i + 1}`, e]),
    ],
  }).catch(() => {});
}

/**
 * Something on the money path needs a human. Unlike every other email in this
 * file these are never decorative — they only fire when acting on them matters
 * (a charge that couldn't be recorded, a chargeback, a card that vanished).
 */
export async function sendOpsAlertEmail(opts: {
  subject: string;
  heading: string;
  lines: string[];
  rows?: Row[];
}): Promise<void> {
  await send({
    to: officeAddress(),
    subject: opts.subject,
    heading: opts.heading,
    intro: opts.lines,
    rows: opts.rows,
  }).catch(() => {});
}

/* ------------------------------------------------------------------ *
 *  Cleaner-portal upgrades (2026-09-01)
 * ------------------------------------------------------------------ */

/**
 * One tap on "running late" and both sides know. The most common awkward
 * moment of the job used to be a phone call most people avoided making —
 * which meant the customer stood waiting and nobody knew.
 */
export async function sendRunningLateEmails(
  booking: BookingRow,
  cleanerName: string,
  minutes: number,
): Promise<void> {
  await send({
    to: booking.customer_email,
    subject: `Running about ${minutes} minutes behind — sorry! (${booking.reference})`,
    greeting: first(booking.customer_name),
    heading: `We're running about ${minutes} minutes late`,
    intro: [
      `${first(cleanerName)} is on the way to you but running roughly ${minutes} minutes behind — sorry about that.`,
      "No need to do anything; this is just so you're not left wondering.",
    ],
    reference: booking.reference,
  }).catch(() => {});
  await send({
    to: officeAddress(),
    subject: `${first(cleanerName)} running ~${minutes}m late — ${booking.reference}`,
    heading: "A cleaner flagged they're running late",
    rows: [
      ["Cleaner", cleanerName],
      ["Job", `${booking.preferred_date} · ${booking.postcode}`],
      ["Customer", `${booking.customer_name} · ${booking.customer_phone}`],
      ["Late by", `about ${minutes} minutes`],
    ],
    outro: ["The customer has been emailed the same estimate."],
    reference: booking.reference,
  }).catch(() => {});
}

/** A mid-job problem, reported without ending the job. */
export async function sendIssueReportEmail(
  booking: BookingRow,
  cleanerName: string,
  categoryLabel: string,
  note: string | null,
): Promise<void> {
  await send({
    to: officeAddress(),
    subject: `⚠ ${categoryLabel} reported — ${booking.reference}`,
    heading: `${first(cleanerName)} reported something on a job`,
    rows: [
      ["What", categoryLabel],
      ["Job", `${booking.preferred_date} · ${booking.address_line}, ${booking.postcode}`],
      ["Customer", `${booking.customer_name} · ${booking.customer_phone}`],
      ["Cleaner", cleanerName],
    ],
    intro: note ? [`"${note}"`] : undefined,
    outro: ["The job is still going — this is a report, not a cancellation."],
    reference: booking.reference,
  }).catch(() => {});
}

/** A cleaner asked for days off — the office decides from /admin/cleaners. */
export async function sendTimeOffRequestEmail(
  cleanerName: string,
  fromDate: string,
  toDate: string,
  note: string | null,
): Promise<void> {
  await send({
    to: officeAddress(),
    subject: `Time off requested — ${cleanerName}`,
    heading: `${first(cleanerName)} has asked for time off`,
    rows: [
      ["Who", cleanerName],
      ["From", fromDate],
      ["To", toDate],
    ],
    intro: note ? [`"${note}"`] : undefined,
    outro: [
      "Approve or decline it from the Cleaners page. Approved days disappear from what customers can book.",
    ],
  }).catch(() => {});
}

/** The office decided — the cleaner hears it in writing, not by silence. */
export async function sendTimeOffDecisionEmail(
  cleaner: { name: string; email: string | null },
  fromDate: string,
  toDate: string,
  approved: boolean,
): Promise<void> {
  if (!cleaner.email) return;
  await send({
    to: cleaner.email,
    subject: approved ? "Your time off is approved" : "About your time-off request",
    greeting: first(cleaner.name),
    heading: approved ? "Time off approved" : "That time off doesn't work this time",
    rows: [
      ["From", fromDate],
      ["To", toDate],
    ],
    outro: [
      approved
        ? "Those days are blocked out — nothing will be booked on you."
        : "Ring the office and they'll talk it through with you.",
    ],
  }).catch(() => {});
}
