// Recurring engine — completing a clean books the next one in the series.
// Shared by the admin path and the cleaner's magic-link path so the two can't
// drift apart.

import { FREQUENCY_DAYS, type Frequency } from "./pricing";
import { insertBooking, type BookingRow } from "./supabaseAdmin";

export function newReference(): string {
  return `SAAFI-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Book the next occurrence of a recurring clean.
 *
 * Carries the QUOTED hours and price forward, never the actuals: one unusually
 * messy Tuesday must not permanently reprice a weekly customer.
 */
export async function spawnNextOccurrence(b: BookingRow): Promise<void> {
  if (b.frequency === "one_off" || !b.recurring_active) return;

  const days = FREQUENCY_DAYS[b.frequency as Exclude<Frequency, "one_off">];
  const next = new Date(b.preferred_date + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + days);

  const quotedHours = b.quoted_hours ?? b.hours;

  await insertBooking({
    reference: newReference(),
    customer_id: b.customer_id,
    customer_name: b.customer_name,
    customer_email: b.customer_email,
    customer_phone: b.customer_phone,
    address_line: b.address_line,
    postcode: b.postcode,
    bedrooms: b.bedrooms,
    bathrooms: b.bathrooms,
    dining_rooms: b.dining_rooms,
    living_rooms: b.living_rooms,
    hours: quotedHours,
    quoted_hours: quotedHours,
    customer_provides_products: b.customer_provides_products,
    addons: b.addons,
    addons_total: b.addons_total,
    frequency: b.frequency,
    series_id: b.series_id ?? b.id,
    recurring_active: true,
    cleaner_id: b.cleaner_id,
    quoted_price: b.quoted_price,
    price_status: "quoted",
    preferred_date: next.toISOString().slice(0, 10),
    notes: b.notes,
    status: "confirmed",
  });
}
