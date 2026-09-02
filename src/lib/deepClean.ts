// Deep clean pricing — a different animal to the standard clean.
//
// Standard is hourly: time × rate, discounted for frequency. Deep is flat-rate
// per room type, from SAAFI's costing sheet (Pricing tab, 2026-08-27 read):
//
//   first room of a type      £58
//   each additional of it     +£5      (family decision 2026-08-27: intentional,
//                                       kept although it prices below cost)
//   extras                    £58 flat each
//   labour                    2 cleaners at £21/hr each
//   room time                 60 man-minutes per room
//   3rd cleaner               when elapsed time would exceed 6 hours
//
// The sheet's own worked example is asserted in scripts/pricing-check.ts:
// 3 bed, 1 bath, corridor, kitchen + windows + laundry = £358.
//
// Kitchen (incl. oven) and corridor/landing/common areas are always included,
// exactly like the standard clean's baseHours.

export type DeepRoomCounts = {
  bedrooms: number;
  bathrooms: number;
  /** Living and dining rooms price here — they are deep-clean only. */
  livingRooms: number;
  diningRooms: number;
  /** Offices / studies — the sheet's "additional room". */
  additionalRooms: number;
};

export const deepConfig = {
  /** £ for the first room of each type. */
  firstRoomPrice: 58,
  /** £ for every additional room of the same type. */
  additionalRoomPrice: 5,
  /** £ per extra (windows, laundry, dusting, fridge) — flat, not hourly. */
  extraPrice: 58,
  /** Man-minutes per room, flat across types (see the 60/75 note below). */
  minutesPerRoom: 60,
  /** A deep clean is always staffed in pairs. */
  baseCleaners: 2,
  /** A job that would keep the pair longer than this gains a third cleaner. */
  maxElapsedHours: 6,
};

/**
 * Deep extras. Deliberately NOT the standard addons table: these bill flat at
 * £58, not by time. Oven is absent because the sheet's deep baseline row is
 * "Kitchen + Oven" — offering it again as a £58 extra would charge the same
 * oven twice. (The sheet lists it in both places; flagged with SAAFI.)
 */
export const DEEP_EXTRAS = [
  { key: "windows", label: "Inside windows" },
  { key: "laundry", label: "Laundry" },
  { key: "dusting", label: "Detailed dusting" },
  { key: "fridge", label: "Inside the fridge" },
] as const;

export type DeepExtraKey = (typeof DEEP_EXTRAS)[number]["key"];

/**
 * Why the house needs a deep clean — the fallback when no walkthrough
 * video/photos are attached (2026-09-01 meeting: proof is preferred, a reason
 * is the floor; neither means no booking). Keys are what the DB stores.
 */
export const DEEP_REASONS = [
  { key: "end_of_tenancy", label: "Moving out — end of tenancy" },
  { key: "moving_in", label: "Just moved in" },
  { key: "post_renovation", label: "After building or decorating work" },
  { key: "needs_reset", label: "It's been a while — needs a proper going-over" },
  { key: "other", label: "Something else" },
] as const;

export type DeepReasonKey = (typeof DEEP_REASONS)[number]["key"];

export const DEEP_REASON_LABEL: Record<string, string> = Object.fromEntries(
  DEEP_REASONS.map((r) => [r.key, r.label])
);

/** £ for one room type: first at £58, the rest at £5 each. Zero rooms cost zero. */
function typePrice(count: number, cfg = deepConfig): number {
  if (count <= 0) return 0;
  return cfg.firstRoomPrice + (count - 1) * cfg.additionalRoomPrice;
}

/**
 * The whole job. Kitchen and corridor are always one each — a home has them
 * whether or not the form asks.
 */
export function deepPrice(
  rooms: DeepRoomCounts,
  extras: DeepExtraKey[] = [],
  cfg = deepConfig,
): number {
  const roomTotal =
    typePrice(rooms.bedrooms, cfg) +
    typePrice(rooms.bathrooms, cfg) +
    typePrice(rooms.livingRooms, cfg) +
    typePrice(rooms.diningRooms, cfg) +
    typePrice(rooms.additionalRooms, cfg) +
    typePrice(1, cfg) + // kitchen + oven
    typePrice(1, cfg); // corridor / landing / common areas
  return roomTotal + extras.length * cfg.extraPrice;
}

/**
 * Total man-minutes. 60 per room flat: the sheet's "+1 bedroom = 75" is
 * contradicted by its own worked example (3 bedrooms = 200 mins, not 210) and
 * by its £126 labour figure, so the flat 60 that two of its four data points
 * support is used until SAAFI time real jobs. The £58 price carries the margin
 * at either figure — this number feeds the diary, not the bill.
 */
export function deepMinutes(
  rooms: DeepRoomCounts,
  extras: DeepExtraKey[] = [],
  cfg = deepConfig,
): number {
  const roomCount =
    rooms.bedrooms +
    rooms.bathrooms +
    rooms.livingRooms +
    rooms.diningRooms +
    rooms.additionalRooms +
    2; // kitchen + corridor
  return (roomCount + extras.length) * cfg.minutesPerRoom;
}

/** 2 cleaners, or 3 when the pair would be there past the elapsed ceiling. */
export function deepCleaners(manMinutes: number, cfg = deepConfig): number {
  const elapsedWithPair = manMinutes / cfg.baseCleaners / 60;
  return elapsedWithPair > cfg.maxElapsedHours ? cfg.baseCleaners + 1 : cfg.baseCleaners;
}

/** Hours on site, rounded up to the half hour — this is what the diary blocks out. */
export function deepElapsedHours(manMinutes: number, cfg = deepConfig): number {
  const cleaners = deepCleaners(manMinutes, cfg);
  return Math.ceil((manMinutes / cleaners / 60) * 2) / 2;
}
