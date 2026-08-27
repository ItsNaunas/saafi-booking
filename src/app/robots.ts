import type { MetadataRoute } from "next";
import { site, DEMO_CONTENT } from "@/lib/business";

export default function robots(): MetadataRoute.Robots {
  // While lib/business.ts holds invented reviews, claims and a drama-range
  // phone number, the whole site is closed to crawlers. An unindexed demo is
  // not "published"; a crawled one is, and publishing invented consumer
  // reviews is a banned practice under the DMCC Act.
  if (DEMO_CONTENT) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The CRM, the cleaner job links, customer booking pages and the
      // payment return page.
      disallow: ["/admin", "/c/", "/b/", "/paid", "/api/"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
