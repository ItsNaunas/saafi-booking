// Deep clean pricing — a different animal to the standard clean.
//
// Standard is hourly: time × rate, discounted for frequency. Deep is a flat
// £235 minimum with escalating per-room additions — Dulla's spec, WhatsApp
// group 2026-09-03, which SUPERSEDES the costing sheet's per-room-type model:
//
//   minimum deep clean        £235     (1 bed, 1 bath, kitchen + oven,
//                                       hallways/landings — the base house)
//   each additional room      £57 + £5 per room already added:
//                             room 2 = £62, room 3 = £67, room 4 = £72…
//                             one running sequence across ALL room kinds
//                             ("the same for kitchen living room and rest
//                             of the toggles")
//   extras                    £58 flat each (unchanged — not in Dulla's spec)
//   labour                    2 cleaners at £21/hr each
//   room time                 60 man-minutes per room
//   3rd cleaner               when elapsed time would exceed 6 hours
//
// The time figures feed the diary ONLY. Dulla, same message: "The time taken
// for a deep clean should NOT be visible for a consumer to see" — nothing
// customer-facing may show deep-clean hours or an end time.
//
// Worked examples asserted in scripts/pricing-check.ts:
//   1 bed 1 bath                     = £235
//   3 bed 1 bath                     = £235 + 62 + 67 = £364
//   3 bed 1 bath + windows + laundry = £480

export type DeepRoomCounts = {
  bedrooms: number;
  bathrooms: number;
  /** Living and dining rooms price here — they are deep-clean only. */
  livingRooms: number;
  diningRooms: number;
  /** Offices / studies and the like. */
  additionalRooms: number;
};

export const deepConfig = {
  /** £ minimum — the 1 bed / 1 bath house, kitchen and hallways included. */
  basePrice: 235,
  /** Additional room n costs this… */
  additionalRoomBase: 57,
  /** …plus this × n: £62, £67, £72 and so on. */
  additionalRoomStep: 5,
  /** £ per extra (windows, laundry, dusting, fridge) — flat, not hourly. */
  extraPrice: 58,
  /** Man-minutes per room, flat across types — diary only, never billed. */
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
 * Why the house needs a deep clean — compulsory on the deep tab (family
 * request, 2026-09-13). It is the one thing that tells the office what they
 * are sending a pair of cleaners into before they confirm it, on a job priced
 * by room count rather than by the state of the place.
 *
 * Keys are what the DB stores; labels are what the customer and the office
 * both read, so the two can never drift apart.
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

/**
 * Rooms beyond the £235 base house (which already covers one bedroom, one
 * bathroom, the kitchen and the hallways). Every kind of room joins the same
 * escalating sequence — a 2nd bathroom and a living room cost £62 and £67,
 * whichever order you count them in.
 */
function additionalRoomCount(rooms: DeepRoomCounts): number {
  return (
    Math.max(0, rooms.bedrooms - 1) +
    Math.max(0, rooms.bathrooms - 1) +
    rooms.livingRooms +
    rooms.diningRooms +
    rooms.additionalRooms
  );
}

/**
 * The whole job: £235 minimum, then room n at £57 + £5n (£62, £67, £72…),
 * extras flat on top. A studio never drops below the base — £235 is a floor,
 * not a formula.
 */
export function deepPrice(
  rooms: DeepRoomCounts,
  extras: DeepExtraKey[] = [],
  cfg = deepConfig,
): number {
  const k = additionalRoomCount(rooms);
  // Σ i=1..k of (base + step·i) = base·k + step·k(k+1)/2
  const additions = cfg.additionalRoomBase * k + (cfg.additionalRoomStep * k * (k + 1)) / 2;
  return cfg.basePrice + additions + extras.length * cfg.extraPrice;
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
