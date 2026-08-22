import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment received — SAAFI Cleaning Service",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where Stripe drops the customer after a successful payment. Deliberately dumb:
 * the booking is marked paid by the webhook, not by anyone reaching this page,
 * so a visitor who bookmarks or shares the URL changes nothing.
 */
export default async function PaidPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4.5 12.5 5 5 10-11" />
        </svg>
      </span>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
        Thank you — that&apos;s paid
      </h1>
      <p className="mx-auto mt-3 max-w-md text-slate-600">
        Your receipt is on its way from Stripe. We&apos;ll see you on the day — if anything
        changes before then, just give us a ring.
      </p>

      {ref && (
        <p className="mt-6 rounded-full bg-white px-4 py-2 text-sm text-slate-500 ring-1 ring-slate-200">
          Booking reference <span className="font-semibold text-slate-900">{ref}</span>
        </p>
      )}

      <Link
        href="/"
        className="mt-8 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Back to SAAFI
      </Link>
    </main>
  );
}
