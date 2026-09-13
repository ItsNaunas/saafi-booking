// Text messages via Twilio's REST API — plain fetch, no SDK, same shape as
// the Resend mailer. Every function here is best-effort and a silent no-op
// until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set, so
// the code can ship ahead of the account and simply wake up.
//
// Why SMS at all: the cleaners live on their phones, not in an inbox — two of
// the three real ones were added without an email address at all, which made
// every "you've got a job" email a quiet no-op. A text is the thing that
// actually gets read.
//
// TWILIO_FROM is either an alphanumeric sender ID ("SAAFI" — reads as the
// business, free, but the recipient CANNOT reply) or a leased UK number in
// E.164 ("+447…", ~$2.50/month, two-way). UK alphanumeric IDs need Twilio's
// registration process first — start it early.
//
// These are transactional messages to people who booked or work here, which
// PECR allows without marketing consent. Nothing promotional goes through
// this file.

import { secret } from "./env";
import { site } from "./business";
import { formatTime } from "./scheduling";
import type { BookingRow } from "./supabaseAdmin";

type Cleaner = { name: string; phone: string; token: string };

export function smsConfigured(): boolean {
  return Boolean(secret("TWILIO_ACCOUNT_SID") && secret("TWILIO_AUTH_TOKEN") && secret("TWILIO_FROM"));
}

/**
 * UK numbers as people type them ("07835 532920", "07835532920",
 * "+44 7835 532920", "447835532920") to E.164. Anything that isn't
 * recognisably a UK mobile is returned null rather than guessed at.
 */
export function toE164Uk(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+447\d{9}$/.test(digits)) return digits;
  if (/^447\d{9}$/.test(digits)) return `+${digits}`;
  if (/^07\d{9}$/.test(digits)) return `+44${digits.slice(1)}`;
  return null;
}

const first = (name: string) => name.split(" ")[0];
const base = () => process.env.NEXT_PUBLIC_SITE_URL ?? site.url;

/** "Tue 15 Sep" — short enough for a text, unambiguous enough for a diary. */
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${iso}T12:00:00Z`)
  );
}

function when(b: BookingRow): string {
  return b.start_time ? `${shortDate(b.preferred_date)} ${formatTime(b.start_time)}` : `${shortDate(b.preferred_date)}, time TBC`;
}

export async function sendSms(to: string, body: string): Promise<{ ok: boolean; reason?: string }> {
  const sid = secret("TWILIO_ACCOUNT_SID");
  const token = secret("TWILIO_AUTH_TOKEN");
  const from = secret("TWILIO_FROM");
  if (!sid || !token || !from) return { ok: false, reason: "sms isn't configured" };
  const e164 = toE164Uk(to);
  if (!e164) return { ok: false, reason: `not a UK mobile: ${to}` };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: from, Body: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[sms] to ${e164} rejected:`, res.status, (await res.text()).slice(0, 200));
      return { ok: false, reason: `provider returned ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[sms] to ${e164} failed:`, e);
    return { ok: false, reason: "network" };
  }
}

/* ------------------------------------------------------------------ *
 *  Cleaner texts — the same moments as the cleaner emails, one line each.
 * ------------------------------------------------------------------ */

export async function smsCleanerAssigned(cleaner: Cleaner, b: BookingRow): Promise<void> {
  if (!smsConfigured()) return;
  await sendSms(
    cleaner.phone,
    `SAAFI: new job ${when(b)}, ${b.postcode}, ${b.hours}h. Tap to see it and press Got it: ${base()}/c/${cleaner.token}`
  );
}

export async function smsCleanerJobChanged(
  cleaner: Cleaner,
  b: BookingRow,
  kind: "moved" | "cancelled" | "reassigned"
): Promise<void> {
  if (!smsConfigured()) return;
  const line = {
    moved: `SAAFI: your job at ${b.postcode} has MOVED to ${when(b)}.`,
    cancelled: `SAAFI: your job ${when(b)} at ${b.postcode} is CANCELLED — don't travel.`,
    reassigned: `SAAFI: you've been taken off ${when(b)} at ${b.postcode} — no action needed.`,
  }[kind];
  await sendSms(cleaner.phone, `${line} ${base()}/c/${cleaner.token}`);
}

export async function smsCleanerDaySheet(cleaner: Cleaner, jobs: BookingRow[]): Promise<void> {
  if (!smsConfigured() || jobs.length === 0) return;
  const lines = jobs.map((j) => `${j.start_time ? formatTime(j.start_time) : "TBC"} ${j.postcode}`).join(", ");
  await sendSms(
    cleaner.phone,
    `SAAFI: ${jobs.length === 1 ? "1 clean" : `${jobs.length} cleans`} today — ${lines}. Details: ${base()}/c/${cleaner.token}`
  );
}

/** The day-before chase for a job nobody has tapped "Got it" on. */
export async function smsCleanerNudge(cleaner: Cleaner, b: BookingRow): Promise<void> {
  if (!smsConfigured()) return;
  await sendSms(
    cleaner.phone,
    `SAAFI: reminder — you're on ${when(b)} at ${b.postcode} tomorrow and haven't confirmed you've seen it. Please press Got it: ${base()}/c/${cleaner.token}`
  );
}

/* ------------------------------------------------------------------ *
 *  Customer texts — only the two that are time-critical.
 * ------------------------------------------------------------------ */

export async function smsCustomerReminder(b: BookingRow): Promise<void> {
  if (!smsConfigured()) return;
  await sendSms(
    b.customer_phone,
    `SAAFI Cleaning: we're coming tomorrow, ${when(b)}. Please make sure we can get in as agreed. Need to change it? Ring 07835 532920.`
  );
}

export async function smsCustomerRunningLate(b: BookingRow, cleanerName: string, minutes: number): Promise<void> {
  if (!smsConfigured()) return;
  await sendSms(
    b.customer_phone,
    `SAAFI Cleaning: ${first(cleanerName)} is on the way but running about ${minutes} minutes behind — sorry! No need to do anything.`
  );
}
