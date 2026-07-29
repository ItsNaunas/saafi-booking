// Pricing engine — config-driven so rates change without deploys.
// Rates from the client spec doc (2026-07-29): £25/h one-off, £22.50/h recurring.
// Mirrors the `pricing_config` table; DB values override these once Supabase is wired.

export const pricingConfig = {
  currency: "GBP",
  /** £ per hour (spec doc 2026-07-29) */
  hourlyRate: 25,
  /** flat £ surcharge when SAAFI bring the products — PLACEHOLDER */
  productSurcharge: 6,
  /** kitchen + lounge + common areas (hallways, landings) — always included */
  baseHours: 1.5,
  hoursPerRoom: {
    bedroom: 0.5,
    bathroom: 0.75,
    diningRoom: 0.5,
    livingRoom: 0.5,
  },
  minHours: 2,
  maxHours: 8,
  /**
   * Outward-code prefixes served, e.g. ["IG", "RM", "E"].
   * Empty = accept any valid UK postcode (until SAAFI supply their service area).
   */
  serviceAreaPrefixes: [] as string[],
  /**
   * % off the clean (not add-ons) for recurring frequencies.
   * Spec doc prices all recurring at £22.50/h = 10% off £25. Four-weekly isn't
   * in the doc — assumed the same rate, pending SAAFI confirmation.
   */
  discounts: {
    one_off: 0,
    weekly: 10,
    fortnightly: 10,
    four_weekly: 10,
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
 * An extra's `price` is flat and covers its own labour (never charged at the
 * hourly rate); `hours` extends the job's duration for scheduling.
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

/** Quote in £ for a clean of `hours`, products either the customer's or SAAFI's. */
export function quotePrice(
  hours: number,
  customerProvidesProducts: boolean,
  cfg: PricingConfig = pricingConfig,
  frequency: Frequency = "one_off",
  addonsTotal = 0
): number {
  const h = clampHours(hours, cfg);
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
