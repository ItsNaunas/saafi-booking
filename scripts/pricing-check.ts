// Quick assertion harness for the pricing engine: `npx tsx scripts/pricing-check.ts`
import {
  recommendedHours,
  quotePrice,
  clampHours,
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
check("price 2h own products", quotePrice(2, true), 36);
check("price 8h our products", quotePrice(8, false), 150);
check("clamp low", clampHours(1), 2);
check("clamp high", clampHours(9), 8);
check("postcode IG1 1AA", looksLikeUkPostcode("IG1 1AA"), true);
check("postcode SW1A 2AA", looksLikeUkPostcode("SW1A 2AA"), true);
check("postcode BANANA", looksLikeUkPostcode("BANANA"), false);
check("service area (empty cfg)", inServiceArea("IG1 1AA"), true);

if (failed) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll pricing checks passed.");
