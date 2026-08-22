// Price adjustments — a visit that ran longer or shorter than quoted.
//
// The rule that shapes everything here: a customer pays more only when the JOB
// was bigger than booked (extra rooms, worse state, something added on the day).
// If the clean simply took the cleaner longer, that is the business's cost and
// the price does not move.

import { quotePrice, type PricingConfig, type Frequency } from "./pricing";

export type ReasonCode =
  | "extra_rooms"
  | "worse_condition"
  | "customer_added"
  | "access_delay"
  | "cleaner_pace";

/** What the cleaner picks on their phone. `chargeable` decides if money moves. */
export const REASONS: { code: ReasonCode; label: string; chargeable: boolean }[] = [
  { code: "extra_rooms", label: "More rooms than booked", chargeable: true },
  { code: "worse_condition", label: "Much dirtier than described", chargeable: true },
  { code: "customer_added", label: "Customer asked for extra on the day", chargeable: true },
  { code: "access_delay", label: "Waiting to get in / no access", chargeable: false },
  { code: "cleaner_pace", label: "Just took me longer", chargeable: false },
];

export function isReasonCode(v: string): v is ReasonCode {
  return REASONS.some((r) => r.code === v);
}

export function isChargeable(code: ReasonCode): boolean {
  return REASONS.find((r) => r.code === code)?.chargeable ?? false;
}

export function reasonLabel(code: ReasonCode): string {
  return REASONS.find((r) => r.code === code)?.label ?? code;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Nearest 15 minutes — the finest granularity anyone should bill a clean at. */
export function roundQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

/** Elapsed hours between two ISO timestamps, to the nearest 15 minutes. */
export function elapsedHours(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return roundQuarter(ms / 3_600_000);
}

/** £/h for this booking with the recurring discount already applied. */
export function effectiveHourlyRate(cfg: PricingConfig, frequency: Frequency): number {
  const pct = cfg.discounts[frequency] ?? 0;
  return round2(cfg.hourlyRate * (1 - pct / 100));
}

export type AdjustmentInput = {
  quotedHours: number;
  actualHours: number;
  quotedPrice: number;
  frequency: Frequency;
  customerProvidesProducts: boolean;
  addonsTotal: number;
  cfg: PricingConfig;
};

/**
 * Final price for a visit that ran `actualHours` instead of `quotedHours`.
 *
 * Priced as a delta on the agreed quote rather than a fresh quote, for two
 * reasons: extras are flat-priced and must never be re-charged hourly, and
 * "one extra hour at £25" is a number the customer can check themselves.
 *
 * Floors at the minimum callout charge so a 20-minute job never bills as 20p.
 */
export function adjustedPrice(i: AdjustmentInput): number {
  const delta = roundQuarter(i.actualHours - i.quotedHours);
  const raw = i.quotedPrice + delta * effectiveHourlyRate(i.cfg, i.frequency);
  const floor = quotePrice(
    i.cfg.minHours,
    i.customerProvidesProducts,
    i.cfg,
    i.frequency,
    i.addonsTotal
  );
  return round2(Math.max(floor, raw));
}

export type AdjustmentOutcome = {
  deltaHours: number;
  newPrice: number;
  chargeable: boolean;
  /** 'none' = quote stands · 'auto' = applied without asking · 'pending' = needs the family's yes */
  resolution: "none" | "auto" | "pending";
};

/**
 * Decide what happens when a cleaner finishes a job.
 *
 * - Ran to time            -> nothing to do.
 * - Ran short              -> price drops automatically. Nobody needs to approve a refund.
 * - Ran long, billable     -> proposal for the family to approve. Never silent.
 * - Ran long, not billable -> logged so the family sees it, price untouched.
 */
export function resolveAdjustment(i: AdjustmentInput, reason: ReasonCode | null): AdjustmentOutcome {
  const deltaHours = roundQuarter(i.actualHours - i.quotedHours);
  if (deltaHours === 0) {
    return { deltaHours: 0, newPrice: i.quotedPrice, chargeable: false, resolution: "none" };
  }
  if (deltaHours < 0) {
    return {
      deltaHours,
      newPrice: adjustedPrice(i),
      chargeable: false,
      resolution: "auto",
    };
  }
  const chargeable = reason ? isChargeable(reason) : false;
  return {
    deltaHours,
    newPrice: chargeable ? adjustedPrice(i) : i.quotedPrice,
    chargeable,
    resolution: chargeable ? "pending" : "auto",
  };
}
