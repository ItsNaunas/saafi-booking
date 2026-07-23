import { NextRequest, NextResponse } from "next/server";
import { listBookings, listCleaners } from "@/lib/supabaseAdmin";
import { bookingsToICS } from "@/lib/ics";
import { verifyFeedToken } from "@/lib/calendarFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public ICS feed, gated by the secret token in the path (see calendarFeed.ts).
// Lives outside the /admin cookie guard so calendar apps can subscribe.
//   /api/calendar/<token>            → all cleans
//   /api/calendar/<token>?cleaner=X  → one cleaner's cleans
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await verifyFeedToken(token))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [allBookings, cleaners] = await Promise.all([listBookings(), listCleaners()]);
  const cleanerName = new Map(cleaners.map((c) => [c.id, c.name]));

  const cleanerId = req.nextUrl.searchParams.get("cleaner");
  let rows = allBookings.filter((b) => b.status !== "cancelled");
  let calName = "SAAFI Cleans";
  if (cleanerId) {
    rows = rows.filter((b) => b.cleaner_id === cleanerId);
    const name = cleanerName.get(cleanerId);
    if (name) calName = `SAAFI — ${name}`;
  }

  const ics = bookingsToICS(rows, cleanerName, { calName });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="saafi-cleans.ics"',
      "Cache-Control": "no-store",
    },
  });
}
