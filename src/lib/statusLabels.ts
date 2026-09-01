// Single source of truth for how a booking status reads and colours in the
// admin. Pipeline and calendar used to keep their own copies that had quietly
// drifted apart (confirmed was blue-500 on one page, sky-400 on the other) —
// one divergence away from the office reading the same status two colours.
import type { BookingStatus } from "./supabaseAdmin";

export const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  confirmed: "Booked in",
  completed: "Cleaned",
  paid: "Paid",
  cancelled: "Cancelled",
  no_access: "Couldn't get in",
};

export const STATUS_DOT: Record<BookingStatus, string> = {
  requested: "bg-amber-400",
  confirmed: "bg-sky-500",
  completed: "bg-violet-400",
  paid: "bg-brand-500",
  no_access: "bg-rose-400",
  cancelled: "bg-slate-300",
};
