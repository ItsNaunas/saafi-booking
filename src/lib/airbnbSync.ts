// Reads each connected Airbnb calendar and turns checkouts into suggested
// turnover cleans. The pure half (parsing, what changes) is lib/icalImport.ts;
// this is the I/O around it.
//
// Runs from three places: the daily cron, the "Sync now" buttons, and quietly
// after the admin calendar renders when a feed is more than STALE_MINUTES old
// (Vercel's plan here allows one cron a day, and the office looking at the
// calendar is exactly when fresh data matters).

import { londonWallClock } from "@/lib/scheduling";
import { parseIcal, planSync, linkSuggestionsToBookings, releaseCancelledLinks } from "@/lib/icalImport";
import {
  listIcalFeeds,
  listSuggestionsForFeed,
  insertSuggestions,
  updateSuggestion,
  updateIcalFeed,
  listBookings,
  type IcalFeedRow,
} from "@/lib/supabaseAdmin";

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
    await insertSuggestions(plan.inserts);
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
    const linkedNew = new Set(links.map((l) => l.id));
    const newIds = fresh.filter((r) => plan.inserts.some((i) => i.uid === r.uid)).map((r) => r.id);

    result.added = newIds.filter((id) => !linkedNew.has(id)).length;
    result.alreadyBooked = links.length;
    result.flagged = plan.updates.filter((u) => u.fields.changed_at).length;
    result.changed = plan.updates.length - result.flagged;
    await updateIcalFeed(feed.id, { last_synced_at: nowIso, last_error: null });
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
    // Stamp the attempt too, so a dead link isn't re-fetched on every page view.
    await updateIcalFeed(feed.id, { last_synced_at: nowIso, last_error: result.error.slice(0, 300) }).catch(
      () => {}
    );
  }
  return result;
}

/** Sync every active feed, or only those older than `staleMinutes`. */
export async function syncFeeds(opts: { staleMinutes?: number } = {}): Promise<FeedSyncResult[]> {
  const feeds = (await listIcalFeeds()).filter((f) => f.active);
  const cutoff = opts.staleMinutes ? Date.now() - opts.staleMinutes * 60_000 : null;
  const due = cutoff
    ? feeds.filter((f) => !f.last_synced_at || Date.parse(f.last_synced_at) < cutoff)
    : feeds;
  const results: FeedSyncResult[] = [];
  // One at a time: a handful of feeds, and it keeps a slow host from fanning
  // out into parallel writes against the same rows.
  for (const f of due) results.push(await syncFeed(f));
  return results;
}
