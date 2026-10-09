/**
 * =========================================================================
 *  EVERY INVENTED FACT ON THE PUBLIC SITE LIVES IN THIS FILE.
 * =========================================================================
 *
 * The landing page, the footer, the sticky bar, the sitemap and the
 * LocalBusiness structured data all read from here. Replacing something is
 * editing one line in this file — never a hunt through components.
 *
 * Everything below was confirmed real on 2026-10-08 and the site is now open
 * to crawlers. Anything new that is not yet confirmed must not land here
 * without setting DEMO_CONTENT back to true.
 */

/**
 * True while this file contains invented content.
 *
 * It does exactly one thing: `app/robots.ts` serves `noindex, nofollow` while
 * it is set. That keeps invented reviews out of Google — publishing fake
 * consumer reviews is a banned practice under the Digital Markets, Competition
 * and Consumers Act, and an unindexed demo is not published in that sense
 * whereas a crawled one is.
 *
 * Flip to false in the SAME commit that replaces the last invented value
 * below. Not before, and not separately.
 */
export const DEMO_CONTENT: boolean = false;

export const site = {
  url: "https://saaficleaningservice.com",
  name: "SAAFI Cleaning Service",
  /** Used in the LocalBusiness schema and the footer. */
  legalName: "SAAFI Cleaning Service",
} as const;

export const contact = {
  email: "info@saaficleaningservice.com",
  /** REAL — the business number, updated 2026-09-16. */
  phoneDisplay: "07864 161387",
  phoneHref: "+447864161387",
  /**
   * REAL — 8am to 8pm confirmed by Naunas 2026-10-09 (was 6pm). Must match
   * the Google Business Profile and openingHoursSpecification in app/page.tsx.
   */
  hours: "Mon to Sat, 8am to 8pm",
} as const;

/**
 * REAL — SAAFI serve Oxfordshire (2026-09-01 meeting: "restrict it to only
 * OX"), and Oxford as the base locality was confirmed by Naunas 2026-10-08.
 */
export const address = {
  locality: "Oxford",
  region: "Oxfordshire",
  postalCode: "",
  country: "GB",
} as const;

/**
 * CONFIRMED at the level of "Oxfordshire only" (2026-09-01 meeting) and
 * enforced for real: `service_areas` in Supabase holds the OX prefix, so the
 * quote form and the bookings API both reject anything else. This list is the
 * display copy — the Oxford-city districts plus the county towns, which is
 * every OX outward area's headline. Trim it if the family serve less.
 */
export const serviceAreas: string[] = [
  "Oxford",
  "Kidlington",
  "Abingdon",
  "Witney",
  "Bicester",
  "Didcot",
  "Wallingford",
  "Thame",
];

/**
 * REAL — from the business card Dulla shared in the group (2026-09-03).
 * Facebook is on the card too, but only as "Saafi" with no handle, and
 * several unrelated companies own the obvious "Saafi" pages — so it stays
 * off the site until the family send the exact page link.
 */
export const socials = [
  { label: "Instagram", handle: "@saafi_cl", url: "https://www.instagram.com/saafi_cl" },
  { label: "TikTok", handle: "@saafi_cl", url: "https://www.tiktok.com/@saafi_cl" },
] as const;

/**
 * EMPTY until real customers say something, with their permission. The three
 * placeholder quotes that lived here were live and publicly readable, and
 * publishing invented reviews is a banned practice under the DMCC Act — so
 * they came out on 2026-09-10. The section renders nothing while this is
 * empty; the review-request feature is what fills it honestly.
 */
export type Review = {
  quote: string;
  name: string;
  area: string;
  /** What they book — "Fortnightly clean", "One-off", and so on. */
  plan: string;
};

export const reviews: Review[] = [];

/**
 * REAL — all four confirmed by Naunas 2026-10-08, including that public
 * liability cover is purchased, not just budgeted.
 *
 * Every line is a commercial and legal claim about the safety of a stranger
 * entering someone's home. If any stops being true (a policy lapses, a hire
 * skips the checks), delete that line the same day.
 */
export type Check = { title: string; text: string };

export const checks: Check[] = [
  {
    title: "We check who we hire",
    text: "Identity and right to work confirmed before anyone is given a job, and we keep a record of it.",
  },
  {
    title: "References taken up",
    text: "We speak to previous employers ourselves rather than taking a CV at face value.",
  },
  {
    title: "Insured for work in your home",
    text: "Public liability cover is in place, so the rare accident is our problem to sort out and not yours.",
  },
  {
    title: "Trained before their first visit",
    text: "Nobody cleans a customer's home alone until we have worked alongside them and are happy with the standard.",
  },
];
