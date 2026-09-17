import { NextRequest, NextResponse } from "next/server";
import { secret } from "@/lib/env";
import { londonWallClock } from "@/lib/scheduling";
import {
  listBookingsNeedingReminder,
  listBookingsNeedingChase,
  listAssignedJobsOn,
  listCleaners,
  markReminderSent,
  markPaymentChased,
  amountDueFor,
  listQueuedOfficeNotices,
  markOfficeNoticesSent,
  countRecentMailFailures,
  type BookingRow,
} from "@/lib/supabaseAdmin";
import { reconcileStripePayments } from "@/lib/reconcile";
import { smsConfigured, smsCustomerReminder, smsCleanerDaySheet, smsCleanerNudge } from "@/lib/sms";
import {
  sendDayBeforeReminderEmail,
  sendPaymentChaseEmail,
  sendCleanerDaySheetEmail,
  sendCleanerNudgeEmail,
  sendCronReportEmail,
  sendOpsAlertEmail,
  sendOfficeDigestEmail,
} from "@/lib/email";

export const runtime = "nodejs";
// The route does real work per booking; never let the platform cache it.
export const dynamic = "force-dynamic";
// The default function timeout truncated the run silently at ~25 bookings —
// and truncation killed the report email too, which is the exact silent-
// scheduler death this route exists to prevent.
export const maxDuration = 300;

/**
 * The daily notify run. Vercel cron calls this every morning (vercel.json);
 * anything else with the secret — n8n, curl, a person — can call it too, and
 * the sent-markers make every re-run safe.
 *
 * Six jobs, in the order money cares about least to most:
 *   1. day-before reminders    — tomorrow's confirmed cleans
 *   2. unpaid-link nudges      — completed, link 3+ days old, never chased
 *   3. cleaner day-sheets      — today's assigned jobs, one email per cleaner
 *   4. Stripe reconciliation   — money Stripe took that no booking shows
 *   5. office digest           — everything parked since yesterday, in one
 *   6. mailer health           — how many sends the provider refused in 24h
 *
 * Each section is best-effort and isolated: a Resend hiccup on reminders must
 * not kill the day-sheets. Whatever happens is reported to the office — from a
 * `finally`, so even a crash mid-run still reports — because the June lesson
 * is that a scheduler that only speaks when it works is indistinguishable from
 * one that has died.
 */
export async function GET(req: NextRequest) {
  const expected = secret("CRON_SECRET");
  if (!expected) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { date: today } = londonWallClock(new Date());
  const tomorrow = addDays(today, 1);
  const errors: string[] = [];
  let reminders = 0;
  let chases = 0;
  let daySheets = 0;
  let nudges = 0;
  const unseen: string[] = [];
  let reconciled = 0;
  let digested = 0;
  let mailFailures = 0;

  try {
    // ---- 1. day-before reminders ----
    // Per-booking try/catch: one Resend hiccup on booking three must not cost
    // bookings four to twenty their reminder — that day never comes back.
    try {
      for (const b of await listBookingsNeedingReminder(tomorrow)) {
        try {
          // Marker first: if the process dies between send and mark, the
          // customer must not get the email twice tomorrow. One lost reminder
          // is the cheaper failure.
          await markReminderSent(b.id);
          await sendDayBeforeReminderEmail(b);
          await smsCustomerReminder(b).catch(() => {});
          reminders++;
        } catch (e) {
          errors.push(`reminder ${b.reference}: ${String(e).slice(0, 120)}`);
        }
      }
    } catch (e) {
      errors.push(`reminders: ${String(e).slice(0, 140)}`);
    }

    // ---- 2. unpaid-link nudges ----
    try {
      for (const b of await listBookingsNeedingChase(3)) {
        try {
          await markPaymentChased(b.id);
          await sendPaymentChaseEmail(b, amountDueFor(b));
          chases++;
        } catch (e) {
          errors.push(`chase ${b.reference}: ${String(e).slice(0, 120)}`);
        }
      }
    } catch (e) {
      errors.push(`chases: ${String(e).slice(0, 140)}`);
    }

    // ---- 3. cleaner day-sheets ----
    try {
      const jobs = await listAssignedJobsOn(today);
      if (jobs.length > 0) {
        const cleaners = await listCleaners();
        const byCleaner = new Map<string, BookingRow[]>();
        for (const j of jobs) {
          // A deep clean is on two people's sheets.
          for (const cid of [j.cleaner_id, j.second_cleaner_id ?? null]) {
            if (cid) byCleaner.set(cid, [...(byCleaner.get(cid) ?? []), j]);
          }
        }
        for (const [cleanerId, theirJobs] of byCleaner) {
          const cleaner = cleaners.find((c) => c.id === cleanerId);
          if (!cleaner) continue;
          if (!cleaner.email && !smsConfigured()) continue;
          try {
            await sendCleanerDaySheetEmail(cleaner, theirJobs);
            await smsCleanerDaySheet(cleaner, theirJobs).catch(() => {});
            daySheets++;
          } catch (e) {
            errors.push(`day-sheet ${cleaner.name}: ${String(e).slice(0, 120)}`);
          }
        }
      }
    } catch (e) {
      errors.push(`day-sheets: ${String(e).slice(0, 140)}`);
    }

    // ---- 3b. tomorrow's jobs nobody has tapped "Got it" on ----
    // The pipeline's "not seen yet" chip is only useful if someone acts on
    // it. The day before, chase the cleaner directly — and name them in the
    // report so the office can ring if the chase goes unanswered too.
    try {
      const tomorrowJobs = await listAssignedJobsOn(tomorrow);
      if (tomorrowJobs.length > 0) {
        const cleaners = await listCleaners();
        for (const j of tomorrowJobs) {
          const pending = [
            !j.acknowledged_at ? cleaners.find((c) => c.id === j.cleaner_id) : undefined,
            j.second_cleaner_id && !j.second_acknowledged_at
              ? cleaners.find((c) => c.id === j.second_cleaner_id)
              : undefined,
          ].filter((c): c is NonNullable<typeof c> => Boolean(c));
          for (const cleaner of pending) {
            try {
              await sendCleanerNudgeEmail(cleaner, j);
              await smsCleanerNudge(cleaner, j).catch(() => {});
              nudges++;
              unseen.push(`${j.reference} · ${cleaner.name} · ${j.start_time?.slice(0, 5) ?? "TBC"} ${j.postcode}`);
            } catch (e) {
              errors.push(`nudge ${j.reference}: ${String(e).slice(0, 120)}`);
            }
          }
        }
      }
    } catch (e) {
      errors.push(`nudges: ${String(e).slice(0, 140)}`);
    }

    // ---- 4. Stripe reconciliation ----
    try {
      const rec = await reconcileStripePayments(3);
      reconciled = rec.repaired.length;
      if (rec.repaired.length > 0 || rec.unmatched.length > 0) {
        await sendOpsAlertEmail({
          subject: `Stripe sweep: ${rec.repaired.length} repaired, ${rec.unmatched.length} unmatched`,
          heading: "Overnight Stripe reconciliation",
          lines: [
            rec.repaired.length > 0
              ? `These bookings were paid on Stripe but not marked here, and are now fixed: ${rec.repaired.join(", ")}.`
              : null,
            rec.unmatched.length > 0
              ? `These payments match no booking and need a human: ${rec.unmatched.join("; ")}.`
              : null,
          ].filter((l): l is string => l !== null),
        });
      }
    } catch (e) {
      errors.push(`reconcile: ${String(e).slice(0, 140)}`);
    }

    // ---- 5. the office digest ----
    // Everything parked since the last run, as one email instead of one each.
    // Marked sent only after the digest actually leaves: a failed send leaves
    // the notices queued, so tomorrow's digest carries them rather than the
    // office silently never hearing about them.
    try {
      const notices = await listQueuedOfficeNotices();
      if (notices.length > 0) {
        const sent = await sendOfficeDigestEmail(notices);
        if (sent.ok) {
          await markOfficeNoticesSent(notices.map((n) => n.id));
          digested = notices.length;
        } else {
          errors.push(`office digest: ${sent.reason ?? "not sent"}`);
        }
      }
    } catch (e) {
      errors.push(`office digest: ${String(e).slice(0, 140)}`);
    }

    // ---- 6. how the mailer itself has been doing ----
    // Read last, so the count includes anything this run just hit.
    try {
      mailFailures = Math.max(0, await countRecentMailFailures(24));
    } catch {
      /* the report is still worth sending without it */
    }
  } finally {
    await sendCronReportEmail({
      date: today,
      reminders,
      chases,
      daySheets,
      reconciled,
      nudges,
      unseen,
      digested,
      mailFailures,
      errors,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: errors.length === 0,
    date: today,
    reminders,
    chases,
    daySheets,
    nudges,
    reconciled,
    digested,
    mailFailures,
    errors,
  });
}

/** YYYY-MM-DD plus n days, DST-proof via UTC noon. */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
