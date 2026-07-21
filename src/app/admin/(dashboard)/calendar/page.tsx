import { listBookings, type BookingRow } from "@/lib/supabaseAdmin";
import { formatGBP } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  completed: "bg-violet-100 text-violet-800",
  paid: "bg-emerald-100 text-emerald-800",
};

export default async function CalendarPage() {
  const bookings = (await listBookings()).filter((b) => b.status !== "cancelled");

  // Agenda view: today + next 6 weeks, grouped by date.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => b.preferred_date >= today);
  const past = bookings.filter((b) => b.preferred_date < today).slice(-10).reverse();

  const byDate = new Map<string, BookingRow[]>();
  for (const b of upcoming) {
    (byDate.get(b.preferred_date) ?? byDate.set(b.preferred_date, []).get(b.preferred_date)!).push(b);
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Calendar</h1>
      {byDate.size === 0 && <p className="text-slate-500">No upcoming cleans booked.</p>}
      <div className="space-y-5">
        {[...byDate.entries()].map(([date, rows]) => (
          <section key={date}>
            <h2 className="mb-2 font-semibold text-slate-700">
              {new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {date === today && (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  today
                </span>
              )}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((b) => (
                <Card key={b.id} b={b} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-slate-500">
            Recent past cleans ({past.length})
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {past.map((b) => (
              <Card key={b.id} b={b} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Card({ b }: { b: BookingRow }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900">{b.customer_name}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[b.status]}`}>
          {b.status}
        </span>
      </div>
      <div className="mt-1 text-slate-500">
        {b.hours}h · {b.address_line}, {b.postcode}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
        <a href={`tel:${b.customer_phone}`} className="text-emerald-700 hover:underline">
          {b.customer_phone}
        </a>
        <span className="font-semibold text-emerald-700">{formatGBP(Number(b.quoted_price))}</span>
      </div>
    </article>
  );
}
