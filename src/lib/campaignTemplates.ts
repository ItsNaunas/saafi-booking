// Starter copy for campaigns, so nobody faces a blank box. Every line is
// editable after it's dropped in, and none of them invents a claim: no
// discounts or dates the family hasn't decided — those go in the [brackets].

export type CampaignTemplate = {
  key: string;
  label: string;
  subject: string;
  heading: string;
  body: string;
  highlight: string | null;
  cta_label: string;
  cta_url: string;
};

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://saaficleaningservice.com";

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    key: "seasonal",
    label: "Seasonal offer",
    subject: "A fresh start for [spring], {first_name}",
    heading: "Time for a proper [spring] clean?",
    body: "The change of season is the best time to get on top of the jobs a weekly tidy doesn't reach.\n\nBook before [date] and we'll [your offer].",
    highlight: "[Your offer, e.g. 10% off any deep clean booked before 31 March]",
    cta_label: "Book a clean",
    cta_url: `${site()}/quote`,
  },
  {
    key: "come_back",
    label: "We miss you",
    subject: "It's been a while, {first_name}",
    heading: "We'd love to clean for you again",
    body: "It's been a little while since your last clean with us. If life got busy, we get it — booking takes a minute and you can pick any slot that suits.\n\nIf anything wasn't right last time, just reply and tell us.",
    highlight: null,
    cta_label: "Book a clean",
    cta_url: `${site()}/quote`,
  },
  {
    key: "quiet_day",
    label: "Slots near you",
    subject: "We're in your area on [Tuesday], {first_name}",
    heading: "A cleaner is nearby on [Tuesdays]",
    body: "We've got a cleaner working near you on [Tuesday] and a few slots free around them.\n\nIf you'd like a clean that day, book online or just reply to this email.",
    highlight: null,
    cta_label: "Book that day",
    cta_url: `${site()}/quote`,
  },
  {
    key: "upgrade",
    label: "Go more often",
    subject: "Fancy a little more help, {first_name}?",
    heading: "A clean more often?",
    body: "Plenty of our regulars find a more frequent plan keeps the house much easier to manage between visits.\n\nReply to this email and we'll move your plan over — same cleaner where we can, and you can change back any time.",
    highlight: null,
    cta_label: "See regular prices",
    cta_url: `${site()}/regular-cleaning`,
  },
  {
    key: "news",
    label: "News or price change",
    subject: "A quick update from SAAFI",
    heading: "Some news from us, {first_name}",
    body: "[What's changing, in one or two sentences.]\n\n[What it means for them, and when.]\n\nAny questions, just reply — it comes straight to the family.",
    highlight: null,
    cta_label: "Visit our site",
    cta_url: site(),
  },
];
