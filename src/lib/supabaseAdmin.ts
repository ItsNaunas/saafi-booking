// Server-only Supabase data layer for the admin CRM (secret key, full access).
// Plain PostgREST fetches — no client SDK needed. Never import from client components.
import { secret } from "./env";

import type { ReasonCode } from "./adjustments";
import { busyFromBooking, type BusyBlock, type SchedulableCleaner } from "./scheduling";

export type BookingStatus = "requested" | "confirmed" | "completed" | "paid" | "cancelled";

export type Frequency = "one_off" | "weekly" | "fortnightly" | "four_weekly";

/** Where the money stands: the quote, a proposal awaiting the owner, or settled. */
export type PriceStatus = "quoted" | "pending" | "agreed";

export type BookingRow = {
  id: string;
  reference: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_line: string;
  postcode: string;
  bedrooms: number;
  bathrooms: number;
  dining_rooms: number;
  living_rooms: number;
  hours: number;
  customer_provides_products: boolean;
  addons: { key: string; label: string; price: number }[];
  addons_total: number;
  frequency: Frequency;
  series_id: string | null;
  recurring_active: boolean;
  cleaner_id: string | null;
  quoted_price: number;
  preferred_date: string;
  /** "09:30:00" local. Null on bookings taken before scheduling existed. */
  start_time: string | null;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  // Actuals — null until the cleaner finishes the job (2026-08-20 migration).
  quoted_hours: number | null;
  actual_hours: number | null;
  final_price: number | null;
  price_status: PriceStatus;
  started_at: string | null;
  finished_at: string | null;
  // Stripe (2026-08-21 migration). Null until a payment link is raised.
  stripe_payment_link_id: string | null;
  stripe_payment_link_url: string | null;
  stripe_payment_intent: string | null;
  amount_paid: number | null;
  paid_at: string | null;
};

export type CleanerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  token: string;
  active: boolean;
  created_at: string;
  /** 0=Sunday..6=Saturday, matching JS getUTCDay(). */
  works_days: number[];
  works_from: string;
  works_to: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address_line: string | null;
  postcode: string | null;
  created_at: string;
};

function creds() {
  const url = process.env.SUPABASE_URL;
  const key = secret("SUPABASE_SECRET_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY not configured");
  return { url, key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = creds();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function listBookings(): Promise<BookingRow[]> {
  return rest<BookingRow[]>("bookings?select=*&order=preferred_date.asc,created_at.asc");
}

export async function getBooking(id: string): Promise<BookingRow | null> {
  const rows = await rest<BookingRow[]>(`bookings?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  return rows[0] ?? null;
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<BookingRow | null> {
  const rows = await rest<BookingRow[]>(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return rows?.[0] ?? null;
}

export async function listCustomers(): Promise<(CustomerRow & { bookings: { count: number }[] })[]> {
  return rest("customers?select=*,bookings(count)&order=created_at.desc");
}

export async function getPricingRows(): Promise<{ key: string; value: number }[]> {
  return rest("pricing_config?select=key,value&order=key.asc");
}

export async function updatePricingRow(key: string, value: number): Promise<void> {
  await rest(`pricing_config?key=eq.${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify({ value, updated_at: new Date().toISOString() }),
  });
}

/** Insert a booking directly (recurring spawn / manual admin booking). */
export async function insertBooking(
  fields: Partial<BookingRow> & {
    reference: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    address_line: string;
    postcode: string;
    hours: number;
    quoted_price: number;
    preferred_date: string;
    status: BookingStatus;
  }
): Promise<BookingRow | null> {
  const rows = await rest<BookingRow[]>("bookings", {
    method: "POST",
    body: JSON.stringify(fields),
  });
  return rows?.[0] ?? null;
}

export async function updateBooking(
  id: string,
  fields: Partial<
    Pick<
      BookingRow,
      | "preferred_date"
      | "start_time"
      | "hours"
      | "quoted_price"
      | "notes"
      | "status"
      | "cleaner_id"
      | "frequency"
      | "recurring_active"
      | "quoted_hours"
      | "actual_hours"
      | "final_price"
      | "price_status"
      | "started_at"
      | "finished_at"
    >
  >
): Promise<BookingRow | null> {
  const rows = await rest<BookingRow[]>(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
  return rows?.[0] ?? null;
}

/* ---------- cleaners ---------- */

export async function listCleaners(): Promise<CleanerRow[]> {
  return rest<CleanerRow[]>("cleaners?select=*&order=created_at.asc");
}

export async function createCleaner(name: string, phone: string, email: string | null): Promise<void> {
  await rest("cleaners", { method: "POST", body: JSON.stringify({ name, phone, email }) });
}

export async function setCleanerActive(id: string, active: boolean): Promise<void> {
  await rest(`cleaners?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function getCleanerByToken(token: string): Promise<CleanerRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const rows = await rest<CleanerRow[]>(
    `cleaners?token=eq.${encodeURIComponent(token)}&active=eq.true&select=*&limit=1`
  );
  return rows[0] ?? null;
}

export async function listBookingsForCleaner(cleanerId: string): Promise<BookingRow[]> {
  return rest<BookingRow[]>(
    `bookings?cleaner_id=eq.${encodeURIComponent(cleanerId)}&status=in.(confirmed,completed)&select=*&order=preferred_date.asc,start_time.asc.nullslast`
  );
}

export async function updateCleanerHours(
  id: string,
  worksDays: number[],
  worksFrom: string,
  worksTo: string
): Promise<void> {
  await rest(`cleaners?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ works_days: worksDays, works_from: worksFrom, works_to: worksTo }),
  });
}

/* ---------- scheduling ---------- */

/** Active cleaners in the shape the scheduling engine wants. */
export async function listSchedulableCleaners(): Promise<SchedulableCleaner[]> {
  const rows = await rest<CleanerRow[]>(
    "cleaners?select=id,name,works_days,works_from,works_to&active=eq.true&order=name.asc"
  );
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    // Defensive: the columns are NOT NULL with defaults, but a row written before
    // the migration by some other route would otherwise produce NaN slots.
    worksDays: Array.isArray(c.works_days) ? c.works_days.map(Number) : [],
    worksFrom: c.works_from ?? "09:00",
    worksTo: c.works_to ?? "17:00",
  }));
}

/**
 * Everything already occupying a given day. Cancelled jobs free their slot back
 * up; every other status is work the business has committed to, assigned or not.
 * `excludeBookingId` lets a booking be rescheduled without clashing with itself.
 */
export async function busyBlocksForDate(
  date: string,
  excludeBookingId?: string
): Promise<BusyBlock[]> {
  const rows = await rest<Pick<BookingRow, "id" | "cleaner_id" | "start_time" | "hours">[]>(
    `bookings?preferred_date=eq.${encodeURIComponent(date)}` +
      `&status=in.(requested,confirmed,completed,paid)` +
      `&select=id,cleaner_id,start_time,hours`
  );
  return rows
    .filter((r) => r.id !== excludeBookingId)
    .map(busyFromBooking)
    .filter((b): b is BusyBlock => b !== null);
}

/* ---------- add-ons (extras) ---------- */

export type AddonRow = {
  key: string;
  label: string;
  price: number;
  hours: number;
  active: boolean;
  sort: number;
};

/** All add-ons including inactive ones — for the admin editor. */
export async function listAllAddons(): Promise<AddonRow[]> {
  const rows = await rest<(Omit<AddonRow, "hours"> & { hours?: number | null })[]>(
    "addons?select=*&order=sort.asc"
  );
  return rows.map((r) => ({ ...r, price: Number(r.price), hours: Number(r.hours ?? 0) }));
}

export async function updateAddon(
  key: string,
  fields: Partial<Pick<AddonRow, "label" | "price" | "hours" | "active">>
): Promise<void> {
  await rest(`addons?key=eq.${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function getServiceAreaPrefixes(): Promise<string[]> {
  const rows = await rest<{ prefix: string }[]>("service_areas?select=prefix&order=prefix.asc");
  return rows.map((r) => r.prefix);
}

export async function addServiceAreaPrefix(prefix: string): Promise<void> {
  await rest("service_areas", { method: "POST", body: JSON.stringify({ prefix }) });
}

export async function removeServiceAreaPrefix(prefix: string): Promise<void> {
  await rest(`service_areas?prefix=eq.${encodeURIComponent(prefix)}`, { method: "DELETE" });
}

/* ---------- price adjustments (2026-08-20) ---------- */


export type AdjustmentStatus = "pending" | "approved" | "rejected" | "auto";

export type AdjustmentRow = {
  id: string;
  booking_id: string;
  from_hours: number;
  to_hours: number;
  from_price: number;
  to_price: number;
  reason_code: ReasonCode;
  note: string | null;
  chargeable: boolean;
  cleaner_id: string | null;
  status: AdjustmentStatus;
  created_at: string;
  decided_at: string | null;
};

export async function insertAdjustment(
  fields: Omit<AdjustmentRow, "id" | "created_at" | "decided_at">
): Promise<AdjustmentRow | null> {
  const rows = await rest<AdjustmentRow[]>("booking_adjustments", {
    method: "POST",
    body: JSON.stringify(fields),
  });
  return rows?.[0] ?? null;
}

export async function listAdjustmentsForBooking(bookingId: string): Promise<AdjustmentRow[]> {
  return rest<AdjustmentRow[]>(
    `booking_adjustments?booking_id=eq.${encodeURIComponent(bookingId)}&select=*&order=created_at.desc`
  );
}

export async function getAdjustment(id: string): Promise<AdjustmentRow | null> {
  const rows = await rest<AdjustmentRow[]>(
    `booking_adjustments?id=eq.${encodeURIComponent(id)}&select=*&limit=1`
  );
  return rows[0] ?? null;
}

/** Everything waiting on the owner's yes/no, newest first. Drives the admin banner. */
export async function listPendingAdjustments(): Promise<(AdjustmentRow & { bookings: BookingRow | null })[]> {
  return rest("booking_adjustments?status=eq.pending&select=*,bookings(*)&order=created_at.desc");
}

export async function setAdjustmentStatus(
  id: string,
  status: AdjustmentStatus
): Promise<AdjustmentRow | null> {
  const rows = await rest<AdjustmentRow[]>(`booking_adjustments?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, decided_at: new Date().toISOString() }),
  });
  return rows?.[0] ?? null;
}

/* ---------- Stripe ---------- */

/** What we should actually charge: the agreed final price if there is one, else the quote. */
export function amountDueFor(b: BookingRow): number {
  return b.price_status === "agreed" && b.final_price != null ? b.final_price : b.quoted_price;
}

export async function saveBookingPaymentLink(
  id: string,
  linkId: string,
  url: string
): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ stripe_payment_link_id: linkId, stripe_payment_link_url: url }),
  });
}

export async function getBookingByPaymentLink(linkId: string): Promise<BookingRow | null> {
  const rows = await rest<BookingRow[]>(
    `bookings?stripe_payment_link_id=eq.${encodeURIComponent(linkId)}&select=*`
  );
  return rows?.[0] ?? null;
}

/**
 * Records a settled payment. Only moves the booking to `paid` — never backwards —
 * and is safe to run twice, because Stripe retries webhooks.
 */
export async function markBookingPaid(
  id: string,
  paymentIntent: string,
  amountPaid: number
): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "paid",
      stripe_payment_intent: paymentIntent,
      amount_paid: amountPaid,
      paid_at: new Date().toISOString(),
    }),
  });
}
