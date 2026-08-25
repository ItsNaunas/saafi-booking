import type { MetadataRoute } from "next";
import { site } from "@/lib/business";

// Only the two public routes. /admin is middleware-guarded, /c/[token] is a
// per-cleaner magic link and /paid already sets robots noindex — none of them
// belong in a sitemap.

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: "monthly", priority: 1 },
    { url: `${site.url}/quote`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
