import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Card saved — SAAFI Cleaning Service",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where Stripe drops the customer after they've saved a card — or backed out of
 * it. Deliberately inert, like the payment page: the card is attached by the
 * webhook, not by anyone reaching this URL, so sharing it achieves nothing.
 */
export default async function CardSavedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; cancelled?: string }>;
}) {
  const { ref, cancelled } = await searchParams;
  const backedOut = cancelled === "1";

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 py-16 text-center">
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full ${
          backedOut ? "bg-slate-200 text-slate-500" : "bg-brand-100 text-brand-700"
        }`}
      >
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
          {backedOut ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="m4.5 12.5 5 5 10-11" />}
        </svg>
      </span>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
        {backedOut ? "No card saved" : "That's your card saved"}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-slate-600">
        {backedOut ? (
          <>
            No problem at all — nothing has changed. We&apos;ll send you a payment link after
            your clean as usual.
          </>
        ) : (
          <>
            Nothing has been charged. After each clean we&apos;ll take whatever that visit
            actually came to, and email you a receipt. Tell us any time you&apos;d rather stop.
          </>
        )}
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
