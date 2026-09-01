import { listBookings, listCustomers, paidSoFar } from "@/lib/supabaseAdmin";
import { formatGBP } from "@/lib/pricing";
import { londonWallClock } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [bookings, customers] = await Promise.all([listBookings(), listCustomers()]);

  // Revenue is what actually arrived — paidSoFar() is gross takings net of
  // refunds (the netting lives in lib/money.ts, once).
  const takenFor = paidSoFar;
  const paid = bookings.filter((b) => takenFor(b) > 0);
  const { date: today } = londonWallClock(new Date());
  const upcoming = bookings.filter(
    (b) =>
      (b.status === "confirmed" || b.status === "requested") &&
      b.preferred_date >= today
  );

  // Revenue by month (by preferred_date month)
  const byMonth = new Map<string, number>();
  for (const b of paid) {
    const m = b.preferred_date.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + takenFor(b));
  }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  const statusCounts = ["requested", "confirmed", "completed", "paid", "no_access", "cancelled"].map((s) => ({
    s,
    n: bookings.filter((b) => b.status === s).length,
  }));

  const repeatCustomers = customers.filter((c) => (c.bookings?.[0]?.count ?? 0) > 1).length;
  const repeatRate = customers.length ? Math.round((repeatCustomers / customers.length) * 100) : 0;
  const recurringActive = new Set(
    bookings.filter((b) => b.frequency !== "one_off" && b.recurring_active && b.status !== "cancelled").map((b) => b.series_id ?? b.id)
  ).size;
  const pipelineValue = upcoming.reduce((s, b) => s + Number(b.quoted_price), 0);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Reports</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue collected" value={formatGBP(paid.reduce((s, b) => s + takenFor(b), 0))} sub="money actually taken, net of refunds" />
        <Stat label="Upcoming pipeline" value={formatGBP(pipelineValue)} sub={`${upcoming.length} clean${upcoming.length === 1 ? "" : "s"} booked`} />
        <Stat label="Recurring customers" value={String(recurringActive)} sub="active repeat series" />
        <Stat label="Repeat rate" value={`${repeatRate}%`} sub={`${repeatCustomers} of ${customers.length} customers rebook`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 font-semibold text-slate-800">Revenue by month (paid)</h2>
          {months.length === 0 && <p className="text-sm text-slate-400">No paid bookings yet.</p>}
          <div className="space-y-2">
            {months.map(([m, v]) => {
              const max = Math.max(...months.map(([, x]) => x));
              return (
                <div key={m} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-slate-500">{m}</span>
                  <div className="h-4 flex-1 bg-slate-100">
                    <div
                      className="h-4 bg-brand-500"
                      style={{ width: `${Math.max(4, (v / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-semibold text-slate-800">{formatGBP(v)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 font-semibold text-slate-800">Bookings by status</h2>
          <div className="space-y-2 text-sm">
            {statusCounts.map(({ s, n }) => (
              <div key={s} className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
                <span className="capitalize text-slate-600">{s.replace("_", " ")}</span>
                <span className="font-semibold text-slate-900">{n}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
