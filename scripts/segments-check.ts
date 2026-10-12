// Assertion harness for marketing segments: `npx tsx scripts/segments-check.ts`
//
// Every case passes an explicit `today`, so these never go stale.
import {
  buildProfiles,
  matches,
  recipients,
  outwardCode,
  merge,
  paragraphs,
  filterFromForm,
  filterToFields,
  type SegBooking,
  type SegLead,
} from "../src/lib/segments";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const TODAY = "2026-10-12";

function bk(over: Partial<SegBooking>): SegBooking {
  return {
    customer_name: "Amy Stone",
    customer_email: "amy@example.com",
    postcode: "OX44HT",
    status: "paid",
    frequency: "one_off",
    recurring_active: false,
    service_type: "standard",
    preferred_date: "2026-09-01",
    quoted_price: 75,
    final_price: null,
    created_at: "2026-08-25T10:00:00Z",
    marketing_ok: true,
    ...over,
  };
}

function lead(over: Partial<SegLead>): SegLead {
  return {
    email: "lee@example.com",
    name: "Lee Park",
    postcode: "OX1 1AA",
    marketing_ok: true,
    created_at: "2026-10-10T10:00:00Z",
    updated_at: "2026-10-10T10:00:00Z",
    converted_at: null,
    ...over,
  };
}

const profile = (bookings: SegBooking[], leads: SegLead[] = [], suppressed: string[] = [], hosts: string[] = []) =>
  buildProfiles({ bookings, leads, suppressed: new Set(suppressed), hostEmails: new Set(hosts), today: TODAY });

/* ---------- stages ---------- */

check("one-off customer", profile([bk({})])[0].stage, "one_off");
check("quote only = lead", profile([], [lead({})])[0].stage, "lead");
check("only cancelled", profile([bk({ status: "cancelled" })])[0].stage, "cancelled");
check("first clean still to come = new", profile([bk({ status: "confirmed", preferred_date: "2026-10-20" })])[0].stage, "new");
check(
  "live recurring plan = regular",
  profile([bk({ frequency: "weekly", recurring_active: true, status: "confirmed", preferred_date: "2026-10-15" })])[0].stage,
  "regular"
);
check(
  "plan stopped, nothing booked = lapsed",
  profile([bk({ frequency: "fortnightly", recurring_active: false, preferred_date: "2026-08-01" })])[0].stage,
  "lapsed"
);

/* ---------- consent ---------- */

check("ticked at booking = yes", profile([bk({})])[0].consent, "yes");
check("unticked = no", profile([bk({ marketing_ok: false })])[0].consent, "no");
check("never asked = unknown", profile([bk({ marketing_ok: null })])[0].consent, "unknown");
check(
  "latest answer wins",
  profile([
    bk({ marketing_ok: true, created_at: "2026-08-01T00:00:00Z" }),
    bk({ marketing_ok: false, created_at: "2026-09-01T00:00:00Z" }),
  ])[0].consent,
  "no"
);
check("unsubscribe beats a later tick", profile([bk({})], [], ["amy@example.com"])[0].consent, "unsubscribed");
check("email case doesn't split a person", profile([bk({}), bk({ customer_email: "AMY@example.com" })]).length, 1);
check("phone-booking placeholder is nobody", profile([bk({ customer_email: "07700900000@phone.saafi" })]).length, 0);

/* ---------- facts ---------- */

const p = profile([
  bk({ preferred_date: "2026-09-01", final_price: 80 }),
  bk({ preferred_date: "2026-09-20", service_type: "deep", quoted_price: 300 }),
  bk({ status: "confirmed", preferred_date: "2026-10-30", quoted_price: 75 }),
])[0];
check("last clean", p.lastClean, "2026-09-20");
check("days since", p.daysSinceLastClean, 22);
check("next booking", p.nextBooking, "2026-10-30");
check("spend counts done cleans, final price first", p.spend, 380);
check("had deep", p.hadDeep, true);
check("area", p.area, "OX4");
check("outward code of a spaced postcode", outwardCode("OX1 1AA"), "OX1");
check("outward code of a placeholder", outwardCode("—"), null);
check("host flag", profile([bk({})], [], [], ["amy@example.com"])[0].isHost, true);

/* ---------- filters ---------- */

const people = profile(
  [
    bk({}),
    bk({ customer_email: "ben@example.com", customer_name: "Ben", postcode: "OX11AA", preferred_date: "2026-10-05" }),
    bk({ customer_email: "cat@example.com", customer_name: "Cat", marketing_ok: false }),
  ],
  [lead({})]
);
check("stage filter", people.filter((x) => matches(x, { stages: ["lead"] })).map((x) => x.email), ["lee@example.com"]);
check("area filter (leads have areas too)", people.filter((x) => matches(x, { areas: ["OX1"] })).map((x) => x.email), ["ben@example.com", "lee@example.com"]);
check(
  "30+ days since clean",
  people.filter((x) => matches(x, { minDaysSinceClean: 30 })).map((x) => x.email).sort(),
  ["amy@example.com", "cat@example.com"]
);
check("days filter skips people who never had a clean", matches(people.find((x) => x.stage === "lead")!, { maxDaysSinceClean: 999 }), false);
check(
  "recipients drop anyone who said no",
  recipients(people, { stages: ["one_off"] }).map((x) => x.email).sort(),
  ["amy@example.com", "ben@example.com"]
);

const f = filterFromForm(
  (k) => ({ min_days: "30", deep: "yes", upcoming: "", min_spend: "abc" })[k as "min_days"] ?? null,
  (k) => (k === "stage" ? ["one_off", "nonsense"] : k === "area" ? ["ox4", "<script>"] : [])
);
check("form parsing keeps only valid values", f, { stages: ["one_off"], areas: ["OX4"], deep: "yes", minDaysSinceClean: 30 });

/* ---------- copy ---------- */

check("merge first name", merge("Hi {first_name}!", { firstName: "Amy", name: "Amy Stone" }), "Hi Amy!");
check("paragraphs split on blank lines", paragraphs("One\nline\n\nTwo\n\n\n"), ["One line", "Two"]);

/* ---------- part 2 segments ---------- */

const reg = (over: Partial<SegBooking>) =>
  bk({ frequency: "fortnightly", recurring_active: true, status: "confirmed", preferred_date: "2026-10-20", ...over });

check("current plan", profile([reg({})])[0].plan, "fortnightly");
check("upgrade preset matches fortnightly", matches(profile([reg({})])[0], { plans: ["four_weekly", "fortnightly"] }), true);
check("weekly is not an upgrade target", matches(profile([reg({ frequency: "weekly" })])[0], { plans: ["four_weekly", "fortnightly"] }), false);
check("never had an extra", matches(profile([bk({})])[0], { addons: "no" }), true);
check("had an extra", profile([bk({ addons: [{ key: "oven" }] })])[0].hadAddon, true);
check("bedrooms from latest booking", matches(profile([bk({ bedrooms: 3 })])[0], { minBedrooms: 3 }), true);
check("weekend booker (2026-10-10 is a Saturday)", profile([bk({ preferred_date: "2026-10-10" })])[0].usualDays, "weekend");
check(
  "mover from a moving-out deep clean",
  profile([bk({ service_type: "deep", deep_reason: "end_of_tenancy", preferred_date: "2026-09-28" })])[0].lastMoveClean,
  "2026-09-28"
);
check("a 'needs reset' deep clean is not a move", profile([bk({ service_type: "deep", deep_reason: "needs_reset" })])[0].lastMoveClean, null);

const noAccess = profile([bk({ status: "no_access", preferred_date: "2026-10-05" })])[0];
check("no-access 7 days ago = at risk", noAccess.atRisk, true);
check("at-risk people are left out of normal segments", matches(noAccess, {}), false);
check("...but match the at-risk segment", matches(noAccess, { atRisk: "yes" }), true);
check("a refund counts as an issue", profile([bk({ refund_amount: 20, preferred_date: "2026-10-01" })])[0].atRisk, true);
check("a bill above the quote counts", profile([bk({ final_price: 90, preferred_date: "2026-10-01" })])[0].atRisk, true);
check("an issue 60 days ago is not at risk", profile([bk({ status: "no_access", preferred_date: "2026-08-13" })])[0].atRisk, false);

const three = [
  bk({ preferred_date: "2026-08-01" }),
  bk({ preferred_date: "2026-08-15" }),
  bk({ preferred_date: "2026-09-01" }),
];
check("3 clean cleans = happy", profile(three)[0].happy, true);
check(
  "an issue in the last 90 days = not happy",
  profile([...three, bk({ status: "no_access", preferred_date: "2026-08-20" })])[0].happy,
  false
);

check("deep due when never had one", matches(profile(three)[0], { deepDueMonths: 6 }), true);
check(
  "deep not due 2 months after one",
  matches(profile([...three, bk({ service_type: "deep", preferred_date: "2026-08-12" })])[0], { deepDueMonths: 6 }),
  false
);

// Quiet-day filler: Ben has a clean in OX4 on Tuesday 2026-10-13; Amy (OX4, nothing booked) is "nearby on Tuesdays".
const near = profile([
  bk({}),
  bk({ customer_email: "ben@example.com", customer_name: "Ben", status: "confirmed", preferred_date: "2026-10-13" }),
]);
const amy = near.find((x) => x.email === "amy@example.com")!;
const ben = near.find((x) => x.email === "ben@example.com")!;
check("nearby on Tuesday", amy.nearbyDays, [2]);
check("quiet-day filter matches Amy", matches(amy, { nearDay: 2 }), true);
check("your own booking doesn't make a day nearby", ben.nearbyDays, []);

check("source", profile([bk({ heard_from: "instagram" })])[0].heardFrom, "instagram");
check("source filter", matches(profile([bk({ heard_from: "friend" })])[0], { sources: ["friend"] }), true);

const host = buildProfiles({
  bookings: [bk({})],
  leads: [],
  suppressed: new Set(),
  hostEmails: new Set(["amy@example.com"]),
  hostStats: new Map([["amy@example.com", { listings: 2, sameDay: 1 }]]),
  today: TODAY,
})[0];
check("busy host", matches(host, { host: "yes", sameDay: "yes" }), true);

const round = filterFromForm(
  (k) => (Object.fromEntries(filterToFields({ plans: ["fortnightly"], nearDay: 2, atRisk: "yes", deepDueMonths: 6 })) as Record<string, string>)[k] ?? null,
  (k) => filterToFields({ plans: ["fortnightly"] }).filter(([kk]) => kk === k).map(([, v]) => v)
);
check("filter -> fields -> filter round trip", round, { plans: ["fortnightly"], deepDueMonths: 6, nearDay: 2, atRisk: "yes" });

if (failed) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll segment checks passed.");
