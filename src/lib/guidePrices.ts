import { quotePrice, recommendedHours, type PricingConfig } from "@/lib/pricing";
import { deepConfig, deepPrice } from "@/lib/deepClean";

/**
 * Every price a guide quotes, computed from the live config the quote form
 * uses — so a guide can never advertise a rate SAAFI has stopped charging.
 * Guides render these; they never hard-code a £ figure.
 *
 * Example homes: n bedrooms, 1 bathroom (2 from 3 beds up), no separate
 * living/dining rooms — the same shape as the home page's 2-bed example.
 * Standard prices assume the customer's own products, as on the home page.
 */
export type HomeRow = {
  label: string;
  oneOff: number;
  fortnightly: number;
  weekly: number;
  deep: number;
};

export type GuidePrices = {
  homes: HomeRow[];
  productSurcharge: number;
  minHours: number;
  maxHours: number;
  deepBase: number;
  deepRoom: number;
  deepExtra: number;
  /** The 2-bed row, which most guides lead with. */
  twoBed: HomeRow;
};

export function guidePrices(cfg: PricingConfig): GuidePrices {
  const homes = [1, 2, 3, 4].map((beds): HomeRow => {
    const baths = beds >= 3 ? 2 : 1;
    const rooms = { bedrooms: beds, bathrooms: baths, diningRooms: 0, livingRooms: 0 };
    const hours = recommendedHours(rooms, cfg);
    return {
      label: `${beds} bed, ${baths} bath`,
      oneOff: quotePrice(hours, true, cfg, "one_off"),
      fortnightly: quotePrice(hours, true, cfg, "fortnightly"),
      weekly: quotePrice(hours, true, cfg, "weekly"),
      deep: deepPrice({ bedrooms: beds, bathrooms: baths, livingRooms: 0, diningRooms: 0, additionalRooms: 0 }),
    };
  });
  return {
    homes,
    productSurcharge: cfg.productSurcharge,
    minHours: cfg.minHours,
    maxHours: cfg.maxHours,
    deepBase: deepConfig.basePrice,
    deepRoom: deepConfig.additionalRoomPrice,
    deepExtra: deepConfig.extraPrice,
    twoBed: homes[1],
  };
}
