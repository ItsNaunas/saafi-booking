"use server";

// Cleaner actions — authenticated by the cleaner's personal token, NOT the admin session.

import { revalidatePath } from "next/cache";
import { sendAdjustmentPendingEmail, sendVisitFailedEmail } from "@/lib/email";
import {
  getCleanerByToken,
  getBooking,
  updateBooking,
  insertAdjustment,
} from "@/lib/supabaseAdmin";
import { autoInvoiceIfUnpaid } from "@/lib/paymentLink";
import { loadPricingConfig } from "@/lib/pricingServer";
import { spawnNextOccurrence } from "@/lib/recurring";
import {
  elapsedHours,
  isReasonCode,
  resolveAdjustment,
  roundQuarter,
  type ReasonCode,
} from "@/lib/adjustments";
import { isOutcomeReason } from "@/lib/outcomes";
import { settleBookingWithSavedCard } from "@/lib/cardOnFile";

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

  await updateBooking(bookingId, {
    started_at: new Date().toISOString(),
    ...gpsStamp(formData, "started"),
  });
  revalidatePath(`/c/${token}`);
}

/**
 * The optional start/finish location fix. Absent, denied or malformed all
 * collapse to "no stamp" — location is evidence, never a gate on working.
 */
function gpsStamp(formData: FormData, prefix: "started" | "finished") {
  const lat = Number(formData.get(`${prefix}_lat`));
  const lng = Number(formData.get(`${prefix}_lng`));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return {};
  return { [`${prefix}_lat`]: lat, [`${prefix}_lng`]: lng };
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
    ...gpsStamp(formData, "finished"),
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

    // Pending means money is waiting on the owner. Nothing used to chase it.
    if (outcome.resolution === "pending") {
      await sendAdjustmentPendingEmail(
        booking,
        {
          from_hours: quotedHours,
          to_hours: actualHours,
          from_price: Number(booking.quoted_price),
          to_price: outcome.newPrice,
          reason_code: reason,
          note,
        },
        cleaner.name
      ).catch((e) => console.error("[cleaner] approval alert failed:", e));
    }
  }

  // The series carries on from the original quote, not from today's actuals.
  await spawnNextOccurrence(booking).catch((e) =>
    console.error("[cleaner] recurring spawn failed:", e)
  );

  // If the price needed no argument and there is a card on file, the clean pays
  // for itself the moment the cleaner walks out. A pending adjustment stops this
  // on its own — nothing is charged before the owner has agreed the figure.
  if (outcome.resolution !== "pending") {
    const settled = await getBooking(bookingId);
    if (settled) {
      const r = await settleBookingWithSavedCard(settled).catch((e) => {
        console.error("[cleaner] automatic charge threw:", e);
        return { ok: false as const, reason: "could not be attempted" };
      });
      if (!r.ok) {
        console.log(`[cleaner] ${settled.reference} not auto-charged — ${r.reason}`);
        // No card on file: the "your clean is done" email carries the payment
        // link out by itself, instead of the job sitting unbilled until the
        // office remembers. Best-effort — the manual send button remains.
        await autoInvoiceIfUnpaid(settled.id);
      }
    }
  }

  revalidatePath(`/c/${token}`);
  revalidatePath("/admin");
}

/**
 * Tapped when the visit cannot happen at all.
 *
 * Deliberately separate from finishing. Finishing with zero hours used to be the
 * only way to record a wasted journey, and it quietly repriced the job down to
 * the two-hour minimum as though the clean had simply gone quickly — the cleaner
 * appeared to have done it fast, and nobody found out otherwise.
 *
 * This records what happened and stops. It sets no price and completes nothing:
 * whether a locked door is chargeable is SAAFI's policy, and the office resolves
 * it from the booking page.
 */
export async function cleanerCannotDoJob(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const found = await ownConfirmedJob(token, bookingId);
  if (!found) return;
  const { cleaner, booking } = found;

  const raw = String(formData.get("outcome_reason") ?? "");
  if (!isOutcomeReason(raw)) return;
  const note = String(formData.get("outcome_note") ?? "").trim() || null;

  // The office hearing about this is the part that matters — a cleaner is stood
  // outside a door right now and somebody may still be able to fix it. So the
  // alert goes first and independently of the write: if the database is having a
  // bad moment, the worst case is a status nobody updated, not a silent failure
  // that leaves the cleaner waiting and the office none the wiser.
  await sendVisitFailedEmail(booking, raw, note, cleaner.name).catch((e) =>
    console.error("[cleaner] wasted journey alert failed:", e)
  );

  try {
    await updateBooking(bookingId, {
      status: "no_access",
      outcome_reason: raw,
      outcome_note: note,
      finished_at: new Date().toISOString(),
    });
  } catch (e) {
    // Also the pre-migration case: the status constraint and the outcome columns
    // arrive with 2026-08-25-visit-outcomes.sql.
    console.error("[cleaner] could not record the wasted journey:", e);
  }

  revalidatePath(`/c/${token}`);
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
}
