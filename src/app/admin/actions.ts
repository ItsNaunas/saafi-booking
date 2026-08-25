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
  updateAddon,
  addServiceAreaPrefix,
  removeServiceAreaPrefix,
  createCleaner,
  listCleaners,
  setCleanerActive,
  updateCleanerHours,
  getBooking,
  getAdjustment,
  setAdjustmentStatus,
  amountDueFor,
  saveBookingPaymentLink,
  markPaymentLinkSent,
  type BookingStatus,
} from "@/lib/supabaseAdmin";
import { getStripe, toPence, siteUrl } from "@/lib/stripe";
import { sendConfirmationEmail, sendAdjustmentEmail, sendPaymentLinkEmail, sendCleanerAssignedEmail } from "@/lib/email";
import { invalidatePricingCache } from "@/lib/pricingServer";
import { type Frequency } from "@/lib/pricing";
import { newReference, spawnNextOccurrence } from "@/lib/recurring";
import { toMinutes, toHHMM } from "@/lib/scheduling";

const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_access"],
  completed: ["paid"],
  paid: [],
  cancelled: ["requested"], // allow re-opening a cancelled request
  // A wasted journey is unresolved, not finished. The office decides which it
  // becomes: cancelled and nobody pays, or completed and something is charged.
  no_access: ["cancelled", "completed", "confirmed"],
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
  const updated = await updateBooking(id, { cleaner_id: cleanerId || null });

  // Tell them. Until this existed a cleaner found out they had a job only by
  // opening their link and noticing something new sitting there.
  if (updated && cleanerId) {
    const cleaner = (await listCleaners()).find((c) => c.id === cleanerId);
    if (cleaner) {
      await sendCleanerAssignedEmail(cleaner, updated).catch((e) =>
        console.error("[admin] cleaner assignment email failed:", e)
      );
    }
  }

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
  // The owner books over the top of availability on purpose — a phone booking is
  // already agreed with the customer, so this records the time, it doesn't police it.
  const startMinutes = toMinutes(get("start_time"));
  const startTime = startMinutes === null ? null : toHHMM(startMinutes);
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
    start_time: startTime,
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
  // An empty time field is meaningful — it puts the job back to "needs a slot".
  const startMinutes = toMinutes(String(formData.get("start_time") ?? ""));
  await updateBooking(id, {
    ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { preferred_date: date } : {}),
    ...(Number.isFinite(hours) && hours > 0 ? { hours } : {}),
    ...(Number.isFinite(price) && price >= 0 ? { quoted_price: price } : {}),
    start_time: startMinutes === null ? null : toHHMM(startMinutes),
    notes: notes || null,
  } as Parameters<typeof updateBooking>[1]);
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
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

export async function saveAddon(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  if (!key) return;
  const label = String(formData.get("label") ?? "").trim();
  const price = Number(formData.get("price"));
  const hours = Number(formData.get("hours"));
  const fields = {
    ...(label.length >= 2 ? { label } : {}),
    ...(Number.isFinite(price) && price >= 0 ? { price } : {}),
    active: formData.get("active") === "on",
  };
  try {
    await updateAddon(key, {
      ...fields,
      ...(Number.isFinite(hours) && hours >= 0 ? { hours } : {}),
    });
  } catch {
    // `hours` column not migrated yet — save the rest rather than erroring
    await updateAddon(key, fields);
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

/* ---------- price adjustments ---------- */

/**
 * Owner approves a cleaner's proposed price change.
 * This is the only path that can raise what a customer pays, and it is the only
 * path that emails them about it.
 */
export async function approveAdjustment(formData: FormData) {
  const id = String(formData.get("adjustment_id") ?? "");
  if (!id) return;

  const adj = await getAdjustment(id);
  if (!adj || adj.status !== "pending") return;
  const booking = await getBooking(adj.booking_id);
  if (!booking) return;

  await setAdjustmentStatus(id, "approved");
  await updateBooking(adj.booking_id, {
    final_price: Number(adj.to_price),
    price_status: "agreed",
  });

  await sendAdjustmentEmail(booking, adj).catch((e) =>
    console.error("[admin] adjustment email failed:", e)
  );

  revalidatePath("/admin");
  revalidatePath(`/admin/booking/${adj.booking_id}`);
}

/** Owner says no — the original quote stands and the customer hears nothing. */
export async function rejectAdjustment(formData: FormData) {
  const id = String(formData.get("adjustment_id") ?? "");
  if (!id) return;

  const adj = await getAdjustment(id);
  if (!adj || adj.status !== "pending") return;
  const booking = await getBooking(adj.booking_id);
  if (!booking) return;

  await setAdjustmentStatus(id, "rejected");
  await updateBooking(adj.booking_id, {
    final_price: Number(booking.quoted_price),
    price_status: "agreed",
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/booking/${adj.booking_id}`);
}


/**
 * Raises a Stripe Payment Link for a booking so the admin can send it to the
 * customer. Reuses an existing link rather than creating a second one for the
 * same job — two live links for one clean is how you get paid twice.
 */
export async function createPaymentLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const booking = await getBooking(id);
  if (!booking) return;

  // Already has one, or already settled — nothing to do.
  if (booking.stripe_payment_link_url || booking.status === "paid") return;

  const stripe = getStripe();
  if (!stripe) {
    console.error("[stripe] createPaymentLink called but STRIPE_SECRET_KEY is missing");
    return;
  }

  const amount = amountDueFor(booking);
  if (!(amount > 0)) {
    console.error(`[stripe] refusing to raise a link for ${booking.reference}: amount is ${amount}`);
    return;
  }

  const price = await stripe.prices.create({
    currency: "gbp",
    unit_amount: toPence(amount),
    product_data: { name: `Clean on ${booking.preferred_date} — ${booking.reference}` },
  });

  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { booking_id: booking.id, reference: booking.reference },
    after_completion: {
      type: "redirect",
      redirect: { url: `${siteUrl()}/paid?ref=${encodeURIComponent(booking.reference)}` },
    },
  });

  await saveBookingPaymentLink(booking.id, link.id, link.url);
  revalidatePath(`/admin/booking/${booking.id}`);
  revalidatePath("/admin");
}

/* ---------- scheduling ---------- */

/** A cleaner's working pattern — what the availability engine offers customers. */
export async function updateCleanerSchedule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const days = formData
    .getAll("works_days")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  const from = toMinutes(String(formData.get("works_from") ?? ""));
  const to = toMinutes(String(formData.get("works_to") ?? ""));
  // A backwards or zero-length day would make every slot vanish with no clue why.
  if (from === null || to === null || to <= from) return;

  await updateCleanerHours(id, days, toHHMM(from), toHHMM(to));
  revalidatePath("/admin/cleaners");
}

/**
 * Email the customer their payment link.
 *
 * Separate from raising the link on purpose. Creating a link is reversible and
 * private; sending one is neither, so the owner gets to see the amount on screen
 * before anything reaches a customer — and can still send it over WhatsApp
 * instead, which some customers prefer.
 */
export async function emailPaymentLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const booking = await getBooking(id);
  if (!booking) return;
  if (booking.status === "paid") redirect(`/admin/booking/${id}?sent=already-paid`);

  const result = await sendPaymentLinkEmail(booking, amountDueFor(booking));
  if (!result.ok) {
    redirect(`/admin/booking/${id}?sent=fail&why=${encodeURIComponent(result.reason ?? "")}`);
  }

  await markPaymentLinkSent(id);
  revalidatePath(`/admin/booking/${id}`);
  redirect(`/admin/booking/${id}?sent=ok`);
}
