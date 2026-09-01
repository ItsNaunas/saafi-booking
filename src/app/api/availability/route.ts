import { NextRequest, NextResponse } from "next/server";
import { loadPricingConfig } from "@/lib/pricingServer";
import { listSchedulableCleaners, listCleanersOnLeave, busyBlocksForDate } from "@/lib/supabaseAdmin";
import { daySlots, dayClosedReason, isValidDate } from "@/lib/scheduling";

// Reads live bookings, so it must never be cached or prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which times a job of `hours` could start on `date`.
 *
 * Deliberately says nothing about *who* is free — how many cleaners SAAFI has is
 * the business's information, not the customer's. The answer is only ever
 * "yes, that time works" or "no".
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? "";
  const hours = Number(req.nextUrl.searchParams.get("hours"));

  if (!isValidDate(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return NextResponse.json({ ok: false, error: "Invalid duration" }, { status: 400 });
  }

  const cfg = await loadPricingConfig();
  const scheduling = cfg.scheduling;

  let cleaners;
  try {
    cleaners = await listSchedulableCleaners();
    // Approved time off means the cleaner doesn't exist that day — otherwise
    // customers book slots the rota can never honour. Best-effort pre-migration.
    const onLeave = await listCleanersOnLeave(date).catch(() => new Set<string>());
    cleaners = cleaners.filter((c) => !onLeave.has(c.id));
  } catch (e) {
    // The quote flow must not die because the DB blinked — let the customer
    // send the request and SAAFI confirm the time by phone.
    console.error("[availability] cleaner load failed:", e);
    return NextResponse.json({ ok: true, date, slots: [], closed: null, degraded: true });
  }

  const now = new Date();
  const closed = dayClosedReason({ date, durationHours: hours, cleaners, cfg: scheduling, now });
  if (closed) {
    return NextResponse.json({ ok: true, date, slots: [], closed });
  }

  const busy = await busyBlocksForDate(date);
  const slots = daySlots({ date, durationHours: hours, cleaners, busy, cfg: scheduling, now });

  return NextResponse.json({
    ok: true,
    date,
    closed: null,
    slots: slots.map((s) => ({ time: s.time, available: s.available })),
  });
}
