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
  /**
   * INVENTED. 020 7946 0xxx is Ofcom's reserved range for drama and fiction:
   * a real-looking London number that can never connect to a real person's
   * phone. Deliberately not a plausible-but-unreserved number, which would
   * eventually ring some stranger's landline.
   */
  phoneDisplay: "020 7946 0958",
  phoneHref: "+442079460958",
  /** INVENTED — confirm the hours someone actually answers. */
  hours: "Mon to Sat, 8am to 6pm",
} as const;

/**
 * INVENTED — the trading address for the LocalBusiness schema. Ilford is a
 * guess drawn from the IG1 postcode used as the quote form's example, not
 * something SAAFI have confirmed. A local service business needs a real
 * locality here to appear in local results.
 */
export const address = {
  locality: "Ilford",
  region: "Greater London",
  postalCode: "",
  country: "GB",
} as const;

/**
 * INVENTED — Redbridge and the Essex border, inferred from that same IG1
 * example. Plausible, unconfirmed.
 *
 * Also still a live operational gap: `service_areas` is empty in Supabase, so
 * the quote form accepts any UK postcode regardless of what this list says.
 * Filling that table is what makes the check real.
 */
export const serviceAreas: string[] = [
  "IG1",
  "IG2",
  "IG3",
  "IG4",
  "IG5",
  "IG6",
  "E11",
  "E18",
  "RM6",
  "RM7",
];

/**
 * INVENTED CUSTOMERS. Nobody said any of this.
 *
 * Written to sound like real people so the section reads properly in a demo,
 * which is exactly what makes them unsafe to index — see DEMO_CONTENT above.
 * Replace with things real customers actually said, with their permission, or
 * empty the array: the section renders nothing at all when it is empty, so
 * deleting is always a safe way to ship.
 */
export type Review = {
  quote: string;
  name: string;
  area: string;
  /** What they book — "Fortnightly clean", "One-off", and so on. */
  plan: string;
};

export const reviews: Review[] = [
  {
    quote:
      "I put off getting a cleaner for two years because I didn't like the idea of someone in the house while I was at work. Six months in and I've stopped thinking about it. I come home on a Thursday and the place is just done.",
    name: "Priya S.",
    area: "Barkingside",
    plan: "Fortnightly clean",
  },
  {
    quote:
      "What sold me was being given a price before anyone came round. Everywhere else I rang wanted to pop by and quote first.",
    name: "Daniel O.",
    area: "Seven Kings",
    plan: "Weekly clean",
  },
  {
    quote:
      "Booked them at the end of a tenancy and expected a fight about the deposit. The landlord signed it off the same day.",
    name: "Hannah M.",
    area: "Woodford Green",
    plan: "One-off clean",
  },
];

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
