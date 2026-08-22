"use server";

// Cleaner actions — authenticated by the cleaner's personal token, NOT the admin session.

import { revalidatePath } from "next/cache";
import {
  getCleanerByToken,
  getBooking,
  updateBooking,
  insertAdjustment,
} from "@/lib/supabaseAdmin";
import { loadPricingConfig } from "@/lib/pricingServer";
import { spawnNextOccurrence } from "@/lib/recurring";
import {
  elapsedHours,
  isReasonCode,
  resolveAdjustment,
  roundQuarter,
  type ReasonCode,
} from "@/lib/adjustments";

/** Booking the cleaner is allowed to touch right now, or null. */
async function ownConfirmedJob(token: string, bookingId: string) {
  const cleaner = await getCleanerByToken(token);
  if (!cleaner || !bookingId) return null;
  const booking = await getBooking(bookingId);
  if (!booking || booking.cleaner_id !== cleaner.id || booking.status !== "confirmed") return null;
  return { cleaner, booking };
}

/** Tapped on arrival — starts the clock. */
export async function cleanerStartJob(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const found = await ownConfirmedJob(token, bookingId);
  if (!found || found.booking.started_at) return;

  await updateBooking(bookingId, { started_at: new Date().toISOString() });
  revalidatePath(`/c/${token}`);
}

/**
 * Tapped when the job is done. Works out the real length, decides whether the
 * price moves, and completes the booking.
 *
 * The cleaner never sets a price. They report time and a reason; the rules in
 * lib/adjustments decide what that means for the bill.
 */
export async function cleanerFinishJob(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const found = await ownConfirmedJob(token, bookingId);
  if (!found) return;
  const { cleaner, booking } = found;

  const finishedAt = new Date().toISOString();
  const quotedHours = Number(booking.quoted_hours ?? booking.hours);

  // Prefer what the cleaner confirmed on screen; fall back to the timer.
  const typed = Number(formData.get("actual_hours"));
  const timed = booking.started_at ? elapsedHours(booking.started_at, finishedAt) : 0;
  const actualHours =
    Number.isFinite(typed) && typed > 0 ? roundQuarter(typed) : timed > 0 ? timed : quotedHours;

  const rawReason = String(formData.get("reason_code") ?? "");
  // An unreadable reason must never bill the customer, so fall back to the
  // non-chargeable one rather than guessing.
  const reason: ReasonCode | null = isReasonCode(rawReason)
    ? rawReason
    : actualHours > quotedHours
      ? "cleaner_pace"
      : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const cfg = await loadPricingConfig();
  const input = {
    quotedHours,
    actualHours,
    quotedPrice: Number(booking.quoted_price),
    frequency: booking.frequency,
    customerProvidesProducts: booking.customer_provides_products,
    addonsTotal: Number(booking.addons_total ?? 0),
    cfg,
  };
  const outcome = resolveAdjustment(input, reason);

  await updateBooking(bookingId, {
    status: "completed",
    actual_hours: actualHours,
    finished_at: finishedAt,
    quoted_hours: quotedHours,
    // A proposal leaves the money unsettled until the owner decides.
    ...(outcome.resolution === "pending"
      ? { price_status: "pending" as const }
      : { price_status: "agreed" as const, final_price: outcome.newPrice }),
  });

  if (outcome.resolution !== "none" && reason) {
    await insertAdjustment({
      booking_id: bookingId,
      from_hours: quotedHours,
      to_hours: actualHours,
      from_price: Number(booking.quoted_price),
      to_price: outcome.newPrice,
      reason_code: reason,
      note,
      chargeable: outcome.chargeable,
      cleaner_id: cleaner.id,
      status: outcome.resolution === "pending" ? "pending" : "auto",
    }).catch((e) => console.error("[cleaner] adjustment log failed:", e));
  }

  // The series carries on from the original quote, not from today's actuals.
  await spawnNextOccurrence(booking).catch((e) =>
    console.error("[cleaner] recurring spawn failed:", e)
  );

  revalidatePath(`/c/${token}`);
  revalidatePath("/admin");
}
