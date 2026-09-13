import { NextResponse } from "next/server";
import { getPricingRows } from "@/lib/supabaseAdmin";

// For an uptime monitor to poll. Reports whether the app is up AND whether
// it can reach the database — the failure mode that actually took the
// cleaner portal down (Supabase 504, 2026-09-13) leaves the app itself
// perfectly healthy, so a plain "200 from the homepage" check would have
// said everything was fine.
//
// 503 on a database failure so the monitor treats it as down. Never cached.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const rows = await getPricingRows();
    return NextResponse.json(
      { ok: true, db: "ok", rows: rows.length, ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: "unreachable", error: e instanceof Error ? e.message : String(e), ms: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
