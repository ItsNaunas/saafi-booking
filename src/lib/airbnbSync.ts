// Reads each connected Airbnb calendar and turns checkouts into suggested
// turnover cleans. The pure half (parsing, what changes) is lib/icalImport.ts;
// this is the I/O around it.
//
// Runs from four places (2026-10-15):
//   - every 15 minutes, Supabase pg_cron -> POST /api/airbnb/sync
//   - the admin calendar, before it renders, when a feed is FRESH_MINUTES old
//   - the "Sync" buttons on /admin/airbnb
//   - the daily cron, as a backstop
// Whichever run first sees a change emails the office about it — once, because
// only the run whose insert actually lands counts a checkout as new.

import { londonWallClock } from "@/lib/scheduling";
import { parseIcal, planSync, linkSuggestionsToBookings, releaseCancelledLinks, daysUntil } from "@/lib/icalImport";
import { sendAirbnbAlertEmail, type AirbnbAlertItem } from "@/lib/email";
import {
  listIcalFeeds,
  listSuggestionsForFeed,
  insertSuggestions,
  updateSuggestion,
  updateIcalFeed,
  listBookings,
  type IcalFeedRow,
} from "@/lib/supabaseAdmin";

/** The calendar syncs before showing when a feed is older than this. */
export const FRESH_MINUTES = 10;
/** Kept for callers that only want a background top-up. */
export const STALE_MINUTES = 30;
const FETCH_TIMEOUT_MS = 15_000;

export type FeedSyncResult = {
  feed: string;
  /** New checkouts left as suggestions. */
  added: number;
  /** Suggestions linked to a clean that was already booked. */
  alreadyBooked?: number;
  changed: number;
  flagged: number;
  error?: string;
};

export async function syncFeed(feed: IcalFeedRow): Promise<FeedSyncResult> {
  const result: FeedSyncResult = { feed: feed.label, added: 0, changed: 0, flagged: 0 };
  const nowIso = new Date().toISOString();
  const alerts: AirbnbAlertItem[] = [];
  try {
    const res = await fetch(feed.url, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
    });
    if (!res.ok) throw new Error(`calendar link answered ${res.status}`);
    const events = parseIcal(await res.text());
    if (!events) throw new Error("that link didn't return a calendar — check it's the Airbnb export link");

    const existing = await listSuggestionsForFeed(feed.id);
    const today = londonWallClock(new Date()).date;
    // An empty feed while we hold upcoming confirmed cleans is far likelier to
    // be Airbnb having a bad minute than every guest cancelling at once. Touch
    // nothing and say so, rather than flag every booking as cancelled.
    if (events.length === 0 && existing.some((r) => r.status === "confirmed" && r.checkout_date >= today)) {
      throw new Error("calendar came back empty — not trusting it this time");
    }

    const plan = planSync(feed.id, events, existing, today, nowIso);
    // Only rows this run actually inserted: a concurrent run inserting the same
    // stay gets nothing back, so the office is told about each checkout once.
    const insertedUids = new Set(await insertSuggestions(plan.inserts));
    for (const u of plan.updates) await updateSuggestion(u.id, u.fields);

    // Duplicate guard: anything already booked at this address that day is
    // linked to that booking rather than suggested again.
    const [fresh, bookings] = await Promise.all([listSuggestionsForFeed(feed.id), listBookings()]);
    // A clean booked for a stay, then cancelled or deleted: the stay needs
    // cleaning again, so it goes back to being suggested (and may re-link
    // below if another clean is booked that day).
    const released = new Set(releaseCancelledLinks(fresh, bookings, today));
    for (const id of released) await updateSuggestion(id, { status: "suggested", booking_id: null, updated_at: nowIso });
    for (const r of fresh) if (released.has(r.id)) Object.assign(r, { status: "suggested", booking_id: null });
    const links = linkSuggestionsToBookings(fresh, bookings, feed.postcode);
    for (const l of links) await updateSuggestion(l.id, { status: "confirmed", booking_id: l.bookingId, updated_at: nowIso });
    const linked = new Set(links.map((l) => l.id));

    for (const r of fresh) {
      const kind = insertedUids.has(r.uid) && !linked.has(r.id) ? "new" : released.has(r.id) && !linked.has(r.id) ? "released" : null;
      if (kind) alerts.push({ kind, checkout: r.checkout_date, nextCheckin: r.next_checkin_date, daysAway: daysUntil(today, r.checkout_date) });
    }
    for (const u of plan.updates) {
      if (!u.fields.changed_at) continue;
      const r = fresh.find((x) => x.id === u.id);
      if (r) alerts.push({ kind: "changed", checkout: r.checkout_date, nextCheckin: r.next_checkin_date, daysAway: daysUntil(today, r.checkout_date), note: u.fields.change_note ?? undefined });
    }

    result.added = alerts.filter((a) => a.kind === "new").length;
    result.alreadyBooked = links.length;
    result.flagged = plan.updates.filter((u) => u.fields.changed_at).length;
    result.changed = plan.updates.length - result.flagged;
    await updateIcalFeed(feed.id, { last_synced_at: nowIso, last_error: null });
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    // Stamp the attempt too, so a dead link isn't re-fetched on every page view.
    await updateIcalFeed(feed.id, { last_synced_at: nowIso, last_error: result.error.slice(0, 300) }).catch(() => {});
    // Tell the office when a calendar STARTS failing — not every 15 minutes.
    if (!feed.last_error) alerts.push({ kind: "failing", note: result.error });
  }
  if (alerts.length) await sendAirbnbAlertEmail(feed.label, alerts).catch(() => {});
  return result;
}

/** Sync every active feed, or only those older than `staleMinutes`. */
export async function syncFeeds(opts: { staleMinutes?: number } = {}): Promise<FeedSyncResult[]> {
  const feeds = (await listIcalFeeds()).filter((f) => f.active);
  const cutoff = opts.staleMinutes ? Date.now() - opts.staleMinutes * 60_000 : null;
  const due = cutoff ? feeds.filter((f) => !f.last_synced_at || Date.parse(f.last_synced_at) < cutoff) : feeds;
  const results: FeedSyncResult[] = [];
  // One at a time: a handful of feeds, and it keeps a slow host from fanning
  // out into parallel writes against the same rows.
  for (const f of due) results.push(await syncFeed(f));
  return results;
}

/** Sync before showing, but never keep the page waiting longer than `maxMs`. */
export async function syncIfStale(minutes: number, maxMs: number): Promise<void> {
  const run = syncFeeds({ staleMinutes: minutes }).catch(() => []);
  await Promise.race([run, new Promise((r) => setTimeout(r, maxMs))]);
}
