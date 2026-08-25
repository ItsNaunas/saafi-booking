import type { MetadataRoute } from "next";
import { site } from "@/lib/business";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The CRM, the cleaner job links and the payment return page.
      disallow: ["/admin", "/c/", "/paid", "/api/"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
