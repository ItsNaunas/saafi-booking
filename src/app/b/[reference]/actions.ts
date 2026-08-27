"use server";

// Customer self-serve actions — authenticated by the signed link token, never
// a session. Every action re-verifies the token and re-reads the booking, the
// same trust model as the cleaner portal.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyBookingToken, cancellationRoute } from "@/lib/bookingLink";
import {
  getBookingByReference,
  updateBookingStatus,
  isPaidInFull,
  listCleaners,
  type BookingRow,
} from "@/lib/supabaseAdmin";
import { raiseBookingPaymentLink, deactivatePaymentLink } from "@/lib/paymentLink";
import {
  sendBookingCancelledEmail,
  sendCleanerJobChangedEmail,
  sendOpsAlertEmail,
} from "@/lib/email";

async function authed(formData: FormData): Promise<BookingRow | null> {
  const reference = String(formData.get("reference") ?? "");
  const token = String(formData.get("t") ?? "");
  if (!reference || !verifyBookingToken(reference, token)) return null;
  return getBookingByReference(reference);
}

function back(b: BookingRow, token: string, flag?: string): never {
  redirect(`/b/${encodeURIComponent(b.reference)}?t=${token}${flag ? `&${flag}` : ""}`);
}

/**
 * "Pay for this clean" — raises (or reuses) the payment link and sends the
 * customer straight to Stripe. A POST action rather than a link on the page so
 * that merely viewing the page — including email scanners prefetching it —
 * never creates Stripe objects.
 */
export async function customerPayNow(formData: FormData) {
  const booking = await authed(formData);
  const token = String(formData.get("t") ?? "");
  if (!booking) return;
  if (booking.status === "cancelled" || isPaidInFull(booking)) back(booking, token);

  const url = await raiseBookingPaymentLink(booking);
  if (!url) back(booking, token, "pay=unavailable");
  redirect(url!);
}

export async function customerCancelBooking(formData: FormData) {
  const booking = await authed(formData);
  const token = String(formData.get("t") ?? "");
  if (!booking) return;
  if (cancellationRoute(booking) !== "self") back(booking, token, "cancel=call");

  const updated = await updateBookingStatus(booking.id, "cancelled");
  if (!updated) back(booking, token, "cancel=fail");

  await deactivatePaymentLink(updated!).catch(() => {});
  await sendBookingCancelledEmail(updated!).catch(() => {});
  await sendOpsAlertEmail({
    subject: `Customer cancelled ${booking.reference}`,
    heading: "A customer cancelled their clean online",
    lines: [
      `${booking.customer_name} cancelled their ${booking.preferred_date} clean themselves from the booking page.`,
    ],
  }).catch(() => {});
  if (updated!.cleaner_id) {
    const cleaner = (await listCleaners()).find((c) => c.id === updated!.cleaner_id);
    if (cleaner) {
      await sendCleanerJobChangedEmail(cleaner, updated!, "cancelled").catch(() => {});
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  back(updated!, token, "cancel=done");
}

/**
 * Reschedule stays a request, not a direct write: moving a job touches the
 * rota, the cleaner and sometimes the price, and those calls are the office's.
 * The customer states what they'd like; the office rings back and moves it.
 */
export async function customerRequestReschedule(formData: FormData) {
  const booking = await authed(formData);
  const token = String(formData.get("t") ?? "");
  if (!booking) return;
  if (!["requested", "confirmed"].includes(booking.status)) back(booking, token);

  const wanted = String(formData.get("new_date") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wanted)) back(booking, token, "move=baddate");

  await sendOpsAlertEmail({
    subject: `Reschedule request — ${booking.reference}`,
    heading: "A customer wants to move their clean",
    lines: [
      `${booking.customer_name} (${booking.customer_phone}) asked to move their ${booking.preferred_date} clean to around ${wanted}.`,
      note ? `Their note: "${note}"` : "No note added.",
      "Ring them to agree the new slot, then move it from the booking page.",
    ],
  }).catch(() => {});

  back(booking, token, "move=sent");
}
