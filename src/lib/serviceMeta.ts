import type { Metadata } from "next";
import { loadPricingAndAddons } from "@/lib/pricingServer";
import { formatGBP, quotePrice, recommendedHours } from "@/lib/pricing";
import { deepPrice } from "@/lib/deepClean";
import { SERVICES, type ServiceSlug } from "@/lib/services";

/**
 * Service-page metadata with the live "from" price in the description, so the
 * search result itself answers "how much?" — the pages sat around position 6
 * with no clicks (Search Console, Aug–Nov 2026). Same example home as the page.
 */
export async function serviceMetadata(slug: ServiceSlug): Promise<Metadata> {
  const s = SERVICES[slug];
  let description = s.metaDescription;
  try {
    const { cfg } = await loadPricingAndAddons();
    const rooms = { bedrooms: 2, bathrooms: 1, diningRooms: 0, livingRooms: 0 };
    const amount =
      s.kind === "deep"
        ? deepPrice({ ...rooms, additionalRooms: 0 })
        : quotePrice(recommendedHours(rooms, cfg), true, cfg, s.priceFrequency ?? "one_off");
    description = `From ${formatGBP(amount)} (${s.priceLabel}). ${s.metaDescription}`;
  } catch {
    // Pricing unavailable: the plain description still stands.
  }
  return {
    title: s.metaTitle,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: { title: s.metaTitle, description, url: `/${slug}` },
  };
}
