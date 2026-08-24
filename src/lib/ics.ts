// iCalendar (RFC 5545) feed builder for the admin calendar.
// A booking with a start time becomes a timed VEVENT; one still waiting to be
// slotted stays an all-day event, so it shows up without pretending to a time it
// hasn't got. Text is escaped and lines folded per the spec so the feed imports
// cleanly into Google / Apple / Outlook calendars.

import type { BookingRow } from "@/lib/supabaseAdmin";
import { FREQUENCY_LABEL } from "@/lib/pricing";
import { toMinutes, toHHMM, formatTimeRange, londonWallClock, daysBetween } from "@/lib/scheduling";

/** Escape a text value for TEXT-typed iCal properties. */
function esc(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold content lines to <=75 octets with a leading space on continuations. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

/** 'YYYY-MM-DD' -> 'YYYYMMDD' for VALUE=DATE. */
const dateVal = (ymd: string) => ymd.replace(/-/g, "");

/** All-day events use an exclusive DTEND of the next day. */
function nextDay(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return dateVal(d.toISOString().slice(0, 10));
}

/**
 * A London wall-clock date+time as a UTC iCal stamp.
 *
 * Emitting UTC rather than TZID sidesteps having to ship a VTIMEZONE block that
 * some clients insist on. The offset is derived from the instant itself, so BST
 * and GMT both come out right.
 */
function utcStamp(date: string, minutes: number): string {
  const naive = Date.parse(`${date}T${toHHMM(minutes)}:00Z`);
  const london = londonWallClock(new Date(naive));
  // How far ahead of UTC London was at that instant.
  const offset = london.minutes - minutes + daysBetween(date, london.date) * 1440;
  return new Date(naive - offset * 60_000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function bookingsToICS(
  rows: BookingRow[],
  cleanerName: Map<string, string>,
  opts: { calName?: string } = {}
): string {
  const now = stamp();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SAAFI Cleaning//Booking CRM//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.calName ?? "SAAFI Cleans")}`,
    "X-WR-TIMEZONE:Europe/London",
  ];

  for (const b of rows) {
    const cleaner = b.cleaner_id ? cleanerName.get(b.cleaner_id) : null;
    const addons = (b.addons ?? []).map((a) => a.label).join(", ");
    const descParts = [
      `Status: ${b.status}`,
      `Price: £${Number(b.quoted_price).toFixed(2)}`,
      `Hours: ${b.hours}`,
      b.start_time ? `Time: ${formatTimeRange(b.start_time, Number(b.hours))}` : "Time: not set yet",
      `Cleaner: ${cleaner ?? "unassigned"}`,
      `Frequency: ${FREQUENCY_LABEL[b.frequency]}`,
      `Phone: ${b.customer_phone}`,
      `Email: ${b.customer_email}`,
      `Rooms: ${b.bedrooms} bed / ${b.bathrooms} bath`,
      addons ? `Extras: ${addons}` : "",
      b.notes ? `Notes: ${b.notes}` : "",
      `Ref: ${b.reference}`,
    ].filter(Boolean);

    const summary = `${b.customer_name} — ${b.hours}h clean${cleaner ? ` (${cleaner})` : ""}`;

    const startMinutes = b.start_time ? toMinutes(b.start_time) : null;
    const timing =
      startMinutes === null
        ? [
            `DTSTART;VALUE=DATE:${dateVal(b.preferred_date)}`,
            `DTEND;VALUE=DATE:${nextDay(b.preferred_date)}`,
          ]
        : [
            `DTSTART:${utcStamp(b.preferred_date, startMinutes)}`,
            `DTEND:${utcStamp(b.preferred_date, startMinutes + Math.round(Number(b.hours) * 60))}`,
          ];

    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@saafi-booking`,
      `DTSTAMP:${now}`,
      ...timing,
      fold(`SUMMARY:${esc(summary)}`),
      fold(`LOCATION:${esc(`${b.address_line}, ${b.postcode}`)}`),
      fold(`DESCRIPTION:${esc(descParts.join("\n"))}`),
      `STATUS:${b.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
