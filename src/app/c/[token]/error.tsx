"use client";

// Route-segment error boundary for the cleaner portal. Without this, a
// rendering failure here fell through to Next's default crash screen — no
// reassurance, no way back in, and standing at a front door that reads as
// "the booking is gone" rather than "reload."

export default function CleanerJobsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-800">SAAFI CLEANING</p>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Couldn&apos;t load your jobs</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your jobs are safe — try again, or ring the office.
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
