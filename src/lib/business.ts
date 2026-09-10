/**
 * =========================================================================
 *  EVERY INVENTED FACT ON THE PUBLIC SITE LIVES IN THIS FILE.
 * =========================================================================
 *
 * The landing page, the footer, the sticky bar, the sitemap and the
 * LocalBusiness structured data all read from here. Replacing something is
 * editing one line in this file — never a hunt through components.
 *
 * Everything below is written to READ as real, because the page has to look
 * finished when it is shown to SAAFI. None of it IS real. That combination is
 * useful in a demo and dangerous on an indexed public site, which is what
 * DEMO_CONTENT exists to manage.
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
export const DEMO_CONTENT: boolean = true;

export const site = {
  url: "https://saaficleaningservice.com",
  name: "SAAFI Cleaning Service",
  /** Used in the LocalBusiness schema and the footer. */
  legalName: "SAAFI Cleaning Service",
} as const;

export const contact = {
  email: "info@saaficleaningservice.com",
  /** REAL — the business number, supplied 2026-09-02. */
  phoneDisplay: "07835 532920",
  phoneHref: "+447835532920",
  /** INVENTED — confirm the hours someone actually answers. */
  hours: "Mon to Sat, 8am to 6pm",
} as const;

/**
 * PARTLY CONFIRMED — SAAFI serve Oxfordshire (2026-09-01 meeting: "restrict
 * it to only OX"). Oxford as the locality is an inference from that, not a
 * confirmed trading address; a local service business needs a real locality
 * here to appear in local results, so confirm it with the family.
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
 * INVENTED CLAIMS, and the most consequential invention in this file.
 *
 * Every line is a commercial and legal claim about the safety of a stranger
 * entering someone's home. "Insured" in particular is either true and evidenced
 * by a policy number, or it is a misrepresentation — SAAFI's costing sheet
 * budgets for insurance, and budgeted is not purchased.
 *
 * Confirm each one individually. Delete any they cannot evidence: three honest
 * checks beat four where one is aspirational.
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
