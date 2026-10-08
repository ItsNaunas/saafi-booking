import type { MetadataRoute } from "next";
import { site } from "@/lib/business";
import { SERVICES } from "@/lib/services";

// The public routes only. /admin is middleware-guarded, /c/[token] is a
// per-cleaner magic link and /paid already sets robots noindex — none of them
// belong in a sitemap.

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: "monthly", priority: 1 },
    ...Object.keys(SERVICES).map((slug) => ({
      url: `${site.url}/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: `${site.url}/quote`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
