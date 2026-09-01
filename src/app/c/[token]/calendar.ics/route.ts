import { NextRequest, NextResponse } from "next/server";
import { getCleanerByToken, listBookingsForCleaner } from "@/lib/supabaseAdmin";
import { toMinutes, londonWallClock } from "@/lib/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A cleaner's own jobs as a calendar feed, behind their portal token.
 *
 * This exists because the only other feed is the office-wide one, whose token
 * unlocks every customer's address — handing that to a cleaner was the leak
 * the audit flagged. This one is scoped server-side to the token's owner, and
 * revoking it is the same act as revoking the portal (deactivate the cleaner).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const cleaner = await getCleanerByToken(token);
  if (!cleaner) {
    return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  const { date: today } = londonWallClock(new Date());
  const jobs = (await listBookingsForCleaner(cleaner.id)).filter(
    (j) => j.status === "confirmed" && j.preferred_date >= today
  );

  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const hhmm = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}${String(mins % 60).padStart(2, "0")}00`;
  const dateTimeAfter = (dateStr: string, mins: number) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Math.floor(mins / 1440));
    return `${d.toISOString().slice(0, 10).replace(/-/g, "")}T${hhmm(((mins % 1440) + 1440) % 1440)}`;
  };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const events = jobs.flatMap((j) => {
    const d = j.preferred_date.replace(/-/g, "");
    const startMins = j.start_time ? toMinutes(j.start_time) : null;
    const timing =
      startMins === null
        ? [`DTSTART;VALUE=DATE:${d}`]
        : [
            `DTSTART;TZID=Europe/London:${dateTimeAfter(j.preferred_date, startMins)}`,
            `DTEND;TZID=Europe/London:${dateTimeAfter(j.preferred_date, startMins + Math.round(Number(j.hours) * 60))}`,
          ];
    return [
      "BEGIN:VEVENT",
      `UID:${j.reference}-cleaner@saaficleaningservice.com`,
      `DTSTAMP:${stamp}`,
      ...timing,
      `SUMMARY:${esc(`SAAFI clean — ${j.customer_name} (${j.hours}h)`)}`,
      `LOCATION:${esc(`${j.address_line}, ${j.postcode}`)}`,
      `DESCRIPTION:${esc(
        [
          `Customer: ${j.customer_name} · ${j.customer_phone}`,
          j.notes ? `Notes: ${j.notes}` : null,
          `Ref ${j.reference} — details and Start/Finish in your SAAFI jobs page.`,
        ]
          .filter(Boolean)
          .join("\n")
      )}`,
      "END:VEVENT",
    ];
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SAAFI Cleaning//Cleaner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`SAAFI — ${cleaner.name.split(" ")[0]}'s cleans`)}`,
    "X-WR-TIMEZONE:Europe/London",
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
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="saafi-jobs.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
