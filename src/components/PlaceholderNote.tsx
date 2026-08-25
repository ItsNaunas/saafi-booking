import { UNCONFIRMED } from "@/lib/business";

/**
 * The visible catch on unconfirmed content.
 *
 * Two sections make claims that are not SAAFI's to have invented for them:
 * what customers said, and what checks the cleaners have passed. Until those
 * are real, they say so on the page itself rather than in a code comment
 * nobody reads at deploy time.
 *
 * Renders nothing once `UNCONFIRMED` is false in lib/business.ts, which is the
 * single switch that removes every one of these at once.
 */
export default function PlaceholderNote({ children }: { children: string }) {
  if (!UNCONFIRMED) return null;
  return (
    <p className="mt-5 inline-block border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
      Placeholder — {children}
    </p>
  );
}
