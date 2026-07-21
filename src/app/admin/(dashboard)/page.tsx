import Link from "next/link";
import { listBookings, listCleaners, type BookingRow, type BookingStatus, type CleanerRow } from "@/lib/supabaseAdmin";
import { setBookingStatus, stopRecurring, assignCleaner } from "@/app/admin/actions";
import { formatGBP, FREQUENCY_LABEL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const COLUMNS: { status: BookingStatus; title: string; accent: string }[] = [
  { status: "requested", title: "Requested", accent: "border-amber-400" },
  { status: "confirmed", title: "Confirmed", accent: "border-sky-400" },
  { status: "completed", title: "Completed", accent: "border-violet-400" },
  { status: "paid", title: "Paid", accent: "border-emerald-500" },
];

const NEXT_ACTION: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
  requested: { to: "confirmed", label: "Confirm" },
  confirmed: { to: "completed", label: "Complete" },
  completed: { to: "paid", label: "Mark paid" },
};

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [allBookings, cleaners] = await Promise.all([listBookings(), listCleaners()]);
  const activeCleaners = cleaners.filter((c) => c.active);

  const needle = (q ?? "").trim().toLowerCase();
  const bookings = needle
    ? allBookings.filter((b) =>
        [b.customer_name, b.customer_email, b.customer_phone, b.postcode, b.reference, b.address_line]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
    : allBookings;
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Bookings pipeline</h1>
        <div className="flex items-center gap-2">
          <form method="GET" className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search name, phone, postcode…"
              className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </form>
          <Link
            href="/admin/new"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + New booking
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const rows = bookings.filter((b) => b.status === col.status);
          return (
            <section
              key={col.status}
              className={`rounded-xl border-t-4 ${col.accent} bg-white p-3 shadow-sm ring-1 ring-slate-200`}
            >
              <h2 className="mb-3 flex items-baseline justify-between px-1 font-semibold text-slate-800">
                {col.title}
                <span className="text-sm font-normal text-slate-400">{rows.length}</span>
              </h2>
              <div className="space-y-3">
                {rows.length === 0 && <p className="px-1 pb-2 text-sm text-slate-400">Nothing here.</p>}
                {rows.map((b) => (
                  <BookingCard key={b.id} b={b} cleaners={activeCleaners} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {cancelled.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-slate-500">
            Cancelled ({cancelled.length})
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {cancelled.map((b) => (
              <BookingCard key={b.id} b={b} cleaners={activeCleaners} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BookingCard({ b, cleaners }: { b: BookingRow; cleaners: CleanerRow[] }) {
  const next = NEXT_ACTION[b.status];
  const isRecurring = b.frequency !== "one_off";
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={`/admin/booking/${b.id}`} className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline">
          {b.customer_name}
        </Link>
        <span className="font-semibold text-emerald-700">{formatGBP(Number(b.quoted_price))}</span>
      </div>
      <div className="mt-1 text-slate-500">
        {b.preferred_date} · {b.hours}h · {b.postcode}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {isRecurring && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              b.recurring_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500 line-through"
            }`}
          >
            {FREQUENCY_LABEL[b.frequency]}
          </span>
        )}
        {(b.addons?.length ?? 0) > 0 && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
            +{b.addons.length} extra{b.addons.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {b.reference} ·{" "}
        <a href={`tel:${b.customer_phone}`} className="text-emerald-700 hover:underline">
          {b.customer_phone}
        </a>
      </div>
      {b.notes && <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-500">{b.notes}</p>}

      {cleaners.length > 0 && b.status !== "cancelled" && b.status !== "paid" && (
        <form action={assignCleaner} className="mt-2 flex items-center gap-1">
          <input type="hidden" name="id" value={b.id} />
          <select
            name="cleaner_id"
            defaultValue={b.cleaner_id ?? ""}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
          >
            <option value="">Unassigned</option>
            {cleaners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
            Set
          </button>
        </form>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {next && (
          <form action={setBookingStatus}>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="from" value={b.status} />
            <input type="hidden" name="to" value={next.to} />
            <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
              {next.label}
            </button>
          </form>
        )}
        {isRecurring && b.recurring_active && b.status !== "cancelled" && (
          <form action={stopRecurring}>
            <input type="hidden" name="id" value={b.id} />
            <button className="rounded-lg px-3 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100" title="No further cleans will be auto-booked after this one">
              Stop recurring
            </button>
          </form>
        )}
        {(b.status === "requested" || b.status === "confirmed") && (
          <form action={setBookingStatus}>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="from" value={b.status} />
            <input type="hidden" name="to" value="cancelled" />
            <button className="rounded-lg px-3 py-1 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600">
              Cancel
            </button>
          </form>
        )}
        {b.status === "cancelled" && (
          <form action={setBookingStatus}>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="from" value="cancelled" />
            <input type="hidden" name="to" value="requested" />
            <button className="rounded-lg px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
              Re-open
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
