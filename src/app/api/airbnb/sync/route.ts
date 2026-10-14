import { NextRequest, NextResponse } from "next/server";
import { syncFeeds } from "@/lib/airbnbSync";
import { airbnbSyncToken } from "@/lib/calendarFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Supabase pg_cron calls this every 15 minutes (supabase/2026-10-15-airbnb-sync.sql),
 * so Airbnb checkouts reach the calendar — and the office inbox — without
 * anyone opening the admin. Its own token (not CRON_SECRET), because this one
 * lives in the database's job table and can only ever trigger a sync.
 */
async function handle(req: NextRequest) {
  const expected = await airbnbSyncToken();
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!expected || got.length !== expected.length || got !== expected) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const results = await syncFeeds();
  return NextResponse.json({ ok: results.every((r) => !r.error), results });
}

export const POST = handle;
export const GET = handle;
