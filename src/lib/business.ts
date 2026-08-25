/**
 * =========================================================================
 *  EVERY PLACEHOLDER ON THE PUBLIC SITE LIVES IN THIS FILE.
 * =========================================================================
 *
 * The landing page, the footer, the sticky bar, the sitemap and the
 * LocalBusiness structured data all read from here. Replacing a placeholder is
 * editing one line in this file — never a hunt through components.
 *
 * Anything marked PLACEHOLDER is invented so the layout can be designed and
 * reviewed. None of it has been confirmed by SAAFI.
 *
 * `UNCONFIRMED` below is the safety catch. While it is `true`, the two sections
 * that carry claims about real people — customer reviews and the vetting /
 * insurance block — render a visible "not confirmed" marker. Set it to `false`
 * only once every value below is the real thing. It exists so unconfirmed
 * claims cannot reach a live site quietly.
 */

/**
 * Flip back to true to bring the on-page "not confirmed" markers back.
 *
 * Turned off 2026-08-24 at Naunas's request so the layouts can be reviewed
 * without them. The placeholders below are all still placeholders — the only
 * thing that changed is that the page no longer says so out loud.
 */
export const UNCONFIRMED: boolean = false;

export const site = {
  url: "https://saaficleaningservice.com",
  name: "SAAFI Cleaning Service",
  /** Used in the LocalBusiness schema and the footer. */
  legalName: "SAAFI Cleaning Service",
} as const;

export const contact = {
  email: "info@saaficleaningservice.com",
  /** PLACEHOLDER — SAAFI's real business number. */
  phoneDisplay: "020 0000 0000",
  /** PLACEHOLDER — the same number, digits only, for tel: links. */
  phoneHref: "+442000000000",
  /** PLACEHOLDER — when someone can actually expect an answer. */
  hours: "Mon to Sat, 8am to 6pm",
} as const;

/**
 * PLACEHOLDER — the trading address for the LocalBusiness schema. A local
 * service business needs a real locality here to appear in local results; the
 * street line can be omitted if they work from home and would rather not
 * publish it, but the town and region cannot.
 */
export const address = {
  locality: "London",
  region: "Greater London",
  postalCode: "",
  country: "GB",
} as const;

/**
 * PLACEHOLDER — postcode districts SAAFI actually cover.
 *
 * This is also a live operational gap, not only a content one: `service_areas`
 * is empty in Supabase, so the quote form currently accepts any UK postcode.
 * Filling that table is what makes the check real; this list is only what the
 * page says out loud.
 */
export const serviceAreas: string[] = [
  "E1",
  "E2",
  "E14",
  "N1",
  "N4",
  "SE1",
  "SE8",
  "IG1",
  "IG11",
  "RM6",
];

/**
 * PLACEHOLDER — real customers, in their own words.
 *
 * Publishing invented reviews is not a style problem: under the Digital
 * Markets, Competition and Consumers Act it is a banned practice. Every entry
 * here has to be replaced with something a real customer actually said, with
 * their permission, or the array has to be emptied — the section renders
 * nothing at all when it is empty, so deleting is a safe way to ship.
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
      "Sample review text goes here. Two or three sentences in the customer's own words about what actually changed for them, rather than a general compliment.",
    name: "Customer name",
    area: "Area",
    plan: "Fortnightly clean",
  },
  {
    quote:
      "Sample review text goes here. The strongest ones name a specific worry that turned out to be unfounded, because that is what the next customer is quietly wondering about.",
    name: "Customer name",
    area: "Area",
    plan: "Weekly clean",
  },
  {
    quote:
      "Sample review text goes here. One about a one-off clean is worth having alongside the regulars, since the two customers are buying different things.",
    name: "Customer name",
    area: "Area",
    plan: "One-off clean",
  },
];

/**
 * PLACEHOLDER — and the most consequential placeholder in this file.
 *
 * Every line below is a commercial and legal claim about the safety of a
 * stranger entering someone's home. "Fully insured" in particular is either
 * true and evidenced by a policy number, or it is a misrepresentation. SAAFI's
 * own costing sheet budgets for insurance, and budgeted is not purchased.
 *
 * Confirm each one with them individually. Delete any they cannot evidence —
 * three honest checks beat four where one is aspirational.
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
