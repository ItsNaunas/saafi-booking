// Server-only Supabase data layer for the admin CRM (secret key, full access).
// Plain PostgREST fetches — no client SDK needed. Never import from client components.

export type BookingStatus = "requested" | "confirmed" | "completed" | "paid" | "cancelled";

export type Frequency = "one_off" | "weekly" | "fortnightly" | "four_weekly";

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
  notes: string | null;
  status: BookingStatus;
  created_at: string;
};

export type CleanerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  token: string;
  active: boolean;
  created_at: string;
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
  const key = process.env.SUPABASE_SECRET_KEY;
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
      | "hours"
      | "quoted_price"
      | "notes"
      | "status"
      | "cleaner_id"
      | "frequency"
      | "recurring_active"
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
    `bookings?cleaner_id=eq.${encodeURIComponent(cleanerId)}&status=in.(confirmed,completed)&select=*&order=preferred_date.asc`
  );
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
