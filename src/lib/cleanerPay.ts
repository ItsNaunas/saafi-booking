// What a cleaner earns per hour, by job type — the split the 2026-09-01
// meeting asked for ("differentiate between deep clean hours and standard
// cleaning hours so we know in terms of pay"), which also settled the open
// question of whether cleaners see money in their portal: they asked for a
// balance, so they do.
//
// Standard was £15/h, the costing sheet's cleaner-pay line (2026-08-18); deep
// £21/h is the labour rate the deep costing was walked through at on the
// 2026-09-01 call (2 cleaners × £21/h). Confirm both before the first real
// payroll run — these figures are what the portal SHOWS, not what anyone is
// paid by; paying stays a human decision.

//
// 2026-10-18 the office cut standard pay to £14/h ("change it from £15/hr to
// £14"), from Mon 19 Oct. Jobs before that keep £15, so last week's balance
// doesn't silently drop when the rate changes.

import type { BookingRow } from "./supabaseAdmin";

export const CLEANER_HOURLY = {
  standard: 14,
  deep: 21,
} as const;

/** Standard rates before the current one: [rate, applies to jobs dated before]. */
const EARLIER_STANDARD: [number, string][] = [[15, "2026-10-19"]];

function standardRate(date: string): number {
  for (const [rate, before] of EARLIER_STANDARD) if (date < before) return rate;
  return CLEANER_HOURLY.standard;
}

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
  let pounds = 0;
  for (const j of jobs) {
    const h = Number(j.actual_hours ?? 0);
    if (!Number.isFinite(h) || h <= 0) continue;
    if (j.service_type === "deep") {
      deepHours += h;
      pounds += h * CLEANER_HOURLY.deep;
    } else {
      standardHours += h;
      pounds += h * standardRate(j.preferred_date);
    }
  }
  standardHours = quarter(standardHours);
  deepHours = quarter(deepHours);
  const earned = Math.round(pounds * 100) / 100;
  return { standardHours, deepHours, earned };
}
