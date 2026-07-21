"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import {
  updateBookingStatus,
  updateBooking,
  insertBooking,
  updatePricingRow,
  addServiceAreaPrefix,
  removeServiceAreaPrefix,
  createCleaner,
  setCleanerActive,
  type BookingRow,
  type BookingStatus,
} from "@/lib/supabaseAdmin";
import { sendConfirmationEmail } from "@/lib/email";
import { invalidatePricingCache } from "@/lib/pricingServer";
import { FREQUENCY_DAYS, type Frequency } from "@/lib/pricing";

function newReference() {
  return `SAAFI-${Date.now().toString(36).toUpperCase()}`;
}

/** Recurring engine: a completed recurring clean books the next occurrence. */
async function spawnNextOccurrence(b: BookingRow) {
  if (b.frequency === "one_off" || !b.recurring_active) return;
  const days = FREQUENCY_DAYS[b.frequency as Exclude<Frequency, "one_off">];
  const next = new Date(b.preferred_date + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + days);
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
    hours: b.hours,
    customer_provides_products: b.customer_provides_products,
    addons: b.addons,
    addons_total: b.addons_total,
    frequency: b.frequency,
    series_id: b.series_id ?? b.id,
    recurring_active: true,
    cleaner_id: b.cleaner_id,
    quoted_price: b.quoted_price,
    preferred_date: next.toISOString().slice(0, 10),
    notes: b.notes,
    status: "confirmed",
  });
}

const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: ["paid"],
  paid: [],
  cancelled: ["requested"], // allow re-opening a cancelled request
};

export async function setBookingStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const from = String(formData.get("from") ?? "") as BookingStatus;
  const to = String(formData.get("to") ?? "") as BookingStatus;
  if (!id || !ALLOWED[from]?.includes(to)) return;

  const updated = await updateBookingStatus(id, to);

  // Confirmation email fires exactly on requested -> confirmed (best-effort).
  if (updated && to === "confirmed") {
    await sendConfirmationEmail(updated).catch((e) =>
      console.error("[admin] confirmation email failed:", e)
    );
  }
  // Completing a recurring clean books the next one automatically.
  if (updated && to === "completed") {
    await spawnNextOccurrence(updated).catch((e) =>
      console.error("[admin] recurring spawn failed:", e)
    );
  }
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
}

export async function stopRecurring(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, { recurring_active: false });
  revalidatePath("/admin");
}

export async function assignCleaner(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const cleanerId = String(formData.get("cleaner_id") ?? "");
  if (!id) return;
  await updateBooking(id, { cleaner_id: cleanerId || null });
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
}

export async function addCleaner(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  if (name.length < 2 || phone.length < 7) return;
  await createCleaner(name, phone, email);
  revalidatePath("/admin/cleaners");
}

export async function toggleCleaner(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  await setCleanerActive(id, active);
  revalidatePath("/admin/cleaners");
}

export async function createManualBooking(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("name");
  const phone = get("phone");
  const preferredDate = get("preferred_date");
  if (name.length < 2 || phone.length < 7 || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    redirect("/admin/new?error=1");
  }
  const hours = Math.max(0.5, Number(get("hours")) || 2);
  const price = Math.max(0, Number(get("price")) || 0);
  const frequency = (
    ["one_off", "weekly", "fortnightly", "four_weekly"].includes(get("frequency"))
      ? get("frequency")
      : "one_off"
  ) as Frequency;

  await insertBooking({
    reference: newReference(),
    customer_name: name,
    customer_email: get("email") || `${phone.replace(/\D/g, "")}@phone.saafi`,
    customer_phone: phone,
    address_line: get("address_line") || "—",
    postcode: get("postcode").toUpperCase().replace(/\s+/g, "") || "—",
    bedrooms: 0,
    bathrooms: 0,
    dining_rooms: 0,
    living_rooms: 0,
    hours,
    customer_provides_products: true,
    frequency,
    quoted_price: price,
    preferred_date: preferredDate,
    notes: get("notes") || null,
    status: "confirmed", // phone bookings arrive pre-agreed
  });
  redirect("/admin");
}

export async function editBooking(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const date = String(formData.get("preferred_date") ?? "");
  const hours = Number(formData.get("hours"));
  const price = Number(formData.get("quoted_price"));
  const notes = String(formData.get("notes") ?? "").trim();
  await updateBooking(id, {
    ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { preferred_date: date } : {}),
    ...(Number.isFinite(hours) && hours > 0 ? { hours } : {}),
    ...(Number.isFinite(price) && price >= 0 ? { quoted_price: price } : {}),
    notes: notes || null,
  } as Parameters<typeof updateBooking>[1]);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function savePricing(formData: FormData) {
  const keys = [
    "hourly_rate",
    "product_surcharge",
    "base_hours",
    "hours_per_bedroom",
    "hours_per_bathroom",
    "hours_per_dining_room",
    "hours_per_living_room",
    "min_hours",
    "max_hours",
    "discount_weekly_pct",
    "discount_fortnightly_pct",
    "discount_four_weekly_pct",
  ];
  for (const key of keys) {
    const raw = formData.get(key);
    if (raw === null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) continue;
    await updatePricingRow(key, value);
  }
  invalidatePricingCache();
  revalidatePath("/admin/pricing");
  revalidatePath("/quote");
}

export async function addServiceArea(formData: FormData) {
  const prefix = String(formData.get("prefix") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{1,2}\d{0,2}$/.test(prefix)) return;
  await addServiceAreaPrefix(prefix);
  invalidatePricingCache();
  revalidatePath("/admin/pricing");
}

export async function removeServiceArea(formData: FormData) {
  const prefix = String(formData.get("prefix") ?? "");
  if (!prefix) return;
  await removeServiceAreaPrefix(prefix);
  invalidatePricingCache();
  revalidatePath("/admin/pricing");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
