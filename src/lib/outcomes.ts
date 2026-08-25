/**
 * Visits that could not happen.
 *
 * The status enum only ever described success: requested, confirmed, completed,
 * paid, cancelled. A cleaner who turned up to a locked door had nowhere honest to
 * put that — "completed" claims work that wasn't done, "cancelled" implies somebody
 * called it off in advance, and finishing with zero hours quietly repriced the job
 * to the two-hour minimum as though it had simply gone quickly.
 *
 * None of these decide anything about money. Whether SAAFI charge for a wasted
 * journey is a policy they have not set, so the job stops at `no_access` and the
 * office resolves it — cancel for nothing, or complete and charge.
 */

export type OutcomeReason = "no_access" | "turned_away" | "unsafe" | "cleaner_unwell";

export const OUTCOMES: {
  code: OutcomeReason;
  label: string;
  /** What the office is being asked to weigh up when they resolve it. */
  hint: string;
  /** Whether the wasted journey is arguably the customer's to pay for. */
  customerAtFault: boolean;
}[] = [
  {
    code: "no_access",
    label: "Couldn't get in",
    hint: "Nobody home, key safe wrong, or no answer.",
    customerAtFault: true,
  },
  {
    code: "turned_away",
    label: "Customer turned me away",
    hint: "They were in, but didn't want the clean today.",
    customerAtFault: true,
  },
  {
    code: "unsafe",
    label: "Not safe or fit to clean",
    hint: "Something at the property made the job impossible.",
    customerAtFault: false,
  },
  {
    code: "cleaner_unwell",
    label: "I couldn't do it",
    hint: "Unwell, hurt, or something happened on the way.",
    customerAtFault: false,
  },
];

export function isOutcomeReason(v: string): v is OutcomeReason {
  return OUTCOMES.some((o) => o.code === v);
}

export function outcomeLabel(code: OutcomeReason): string {
  return OUTCOMES.find((o) => o.code === code)?.label ?? code;
}

/**
 * Whether the office could reasonably charge for this one. Advisory only — it
 * decides what the admin suggests, never what it does.
 */
export function chargeableJourney(code: OutcomeReason): boolean {
  return OUTCOMES.find((o) => o.code === code)?.customerAtFault ?? false;
}
