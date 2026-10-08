/**
 * The service pages' words. One page per thing people search for — "regular
 * cleaner Oxford", "deep clean Oxford", "end of tenancy cleaning Oxford" —
 * because a one-page site can only rank for one of them.
 *
 * Every claim here is one the home page or lib/deepClean.ts already makes.
 * Nothing new is promised: no guarantees, no deposit-back claims, no timings
 * for deep cleans (Dulla, 2026-09-03: deep-clean time is never shown). Prices
 * are NOT written here — ServicePage computes them from the live config.
 */

export type ServiceSlug = "regular-cleaning" | "one-off-cleaning" | "deep-cleaning";

export type ServiceContent = {
  slug: ServiceSlug;
  /** <title> — leads with the search, keeps the brand. */
  metaTitle: string;
  metaDescription: string;
  /** Breadcrumb + schema name. */
  name: string;
  h1: string;
  intro: string[];
  quoteHref: string;
  /** "Who it's for" — the situations people search with. */
  goodFor: { title: string; text: string }[];
  faqs: { q: string; a: string }[];
};

export const SERVICES: Record<ServiceSlug, ServiceContent> = {
  "regular-cleaning": {
    slug: "regular-cleaning",
    metaTitle: "Regular House Cleaning in Oxford & Oxfordshire | SAAFI Cleaning Service",
    metaDescription:
      "Weekly or fortnightly home cleaning across Oxford and Oxfordshire. The same cleaner wherever we can, a clear price per visit, and you see it online before you book.",
    name: "Regular cleaning",
    h1: "Regular house cleaning in Oxford & Oxfordshire",
    intro: [
      "A weekly or fortnightly clean from a family-run local team, so the house stays on top of itself and you get your evenings and weekends back.",
      "Regular visits cost less per hour than a one-off clean, and we keep you with the same cleaner wherever we can — someone who already knows your home does a better job of it.",
    ],
    quoteHref: "/quote?frequency=fortnightly",
    goodFor: [
      {
        title: "Busy households",
        text: "Plenty of our regulars are at work when we come. We agree how we get in on the confirmation call — a key, a keysafe, or you're there for the first visit.",
      },
      {
        title: "Keeping on top of it",
        text: "Kitchen, bathrooms, hallways, landings and floors every visit, so nothing gets the chance to build up.",
      },
      {
        title: "Homes with pets",
        text: "No problem at all — tell us what you've got and whether they'll be loose, so whoever comes is expecting them.",
      },
    ],
    faqs: [
      {
        q: "How often can you come?",
        a: "Weekly or fortnightly. Pick what suits you when you get your quote, and the price per visit is shown before you book.",
      },
      {
        q: "Is it the same cleaner each time?",
        a: "For regular cleans we keep you with the same person wherever we can. If they're ever off, we'll tell you before the visit rather than send a stranger unannounced.",
      },
      {
        q: "Who brings the cleaning products?",
        a: "Whichever you prefer, and you choose when you book — we can bring everything, or use the products you already have.",
      },
      {
        q: "What if I need to move a clean?",
        a: "Give us a ring as early as you can and we'll do our best to find another slot. As long as we know a day or so before, there's nothing to pay.",
      },
    ],
  },

  "one-off-cleaning": {
    slug: "one-off-cleaning",
    metaTitle: "One-Off House Cleaning in Oxford & Oxfordshire | SAAFI Cleaning Service",
    metaDescription:
      "A single home clean whenever you need it — before guests, after a party or just to reset the house. Oxford and Oxfordshire, priced online in under a minute.",
    name: "One-off cleaning",
    h1: "One-off house cleaning in Oxford & Oxfordshire",
    intro: [
      "A single visit, whenever you need it, with no commitment. The same standard our regular customers get — kitchen, bathrooms, hallways, landings and floors.",
      "Tell us your rooms and we'll suggest how long it needs. You can adjust it, and the price follows — nothing is added afterwards without asking you first.",
    ],
    quoteHref: "/quote?frequency=one_off",
    goodFor: [
      {
        title: "Before guests arrive",
        text: "Family visiting, a party, a viewing — book a single date and have the house ready for it.",
      },
      {
        title: "After a busy spell",
        text: "When the house has got away from you and you want it reset in one go.",
      },
      {
        title: "Trying us out",
        text: "No commitment. And if you'd like us back, regular visits cost less per hour.",
      },
    ],
    faqs: [
      {
        q: "How long will you stay?",
        a: "The quote form suggests a length based on the rooms you tell us about, and you can adjust it. Visits run from a 2-hour minimum up to a full 8-hour day.",
      },
      {
        q: "When do I pay?",
        a: "You pay for the clean when you book it, and we ring you to confirm the date and time. If anything changes on the day we agree it with you first.",
      },
      {
        q: "Can I add extras?",
        a: "Yes — pick them on the quote form and they're priced in before you book.",
      },
      {
        q: "Do I need to be home?",
        a: "Only if you'd rather be. We'll agree how we get in on the confirmation call.",
      },
    ],
  },

  "deep-cleaning": {
    slug: "deep-cleaning",
    metaTitle: "Deep Cleaning & End of Tenancy Cleaning in Oxford | SAAFI Cleaning Service",
    metaDescription:
      "Top-to-bottom deep cleans across Oxford and Oxfordshire — moving out, moving in, after building work or when it's been a while. Two cleaners, priced by the size of your home.",
    name: "Deep cleaning",
    h1: "Deep cleaning in Oxford & Oxfordshire",
    intro: [
      "For when a regular clean isn't enough. A deep clean is done by two cleaners, top to bottom, with the kitchen, the oven and the hallways always included.",
      "It's priced by the size of your home, not by the hour, so you know the whole cost before we arrive.",
    ],
    quoteHref: "/quote?service=deep",
    goodFor: [
      {
        title: "Moving out — end of tenancy",
        text: "Leave the property properly clean for the handover, with the kitchen and oven done as standard.",
      },
      {
        title: "Just moved in",
        text: "Start in a new home that's been cleaned top to bottom before your things go in.",
      },
      {
        title: "After building or decorating work",
        text: "The dust gets everywhere. A deep clean gets it out of the corners a normal clean doesn't reach.",
      },
      {
        title: "When it's been a while",
        text: "A proper going-over to bring the house back to a standard a regular clean can then keep.",
      },
    ],
    faqs: [
      {
        q: "What's the difference between a deep clean and a regular clean?",
        a: "A regular clean keeps a house on top of itself. A deep clean is two cleaners going through the whole home top to bottom, with the oven, living and dining rooms included, and it's priced by the size of the home rather than by the hour.",
      },
      {
        q: "Do you do end of tenancy cleans?",
        a: "Yes — moving out is one of the most common reasons people book a deep clean with us. Choose \"Moving out — end of tenancy\" when you get your quote so we know what we're preparing for.",
      },
      {
        q: "How is the price worked out?",
        a: "A set price covers a home with one bedroom, one bathroom, one living room, one dining room, the kitchen with the oven, and the hallways. Each room beyond that adds the same flat amount, and extras like inside windows or the fridge are priced on top. You see the total before you book.",
      },
      {
        q: "Why do you ask why I need a deep clean?",
        a: "So we know what we're walking into before we confirm the date and send the team — a just-vacated flat and a house after building work need different preparation.",
      },
    ],
  },
};
