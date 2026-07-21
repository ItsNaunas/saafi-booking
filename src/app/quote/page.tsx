import type { Metadata } from "next";
import Link from "next/link";
import QuoteWizard from "@/components/QuoteWizard";
import { loadPricingAndAddons } from "@/lib/pricingServer";

export const metadata: Metadata = {
  title: "Get a free quote — SAAFI Cleaning Service",
  description: "Instant quote for your home clean. Pick your rooms, get a price, book in minutes.",
};

export const dynamic = "force-dynamic";

export default async function QuotePage() {
  const { cfg, addons } = await loadPricingAndAddons();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto mb-8 max-w-lg text-center">
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline">
          ← SAAFI Cleaning Service
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Get your free quote</h1>
      </div>
      <QuoteWizard cfg={cfg} addons={addons} />
    </main>
  );
}
