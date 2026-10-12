// Who each automatic email goes to: `npx tsx scripts/automations-check.ts`
import { automationTargets, quoteLine } from "../src/lib/marketing";
import { buildProfiles, type SegBooking } from "../src/lib/segments";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

function bk(email: string, over: Partial<SegBooking>): SegBooking {
  return {
    customer_name: email.split("@")[0],
    customer_email: email,
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

const TODAY = "2026-10-12";
const profiles = buildProfiles({
  bookings: [
    bk("oneoff@x.com", { preferred_date: "2026-09-15" }), // 27 days ago
    bk("tooearly@x.com", { preferred_date: "2026-10-01" }), // 11 days ago
    bk("said-no@x.com", { preferred_date: "2026-09-15", marketing_ok: false }),
    bk("lapsed@x.com", { frequency: "weekly", preferred_date: "2026-09-01" }), // 41 days
    bk("mover@x.com", { service_type: "deep", deep_reason: "end_of_tenancy", preferred_date: "2026-09-25" }), // 17 days
    bk("issue@x.com", { status: "no_access", preferred_date: "2026-10-09" }), // 3 days
    bk("issue-oneoff@x.com", { preferred_date: "2026-09-15" }),
    bk("issue-oneoff@x.com", { status: "cancelled", preferred_date: "2026-10-20", created_at: "2026-10-09T09:00:00Z" }),
    ...["2026-08-01", "2026-08-15", "2026-09-01"].map((d) => bk("happy@x.com", { preferred_date: d })),
  ],
  leads: [],
  suppressed: new Set(),
  hostEmails: new Set(),
  today: TODAY,
});

const who = (key: Parameters<typeof automationTargets>[0], delay: number, today = TODAY) =>
  automationTargets(key, delay, profiles, today).map((t) => t.profile.email).sort();

check("one-off follow-up at 21 days (a repeat one-off counts too)", who("one_off_followup", 21), ["happy@x.com", "oneoff@x.com"]);
check("lapsed regular at 30 days", who("lapsed_regular", 30), ["lapsed@x.com"]);
check("mover follow-up at 14 days", who("mover_followup", 14), ["mover@x.com"]);
check("referral ask to happy customers", who("referral_ask", 0), ["happy@x.com"]);
check("at-risk check-in 2+ days after the problem", who("at_risk_checkin", 2), ["issue-oneoff@x.com", "issue@x.com"]);
check("seasonal deep is off outside March/September", who("seasonal_deep", 0), []);
check(
  "seasonal deep in March: skips the recent mover's deep clean and anyone at risk",
  who("seasonal_deep", 0, "2027-03-02"),
  ["happy@x.com", "oneoff@x.com", "tooearly@x.com"]
);
check(
  "an at-risk one-off doesn't get the upsell",
  who("one_off_followup", 21).includes("issue-oneoff@x.com"),
  false
);
check(
  "dedupe key is per clean",
  automationTargets("one_off_followup", 21, profiles, TODAY).find((t) => t.profile.email === "oneoff@x.com")!.dedupeKey,
  "one_off_followup:oneoff@x.com:2026-09-15"
);
check(
  "quote line",
  quoteLine({ quote: { service: "standard", frequency: "fortnightly", hours: 3, price: 66 } }),
  "Your quote: Every 2 weeks, 3 hours — £66 a visit"
);

if (failed) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll automation checks passed.");
