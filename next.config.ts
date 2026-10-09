import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response header.
  poweredByHeader: false,
  // One host only. www and the apex both served 200, which search engines can
  // read as two copies of the site; www now 301s to the apex, path intact.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.saaficleaningservice.com" }],
        destination: "https://saaficleaningservice.com/:path*",
        statusCode: 301,
      },
    ];
  },
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
  // Baseline browser hardening. HSTS is set by Vercel at the edge already.
  // No CSP yet: Stripe's hosted pages are off-site so nothing here embeds
  // third-party script, but a CSP still needs a nonce pass before it can be
  // added without breaking inline styles — a deliberate later step.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The admin and the cleaner/customer link pages must never be framed
          // by another site; the public pages have no reason to be either.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The cleaner portal asks for location on Start/Finish, so that one
          // stays allowed for our own origin; nothing else is needed.
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
