import type { ComponentType } from "react";
import type { GuidePrices } from "@/lib/guidePrices";
import * as cost from "@/content/guides/how-much-does-a-cleaner-cost-in-oxford";
import * as deepVsRegular from "@/content/guides/deep-clean-vs-regular-clean";
import * as endOfTenancy from "@/content/guides/end-of-tenancy-cleaning-checklist";
import * as howOften from "@/content/guides/how-often-should-you-get-a-cleaner";

/**
 * The guides (the site's blog). One file per guide in src/content/guides,
 * registered here. A guide goes live on its `date` by itself: before then it
 * is left out of /guides and the sitemap, and its own URL renders noindex
 * with a "scheduled" banner — so a batch can be approved at once and still
 * release weekly. Guide pages revalidate hourly, which is what flips them.
 *
 * Rules for new guides: real prices only via GuidePrices (never a typed £),
 * and no claim the home page or lib/business.ts doesn't already make.
 */
export type GuideMeta = {
  slug: string;
  title: string;
  /** <title>: under ~60 characters so Google doesn't truncate it. */
  metaTitle: string;
  /** Under ~155 characters. */
  description: string;
  /** Publish date, YYYY-MM-DD (London). */
  date: string;
  readMins: number;
  cta: { href: string; text: string };
};

export type Guide = { meta: GuideMeta; Body: ComponentType<{ p: GuidePrices }> };

const ALL: Guide[] = [cost, deepVsRegular, endOfTenancy, howOften].map((m) => ({
  meta: m.meta,
  Body: m.default,
}));

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

export function isPublished(meta: GuideMeta): boolean {
  return meta.date <= londonToday();
}

/** Every guide, newest first — including scheduled ones. */
export function allGuides(): Guide[] {
  return [...ALL].sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}

/** Live guides only, newest first. */
export function publishedGuides(): Guide[] {
  return allGuides().filter((g) => isPublished(g.meta));
}

export function guideBySlug(slug: string): Guide | undefined {
  return ALL.find((g) => g.meta.slug === slug);
}

export function formatGuideDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}
