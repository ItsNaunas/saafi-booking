import type { AutomationRow } from "@/lib/supabaseAdmin";

/** Plain-English description of each automatic email, for the admin. */
export const AUTOMATION_INFO: Record<
  AutomationRow["key"],
  { title: string; when: (d: number) => string; delayLabel?: string }
> = {
  abandoned_quote: {
    title: "Finish your quote",
    when: () =>
      "Typed their email into the quote form but didn't book. Sent once, the next morning (at least 6 hours later), within a week, with their quoted price.",
  },
  one_off_followup: {
    title: "One-off → regular",
    when: (d) => `One-off customers, ${d}–${d + 30} days after their clean, with nothing else booked.`,
    delayLabel: "Days after their clean",
  },
  lapsed_regular: {
    title: "Come back (stopped their plan)",
    when: (d) => `Customers who stopped their regular plan, ${d}–${d + 60} days after their last clean, with nothing booked.`,
    delayLabel: "Days after their last clean",
  },
  mover_followup: {
    title: "Settled in? (movers)",
    when: (d) => `${d}–${d + 30} days after a deep clean booked for moving out or moving in. Asks for a clean at the new place and an introduction.`,
    delayLabel: "Days after the move clean",
  },
  seasonal_deep: {
    title: "Seasonal deep clean",
    when: () => "In March and September, to regular and one-off customers with no deep clean in 6+ months. Once per season.",
  },
  referral_ask: {
    title: "Ask for a referral",
    when: () => "Once, to happy regulars: 3+ cleans and no problems in 90 days. No reward is promised.",
  },
  at_risk_checkin: {
    title: "Sorry — how did we do?",
    when: (d) =>
      `${d}+ days after a no-access visit, a cancellation, a refund or a bill above the quote. A personal check-in, never an offer, and it goes before any other email that week.`,
    delayLabel: "Days after the problem",
  },
};

export const AUTOMATION_ORDER: AutomationRow["key"][] = [
  "abandoned_quote",
  "one_off_followup",
  "lapsed_regular",
  "mover_followup",
  "seasonal_deep",
  "referral_ask",
  "at_risk_checkin",
];
