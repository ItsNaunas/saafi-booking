// Server-only Supabase data layer for the admin CRM (secret key, full access).
// Plain PostgREST fetches — no client SDK needed. Never import from client components.
import { secret } from "./env";

import type { ReasonCode } from "./adjustments";
import { busyFromBooking, type BusyBlock, type SchedulableCleaner } from "./scheduling";
import type { OutcomeReason } from "./outcomes";

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "completed"
  | "paid"
  | "cancelled"
  /** Turned up, could not do it. Not a decision about money — the office resolves it. */
  | "no_access";

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
  /** 'standard' | 'deep' — optional so the app runs before the migration lands. */
  service_type?: "standard" | "deep";
  cleaners_needed?: number;
  /** Deep cleans only: why the customer says the house needs one. */
  deep_reason?: string | null;
  /** One GPS fix at start and finish — a stamp, not a track. */
  started_lat?: number | null;
  started_lng?: number | null;
  finished_lat?: number | null;
  finished_lng?: number | null;
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
  /** When the link was emailed. Null = never emailed (may still have gone by hand). */
  payment_link_sent_at: string | null;
  /** Pounds the current payment link was raised for — stale-link detection.
   *  Optional so the app runs before supabase/2026-08-28-upgrades.sql lands. */
  payment_link_amount?: number | null;
  /** Money returned to the customer. Optional pre-migration. */
  refunded_at?: string | null;
  refund_amount?: number | null;
  /** Daily-notify sent-markers — see supabase/2026-08-28-upgrades.sql. */
  reminder_sent_at?: string | null;
  payment_chased_at?: string | null;
  /** Cleaner tapped "Got it" on the assignment. Null = no proof they know. */
  acknowledged_at?: string | null;
  /** Why a visit did not happen. Null on every normal booking. */
  outcome_reason: OutcomeReason | null;
  outcome_note: string | null;
  /** Automatic charge against a saved card. Null until one is tried. */
  charge_attempted_at: string | null;
  charge_error: string | null;
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
  // Card on file (2026-08-25 migration). Handles only — Stripe holds the card,
  // so there is nothing here worth stealing.
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_saved_at: string | null;
};

function creds() {
  const url = process.env.SUPABASE_URL;
  const key = secret("SUPABASE_SECRET_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY not configured");
  return { url, key };
}

// Retry on the failures that are the platform's, not ours: a 502/503/504 from
// the gateway (free-tier Supabase does this on a cold path — it took the
// cleaner portal down twice on 2026-09-13), a dropped connection, a timeout.
// Never on POST: an insert that actually landed would land twice. PATCH and
// DELETE here are idempotent by construction (filtered by id, fixed body).
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const REST_TIMEOUT_MS = 12_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rest<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const { url, key } = creds();
  const method = (init?.method ?? "GET").toUpperCase();
  const canRetry = method !== "POST" && attempt < 2;
  const backoff = () => sleep(400 * 2 ** attempt);

  let res: Response;
  try {
    res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
  } catch (e) {
    if (canRetry) {
      await backoff();
      return rest<T>(path, init, attempt + 1);
    }
    throw e;
  }
  if (!res.ok) {
    if (RETRYABLE_STATUS.has(res.status) && canRetry) {
      await backoff();
      return rest<T>(path, init, attempt + 1);
    }
    throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  }
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
      // Contact details, editable per booking: a customer correcting a phone
      // number or a move mid-series edits the job, not history. The customers
      // table row is matched by email at insert time and left alone here.
      | "customer_name"
      | "customer_phone"
      | "customer_email"
      | "address_line"
      | "postcode"
      | "recurring_active"
      | "quoted_hours"
      | "actual_hours"
      | "final_price"
      | "price_status"
      | "started_at"
      | "finished_at"
      | "started_lat"
      | "started_lng"
      | "finished_lat"
      | "finished_lng"
      | "outcome_reason"
      | "outcome_note"
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
  // Active team first, deactivated cleaners sink to the bottom (Dulla,
  // 2026-09-03) — within each group, oldest first as before.
  return rest<CleanerRow[]>("cleaners?select=*&order=active.desc,created_at.asc");
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
  // no_access included so a reported wasted journey doesn't just vanish from
  // the cleaner's portal — they get a receipt that the office has it.
  return rest<BookingRow[]>(
    `bookings?cleaner_id=eq.${encodeURIComponent(cleanerId)}&status=in.(confirmed,completed,no_access)&select=*&order=preferred_date.asc,start_time.asc.nullslast`
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

// What a booking owes lives in lib/money.ts — one source of truth shared with
// the email layer, so the figure in an email can never drift from the charge.
export {
  amountDueFor,
  agreedPriceFor,
  isPaidInFull,
  isPartPaid,
  paidSoFar,
  grossPaidFor,
  refundedFor,
  overpaidBy,
} from "./money";

export async function saveBookingPaymentLink(
  id: string,
  linkId: string,
  url: string,
  amount: number
): Promise<void> {
  const base = { stripe_payment_link_id: linkId, stripe_payment_link_url: url };
  try {
    await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...base, payment_link_amount: amount }),
    });
  } catch {
    // payment_link_amount not migrated yet — the link still has to be saved,
    // stale-detection just can't work until the column exists.
    await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(base),
    });
  }
}

/** Forget the current link (it has been deactivated or superseded on Stripe). */
export async function clearBookingPaymentLink(id: string): Promise<void> {
  const base = { stripe_payment_link_id: null, stripe_payment_link_url: null };
  try {
    await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...base, payment_link_amount: null }),
    });
  } catch {
    await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(base),
    });
  }
}

export async function getBookingByReference(reference: string): Promise<BookingRow | null> {
  const rows = await rest<BookingRow[]>(
    `bookings?reference=eq.${encodeURIComponent(reference)}&select=*&limit=1`
  );
  return rows?.[0] ?? null;
}

/**
 * The same person booking the same visit within minutes is a retry, not a new
 * job — a network blip on the success response used to invite a duplicate
 * booking, a duplicate Stripe link and a duplicate pair of emails.
 */
export async function findRecentDuplicateBooking(
  email: string,
  preferredDate: string,
  minutes = 10
): Promise<BookingRow | null> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const rows = await rest<BookingRow[]>(
    `bookings?customer_email=eq.${encodeURIComponent(email)}` +
      `&preferred_date=eq.${encodeURIComponent(preferredDate)}` +
      `&created_at=gt.${encodeURIComponent(since)}&status=eq.requested&select=*&limit=1`
  );
  return rows?.[0] ?? null;
}

export async function getBookingByPaymentIntent(paymentIntent: string): Promise<BookingRow | null> {
  const rows = await rest<BookingRow[]>(
    `bookings?stripe_payment_intent=eq.${encodeURIComponent(paymentIntent)}&select=*&limit=1`
  );
  return rows?.[0] ?? null;
}

export async function getBookingByPaymentLink(linkId: string): Promise<BookingRow | null> {
  const rows = await rest<BookingRow[]>(
    `bookings?stripe_payment_link_id=eq.${encodeURIComponent(linkId)}&select=*`
  );
  return rows?.[0] ?? null;
}

/**
 * Records a settled payment on a FINISHED job. Moves the booking to `paid` —
 * the terminal "work done, money in" state — and is safe to run twice, because
 * Stripe retries webhooks. `amountPaid` is the running total, not this charge.
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

/**
 * Records money arriving on a job that is NOT finished — pay-at-booking, mostly.
 * Deliberately leaves `status` alone: a prepaid request still needs confirming,
 * a prepaid confirmed job still needs cleaning. The money fact lives in
 * `amount_paid`/`paid_at`; lib/money.ts reads it from there.
 */
export async function recordBookingPayment(
  id: string,
  paymentIntent: string,
  amountPaid: number
): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      stripe_payment_intent: paymentIntent,
      amount_paid: amountPaid,
      paid_at: new Date().toISOString(),
    }),
  });
}

/** A completed job whose money has fully arrived graduates to `paid`. */
export async function finaliseBookingPaid(id: string): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "paid" }),
  });
}

/** Money went back. Best-effort on the columns (they land with the upgrades migration). */
export async function recordBookingRefund(id: string, amount: number): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ refunded_at: new Date().toISOString(), refund_amount: amount }),
  });
}

/**
 * Webhook replay guard. True = first sighting, process it; false = seen before.
 * Errs on the side of processing: if the table is missing (pre-migration) or
 * unreachable, the handlers' own idempotency still holds.
 */
export async function recordStripeEvent(id: string, type: string): Promise<boolean> {
  try {
    const rows = await rest<{ id: string }[]>("stripe_events?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ id, type }),
    });
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return true;
  }
}

/* ---------- the daily notify cron's queries ---------- */

/** Confirmed cleans on `date` that have not had their day-before reminder. */
export async function listBookingsNeedingReminder(date: string): Promise<BookingRow[]> {
  return (
    (await rest<BookingRow[]>(
      `bookings?status=eq.confirmed&preferred_date=eq.${date}&reminder_sent_at=is.null&select=*`
    )) ?? []
  );
}

/**
 * Completed cleans whose payment link went out at least `days` ago, unpaid and
 * never chased. One nudge each, ever — the second chase is a phone call.
 */
export async function listBookingsNeedingChase(days: number): Promise<BookingRow[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  return (
    (await rest<BookingRow[]>(
      `bookings?status=eq.completed&stripe_payment_link_url=not.is.null` +
        `&payment_link_sent_at=lt.${encodeURIComponent(cutoff)}&payment_chased_at=is.null` +
        // Belt and braces: money may have arrived without the status moving
        // (a webhook hiccup) — never chase a customer whose payment landed.
        `&paid_at=is.null&select=*`
    )) ?? []
  );
}

/** Confirmed, cleaner-assigned jobs on `date` — the raw material of day-sheets. */
export async function listAssignedJobsOn(date: string): Promise<BookingRow[]> {
  return (
    (await rest<BookingRow[]>(
      `bookings?status=eq.confirmed&preferred_date=eq.${date}&cleaner_id=not.is.null&select=*&order=start_time.asc.nullslast`
    )) ?? []
  );
}

export async function markReminderSent(id: string): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }),
  });
}

export async function markPaymentChased(id: string): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ payment_chased_at: new Date().toISOString() }),
  });
}

export async function markPaymentLinkSent(id: string): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ payment_link_sent_at: new Date().toISOString() }),
  });
}

/**
 * Every booking in a recurring series, including the one that started it.
 *
 * The first booking of a series has no `series_id` — it *is* the series — so both
 * shapes have to be matched.
 */
export async function listSeriesBookings(seriesId: string): Promise<BookingRow[]> {
  const id = encodeURIComponent(seriesId);
  return rest<BookingRow[]>(
    `bookings?or=(id.eq.${id},series_id.eq.${id})&select=*&order=preferred_date.asc`
  );
}

/* ---------- card on file ---------- */

export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const rows = await rest<CustomerRow[]>(`customers?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  return rows[0] ?? null;
}

/** Find a customer by the email a booking carries, for rows predating customer_id. */
export async function getCustomerByEmail(email: string): Promise<CustomerRow | null> {
  const rows = await rest<CustomerRow[]>(
    `customers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*&limit=1`
  );
  return rows[0] ?? null;
}

export async function saveCustomerCard(
  id: string,
  fields: {
    stripe_customer_id: string;
    stripe_payment_method_id: string;
    card_brand: string | null;
    card_last4: string | null;
  }
): Promise<void> {
  await rest(`customers?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...fields, card_saved_at: new Date().toISOString() }),
  });
}

/** Which customer holds this saved card — for Stripe's "card removed" webhook. */
export async function getCustomerByPaymentMethod(pmId: string): Promise<CustomerRow | null> {
  const rows = await rest<CustomerRow[]>(
    `customers?stripe_payment_method_id=eq.${encodeURIComponent(pmId)}&select=*&limit=1`
  );
  return rows[0] ?? null;
}

/** The card is gone on Stripe's side — a stale handle here would decline forever. */
export async function clearCustomerCard(id: string): Promise<void> {
  await rest(`customers?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      stripe_payment_method_id: null,
      card_brand: null,
      card_last4: null,
      card_saved_at: null,
    }),
  });
}

/* ---------- cleaner-portal upgrades (2026-09-01 migration) ---------- */

export type IssueCategory = "breakage" | "supplies" | "customer_request" | "safety" | "other";

export type IssueRow = {
  id: string;
  booking_id: string;
  cleaner_id: string | null;
  category: IssueCategory;
  note: string | null;
  created_at: string;
};

export type TimeOffRow = {
  id: string;
  cleaner_id: string;
  from_date: string;
  to_date: string;
  note: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
  decided_at: string | null;
};

export type PhotoRow = {
  id: string;
  booking_id: string;
  cleaner_id: string | null;
  phase: "before" | "after";
  path: string;
  created_at: string;
};

/** The cleaner has seen the job. Best-effort pre-migration: failure is fine. */
export async function markBookingAcknowledged(id: string): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ acknowledged_at: new Date().toISOString() }),
  });
}

export async function insertBookingIssue(
  fields: Omit<IssueRow, "id" | "created_at">
): Promise<IssueRow | null> {
  const rows = await rest<IssueRow[]>("booking_issues", {
    method: "POST",
    body: JSON.stringify(fields),
  });
  return rows?.[0] ?? null;
}

export async function listIssuesForBooking(bookingId: string): Promise<IssueRow[]> {
  return rest<IssueRow[]>(
    `booking_issues?booking_id=eq.${encodeURIComponent(bookingId)}&select=*&order=created_at.desc`
  );
}

export async function insertTimeOffRequest(
  fields: Pick<TimeOffRow, "cleaner_id" | "from_date" | "to_date" | "note">
): Promise<TimeOffRow | null> {
  const rows = await rest<TimeOffRow[]>("cleaner_time_off", {
    method: "POST",
    body: JSON.stringify(fields),
  });
  return rows?.[0] ?? null;
}

export async function listTimeOffForCleaner(cleanerId: string): Promise<TimeOffRow[]> {
  return rest<TimeOffRow[]>(
    `cleaner_time_off?cleaner_id=eq.${encodeURIComponent(cleanerId)}&select=*&order=from_date.desc&limit=10`
  );
}

export async function listPendingTimeOff(): Promise<(TimeOffRow & { cleaners: { name: string } | null })[]> {
  return rest(
    "cleaner_time_off?status=eq.pending&select=*,cleaners(name)&order=created_at.asc"
  );
}

export async function setTimeOffStatus(
  id: string,
  status: "approved" | "denied"
): Promise<TimeOffRow | null> {
  const rows = await rest<TimeOffRow[]>(`cleaner_time_off?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, decided_at: new Date().toISOString() }),
  });
  return rows?.[0] ?? null;
}

/** Cleaner ids on APPROVED leave covering `date` — the rota treats them as absent. */
export async function listCleanersOnLeave(date: string): Promise<Set<string>> {
  const d = encodeURIComponent(date);
  const rows = await rest<{ cleaner_id: string }[]>(
    `cleaner_time_off?status=eq.approved&from_date=lte.${d}&to_date=gte.${d}&select=cleaner_id`
  );
  return new Set(rows.map((r) => r.cleaner_id));
}

export async function insertBookingPhoto(
  fields: Omit<PhotoRow, "id" | "created_at">
): Promise<void> {
  await rest("booking_photos", { method: "POST", body: JSON.stringify(fields) });
}

export async function listPhotosForBooking(bookingId: string): Promise<PhotoRow[]> {
  return rest<PhotoRow[]>(
    `booking_photos?booking_id=eq.${encodeURIComponent(bookingId)}&select=*&order=created_at.asc`
  );
}

/**
 * Undo support: any not-yet-decided adjustments from a finish that is being
 * unwound. Marked rejected rather than deleted — the trail survives.
 */
export async function voidOpenAdjustments(bookingId: string): Promise<void> {
  await rest(
    `booking_adjustments?booking_id=eq.${encodeURIComponent(bookingId)}&status=in.(pending,auto)`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected", decided_at: new Date().toISOString() }),
    }
  );
}

/** Record how an automatic charge went, successful or not. */
export async function recordChargeAttempt(id: string, error: string | null): Promise<void> {
  await rest(`bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ charge_attempted_at: new Date().toISOString(), charge_error: error }),
  });
}
