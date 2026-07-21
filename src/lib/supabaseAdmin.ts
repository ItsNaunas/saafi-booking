// Server-only Supabase data layer for the admin CRM (secret key, full access).
// Plain PostgREST fetches — no client SDK needed. Never import from client components.

export type BookingStatus = "requested" | "confirmed" | "completed" | "paid" | "cancelled";

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
  quoted_price: number;
  preferred_date: string;
  notes: string | null;
  status: BookingStatus;
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
