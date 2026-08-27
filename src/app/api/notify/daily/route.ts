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
  type BookingRow,
} from "@/lib/supabaseAdmin";
import { reconcileStripePayments } from "@/lib/reconcile";
import {
  sendDayBeforeReminderEmail,
  sendPaymentChaseEmail,
  sendCleanerDaySheetEmail,
  sendCronReportEmail,
  sendOpsAlertEmail,
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
  let reconciled = 0;

  try {
    // ---- 1. day-before reminders ----
    try {
      for (const b of await listBookingsNeedingReminder(tomorrow)) {
        // Marker first: if the process dies between send and mark, the customer
        // must not get the email twice tomorrow. One lost reminder is the
        // cheaper failure.
        await markReminderSent(b.id);
        await sendDayBeforeReminderEmail(b);
        reminders++;
      }
    } catch (e) {
      errors.push(`reminders: ${String(e).slice(0, 140)}`);
    }

    // ---- 2. unpaid-link nudges ----
    try {
      for (const b of await listBookingsNeedingChase(3)) {
        await markPaymentChased(b.id);
        await sendPaymentChaseEmail(b, amountDueFor(b));
        chases++;
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
          if (!j.cleaner_id) continue;
          byCleaner.set(j.cleaner_id, [...(byCleaner.get(j.cleaner_id) ?? []), j]);
        }
        for (const [cleanerId, theirJobs] of byCleaner) {
          const cleaner = cleaners.find((c) => c.id === cleanerId);
          if (!cleaner?.email) continue;
          await sendCleanerDaySheetEmail(cleaner, theirJobs);
          daySheets++;
        }
      }
    } catch (e) {
      errors.push(`day-sheets: ${String(e).slice(0, 140)}`);
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
    await sendCronReportEmail({ date: today, reminders, chases, daySheets, reconciled, errors }).catch(
      () => {}
    );
  }

  return NextResponse.json({
    ok: errors.length === 0,
    date: today,
    reminders,
    chases,
    daySheets,
    reconciled,
    errors,
  });
}

/** YYYY-MM-DD plus n days, DST-proof via UTC noon. */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
