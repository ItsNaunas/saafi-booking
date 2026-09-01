// Server-side pricing loader: pricing_config + service_areas from Supabase,
// merged over the static defaults, cached for 60s. Falls back to the static
// config whenever the DB is unreachable — the quote flow must never go down.

import { pricingConfig, type PricingConfig, type Addon } from "./pricing";
import { secret } from "./env";

const TTL_MS = 60_000;
let cached: { cfg: PricingConfig; addons: Addon[]; at: number } | null = null;

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
  discount_weekly_pct: (c, v) => (c.discounts.weekly = v),
  discount_fortnightly_pct: (c, v) => (c.discounts.fortnightly = v),
  discount_four_weekly_pct: (c, v) => (c.discounts.four_weekly = v),
  slot_minutes: (c, v) => (c.scheduling.slotMinutes = v),
  lead_time_hours: (c, v) => (c.scheduling.leadTimeHours = v),
  max_days_ahead: (c, v) => (c.scheduling.maxDaysAhead = v),
};

export async function loadPricingConfig(): Promise<PricingConfig> {
  return (await loadPricingAndAddons()).cfg;
}

/** Active add-ons, DB-priced. Empty when the DB is unreachable. */
export async function loadAddons(): Promise<Addon[]> {
  return (await loadPricingAndAddons()).addons;
}

export async function loadPricingAndAddons(): Promise<{ cfg: PricingConfig; addons: Addon[] }> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;

  const url = process.env.SUPABASE_URL;
  const key = secret("SUPABASE_SECRET_KEY");
  // deep-clone the defaults so DB values never mutate the module constant
  const cfg: PricingConfig = structuredClone(pricingConfig);
  let addons: Addon[] = [];

  if (url && key) {
    try {
      const headers = { apikey: key, Authorization: `Bearer ${key}` };
      const [pricingRes, areasRes, addonsRes] = await Promise.all([
        // Data-cache revalidation, not no-store: no-store threw during the ISR
        // landing-page prerender and the catch baked fallback defaults into it.
        fetch(`${url}/rest/v1/pricing_config?select=key,value`, { headers, next: { revalidate: 60 } }),
        fetch(`${url}/rest/v1/service_areas?select=prefix`, { headers, next: { revalidate: 60 } }),
        // select=* so the fetch keeps working before/after the `hours` column migration
        fetch(`${url}/rest/v1/addons?select=*&active=eq.true&order=sort.asc`, {
          headers,
          next: { revalidate: 60 },
        }),
      ]);
      if (pricingRes.ok) {
        const rows = (await pricingRes.json()) as { key: string; value: string | number }[];
        for (const row of rows) KEY_MAP[row.key]?.(cfg, Number(row.value));
      }
      if (areasRes.ok) {
        const rows = (await areasRes.json()) as { prefix: string }[];
        cfg.serviceAreaPrefixes = rows.map((r) => r.prefix);
      }
      if (addonsRes.ok) {
        const rows = (await addonsRes.json()) as {
          key: string;
          label: string;
          price: string | number;
          hours?: string | number | null;
        }[];
        addons = rows.map((r) => ({
          key: r.key,
          label: r.label,
          price: Number(r.price),
          hours: Number(r.hours ?? 0),
        }));
      }
      // Only cache fully-successful loads — a transient failure must not stick for 60s.
      if (pricingRes.ok && areasRes.ok && addonsRes.ok) {
        cached = { cfg, addons, at: Date.now() };
      }
      return { cfg, addons };
    } catch (e) {
      console.error("[pricing] DB load failed, using defaults:", e);
    }
  }
  return { cfg, addons };
}

/** Bust the 60s cache after the admin edits pricing. */
export function invalidatePricingCache() {
  cached = null;
}
