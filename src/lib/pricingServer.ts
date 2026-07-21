// Server-side pricing loader: pricing_config + service_areas from Supabase,
// merged over the static defaults, cached for 60s. Falls back to the static
// config whenever the DB is unreachable — the quote flow must never go down.

import { pricingConfig, type PricingConfig } from "./pricing";

const TTL_MS = 60_000;
let cached: { cfg: PricingConfig; at: number } | null = null;

const KEY_MAP: Record<string, (cfg: PricingConfig, v: number) => void> = {
  hourly_rate: (c, v) => (c.hourlyRate = v),
  product_surcharge: (c, v) => (c.productSurcharge = v),
  base_hours: (c, v) => (c.baseHours = v),
  hours_per_bedroom: (c, v) => (c.hoursPerRoom.bedroom = v),
  hours_per_bathroom: (c, v) => (c.hoursPerRoom.bathroom = v),
  hours_per_dining_room: (c, v) => (c.hoursPerRoom.diningRoom = v),
  hours_per_living_room: (c, v) => (c.hoursPerRoom.livingRoom = v),
  min_hours: (c, v) => (c.minHours = v),
  max_hours: (c, v) => (c.maxHours = v),
};

export async function loadPricingConfig(): Promise<PricingConfig> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.cfg;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  // deep-clone the defaults so DB values never mutate the module constant
  const cfg: PricingConfig = structuredClone(pricingConfig);

  if (url && key) {
    try {
      const headers = { apikey: key, Authorization: `Bearer ${key}` };
      const [pricingRes, areasRes] = await Promise.all([
        fetch(`${url}/rest/v1/pricing_config?select=key,value`, { headers, cache: "no-store" }),
        fetch(`${url}/rest/v1/service_areas?select=prefix`, { headers, cache: "no-store" }),
      ]);
      if (pricingRes.ok) {
        const rows = (await pricingRes.json()) as { key: string; value: string | number }[];
        for (const row of rows) KEY_MAP[row.key]?.(cfg, Number(row.value));
      }
      if (areasRes.ok) {
        const rows = (await areasRes.json()) as { prefix: string }[];
        cfg.serviceAreaPrefixes = rows.map((r) => r.prefix);
      }
      cached = { cfg, at: Date.now() };
    } catch (e) {
      console.error("[pricing] DB load failed, using defaults:", e);
    }
  }
  return cfg;
}

/** Bust the 60s cache after the admin edits pricing. */
export function invalidatePricingCache() {
  cached = null;
}
