import type { Metadata } from "next";
import Link from "next/link";
import QuoteWizard from "@/components/QuoteWizard";
import { loadPricingAndAddons } from "@/lib/pricingServer";
import { normalisePostcode } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Get a free quote — SAAFI Cleaning Service",
  description: "Instant quote for your home clean. Pick your rooms, get a price, book in minutes.",
};

export const dynamic = "force-dynamic";

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{
    postcode?: string;
    bedrooms?: string;
    bathrooms?: string;
    frequency?: string;
  }>;
}) {
  const [{ cfg, addons }, params] = await Promise.all([
    loadPricingAndAddons(),
    searchParams,
  ]);
  const initialPostcode = normalisePostcode(params.postcode ?? "");

  // Rooms/frequency handed over by the hero search bar. Only treated as "the hero
  // already asked" when at least one room count actually came through.
  const num = (v: string | undefined, max: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
  };
  const bedrooms = num(params.bedrooms, 6);
  const bathrooms = num(params.bathrooms, 4);
  const initialRooms =
    bedrooms !== undefined || bathrooms !== undefined
      ? { ...(bedrooms !== undefined && { bedrooms }), ...(bathrooms !== undefined && { bathrooms }) }
      : undefined;
  const initialFrequency = (["one_off", "weekly", "fortnightly", "four_weekly"] as const).find(
    (f) => f === params.frequency
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto mb-8 max-w-lg text-center">
        <Link href="/" className="text-sm font-medium text-brand-700 hover:underline">
          ← SAAFI Cleaning Service
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Get your free quote</h1>
      </div>
      <QuoteWizard
        cfg={cfg}
        addons={addons}
        initialPostcode={initialPostcode}
        initialRooms={initialRooms}
        initialFrequency={initialFrequency}
      />
    </main>
  );
}
