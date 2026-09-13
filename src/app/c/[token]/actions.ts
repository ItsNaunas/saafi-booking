"use server";

// Cleaner actions — authenticated by the cleaner's personal token, NOT the admin session.

import { revalidatePath } from "next/cache";
import { sendAdjustmentPendingEmail, sendVisitFailedEmail } from "@/lib/email";
import {
  getCleanerByToken,
  getBooking,
  updateBooking,
  insertAdjustment,
  markBookingAcknowledged,
  insertBookingIssue,
  insertTimeOffRequest,
  insertBookingPhoto,
  voidOpenAdjustments,
  paidSoFar,
  type IssueCategory,
} from "@/lib/supabaseAdmin";
import { deactivatePaymentLink } from "@/lib/paymentLink";
import { uploadJobPhoto, ensurePhotoBucket } from "@/lib/storage";
import { ISSUE_LABEL } from "@/lib/statusLabels";
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
import { smsCustomerRunningLate } from "@/lib/sms";
import type { BookingRow } from "@/lib/supabaseAdmin";

/** On the job as the cleaner, or as the second cleaner on a deep clean. */
const isOnJob = (b: BookingRow, cleanerId: string) =>
  b.cleaner_id === cleanerId || b.second_cleaner_id === cleanerId;

/** Booking the cleaner is allowed to touch right now, or null. */
async function ownConfirmedJob(token: string, bookingId: string) {
  const cleaner = await getCleanerByToken(token);
  if (!cleaner || !bookingId) return null;
  const booking = await getBooking(bookingId);
  if (!booking || !isOnJob(booking, cleaner.id) || booking.status !== "confirmed") return null;
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
    // The alert email above already went, so the office knows about the visit —
    // but they must also know the booking itself never changed, or the rota
    // shows a job that everyone believes is closed.
    console.error("[cleaner] could not record the wasted journey:", e);
    const { sendOpsAlertEmail } = await import("@/lib/email");
    await sendOpsAlertEmail({
      subject: `⚠ Wasted journey NOT saved — ${booking.reference}`,
      heading: "A visit was reported as impossible but the booking didn't update",
      lines: [
        `${cleaner.name} reported ${booking.reference} as a visit that couldn't happen, but writing that to the booking failed.`,
        "The booking still shows as confirmed — resolve it by hand from the booking page.",
      ],
    }).catch(() => {});
  }

  revalidatePath(`/c/${token}`);
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
}

/* ------------------------------------------------------------------ *
 *  Cleaner-portal upgrades (2026-09-01)
 * ------------------------------------------------------------------ */

/** Like ownConfirmedJob but for any status in `allowed` — undo needs completed. */
async function ownJob(token: string, bookingId: string, allowed: string[]) {
  const cleaner = await getCleanerByToken(token);
  if (!cleaner || !bookingId) return null;
  const booking = await getBooking(bookingId);
  if (!booking || !isOnJob(booking, cleaner.id) || !allowed.includes(booking.status)) return null;
  return { cleaner, booking };
}

/** "Got it" — the office finally gets proof the assignment was seen. */
export async function cleanerAcknowledgeJob(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const found = await ownJob(token, bookingId, ["confirmed"]);
  if (!found) return;
  // Best-effort pre-migration: a missing column must not break the button.
  // Two cleaners, two taps: record this one's, not the other's.
  const who = found.booking.cleaner_id === found.cleaner.id ? "primary" : "second";
  await markBookingAcknowledged(bookingId, who).catch((e) =>
    console.error("[cleaner] could not record acknowledgment:", e)
  );
  revalidatePath(`/c/${token}`);
  revalidatePath("/admin");
}

/** One tap tells the customer and the office — no phone call to dread. */
export async function cleanerRunningLate(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const minutes = Number(formData.get("minutes"));
  if (![15, 30, 45].includes(minutes)) return;
  const found = await ownJob(token, bookingId, ["confirmed"]);
  if (!found) return;

  const { sendRunningLateEmails } = await import("@/lib/email");
  await sendRunningLateEmails(found.booking, found.cleaner.name, minutes).catch((e) =>
    console.error("[cleaner] running-late emails failed:", e)
  );
  // The customer is watching the clock, not their inbox.
  await smsCustomerRunningLate(found.booking, found.cleaner.name, minutes).catch(() => {});
  revalidatePath(`/c/${token}`);
}

// Labels live in lib/statusLabels so the admin page reads the same words.

/**
 * A mid-job problem gets a home without ending the job. The email goes first
 * and independently of the write, same rule as the wasted-journey report:
 * the office hearing about it is the part that matters.
 */
export async function cleanerReportIssue(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const category = String(formData.get("category") ?? "");
  if (!(category in ISSUE_LABEL)) return;
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  const found = await ownJob(token, bookingId, ["confirmed", "completed"]);
  if (!found) return;

  const { sendIssueReportEmail } = await import("@/lib/email");
  await sendIssueReportEmail(
    found.booking,
    found.cleaner.name,
    ISSUE_LABEL[category],
    note
  ).catch((e) => console.error("[cleaner] issue email failed:", e));

  await insertBookingIssue({
    booking_id: bookingId,
    cleaner_id: found.cleaner.id,
    category: category as IssueCategory,
    note,
  }).catch((e) => console.error("[cleaner] issue insert failed (pre-migration?):", e));

  revalidatePath(`/c/${token}`);
}

/** How long after Finish a mistake can still be self-corrected. */
const UNDO_WINDOW_MS = 15 * 60 * 1000;

/**
 * Undo a Finish tapped in error, within 15 minutes and only while no money
 * has moved. Puts the job back to confirmed with the clock still running,
 * voids the finish's undecided adjustments, and kills any invoice link the
 * auto-invoice already raised — the stale-link machinery mints a correct one
 * on the real finish.
 */
export async function cleanerUndoFinish(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const found = await ownJob(token, bookingId, ["completed"]);
  if (!found) return;
  const { booking, cleaner } = found;

  if (paidSoFar(booking) > 0) return; // money moved — the office untangles it
  if (!booking.finished_at) return;
  if (Date.now() - new Date(booking.finished_at).getTime() > UNDO_WINDOW_MS) return;

  await voidOpenAdjustments(bookingId).catch(() => {});
  await deactivatePaymentLink(booking).catch(() => {});
  await updateBooking(bookingId, {
    status: "confirmed",
    finished_at: null,
    actual_hours: null,
    final_price: null,
    price_status: "quoted",
  });

  const { sendOpsAlertEmail } = await import("@/lib/email");
  await sendOpsAlertEmail({
    subject: `Finish undone — ${booking.reference}`,
    heading: "A cleaner undid a finish to correct a mistake",
    lines: [
      `${cleaner.name} undid their finish on ${booking.reference} within the 15-minute window. The job is back in progress and will be finished again properly.`,
      "Any 'clean completed' email the customer just received will be superseded by the corrected one.",
    ],
  }).catch(() => {});

  revalidatePath(`/c/${token}`);
  revalidatePath("/admin");
}

/** Days off requested from the phone; the office decides from /admin/cleaners. */
export async function cleanerRequestTimeOff(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const cleaner = await getCleanerByToken(token);
  if (!cleaner) return;

  const from = String(formData.get("from_date") ?? "");
  const to = String(formData.get("to_date") ?? "") || from;
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return;
  if (to < from) return;

  const row = await insertTimeOffRequest({
    cleaner_id: cleaner.id,
    from_date: from,
    to_date: to,
    note,
  }).catch((e) => {
    console.error("[cleaner] time-off insert failed (pre-migration?):", e);
    return null;
  });

  if (row) {
    const { sendTimeOffRequestEmail } = await import("@/lib/email");
    await sendTimeOffRequestEmail(cleaner.name, from, to, note).catch(() => {});
  }
  revalidatePath(`/c/${token}`);
}

/**
 * Before/after photos from the phone camera. Optional by deliberate default —
 * whether they become required is the family's call. Capped and validated
 * here because the input is a phone in the field, not a trusted client.
 */
export async function cleanerUploadPhotos(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const phase = String(formData.get("phase") ?? "");
  if (phase !== "before" && phase !== "after") return;
  const found = await ownJob(token, bookingId, ["confirmed", "completed"]);
  if (!found) return;

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return;

  try {
    await ensurePhotoBucket();
    // A handful per tap is plenty; 8MB each keeps phone photos in and abuse out.
    for (const file of files.slice(0, 6)) {
      if (file.size > 8 * 1024 * 1024) continue;
      const type = file.type || "image/jpeg";
      if (!type.startsWith("image/")) continue;
      const ext = type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const path = `${bookingId}/${phase}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      await uploadJobPhoto(path, await file.arrayBuffer(), type);
      await insertBookingPhoto({
        booking_id: bookingId,
        cleaner_id: found.cleaner.id,
        phase,
        path,
      }).catch((e) => console.error("[cleaner] photo row insert failed:", e));
    }
  } catch (e) {
    console.error("[cleaner] photo upload failed:", e);
  }
  revalidatePath(`/c/${token}`);
}
