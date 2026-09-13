"use client";

import { contact } from "@/lib/business";

// Route-segment error boundary for the customer's booking page. A database
// blip here used to surface as Next's bare crash screen on a link we had
// just emailed someone — which reads as "your booking has gone", not "try
// again". The booking is untouched; only the render failed.

export default function BookingPageError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-800">SAAFI CLEANING</p>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Couldn&apos;t load your booking</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your booking is safe &mdash; this page just didn&apos;t load. Try again, or ring us on{" "}
          <a href={`tel:${contact.phoneHref}`} className="font-semibold text-brand-700">
            {contact.phoneDisplay}
          </a>
          .
        </p>
        <button
          onClick={() => reset()}
          className="mt-4 w-full rounded-full bg-brand-600 px-4 py-3 text-base font-semibold text-white hover:bg-brand-700"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
