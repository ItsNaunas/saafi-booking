import { NextResponse } from "next/server";
import {
  getPricingRows,
  countRecentMailFailures,
  FAILURE_COUNT_CAP,
} from "@/lib/supabaseAdmin";

// For an uptime monitor to poll. Reports whether the app is up AND whether
// it can reach the database — the failure mode that actually took the
// cleaner portal down (Supabase 504, 2026-09-13) leaves the app itself
// perfectly healthy, so a plain "200 from the homepage" check would have
// said everything was fine.
//
// It also reports whether the mail provider has been refusing us. Every send
// in lib/email.ts is best-effort by design, so running out of free quota
// (Resend: 100/day, 3,000/month) fails silently — and the one thing that
// cannot carry that warning is email. So it goes here instead, where a free
// external monitor (UptimeRobot, BetterStack, Cronitor) can alarm on it over
// a path that has nothing to do with the provider that is failing.
//
// 503 on a database failure so the monitor treats it as down, and 503 once
// mail failures cross the threshold: for a booking business, silently not
// sending confirmations is its own kind of down.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Provider-side failures in 24h before this is called degraded. */
const DEFAULT_THRESHOLD = 5;

function threshold(): number {
  const raw = Number(process.env.EMAIL_FAILURE_ALERT_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_THRESHOLD;
}

export async function GET() {
  const started = Date.now();
  try {
    const rows = await getPricingRows();
    // -1 means the table isn't there yet or couldn't be read. Reported as
    // "unknown" rather than folded into zero, which would read as healthy.
    const failures = await countRecentMailFailures(24);
    const degraded = failures >= threshold();

    return NextResponse.json(
      {
        ok: !degraded,
        db: "ok",
        rows: rows.length,
        mail: {
          failures24h: failures < 0 ? null : failures,
          atCap: failures >= FAILURE_COUNT_CAP,
          threshold: threshold(),
          status: failures < 0 ? "unknown" : degraded ? "refusing" : "ok",
        },
        ms: Date.now() - started,
      },
      { status: degraded ? 503 : 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: "unreachable", error: e instanceof Error ? e.message : String(e), ms: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
