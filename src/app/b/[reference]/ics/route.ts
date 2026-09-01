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
  const notFoundResponse = () =>
    new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });

  const { reference } = await ctx.params;
  const token = req.nextUrl.searchParams.get("t") ?? "";
  if (!verifyBookingToken(reference, token)) {
    return notFoundResponse();
  }
  const b = await getBookingByReference(reference);
  if (!b || b.status === "cancelled") {
    return notFoundResponse();
  }

  const esc = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  const d = b.preferred_date.replace(/-/g, "");
  const startMins = b.start_time ? toMinutes(b.start_time) : null;
  const hhmm = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}${String(mins % 60).padStart(2, "0")}00`;

  // date+time arithmetic that carries minutes past 24:00 into the next day —
  // an evening job otherwise emits an invalid T25xxxx DTEND.
  const dateTimeAfter = (dateStr: string, mins: number) => {
    // Noon UTC sidesteps any DST-edge weirdness from adding days at midnight.
    const base = new Date(`${dateStr}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + Math.floor(mins / 1440));
    const ymd = base.toISOString().slice(0, 10).replace(/-/g, "");
    return `${ymd}T${hhmm(((mins % 1440) + 1440) % 1440)}`;
  };

  // With a time: local London wall-clock times with a TZID. All-day otherwise.
  const timing =
    startMins === null
      ? [`DTSTART;VALUE=DATE:${d}`]
      : [
          `DTSTART;TZID=Europe/London:${dateTimeAfter(b.preferred_date, startMins)}`,
          `DTEND;TZID=Europe/London:${dateTimeAfter(b.preferred_date, startMins + Math.round(Number(b.hours) * 60))}`,
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
