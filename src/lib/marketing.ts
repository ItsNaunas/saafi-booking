// Marketing sends: campaigns from /admin/marketing and the automations the
// daily cron runs. The rules that decide WHO live in lib/segments.ts (pure);
// this file is the I/O.
//
// Every send is claimed in email_sends under a dedupe key before it goes, so
// nothing is ever sent twice — a campaign that stops part way is resumed by
// pressing Send again, and the cron can re-run safely.

import { site } from "./business";
import { londonWallClock } from "./scheduling";
import { formatGBP, FREQUENCY_LABEL, type Frequency } from "./pricing";
import { sendMarketingEmail } from "./email";
import { unsubscribeUrls } from "./unsubscribe";
import { buildProfiles, recipients, merge, paragraphs, type Profile } from "./segments";
import {
  listBookings,
  listQuoteLeads,
  listSuppressedEmails,
  listHostEmails,
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
  const [bookings, leads, suppressed, hostEmails] = await Promise.all([
    listBookings(),
    listQuoteLeads(),
    listSuppressedEmails(),
    listHostEmails(),
  ]);
  return { profiles: buildProfiles({ bookings, leads, suppressed, hostEmails, today }), leads, bookings };
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
  extra?: string[];
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
    paragraphs: [...(opts.extra ?? []), ...paragraphs(merge(opts.body, opts.profile))],
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
    cta: c.cta_label && c.cta_url ? { label: c.cta_label, url: c.cta_url } : null,
    unsubscribe: await unsubscribeUrls(to),
  });
}

/* ---------- automations (daily cron) ---------- */

const AUTOMATION_CTA: Record<AutomationRow["key"], string> = {
  abandoned_quote: "/quote",
  one_off_followup: "/regular-cleaning",
  lapsed_regular: "/quote",
};

/** Most automation emails a day — a ceiling on any surprise (or abuse of the quote form). */
const DAILY_CAP = 40;
/** No one gets two marketing emails within this many days. */
const QUIET_DAYS = 7;

function quoteLine(l: QuoteLeadRow): string | null {
  const q = l.quote ?? {};
  if (!q.price) return null;
  const what = q.service === "deep" ? "Deep clean" : `${FREQUENCY_LABEL[(q.frequency ?? "one_off") as Frequency] ?? "Clean"}`;
  const hrs = q.hours && q.service !== "deep" ? `, ${q.hours} hours` : "";
  return `Your quote: ${what}${hrs} — ${formatGBP(Number(q.price))}${q.service !== "deep" && q.frequency && q.frequency !== "one_off" ? " a visit" : ""}.`;
}

export async function runAutomations(): Promise<{ sent: Record<string, number>; errors: string[] }> {
  const sent: Record<string, number> = {};
  const errors: string[] = [];
  const automations = (await listAutomations()).filter((a) => a.enabled);
  if (automations.length === 0) return { sent, errors };

  const { profiles, leads, bookings } = await loadAudience();
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  const quietSince = new Date(Date.now() - QUIET_DAYS * 86_400_000).toISOString();
  const recentlyEmailed = await emailsSentSince(quietSince);
  let budget = DAILY_CAP;

  const go = async (a: AutomationRow, p: Profile, key: string, extra?: string[]) => {
    if (budget <= 0 || recentlyEmailed.has(p.email)) return false;
    const r = await sendOnce({
      dedupeKey: key,
      kind: a.key,
      profile: p,
      subject: a.subject,
      heading: a.heading,
      body: a.body,
      extra,
      cta: { label: a.cta_label, url: siteUrl() + AUTOMATION_CTA[a.key] },
    });
    if (r === "sent") {
      budget--;
      recentlyEmailed.add(p.email);
      sent[a.key] = (sent[a.key] ?? 0) + 1;
      await sleep(SEND_GAP_MS);
    } else if (r === "failed") errors.push(`${a.key} to ${p.email} failed`);
    return r === "sent";
  };

  for (const a of automations) {
    try {
      if (a.key === "abandoned_quote") {
        const now = Date.now();
        for (const l of leads) {
          const email = l.email.toLowerCase();
          const p = byEmail.get(email);
          if (!p || p.consent !== "yes") continue;
          if (l.converted_at || l.nudged_at) continue;
          // Quiet for 6h (they may just be on a break), and never older than a week.
          const age = now - Date.parse(l.updated_at);
          if (age < 6 * 3_600_000 || now - Date.parse(l.created_at) > 7 * 86_400_000) continue;
          // A name and phone too: an email alone could be anyone's, typed by anyone.
          if (!l.name || (l.phone ?? "").replace(/\D/g, "").length < 7) continue;
          // Booked after quoting (even if the conversion marker missed)?
          if (bookings.some((b) => b.customer_email.toLowerCase() === email && b.created_at >= l.created_at)) continue;
          const line = quoteLine(l);
          if (await go(a, p, `abandoned_quote:${email}`, line ? [line] : undefined)) await markLeadNudged(l.id);
        }
      } else {
        const stage = a.key === "one_off_followup" ? "one_off" : "lapsed";
        const window = a.key === "one_off_followup" ? 30 : 60;
        for (const p of profiles) {
          if (p.consent !== "yes" || p.stage !== stage || p.nextBooking || p.daysSinceLastClean == null) continue;
          if (p.daysSinceLastClean < a.delay_days || p.daysSinceLastClean > a.delay_days + window) continue;
          await go(a, p, `${a.key}:${p.email}:${p.lastClean}`);
        }
      }
    } catch (e) {
      errors.push(`${a.key}: ${String(e).slice(0, 140)}`);
    }
  }
  return { sent, errors };
}
