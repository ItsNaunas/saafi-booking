// Recurring engine — keeps a series filled in ahead of itself.
//
// It used to book exactly one visit at a time: completing a clean created the
// next one, and that was the whole series. Which meant a "fortnightly customer"
// had precisely one booking in the system, and so:
//
//   - nobody could be told when their next few cleans were
//   - the rota could not be planned beyond the job in front of you
//   - a slot a regular customer has held for a year looked free to everyone else
//   - there was nothing for a customer to reschedule or skip, because it did not
//     exist yet
//
// Now the next eight weeks are real bookings. Filling the horizon is idempotent,
// so it can be called as often as you like — on confirmation, on completion, or
// from a job that runs nightly if one is ever added.
//
// Shared by the admin path and the cleaner's magic-link path so the two cannot
// drift apart.

import { FREQUENCY_DAYS, type Frequency } from "./pricing";
import { insertBooking, listSeriesBookings, type BookingRow } from "./supabaseAdmin";
import { newReference } from "./reference";

export { newReference };

/** How far ahead a series is kept booked. */
export const HORIZON_DAYS = 56;

/** Never create more than this in one go, whatever the arithmetic says. */
const MAX_PER_RUN = 12;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Book every occurrence of a series that should exist between now and the
 * horizon, and return only the ones it had to create.
 *
 * Idempotent by date: an occurrence already on the books — in any state except
 * cancelled — is left exactly as it is. A cancelled one is treated as a gap the
 * customer asked for, and is not silently re-created.
 */
export async function ensureSeriesHorizon(
  seed: BookingRow,
  now: Date = new Date()
): Promise<BookingRow[]> {
  if (seed.frequency === "one_off" || !seed.recurring_active) return [];

  const step = FREQUENCY_DAYS[seed.frequency as Exclude<Frequency, "one_off">];
  const seriesId = seed.series_id ?? seed.id;
  const today = now.toISOString().slice(0, 10);
  const horizon = addDays(today, HORIZON_DAYS);

  // Every date this series has ever occupied, whatever became of it. Cancelled
  // counts: somebody deliberately took that visit out, and filling the horizon
  // must not quietly put it back. Skipping one clean is a thing customers ask
  // for, and it has to survive the next top-up.
  let taken: Set<string>;
  try {
    const existing = await listSeriesBookings(seriesId);
    taken = new Set(existing.map((b) => b.preferred_date));
  } catch (e) {
    // Without knowing what exists we could duplicate the whole series. Doing
    // nothing is the safe failure here.
    console.error("[recurring] could not read the series, skipping top-up:", e);
    return [];
  }

  const quotedHours = seed.quoted_hours ?? seed.hours;
  const created: BookingRow[] = [];

  let date = addDays(seed.preferred_date, step);
  while (date <= horizon && created.length < MAX_PER_RUN) {
    // Skip anything already booked, and anything that has fallen into the past
    // — a series left alone for months should resume, not backfill.
    if (!taken.has(date) && date >= today) {
      const row = await insertBooking({
        reference: newReference(),
        customer_id: seed.customer_id,
        customer_name: seed.customer_name,
        customer_email: seed.customer_email,
        customer_phone: seed.customer_phone,
        address_line: seed.address_line,
        postcode: seed.postcode,
        bedrooms: seed.bedrooms,
        bathrooms: seed.bathrooms,
        dining_rooms: seed.dining_rooms,
        living_rooms: seed.living_rooms,
        hours: quotedHours,
        quoted_hours: quotedHours,
        customer_provides_products: seed.customer_provides_products,
        addons: seed.addons,
        addons_total: seed.addons_total,
        frequency: seed.frequency,
        series_id: seriesId,
        recurring_active: true,
        cleaner_id: seed.cleaner_id,
        // The QUOTED figures, never the actuals: one unusually messy Tuesday must
        // not permanently reprice a weekly customer.
        quoted_price: seed.quoted_price,
        price_status: "quoted",
        preferred_date: date,
        // Same slot every visit is the point of a regular clean. A series that
        // never had a time does not invent one.
        start_time: seed.start_time,
        notes: seed.notes,
        status: "confirmed",
      });
      if (row) {
        created.push(row);
        taken.add(date);
      }
    }
    date = addDays(date, step);
  }

  if (created.length > 0) {
    // One email describing the lot. Filling eight weeks at once used to mean
    // eight separate emails, which is a good way to teach someone to ignore you.
    const { sendSeriesBookedEmail } = await import("./email");
    await sendSeriesBookedEmail(created).catch((e) =>
      console.error("[recurring] series email failed:", e)
    );
  }

  return created;
}

/**
 * Kept because two call sites used it and the name still describes the intent at
 * those points — completing a clean should leave the series topped up. It is the
 * horizon fill now, not a single spawn.
 */
export async function spawnNextOccurrence(b: BookingRow): Promise<BookingRow | null> {
  const created = await ensureSeriesHorizon(b);
  return created[0] ?? null;
}
