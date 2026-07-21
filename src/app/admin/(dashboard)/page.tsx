import { listBookings, type BookingRow, type BookingStatus } from "@/lib/supabaseAdmin";
import { setBookingStatus } from "@/app/admin/actions";
import { formatGBP } from "@/lib/pricing";

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

export default async function PipelinePage() {
  const bookings = await listBookings();
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Bookings pipeline</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const rows = bookings.filter((b) => b.status === col.status);
          return (
            <section key={col.status} className={`rounded-xl border-t-4 ${col.accent} bg-white p-3 shadow-sm ring-1 ring-slate-200`}>
              <h2 className="mb-3 flex items-baseline justify-between px-1 font-semibold text-slate-800">
                {col.title}
                <span className="text-sm font-normal text-slate-400">{rows.length}</span>
              </h2>
              <div className="space-y-3">
                {rows.length === 0 && (
                  <p className="px-1 pb-2 text-sm text-slate-400">Nothing here.</p>
                )}
                {rows.map((b) => (
                  <BookingCard key={b.id} b={b} />
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
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BookingCard({ b }: { b: BookingRow }) {
  const next = NEXT_ACTION[b.status];
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-slate-900">{b.customer_name}</span>
        <span className="font-semibold text-emerald-700">{formatGBP(Number(b.quoted_price))}</span>
      </div>
      <div className="mt-1 text-slate-500">
        {b.preferred_date} · {b.hours}h · {b.postcode}
      </div>
      <div className="text-slate-500">
        {b.bedrooms}bd/{b.bathrooms}ba · {b.customer_provides_products ? "their products" : "our products"}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {b.reference} · <a href={`tel:${b.customer_phone}`} className="text-emerald-700 hover:underline">{b.customer_phone}</a>
      </div>
      {b.notes && <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-500">{b.notes}</p>}
      <div className="mt-2 flex gap-2">
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
