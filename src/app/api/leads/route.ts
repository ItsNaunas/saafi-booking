import { NextRequest, NextResponse } from "next/server";
import { upsertQuoteLead } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The quote form calls this as soon as someone types a valid email, so a quote
 * abandoned half way is still a person we can follow up with (if they left the
 * marketing box ticked). One row per address — a second visit overwrites the
 * first — so this can't be used to grow the table without bound.
 *
 * Always answers 200 with no detail: the form never waits on it and an
 * attacker learns nothing from it.
 */
export async function POST(req: NextRequest) {
  const ok = NextResponse.json({ ok: true });
  let d: Record<string, unknown>;
  try {
    d = await req.json();
  } catch {
    return ok;
  }
  if (typeof d.website === "string" && d.website.trim()) return ok; // honeypot

  const str = (k: string, max: number) => (typeof d[k] === "string" ? (d[k] as string).trim().slice(0, max) : "");
  const email = str("email", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return ok;

  const num = (k: string) => {
    const n = Number(d[k]);
    return Number.isFinite(n) && n >= 0 && n < 10_000 ? n : undefined;
  };
  const date = str("date", 10);
  try {
    await upsertQuoteLead({
      email,
      name: str("name", 120) || null,
      phone: str("phone", 40) || null,
      postcode: str("postcode", 10).toUpperCase().replace(/\s+/g, "") || null,
      quote: {
        service: str("service", 20) === "deep" ? "deep" : "standard",
        frequency: str("frequency", 20) || "one_off",
        hours: num("hours"),
        price: num("price"),
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      },
      marketing_ok: typeof d.marketingOk === "boolean" ? d.marketingOk : null,
    });
  } catch (e) {
    // Pre-migration, or a DB blip: a lost lead must never surface to the customer.
    console.error("[leads] capture failed:", String(e).slice(0, 200));
  }
  return ok;
}
