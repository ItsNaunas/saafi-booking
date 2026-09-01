"use client";

// Route-level error boundary for the admin dashboard. Without this, a thrown
// error below any page here fell through to Next's default error screen —
// blank and unbranded, and useless to a non-technical family mid-shift.

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">Something went wrong loading this page</h1>
      <p className="mt-2 text-sm text-slate-500">
        The booking system couldn&apos;t be reached — your data is safe.
      </p>
      <button
        onClick={reset}
        className="mt-5 bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  );
}
