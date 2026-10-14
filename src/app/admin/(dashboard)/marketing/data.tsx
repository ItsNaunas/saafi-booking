// What every marketing tab loads, with one place that turns "the migration
// hasn't been pasted" into a friendly notice instead of an error page.
import { loadAudience } from "@/lib/marketing";
import { londonWallClock } from "@/lib/scheduling";
import type { Profile } from "@/lib/segments";
import type { QuoteLeadRow, BookingRow } from "@/lib/supabaseAdmin";

export type Audience = { profiles: Profile[]; leads: QuoteLeadRow[]; bookings: BookingRow[] };

export async function loadAudienceOrMissing(): Promise<Audience | null> {
  try {
    return await loadAudience();
  } catch (e) {
    if (/PGRST205|42P01/.test(String(e))) return null;
    throw e;
  }
}

/** Outward codes anyone in the audience lives in, sorted. */
export function areasOf(profiles: Profile[]): string[] {
  return [...new Set(profiles.map((p) => p.area).filter((a): a is string => !!a))].sort();
}

export function MigrationNotice({ file = "supabase/2026-10-12-marketing.sql" }: { file?: string }) {
  return (
    <p className="bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
      One-time setup needed: paste <code>{file}</code> into the Supabase SQL editor, then reload this page.
    </p>
  );
}

/** The request's clock, read once in a loader rather than during render. */
export function requestClock(): { now: number; today: string; daysAgoIso: (n: number) => string } {
  const now = Date.now();
  return {
    now,
    today: londonWallClock(new Date(now)).date,
    daysAgoIso: (n) => new Date(now - n * 86_400_000).toISOString(),
  };
}
