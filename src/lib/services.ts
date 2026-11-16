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

export type ServiceSlug =
  | "regular-cleaning"
  | "one-off-cleaning"
  | "deep-cleaning"
  | "end-of-tenancy-cleaning"
  | "airbnb-cleaning";

export type ServiceContent = {
  slug: ServiceSlug;
  /** Which price engine and room-by-room list the page uses. */
  kind: "standard" | "deep";
  /** The example price on the page, for a 2-bed home. */
  priceLabel: string;
  /** How the example price is worked out (standard kind only). */
  priceFrequency?: "one_off" | "fortnightly";
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
    kind: "standard",
    priceLabel: "2-bed home, fortnightly",
    priceFrequency: "fortnightly",
    metaTitle: "Regular House Cleaning in Oxford | SAAFI Cleaning",
    metaDescription:
      "Weekly or fortnightly home cleaning in Oxford & Oxfordshire. The same cleaner wherever we can, and a clear price per visit before you book.",
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
        text: "Kitchen, bathrooms, bedrooms, living spaces and floors every visit, so nothing gets the chance to build up.",
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
    kind: "standard",
    priceLabel: "2-bed home, one visit",
    priceFrequency: "one_off",
    metaTitle: "One-Off House Cleaning in Oxford | SAAFI Cleaning",
    metaDescription:
      "A single home clean whenever you need it — before guests, after a party or to reset the house. Oxford & Oxfordshire, priced online in a minute.",
    name: "One-off cleaning",
    h1: "One-off house cleaning in Oxford & Oxfordshire",
    intro: [
      "A single visit, whenever you need it, with no commitment. The same standard our regular customers get — kitchen, bathrooms, bedrooms, living spaces and floors.",
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
    kind: "deep",
    priceLabel: "Deep clean, 2-bed home",
    metaTitle: "Deep Cleaning in Oxford | Two Cleaners, Oven Included | SAAFI",
    metaDescription:
      "Top-to-bottom deep cleans in Oxford & Oxfordshire. Two cleaners, kitchen and oven always included, one fixed price by the size of your home.",
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
        a: "A regular clean keeps a house on top of itself. A deep clean is two cleaners going through the whole home top to bottom: grease and limescale removed, tiles and grout, skirting boards and door frames, and behind and under the furniture. The oven is included, and it's priced by the size of the home rather than by the hour.",
      },
      {
        q: "Do you do end of tenancy cleans?",
        a: "Yes — moving out is one of the most common reasons people book a deep clean with us. See our end of tenancy cleaning page for what's covered, and choose \"Moving out — end of tenancy\" when you get your quote so we know what we're preparing for.",
      },
      {
        q: "How is the price worked out?",
        a: "A set price covers a home with one bedroom, one bathroom, one living room, one dining room, the kitchen with the oven, and the hallways. Each room beyond that adds the same flat amount, and extras like windows or the fridge are priced on top. You see the total before you book.",
      },
      {
        q: "Why do you ask why I need a deep clean?",
        a: "So we know what we're walking into before we confirm the date and send the team — a just-vacated flat and a house after building work need different preparation.",
      },
    ],
  },
  "end-of-tenancy-cleaning": {
    slug: "end-of-tenancy-cleaning",
    kind: "deep",
    priceLabel: "End of tenancy, 2-bed home",
    metaTitle: "End of Tenancy Cleaning in Oxford | SAAFI Cleaning",
    metaDescription:
      "End of tenancy cleaning in Oxford & Oxfordshire for tenants, landlords and letting agents. Two cleaners, kitchen and oven included, one fixed price.",
    name: "End of tenancy cleaning",
    h1: "End of tenancy cleaning in Oxford & Oxfordshire",
    intro: [
      "Moving out? We'll leave the property properly clean for the handover. An end of tenancy clean is our deep clean: two cleaners working top to bottom, with the kitchen, the oven and the hallways always included.",
      "It's one fixed price by the size of the property, not by the hour, so you know the whole cost before we arrive — and you can book it online in a minute.",
    ],
    quoteHref: "/quote?service=deep",
    goodFor: [
      {
        title: "Tenants moving out",
        text: "Hand the keys back on a property that's been cleaned top to bottom, with the kitchen and oven done as standard.",
      },
      {
        title: "Landlords between tenants",
        text: "Get the property ready for the next tenant or for viewings, without having to do it yourself.",
      },
      {
        title: "Letting agents",
        text: "Book the clean for the date the property is empty. We agree access with you on the confirmation call — keys, a keysafe, or someone there to let us in.",
      },
      {
        title: "Selling or moving in",
        text: "The same clean works for a house going on the market or a new home before your things arrive.",
      },
    ],
    faqs: [
      {
        q: "What does an end of tenancy clean include?",
        a: "Everything in our deep clean: two cleaners going through the whole property top to bottom — grease and limescale removed, tiles and grout, skirting boards and door frames, behind and under the furniture — with the kitchen, the oven and the hallways always included. The full room-by-room list is above.",
      },
      {
        q: "How much does end of tenancy cleaning cost in Oxford?",
        a: "A set price covers a home with one bedroom, one bathroom, one living room, one dining room, the kitchen with the oven, and the hallways. Each room beyond that adds the same flat amount, and extras like windows or the fridge are priced on top. The quote form shows your total before you book.",
      },
      {
        q: "Does the property need to be empty?",
        a: "It's best if it is — we can reach behind and under everything and the clean goes further. If some furniture is staying, tell us when you book.",
      },
      {
        q: "Do I need to be there?",
        a: "No. Plenty of people have already moved out by the day of the clean. We agree how we get in on the confirmation call.",
      },
    ],
  },

  "airbnb-cleaning": {
    slug: "airbnb-cleaning",
    kind: "standard",
    priceLabel: "2-bed changeover clean",
    priceFrequency: "one_off",
    metaTitle: "Airbnb & Short Let Cleaning in Oxford | SAAFI Cleaning",
    metaDescription:
      "Airbnb and short let changeover cleaning in Oxford & Oxfordshire. We can follow your listing's calendar so every checkout gets a clean before the next guest.",
    name: "Airbnb & short let cleaning",
    h1: "Airbnb & short let cleaning in Oxford",
    intro: [
      "Changeover cleans between guests for Airbnb hosts and short let owners across Oxford & Oxfordshire, from a family-run local team.",
      "Send us your listing's calendar link and we can see your checkouts as they're booked, so each changeover is planned in — rather than you messaging us every time a guest books.",
    ],
    quoteHref: "/quote?frequency=one_off",
    goodFor: [
      {
        title: "Hosts with one property",
        text: "Book a changeover for each checkout, or let us follow your calendar so it's planned for you.",
      },
      {
        title: "Hosts and managers with several",
        text: "Each property's calendar can be linked separately, so every checkout across all of them is in our diary.",
      },
      {
        title: "Hosts who aren't nearby",
        text: "We agree access once — a keysafe or a lockbox works well — so you don't need to be there for each clean.",
      },
    ],
    faqs: [
      {
        q: "How does the calendar link work?",
        a: "Airbnb and most booking sites give each listing a calendar link. Send it to us and new checkouts show up on our side as they're booked. We confirm each changeover clean before it goes in the diary.",
      },
      {
        q: "How is a changeover clean priced?",
        a: "The same way as our one-off cleans: by your rooms and the hours the clean needs. The quote form shows the price for your property before you book.",
      },
      {
        q: "What time do you clean?",
        a: "Between your guests' checkout and the next check-in. Tell us your usual times and we'll plan around them.",
      },
      {
        q: "Who brings the cleaning products?",
        a: "Whichever you prefer — we can bring everything, or use the products you keep at the property.",
      },
    ],
  },
};
