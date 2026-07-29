// Quick assertion harness for the pricing engine: `npx tsx scripts/pricing-check.ts`
import {
  recommendedHours,
  quotePrice,
  clampHours,
  addonsHours,
  inServiceArea,
  looksLikeUkPostcode,
} from "../src/lib/pricing";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${actual}, expected ${expected}`);
}

check("rec 3bed/2bath/1din/1liv", recommendedHours({ bedrooms: 3, bathrooms: 2, diningRooms: 1, livingRooms: 1 }), 5.5);
check("rec studio clamps up", recommendedHours({ bedrooms: 0, bathrooms: 0, diningRooms: 0, livingRooms: 0 }), 2);
check("rec mansion clamps down", recommendedHours({ bedrooms: 10, bathrooms: 5, diningRooms: 2, livingRooms: 3 }), 8);
check("price 2h own products", quotePrice(2, true), 50);
check("price 8h our products", quotePrice(8, false), 206);
check("clamp low", clampHours(1), 2);
check("clamp high", clampHours(9), 8);
check("postcode IG1 1AA", looksLikeUkPostcode("IG1 1AA"), true);
check("postcode SW1A 2AA", looksLikeUkPostcode("SW1A 2AA"), true);
check("postcode BANANA", looksLikeUkPostcode("BANANA"), false);
check("service area (empty cfg)", inServiceArea("IG1 1AA"), true);

// Tier A: frequency discounts + add-ons
check("weekly 10% = £22.50/h: 3h own products", quotePrice(3, true, undefined, "weekly", 0), 67.5);
check("weekly + addons (discount skips addons)", quotePrice(3, true, undefined, "weekly", 40), 107.5);
check("fortnightly 10% = £22.50/h: 2h", quotePrice(2, true, undefined, "fortnightly", 0), 45);
check("one_off £25/h", quotePrice(2, true, undefined, "one_off", 0), 50);
check("addons flat on one_off", quotePrice(2, true, undefined, "one_off", 25), 75);

// 2026-07-29: extras add time (price stays flat)
check(
  "addonsHours sums extras time",
  addonsHours([
    { key: "oven", label: "Oven", price: 25, hours: 1 },
    { key: "fridge", label: "Fridge", price: 15, hours: 0.5 },
  ]),
  1.5
);

if (failed) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll pricing checks passed.");
