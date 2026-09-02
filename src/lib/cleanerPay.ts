// What a cleaner earns per hour, by job type — the split the 2026-09-01
// meeting asked for ("differentiate between deep clean hours and standard
// cleaning hours so we know in terms of pay"), which also settled the open
// question of whether cleaners see money in their portal: they asked for a
// balance, so they do.
//
// Standard £15/h is the costing sheet's cleaner-pay line (2026-08-18); deep
// £21/h is the labour rate the deep costing was walked through at on the
// 2026-09-01 call (2 cleaners × £21/h). Confirm both before the first real
// payroll run — these figures are what the portal SHOWS, not what anyone is
// paid by; paying stays a human decision.

import type { BookingRow } from "./supabaseAdmin";

export const CLEANER_HOURLY = {
  standard: 15,
  deep: 21,
} as const;

export type WorkedSplit = {
  standardHours: number;
  deepHours: number;
  /** £ at the rates above. */
  earned: number;
};

const quarter = (n: number) => Math.round(n * 4) / 4;

/** Split a set of finished jobs into standard/deep hours and the £ they add up to. */
export function workedSplit(jobs: BookingRow[]): WorkedSplit {
  let standardHours = 0;
  let deepHours = 0;
  for (const j of jobs) {
    const h = Number(j.actual_hours ?? 0);
    if (!Number.isFinite(h) || h <= 0) continue;
    if (j.service_type === "deep") deepHours += h;
    else standardHours += h;
  }
  standardHours = quarter(standardHours);
  deepHours = quarter(deepHours);
  const earned =
    Math.round((standardHours * CLEANER_HOURLY.standard + deepHours * CLEANER_HOURLY.deep) * 100) /
    100;
  return { standardHours, deepHours, earned };
}
