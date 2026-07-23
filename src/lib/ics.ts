// iCalendar (RFC 5545) feed builder for the admin calendar.
// Bookings are date-only (no time-of-day in the schema), so each clean is an
// all-day VEVENT. Text is escaped and lines folded per the spec so the feed
// imports cleanly into Google / Apple / Outlook calendars.

import type { BookingRow } from "@/lib/supabaseAdmin";
import { FREQUENCY_LABEL } from "@/lib/pricing";

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

    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@saafi-booking`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dateVal(b.preferred_date)}`,
      `DTEND;VALUE=DATE:${nextDay(b.preferred_date)}`,
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
