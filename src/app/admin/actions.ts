"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import {
  updateBookingStatus,
  updatePricingRow,
  addServiceAreaPrefix,
  removeServiceAreaPrefix,
  type BookingStatus,
} from "@/lib/supabaseAdmin";
import { sendConfirmationEmail } from "@/lib/email";
import { invalidatePricingCache } from "@/lib/pricingServer";

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
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
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
