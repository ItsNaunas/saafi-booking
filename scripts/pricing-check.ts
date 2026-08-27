// Quick assertion harness for the pricing engine: `npx tsx scripts/pricing-check.ts`
import {
  recommendedHours,
  quotePrice,
  clampHours,
  addonsHours,
  inServiceArea,
  looksLikeUkPostcode,
  pricingConfig,
} from "../src/lib/pricing";
import {
  adjustedPrice,
  resolveAdjustment,
  isChargeable,
  elapsedHours,
} from "../src/lib/adjustments";
import {
  deepPrice,
  deepMinutes,
  deepCleaners,
  deepElapsedHours,
} from "../src/lib/deepClean";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${actual}, expected ${expected}`);
}

// Living and dining rooms price at zero on a standard clean (costing sheet
// itemises them under deep clean only), so the same house is 3.5h, not 4.5h.
check("rec 3bed/2bath: base 1h + 1.5 + 1", recommendedHours({ bedrooms: 3, bathrooms: 2, diningRooms: 0, livingRooms: 0 }), 3.5);
check("living/dining add nothing to a standard clean", recommendedHours({ bedrooms: 3, bathrooms: 2, diningRooms: 1, livingRooms: 1 }), 3.5);
check("rec studio clamps up", recommendedHours({ bedrooms: 0, bathrooms: 0, diningRooms: 0, livingRooms: 0 }), 2);
check("rec mansion clamps down", recommendedHours({ bedrooms: 10, bathrooms: 5, diningRooms: 2, livingRooms: 3 }), 8);
check("price 2h own products", quotePrice(2, true), 48);
// SAAFI supplying products is +£5 (2026-08-25 review). quotePrice's second arg
// is customerProvidesProducts, so `false` means we bring them.
check("price 8h, we bring products (+£5)", quotePrice(8, false), 197);
check("price 8h, customer's own products", quotePrice(8, true), 192);
check("product surcharge is flat, not per hour", quotePrice(2, false) - quotePrice(2, true), 5);
check("long jobs bill their real time, no 8h cap", quotePrice(10, true), 240);

// === SAAFI costing sheet 2026-08-18: the two worked examples are the ground truth ===
// 1 bed 1 bath = 120 mins (kitchen 30 + corridor 30 + bedroom 30 + bathroom 30)
const oneBedHours = recommendedHours({ bedrooms: 1, bathrooms: 1, diningRooms: 0, livingRooms: 0 });
check("sheet: 1 bed 1 bath = 2h", oneBedHours, 2);
check("sheet: 1 bed 1 bath one-off = £48", quotePrice(oneBedHours, true, undefined, "one_off", 0), 48);
check("sheet: 1 bed 1 bath recurring = £43.50", quotePrice(oneBedHours, true, undefined, "weekly", 0), 43.5);

// 3 bed 1 bath + windows (30m) + laundry (30m) = 240 mins, recurring £87
const threeBedHours = recommendedHours({ bedrooms: 3, bathrooms: 1, diningRooms: 0, livingRooms: 0 });
check("sheet: 3 bed 1 bath = 3h before extras", threeBedHours, 3);
check(
  "sheet: 3 bed 1 bath + windows + laundry recurring = £87",
  quotePrice(threeBedHours + 0.5 + 0.5, true, undefined, "weekly", 0),
  87
);
check("sheet: same job one-off = £96", quotePrice(threeBedHours + 1, true, undefined, "one_off", 0), 96);
check("clamp low", clampHours(1), 2);
check("clamp high", clampHours(9), 8);
check("postcode IG1 1AA", looksLikeUkPostcode("IG1 1AA"), true);
check("postcode SW1A 2AA", looksLikeUkPostcode("SW1A 2AA"), true);
check("postcode BANANA", looksLikeUkPostcode("BANANA"), false);
check("service area (empty cfg)", inServiceArea("IG1 1AA"), true);

// Tier A: frequency discounts + add-ons
check("weekly 9.375% = £21.75/h: 3h own products", quotePrice(3, true, undefined, "weekly", 0), 65.25);
check("flat addon skips the discount", quotePrice(3, true, undefined, "weekly", 40), 105.25);
check("fortnightly £21.75/h: 2h", quotePrice(2, true, undefined, "fortnightly", 0), 43.5);
check("one_off £24/h", quotePrice(2, true, undefined, "one_off", 0), 48);
check("flat addon added on top", quotePrice(2, true, undefined, "one_off", 25), 73);

// 2026-07-29: extras add time (price stays flat)
check(
  "addonsHours sums extras time",
  addonsHours([
    { key: "oven", label: "Oven", price: 25, hours: 1 },
    { key: "fridge", label: "Fridge", price: 15, hours: 0.5 },
  ]),
  1.5
);

// 2026-08-20: price adjustments (job ran longer or shorter than quoted)
// Quote baseline: 3h one-off, own products = £75.
const q3 = quotePrice(3, true, undefined, "one_off", 0);
check("baseline 3h one-off", q3, 72);

const base = {
  quotedHours: 3,
  quotedPrice: q3,
  frequency: "one_off" as const,
  customerProvidesProducts: true,
  addonsTotal: 0,
  cfg: pricingConfig,
};

check("ran to time -> no change", adjustedPrice({ ...base, actualHours: 3 }), 72);
check("+1h at £24 -> £96", adjustedPrice({ ...base, actualHours: 4 }), 96);
check("+30m at £24 -> £84", adjustedPrice({ ...base, actualHours: 3.5 }), 84);
check("ran 1h short -> £48", adjustedPrice({ ...base, actualHours: 2 }), 48);
check(
  "never below the 2h minimum charge",
  adjustedPrice({ ...base, actualHours: 0.5 }),
  quotePrice(2, true, undefined, "one_off", 0)
);

// Recurring bills the extra time at the discounted rate, not the headline rate.
const qw3 = quotePrice(3, true, undefined, "weekly", 0);
check("weekly +1h at £21.75 -> £87", adjustedPrice({
  ...base, quotedPrice: qw3, frequency: "weekly", actualHours: 4,
}), 87);

// Extras are flat-priced, so an overrun must not re-charge them hourly.
const qAddon = quotePrice(3, true, undefined, "one_off", 25);
check("baseline 3h + £25 flat extra", qAddon, 97);
check("+1h with a flat extra -> £121 (extra not re-charged)", adjustedPrice({
  ...base, quotedPrice: qAddon, addonsTotal: 25, actualHours: 4,
}), 121);

// The rule that matters: who pays for the overrun depends on WHY.
check("slow cleaner is not billable", isChargeable("cleaner_pace"), false);
check("extra rooms are billable", isChargeable("extra_rooms"), true);
check("waiting for access is not billable", isChargeable("access_delay"), false);

check(
  "overrun for a billable reason needs approval",
  resolveAdjustment({ ...base, actualHours: 4 }, "extra_rooms").resolution,
  "pending"
);
check(
  "overrun on cleaner pace leaves the price alone",
  resolveAdjustment({ ...base, actualHours: 4 }, "cleaner_pace").newPrice,
  72
);
check(
  "finishing early applies with no approval",
  resolveAdjustment({ ...base, actualHours: 2 }, null).resolution,
  "auto"
);
check("elapsed rounds to the nearest 15m", elapsedHours("2026-08-20T09:00:00Z", "2026-08-20T12:10:00Z"), 3.25);


if (failed) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll pricing checks passed.");

/* ---------- deep clean (costing sheet, Pricing tab) ---------- */

const sheetExample = { bedrooms: 3, bathrooms: 1, livingRooms: 0, diningRooms: 0, additionalRooms: 0 };
// The sheet's own worked example: 3 bed £68 + bath £58 + corridor £58 +
// kitchen £58 + windows £58 + laundry £58 = £358.
check("deep: sheet worked example = £358", deepPrice(sheetExample, ["windows", "laundry"]), 358);
check("deep: 1 bed 1 bath baseline = £232", deepPrice({ bedrooms: 1, bathrooms: 1, livingRooms: 0, diningRooms: 0, additionalRooms: 0 }), 232);
check("deep: additional room of a type is +£5", deepPrice({ bedrooms: 2, bathrooms: 1, livingRooms: 0, diningRooms: 0, additionalRooms: 0 }) - deepPrice({ bedrooms: 1, bathrooms: 1, livingRooms: 0, diningRooms: 0, additionalRooms: 0 }), 5);
check("deep: living room prices here (unlike standard)", deepPrice({ bedrooms: 1, bathrooms: 1, livingRooms: 1, diningRooms: 0, additionalRooms: 0 }), 290);

const m = deepMinutes(sheetExample, ["windows", "laundry"]);
check("deep: sheet example = 480 man-minutes", m, 480);
check("deep: pair stays 4h -> 2 cleaners", deepCleaners(m), 2);
check("deep: elapsed 4h for the pair", deepElapsedHours(m), 4);
// 13 rooms = 780 man-mins; a pair would be there 6.5h, over the 6h ceiling.
check("deep: 6-bed house tips to 3 cleaners", deepCleaners(780), 3);
check("deep: 3 cleaners bring elapsed back to 4.5h", deepElapsedHours(780), 4.5);
