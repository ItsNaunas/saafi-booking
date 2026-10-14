// Airbnb (or any) iCal feed -> turnover-clean suggestions. Pure: no DB, no
// clock of its own (`today` is passed in), so all of it is assertable — see
// scripts/ical-import-check.ts.
//
// What an Airbnb export gives us is thin on purpose: one VEVENT per stay with
// a stable UID, all-day DTSTART (check-in) and DTEND (checkout day), and a
// SUMMARY of "Reserved" (a guest) or "Airbnb (Not available)" (a host block,
// or a stay synced in from another platform). No guest names, no times. A
// checkout is the moment a turnover clean is needed, so DTEND is the date
// that matters.

import { londonWallClock } from "@/lib/scheduling";

export type IcalEvent = {
  uid: string;
  summary: string;
  /** Check-in, YYYY-MM-DD (London date). */
  start: string;
  /** Checkout, YYYY-MM-DD. */
  end: string;
};

export type SuggestionStatus = "suggested" | "confirmed" | "dismissed" | "gone";

export type SuggestionRow = {
  id: string;
  feed_id: string;
  uid: string;
  summary: string | null;
  checkin_date: string;
  checkout_date: string;
  next_checkin_date: string | null;
  status: SuggestionStatus;
  booking_id: string | null;
  changed_at: string | null;
  change_note: string | null;
  created_at: string;
  updated_at: string;
};

/** iCal date or date-time value -> YYYY-MM-DD in London. */
function toDate(value: string): string | null {
  const v = value.trim();
  const ymd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{8}$/.test(v)) return ymd(v);
  // UTC instant: the London date can differ from the UTC one near midnight.
  const z = v.match(/^(\d{8})T(\d{2})(\d{2})(\d{2})Z$/);
  if (z) {
    const iso = `${ymd(z[1])}T${z[2]}:${z[3]}:${z[4]}Z`;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : londonWallClock(new Date(t)).date;
  }
  // Floating or TZID-qualified local time: the date part is the local date.
  if (/^\d{8}T\d{6}$/.test(v)) return ymd(v);
  return null;
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

function plusDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse a feed. Returns null when the text isn't a calendar at all (an HTML
 * login page, an error body) — distinct from a real calendar with no events,
 * because the caller must never treat a broken fetch as "every stay cancelled".
 */
export function parseIcal(text: string): IcalEvent[] | null {
  if (!/BEGIN:VCALENDAR/i.test(text)) return null;
  // Unfold continuation lines (RFC 5545 §3.1) before reading anything.
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: IcalEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^BEGIN:VEVENT$/i.test(line)) {
      cur = {};
      continue;
    }
    if (/^END:VEVENT$/i.test(line)) {
      if (cur) {
        const start = cur.DTSTART ? toDate(cur.DTSTART) : null;
        let end = cur.DTEND ? toDate(cur.DTEND) : null;
        // An all-day event with no DTEND lasts one day.
        if (start && !end) end = plusDays(start, 1);
        if (cur.UID && start && end && end >= start) {
          events.push({ uid: cur.UID.trim(), summary: unescapeText(cur.SUMMARY ?? ""), start, end });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    // "DTSTART;VALUE=DATE:20261015" -> name DTSTART, value 20261015.
    const name = line.slice(0, colon).split(";")[0].toUpperCase();
    if (name === "UID" || name === "SUMMARY" || name === "DTSTART" || name === "DTEND") {
      cur[name] = line.slice(colon + 1);
    }
  }
  return events;
}

/** A host's own block rather than a guest — still shown, labelled differently. */
export function isBlock(summary: string | null): boolean {
  return /not available|blocked/i.test(summary ?? "");
}

export type SyncPlan = {
  inserts: Omit<SuggestionRow, "id" | "status" | "booking_id" | "changed_at" | "change_note" | "created_at" | "updated_at">[];
  updates: { id: string; fields: Partial<SuggestionRow> }[];
};

/**
 * Work out what a sync changes, given the feed's events and what we already
 * hold for this feed.
 *
 * - New stay with a checkout from today to `horizonDays` ahead -> suggested.
 * - Suggested/dismissed stay that moved -> dates follow silently (dismissed
 *   stays dismissed — the office already said no to this stay).
 * - CONFIRMED stay that moved or vanished -> the booking is left alone and the
 *   row is flagged, once per distinct change, for a human.
 * - Suggested stay that vanished -> gone. Reappears -> suggested again.
 *
 * Only rows with a checkout from today on are judged "vanished": Airbnb drops
 * past stays from the feed, which is not a cancellation.
 */
export function planSync(
  feedId: string,
  events: IcalEvent[],
  existing: SuggestionRow[],
  today: string,
  nowIso: string,
  horizonDays = 180
): SyncPlan {
  const horizon = plusDays(today, horizonDays);
  const starts = events.map((e) => e.start).sort();
  const nextCheckin = (checkout: string) => starts.find((s) => s >= checkout) ?? null;

  const byUid = new Map(existing.map((r) => [r.uid, r]));
  const seen = new Set<string>();
  const plan: SyncPlan = { inserts: [], updates: [] };

  for (const e of events) {
    seen.add(e.uid);
    const next = nextCheckin(e.end);
    const row = byUid.get(e.uid);
    if (!row) {
      if (e.end < today || e.end > horizon) continue;
      plan.inserts.push({
        feed_id: feedId,
        uid: e.uid,
        summary: e.summary || null,
        checkin_date: e.start,
        checkout_date: e.end,
        next_checkin_date: next,
      });
      continue;
    }

    const moved = row.checkout_date !== e.end;
    const fields: Partial<SuggestionRow> = {};
    if (moved) fields.checkout_date = e.end;
    if (row.checkin_date !== e.start) fields.checkin_date = e.start;
    if ((row.next_checkin_date ?? null) !== next) fields.next_checkin_date = next;
    if ((row.summary ?? "") !== e.summary) fields.summary = e.summary || null;

    if (row.status === "gone") {
      fields.status = "suggested";
    } else if (row.status === "confirmed" && moved) {
      fields.changed_at = nowIso;
      fields.change_note = `Airbnb checkout moved from ${row.checkout_date} to ${e.end} — the booking still says the old date.`;
    }
    if (Object.keys(fields).length > 0) {
      plan.updates.push({ id: row.id, fields: { ...fields, updated_at: nowIso } });
    }
  }

  for (const row of existing) {
    if (seen.has(row.uid) || row.checkout_date < today) continue;
    if (row.status === "suggested") {
      plan.updates.push({ id: row.id, fields: { status: "gone", updated_at: nowIso } });
    } else if (row.status === "confirmed") {
      const note = "This stay is no longer on the Airbnb calendar — cancelled? The clean is still booked.";
      if (row.change_note !== note) {
        plan.updates.push({ id: row.id, fields: { changed_at: nowIso, change_note: note, updated_at: nowIso } });
      }
    }
  }
  return plan;
}

const normPostcode = (p: string | null | undefined) => (p ?? "").toUpperCase().replace(/\s+/g, "");

/**
 * The duplicate guard. A suggested turnover is already handled when a clean
 * is booked at the same postcode on the checkout day — booked by hand, by
 * phone, or confirmed from an earlier copy of this calendar. Those suggestions
 * are linked to that booking (status confirmed) instead of asking again, so
 * a later Airbnb change still flags it.
 *
 * Each booking links to at most one suggestion. Without a postcode on the
 * calendar there's nothing safe to match on, so nothing is linked.
 */
export function linkSuggestionsToBookings(
  rows: Pick<SuggestionRow, "id" | "status" | "checkout_date" | "booking_id">[],
  bookings: { id: string; postcode: string; preferred_date: string; status: string }[],
  feedPostcode: string | null
): { id: string; bookingId: string }[] {
  const pc = normPostcode(feedPostcode);
  if (!pc) return [];
  const used = new Set(rows.map((r) => r.booking_id).filter((b): b is string => !!b));
  const out: { id: string; bookingId: string }[] = [];
  for (const r of rows) {
    if (r.status !== "suggested") continue;
    const b = bookings.find(
      (x) => x.status !== "cancelled" && x.preferred_date === r.checkout_date && normPostcode(x.postcode) === pc && !used.has(x.id)
    );
    if (b) {
      used.add(b.id);
      out.push({ id: r.id, bookingId: b.id });
    }
  }
  return out;
}

/** True when a clean is already booked at this postcode on this day — for hiding a suggestion instantly. */
export function alreadyBooked(
  postcode: string | null,
  date: string,
  bookings: { postcode: string; preferred_date: string; status: string }[]
): boolean {
  const pc = normPostcode(postcode);
  return !!pc && bookings.some((b) => b.status !== "cancelled" && b.preferred_date === date && normPostcode(b.postcode) === pc);
}
