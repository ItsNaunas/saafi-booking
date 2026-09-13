import type { BookingStatus } from "./supabaseAdmin";

/**
 * Which status a booking may move to from where it is. One table, read by
 * both the automated flow (Confirm / Complete / Mark paid buttons, the
 * webhook, the cleaner's Finish tap) and the office's manual control on the
 * booking page — so "by hand" can never reach a state the machine couldn't.
 *
 * Guards that need data (money in blocks a plain cancel; a future date blocks
 * complete) live in setBookingStatus, not here — this is only the shape.
 */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_access"],
  completed: ["paid"],
  // Escape hatch for a booking that reached `paid` while the work was still
  // outstanding (the pre-2026-08-28 webhook did this to every prepaid
  // booking): push it back into the flow. Its money survives in amount_paid.
  paid: ["confirmed"],
  cancelled: ["requested"], // allow re-opening a cancelled request
  // A wasted journey is unresolved, not finished. The office decides which it
  // becomes: cancelled and nobody pays, or completed and something is charged.
  no_access: ["cancelled", "completed", "confirmed"],
};
