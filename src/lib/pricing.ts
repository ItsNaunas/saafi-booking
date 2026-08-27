// Pricing engine — config-driven so rates change without deploys.
//
// Rates from SAAFI's costing sheet (2026-08-18, supersedes the 2026-07-29 spec doc):
// cleaner pay £15/h; customer pays £24/h one-off, £21.75/h recurring. Both of the
// sheet's worked examples reconcile exactly (1 bed 1 bath = £48 / £43.50;
// 3 bed 1 bath + windows + laundry = £87 recurring) and are asserted in
// scripts/pricing-check.ts.
//
// Mirrors the `pricing_config` table; DB values override these.

export const pricingConfig = {
  currency: "GBP",
  /** £ per hour, one-off (costing sheet 2026-08-18) */
  hourlyRate: 24,
  /**
   * Charged when SAAFI supply the cleaning products.
   *
   * £5 per the 2026-08-25 review. Note this was contested on that call: the
   * operational worry is a cleaner arriving to no products, which the
   * compulsory choice on the quote form solves on its own. £5 on a £43.50
   * fortnightly clean is 11.5% sitting at the last step before booking, for
   * what is likely £1-2 of consumables.
   *
   * Set to 0 to keep the compulsory question and drop the charge — nothing
   * else has to change.
   */
  productSurcharge: 5,
  /** kitchen (30m) + corridor/landing/stairs (30m) — always included */
  baseHours: 1,
  /**
   * Sheet: 30 mins each.
   *
   * Living and dining rooms are DELIBERATELY absent. The costing sheet only
   * itemises them under deep clean, and Abdullah confirmed it on the 2026-08-25
   * call: "living rooms and dining rooms, this is only for deep clean, for this
   * standard clean the living rooms and dining rooms doesn't need to be."
   *
   * A standard clean is bedrooms + bathrooms on top of the kitchen and common
   * areas in `baseHours`. Adding a living room here would quietly re-price
   * every standard quote.
   */
  hoursPerRoom: {
    bedroom: 0.5,
    bathroom: 0.5,
    /**
     * Zero, not removed. The keys stay because RoomCounts, the bookings API and
     * the dining_rooms/living_rooms columns all still carry them, and a deep
     * clean WILL price them (60m each). Zeroing is the pricing change; ripping
     * the fields out would be a schema migration for no gain.
     */
    diningRoom: 0,
    livingRoom: 0,
  },
  minHours: 2,
  maxHours: 8,
  /**
   * Outward-code prefixes served, e.g. ["IG", "RM", "E"].
   * Empty = accept any valid UK postcode (until SAAFI supply their service area).
   */
  serviceAreaPrefixes: [] as string[],
  /**
   * % off the clean (not flat-priced add-ons) for recurring frequencies.
   * £21.75 against £24 = 9.375% off. The sheet only prices one recurring
   * frequency, so all three are assumed equal pending SAAFI confirmation.
   */
  discounts: {
    one_off: 0,
    weekly: 9.375,
    fortnightly: 9.375,
    four_weekly: 9.375,
  },
  /**
   * Booking-window rules. Not prices, but they live in `pricing_config` and load
   * through the same 60s cache and static fallback, so they sit here too.
   * The engine that uses them is lib/scheduling.ts.
   */
  scheduling: {
    /** Granularity of the times offered to a customer, in minutes. */
    slotMinutes: 30,
    /** Least notice a customer may give, in hours. */
    leadTimeHours: 24,
    /** How far ahead the calendar opens, in days. */
    maxDaysAhead: 60,
  },
};

export type Frequency = "one_off" | "weekly" | "fortnightly" | "four_weekly";

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  one_off: "One-off",
  weekly: "Weekly",
  fortnightly: "Every 2 weeks",
  four_weekly: "Every 4 weeks",
};

export const FREQUENCY_DAYS: Record<Exclude<Frequency, "one_off">, number> = {
  weekly: 7,
  fortnightly: 14,
  four_weekly: 28,
};

/**
 * Extras are billed as TIME: `hours` is added to the visit and charged at the
 * hourly rate (costing sheet 2026-08-18 — its 3-bed example folds windows and
 * laundry into the 240-minute total with no separate charge).
 *
 * `price` is a flat amount on top, kept at 0 for every current extra. It exists
 * so a future fixed-fee extra still works without reshaping the engine.
 */
export type Addon = { key: string; label: string; price: number; hours: number };

/** Total time the selected extras add to the job. */
export function addonsHours(addons: Addon[]): number {
  return Math.round(addons.reduce((s, a) => s + a.hours, 0) * 4) / 4;
}

export type PricingConfig = typeof pricingConfig;

export type RoomCounts = {
  bedrooms: number;
  bathrooms: number;
  diningRooms: number;
  livingRooms: number;
};

/** Recommended clean length, rounded to the nearest half hour, clamped 2–8h. */
export function recommendedHours(rooms: RoomCounts, cfg: PricingConfig = pricingConfig): number {
  const raw =
    cfg.baseHours +
    rooms.bedrooms * cfg.hoursPerRoom.bedroom +
    rooms.bathrooms * cfg.hoursPerRoom.bathroom +
    rooms.diningRooms * cfg.hoursPerRoom.diningRoom +
    rooms.livingRooms * cfg.hoursPerRoom.livingRoom;
  const rounded = Math.round(raw * 2) / 2;
  return clampHours(rounded, cfg);
}

export function clampHours(hours: number, cfg: PricingConfig = pricingConfig): number {
  return Math.min(cfg.maxHours, Math.max(cfg.minHours, hours));
}

/**
 * Quote in £ for a visit of `hours` — that is BILLABLE hours: the clean itself
 * plus any time the chosen extras add.
 *
 * Floors at the minimum callout charge. Deliberately no upper cap: `maxHours`
 * limits what the wizard will *recommend*, but a genuinely long job must bill
 * for the time it actually takes.
 */
export function quotePrice(
  hours: number,
  customerProvidesProducts: boolean,
  cfg: PricingConfig = pricingConfig,
  frequency: Frequency = "one_off",
  addonsTotal = 0
): number {
  const h = Math.max(cfg.minHours, hours);
  const base = h * cfg.hourlyRate + (customerProvidesProducts ? 0 : cfg.productSurcharge);
  const pct = cfg.discounts[frequency] ?? 0;
  // discount applies to the clean itself, not the add-ons
  const discounted = base * (1 - pct / 100);
  return Math.round((discounted + addonsTotal) * 100) / 100;
}

export function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function normalisePostcode(pc: string): string {
  return pc.trim().toUpperCase().replace(/\s+/g, "");
}

/** Loose UK postcode shape check (offline fallback for postcodes.io). */
export function looksLikeUkPostcode(pc: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(normalisePostcode(pc));
}

/** Prefix match on the outward code's leading letters. Empty config list = serve everywhere. */
export function inServiceArea(postcode: string, cfg: PricingConfig = pricingConfig): boolean {
  if (cfg.serviceAreaPrefixes.length === 0) return true;
  const norm = normalisePostcode(postcode);
  return cfg.serviceAreaPrefixes.some((p) => norm.startsWith(p.toUpperCase()));
}

/** "1 hr 30", "30 min" — how long an extra adds to a visit. */
export function formatDuration(hours: number): string {
  const mins = Math.round(hours * 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m}` : `${h} hr`;
}

