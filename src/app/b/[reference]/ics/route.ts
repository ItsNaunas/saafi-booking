import { NextRequest, NextResponse } from "next/server";
import { verifyBookingToken } from "@/lib/bookingLink";
import { getBookingByReference } from "@/lib/supabaseAdmin";
import { toMinutes } from "@/lib/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A single customer-facing calendar event for one booking, behind the same
 * signed token as the booking page. Deliberately lean — no status, cleaner or
 * internal detail, just the appointment the customer agreed to.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ reference: string }> }
) {
  const { reference } = await ctx.params;
  const token = req.nextUrl.searchParams.get("t") ?? "";
  if (!verifyBookingToken(reference, token)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const b = await getBookingByReference(reference);
  if (!b || b.status === "cancelled") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const d = b.preferred_date.replace(/-/g, "");
  const startMins = b.start_time ? toMinutes(b.start_time) : null;
  const hhmm = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}${String(mins % 60).padStart(2, "0")}00`;

  // With a time: local London wall-clock times with a TZID. All-day otherwise.
  const timing =
    startMins === null
      ? [`DTSTART;VALUE=DATE:${d}`]
      : [
          `DTSTART;TZID=Europe/London:${d}T${hhmm(startMins)}`,
          `DTEND;TZID=Europe/London:${d}T${hhmm(startMins + Math.round(Number(b.hours) * 60))}`,
        ];

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SAAFI Cleaning//Customer//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/London",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0000",
    "TZOFFSETTO:+0100",
    "TZNAME:BST",
    "DTSTART:19700329T010000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0000",
    "TZNAME:GMT",
    "DTSTART:19701025T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${b.reference}@saaficleaningservice.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    ...timing,
    `SUMMARY:${esc(`SAAFI clean — ${b.hours} hours`)}`,
    `LOCATION:${esc(`${b.address_line}, ${b.postcode}`)}`,
    `DESCRIPTION:${esc(`Reference ${b.reference}. Questions? Reply to any of our emails.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="saafi-${b.reference}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
