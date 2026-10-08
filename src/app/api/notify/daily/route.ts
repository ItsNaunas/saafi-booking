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
  listBookingsNeedingReviewAsk,
  emailsAlreadyAskedForReview,
  markReviewRequested,
  amountDueFor,
  type BookingRow,
} from "@/lib/supabaseAdmin";
import { reconcileStripePayments } from "@/lib/reconcile";
import {
  smsConfigured,
  smsCustomerReminder,
  smsCleanerDaySheet,
  smsCleanerNudge,
  smsCustomerReviewRequest,
} from "@/lib/sms";
import {
  sendDayBeforeReminderEmail,
  sendPaymentChaseEmail,
  sendCleanerDaySheetEmail,
  sendCleanerNudgeEmail,
  sendCronReportEmail,
  sendOpsAlertEmail,
  sendReviewRequestEmail,
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
 * Four jobs, in the order money cares about least to most:
 *   1. day-before reminders    — tomorrow's confirmed cleans
 *   2. unpaid-link nudges      — completed, link 3+ days old, never chased
 *   3. cleaner day-sheets      — today's assigned jobs, one email per cleaner
 *   3c. Google review asks     — first completed clean, the morning after
 *   4. Stripe reconciliation   — money Stripe took that no booking shows
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
  let reviewAsks = 0;

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

    // ---- 3c. Google review asks ----
    // Dormant until GOOGLE_REVIEW_URL is set (the Business Profile's "ask for
    // reviews" link). Once per customer ever: a regular gets asked after their
    // first clean, not every fortnight. Anyone who refused marketing at
    // booking is skipped — stamped, never asked.
    const reviewUrl = process.env.GOOGLE_REVIEW_URL;
    if (reviewUrl) {
      try {
        const asked = await emailsAlreadyAskedForReview();
        for (const b of await listBookingsNeedingReviewAsk()) {
          try {
            const email = b.customer_email.toLowerCase();
            const refused = (b as { marketing_ok?: boolean | null }).marketing_ok === false;
            // Marker first, as with reminders: a lost ask beats a double one.
            await markReviewRequested(b.id);
            if (asked.has(email) || refused) continue;
            asked.add(email);
            await sendReviewRequestEmail(b, reviewUrl);
            await smsCustomerReviewRequest(b, reviewUrl).catch(() => {});
            reviewAsks++;
          } catch (e) {
            errors.push(`review ask ${b.reference}: ${String(e).slice(0, 120)}`);
          }
        }
      } catch (e) {
        errors.push(`review asks: ${String(e).slice(0, 140)}`);
      }
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
  } finally {
    await sendCronReportEmail({ date: today, reminders, chases, daySheets, reconciled, nudges, unseen, reviewAsks, errors }).catch(
      () => {}
    );
  }

  return NextResponse.json({
    ok: errors.length === 0,
    date: today,
    reminders,
    chases,
    daySheets,
    nudges,
    reconciled,
    reviewAsks,
    errors,
  });
}

/** YYYY-MM-DD plus n days, DST-proof via UTC noon. */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
