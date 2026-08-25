import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF first, WebP as the fallback. AVIF encodes ~50% slower on the very
    // first request for a given size, then compresses ~20% smaller than WebP
    // for every cached request after it — the right trade for a landing page
    // whose images never change.
    formats: ["image/avif", "image/webp"],
    // A year: these are content images with hashed optimiser URLs, so a cached
    // copy can never go stale against a replacement.
    minimumCacheTTL: 31_536_000,
  },
};

export default nextConfig;
