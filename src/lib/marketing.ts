// Marketing sends: campaigns from /admin/marketing and the automations the
// daily cron runs. The rules that decide WHO live in lib/segments.ts (pure);
// this file is the I/O.
//
// Every send is claimed in email_sends under a dedupe key before it goes, so
// nothing is ever sent twice — a campaign that stops part way is resumed by
// pressing Send again, and the cron can re-run safely.

import { site, contact } from "./business";
import { londonWallClock } from "./scheduling";
import { formatGBP, FREQUENCY_LABEL, type Frequency } from "./pricing";
import { sendMarketingEmail } from "./email";
import { unsubscribeUrls } from "./unsubscribe";
import { buildProfiles, recipients, merge, paragraphs, daysBetween, type Profile } from "./segments";
import {
  listBookings,
  listQuoteLeads,
  listSuppressedEmails,
  listHostEmails,
  listHostStats,
  listManualConsent,
  getCampaign,
  updateCampaign,
  claimSend,
  finishSend,
  countSentForCampaign,
  emailsSentSince,
  listAutomations,
  markLeadNudged,
  type QuoteLeadRow,
  type AutomationRow,
  type BookingRow,
} from "./supabaseAdmin";

const SEND_GAP_MS = 550; // Resend's default limit is 2 requests a second
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? site.url;

export async function loadAudience(): Promise<{ profiles: Profile[]; leads: QuoteLeadRow[]; bookings: BookingRow[] }> {
  const today = londonWallClock(new Date()).date;
  const [bookings, leads, suppressed, hostEmails, hostStats, manual] = await Promise.all([
    listBookings(),
    listQuoteLeads(),
    listSuppressedEmails(),
    listHostEmails(),
    listHostStats(today),
    listManualConsent(),
  ]);
  return {
    profiles: buildProfiles({ bookings, leads, suppressed, hostEmails, hostStats, manualConsent: manual ?? undefined, today }),
    leads,
    bookings,
  };
}

/** Send one marketing email to one person, at most once per dedupe key. */
async function sendOnce(opts: {
  dedupeKey: string;
  kind: string;
  campaignId?: string;
  profile: Pick<Profile, "email" | "firstName" | "name">;
  subject: string;
  heading: string;
  body: string;
  highlight?: string | null;
  cta?: { label: string; url: string } | null;
}): Promise<"sent" | "skipped" | "failed"> {
  const claim = await claimSend({
    dedupeKey: opts.dedupeKey,
    kind: opts.kind,
    campaignId: opts.campaignId,
    email: opts.profile.email,
  });
  if (!claim) return "skipped";
  const res = await sendMarketingEmail({
    to: opts.profile.email,
    subject: merge(opts.subject, opts.profile),
    heading: merge(opts.heading, opts.profile),
    paragraphs: paragraphs(merge(opts.body, opts.profile)),
    highlight: opts.highlight ? merge(opts.highlight, opts.profile) : null,
    cta: opts.cta,
    unsubscribe: await unsubscribeUrls(opts.profile.email),
  }).catch((e) => ({ ok: false, reason: String(e) }));
  await finishSend(claim, res.ok, res.reason);
  return res.ok ? "sent" : "failed";
}

/* ---------- campaigns ---------- */

/**
 * Send (or resume) a campaign. Stops before the function's time limit and
 * reports what's left; pressing Send again carries on where it stopped.
 */
export async function sendCampaign(
  id: string,
  budgetMs = 240_000
): Promise<{ sent: number; failed: number; remaining: number; error?: string }> {
  const started = Date.now();
  const c = await getCampaign(id);
  if (!c) return { sent: 0, failed: 0, remaining: 0, error: "campaign not found" };
  if (!c.subject.trim() || !c.body.trim()) return { sent: 0, failed: 0, remaining: 0, error: "add a subject and a message first" };
  if (/\[[^\]]+\]/.test(`${c.subject}${c.heading}${c.body}${c.highlight ?? ""}`))
    return { sent: 0, failed: 0, remaining: 0, error: "replace the text in [brackets] before sending" };

  const { profiles } = await loadAudience();
  const list = recipients(profiles, c.segment ?? {});
  await updateCampaign(id, { status: "sending" });

  let sent = 0;
  let failed = 0;
  let i = 0;
  for (; i < list.length; i++) {
    if (Date.now() - started > budgetMs) break;
    const r = await sendOnce({
      dedupeKey: `campaign:${id}:${list[i].email}`,
      kind: "campaign",
      campaignId: id,
      profile: list[i],
      subject: c.subject,
      heading: c.heading || c.subject,
      body: c.body,
      highlight: c.highlight,
      cta: c.cta_label && c.cta_url ? { label: c.cta_label, url: c.cta_url } : null,
    });
    if (r === "sent") {
      sent++;
      await sleep(SEND_GAP_MS);
    } else if (r === "failed") failed++;
  }
  const remaining = list.length - i;
  const total = await countSentForCampaign(id);
  await updateCampaign(id, {
    sent_count: total,
    ...(remaining === 0 ? { status: "sent", sent_at: new Date().toISOString() } : {}),
  });
  return { sent, failed, remaining };
}

/** A test copy to one address, never logged as a send. */
export async function sendCampaignTest(id: string, to: string): Promise<{ ok: boolean; reason?: string }> {
  const c = await getCampaign(id);
  if (!c) return { ok: false, reason: "campaign not found" };
  const sample = { firstName: "Sam", name: "Sam Example" };
  return sendMarketingEmail({
    to,
    subject: `[TEST] ${merge(c.subject, sample)}`,
    heading: merge(c.heading || c.subject, sample),
    paragraphs: paragraphs(merge(c.body, sample)),
    highlight: c.highlight ? merge(c.highlight, sample) : null,
    cta: c.cta_label && c.cta_url ? { label: c.cta_label, url: c.cta_url } : null,
    unsubscribe: await unsubscribeUrls(to),
  });
}

/* ---------- automations (daily cron) ---------- */

export const AUTOMATION_KEYS = [
  "abandoned_quote",
  "one_off_followup",
  "lapsed_regular",
  "mover_followup",
  "seasonal_deep",
  "referral_ask",
  "at_risk_checkin",
] as const;

/** Where each automation's button goes. */
export function automationCtaUrl(key: AutomationRow["key"]): string {
  switch (key) {
    case "one_off_followup":
      return siteUrl() + "/regular-cleaning";
    case "seasonal_deep":
      return siteUrl() + "/deep-cleaning";
    case "referral_ask":
      return siteUrl();
    case "at_risk_checkin":
      return `mailto:${contact.email}`;
    default:
      return siteUrl() + "/quote";
  }
}

/** Most automation emails a day — a ceiling on any surprise (or abuse of the quote form). */
const DAILY_CAP = 40;
/** No one gets two marketing emails within this many days. */
const QUIET_DAYS = 7;
/** Seasonal deep-clean pushes run in these months (1-12). */
const SEASON_MONTHS = [3, 9];

export function quoteLine(l: Pick<QuoteLeadRow, "quote">): string | null {
  const q = l.quote ?? {};
  if (!q.price) return null;
  const what = q.service === "deep" ? "Deep clean" : `${FREQUENCY_LABEL[(q.frequency ?? "one_off") as Frequency] ?? "Clean"}`;
  const hrs = q.hours && q.service !== "deep" ? `, ${q.hours} hours` : "";
  return `Your quote: ${what}${hrs} — ${formatGBP(Number(q.price))}${q.service !== "deep" && q.frequency && q.frequency !== "one_off" ? " a visit" : ""}`;
}

/**
 * Who each lifecycle automation is for today, and the key that makes it
 * once-only. Pure over profiles — the abandoned-quote one needs leads too and
 * is handled separately.
 */
export function automationTargets(
  key: Exclude<AutomationRow["key"], "abandoned_quote">,
  delayDays: number,
  profiles: Profile[],
  today: string
): { profile: Profile; dedupeKey: string }[] {
  const ok = (p: Profile) => p.consent === "yes";
  const out: { profile: Profile; dedupeKey: string }[] = [];
  const within = (date: string | null, from: number, span: number) => {
    if (!date) return false;
    const d = daysBetween(date, today);
    return d >= from && d <= from + span;
  };
  for (const p of profiles) {
    if (!ok(p)) continue;
    // At-risk people get the check-in and nothing else.
    if (key !== "at_risk_checkin" && p.atRisk) continue;
    switch (key) {
      case "one_off_followup":
        if (p.stage === "one_off" && !p.nextBooking && within(p.lastClean, delayDays, 30))
          out.push({ profile: p, dedupeKey: `${key}:${p.email}:${p.lastClean}` });
        break;
      case "lapsed_regular":
        if (p.stage === "lapsed" && !p.nextBooking && within(p.lastClean, delayDays, 60))
          out.push({ profile: p, dedupeKey: `${key}:${p.email}:${p.lastClean}` });
        break;
      case "mover_followup":
        if (within(p.lastMoveClean, delayDays, 30))
          out.push({ profile: p, dedupeKey: `${key}:${p.email}:${p.lastMoveClean}` });
        break;
      case "seasonal_deep": {
        const month = Number(today.slice(5, 7));
        const due = p.daysSinceDeep == null || p.daysSinceDeep >= 6 * 30;
        if (SEASON_MONTHS.includes(month) && (p.stage === "regular" || p.stage === "one_off") && due)
          out.push({ profile: p, dedupeKey: `${key}:${p.email}:${today.slice(0, 7)}` });
        break;
      }
      case "referral_ask":
        if (p.happy) out.push({ profile: p, dedupeKey: `${key}:${p.email}` });
        break;
      case "at_risk_checkin":
        if (p.atRisk && within(p.lastIssue, delayDays, 5))
          out.push({ profile: p, dedupeKey: `${key}:${p.email}:${p.lastIssue}` });
        break;
    }
  }
  return out;
}

/** Abandoned quotes due a nudge right now. Pure: `now` is passed in. */
export function abandonedTargets(
  leads: QuoteLeadRow[],
  profiles: Profile[],
  bookings: Pick<BookingRow, "customer_email" | "created_at">[],
  now: number
): { profile: Profile; lead: QuoteLeadRow; dedupeKey: string }[] {
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  const out: { profile: Profile; lead: QuoteLeadRow; dedupeKey: string }[] = [];
  for (const l of leads) {
    const email = l.email.toLowerCase();
    const p = byEmail.get(email);
    if (!p || p.consent !== "yes" || p.atRisk) continue;
    if (l.converted_at || l.nudged_at) continue;
    // Quiet for 6h (they may just be on a break), and never older than a week.
    if (now - Date.parse(l.updated_at) < 6 * 3_600_000 || now - Date.parse(l.created_at) > 7 * 86_400_000) continue;
    // A name and phone too: an email alone could be anyone's, typed by anyone.
    if (!l.name || (l.phone ?? "").replace(/\D/g, "").length < 7) continue;
    // Booked after quoting (even if the conversion marker missed)?
    if (bookings.some((b) => b.customer_email.toLowerCase() === email && b.created_at >= l.created_at)) continue;
    out.push({ profile: p, lead: l, dedupeKey: `abandoned_quote:${email}` });
  }
  return out;
}

/** How many people each automation would email today (before the weekly quiet rule). */
export function qualifyingCounts(
  automations: Pick<AutomationRow, "key" | "delay_days">[],
  audience: { profiles: Profile[]; leads: QuoteLeadRow[]; bookings: BookingRow[] },
  today: string,
  now: number
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of automations) {
    out[a.key] =
      a.key === "abandoned_quote"
        ? abandonedTargets(audience.leads, audience.profiles, audience.bookings, now).length
        : automationTargets(a.key, a.delay_days, audience.profiles, today).length;
  }
  return out;
}

/** A test of an automation's email to one address, never logged as a send. */
export async function sendAutomationTest(a: AutomationRow, to: string): Promise<{ ok: boolean; reason?: string }> {
  const sample = { firstName: "Sam", name: "Sam Example" };
  return sendMarketingEmail({
    to,
    subject: `[TEST] ${merge(a.subject, sample)}`,
    heading: merge(a.heading, sample),
    paragraphs: paragraphs(merge(a.body, sample)),
    highlight: a.key === "abandoned_quote" ? "Your quote: Every 2 weeks, 3 hours — £66 a visit" : null,
    cta: { label: a.cta_label, url: automationCtaUrl(a.key) },
    unsubscribe: await unsubscribeUrls(to),
  });
}

export async function runAutomations(): Promise<{ sent: Record<string, number>; errors: string[] }> {
  const sent: Record<string, number> = {};
  const errors: string[] = [];
  const automations = (await listAutomations()).filter((a) => a.enabled);
  if (automations.length === 0) return { sent, errors };

  const today = londonWallClock(new Date()).date;
  const { profiles, leads, bookings } = await loadAudience();
  const quietSince = new Date(Date.now() - QUIET_DAYS * 86_400_000).toISOString();
  const recentlyEmailed = await emailsSentSince(quietSince);
  let budget = DAILY_CAP;

  const go = async (a: AutomationRow, p: Profile, key: string, highlight?: string | null) => {
    if (budget <= 0 || recentlyEmailed.has(p.email)) return false;
    const r = await sendOnce({
      dedupeKey: key,
      kind: a.key,
      profile: p,
      subject: a.subject,
      heading: a.heading,
      body: a.body,
      highlight,
      cta: { label: a.cta_label, url: automationCtaUrl(a.key) },
    });
    if (r === "sent") {
      budget--;
      recentlyEmailed.add(p.email);
      sent[a.key] = (sent[a.key] ?? 0) + 1;
      await sleep(SEND_GAP_MS);
    } else if (r === "failed") errors.push(`${a.key} to ${p.email} failed`);
    return r === "sent";
  };

  // The check-in goes first: if something went wrong, that's the email they
  // should get this week, not an offer.
  const order = (k: string) => (k === "at_risk_checkin" ? 0 : k === "abandoned_quote" ? 1 : 2);
  for (const a of automations.sort((x, y) => order(x.key) - order(y.key))) {
    try {
      if (a.key === "abandoned_quote") {
        for (const t of abandonedTargets(leads, profiles, bookings, Date.now())) {
          if (await go(a, t.profile, t.dedupeKey, quoteLine(t.lead))) await markLeadNudged(t.lead.id);
        }
      } else {
        for (const t of automationTargets(a.key, a.delay_days, profiles, today)) await go(a, t.profile, t.dedupeKey);
      }
    } catch (e) {
      errors.push(`${a.key}: ${String(e).slice(0, 140)}`);
    }
  }
  return { sent, errors };
}
