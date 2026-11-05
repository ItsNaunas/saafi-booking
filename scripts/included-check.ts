// Every customer-facing "what's included" line must stand for real items on the
// cleaner's SOP checklist: `npx tsx scripts/included-check.ts`
import { checklistFor } from "../src/lib/checklist";
import {
  BEFORE_WE_LEAVE,
  DEEP_EXTRA_COVERS,
  DEEP_ROOMS,
  STANDARD_EXTRA_COVERS,
  STANDARD_ROOMS,
  WE_DONT,
} from "../src/lib/included";

const everyAddon = ["windows", "laundry", "ironing", "dusting", "fridge", "oven"].map((key) => ({ key }));
const sopKeys = new Set(
  [...checklistFor({ service_type: "standard", addons: everyAddon }), ...checklistFor({ service_type: "deep", addons: everyAddon })]
    .flatMap((s) => s.items.map((i) => i.key))
);

let failed = 0;
function check(where: string, lines: { text: string; sop: string[] }[]) {
  for (const l of lines) {
    for (const k of l.sop) {
      if (!sopKeys.has(k)) {
        failed++;
        console.error(`FAIL ${where}: "${l.text}" points at missing SOP item ${k}`);
      }
    }
  }
}

for (const r of STANDARD_ROOMS) check(`standard/${r.title}`, r.items);
for (const r of DEEP_ROOMS) check(`deep/${r.title}`, r.items);
check("standard extras", Object.values(STANDARD_EXTRA_COVERS));
check("deep extras", Object.values(DEEP_EXTRA_COVERS));
check("before we leave", BEFORE_WE_LEAVE);
check("we don't", WE_DONT);

// Room lines on the site must point at their own service's list.
for (const r of STANDARD_ROOMS) for (const i of r.items) if (i.sop.some((k) => !k.startsWith("s."))) {
  failed++;
  console.error(`FAIL standard/${r.title}: "${i.text}" points at a deep-clean item`);
}
for (const r of DEEP_ROOMS) for (const i of r.items) if (i.sop.some((k) => !k.startsWith("d."))) {
  failed++;
  console.error(`FAIL deep/${r.title}: "${i.text}" points at a standard item`);
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("included-check: all lines map to the cleaner SOP");
