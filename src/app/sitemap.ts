import type { MetadataRoute } from "next";
import { site } from "@/lib/business";
import { SERVICES } from "@/lib/services";
import { publishedGuides } from "@/lib/guides";

// The public routes only. /admin is middleware-guarded, /c/[token] is a
// per-cleaner magic link and /paid already sets robots noindex — none of them
// belong in a sitemap. Scheduled guides join on their publish date.

// Hourly, so a guide going live on its date reaches the sitemap without a deploy.
export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: "monthly", priority: 1 },
    ...Object.keys(SERVICES).map((slug) => ({
      url: `${site.url}/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: `${site.url}/guides`, changeFrequency: "weekly", priority: 0.7 },
    ...publishedGuides().map((g) => ({
      url: `${site.url}/guides/${g.meta.slug}`,
      lastModified: g.meta.date,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${site.url}/quote`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
