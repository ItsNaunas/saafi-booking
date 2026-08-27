import { ChevronDown } from "lucide-react";
import Link from "next/link";
import {
  listBookings,
  listCleaners,
  listPendingAdjustments,
  type BookingRow,
  type BookingStatus,
  type CleanerRow,
} from "@/lib/supabaseAdmin";
import { setBookingStatus, stopRecurring, assignCleaner } from "@/app/admin/actions";
import {
  busyFromBooking,
  fitForJob,
  toMinutes,
  type BusyBlock,
  type CleanerFit,
  type SchedulableCleaner,
} from "@/lib/scheduling";
import { formatGBP, FREQUENCY_LABEL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const COLUMNS: { status: BookingStatus; title: string; accent: string }[] = [
  { status: "requested", title: "Requested", accent: "bg-amber-400" },
  { status: "confirmed", title: "Confirmed", accent: "bg-blue-500" },
  { status: "completed", title: "Completed", accent: "bg-violet-400" },
  { status: "paid", title: "Paid", accent: "bg-brand-500" },
];

/**
 * Shown against each name in the assignment dropdown. The office is still free to
 * pick a busy cleaner — they sometimes know something the calendar doesn't — but
 * they now find out before choosing rather than from a warning afterwards.
 */
const FIT_SUFFIX: Record<CleanerFit, string> = {
  free: "",
  busy: " — already on a job then",
  off: " — not working then",
};

const NEXT_ACTION: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
  requested: { to: "confirmed", label: "Confirm" },
  confirmed: { to: "completed", label: "Complete" },
  completed: { to: "paid", label: "Mark paid" },
  // no_access deliberately has no single "next" — the office picks between
  // writing it off and charging for it, and that choice lives on the booking page.
};

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [allBookings, cleaners, pendingAdjustments] = await Promise.all([
    listBookings(),
    listCleaners(),
    // Tolerate the table not existing yet (pre-migration).
    listPendingAdjustments().catch(() => []),
  ]);
  const activeCleaners = cleaners.filter((c) => c.active);

  // Everything already occupying each day, built once from the bookings we have
  // in hand — annotating the assignment dropdown costs no extra queries.
  const busyByDate = new Map<string, BusyBlock[]>();
  for (const bk of allBookings) {
    if (bk.status === "cancelled" || bk.status === "no_access") continue;
    const block = busyFromBooking(bk);
    if (!block) continue;
    const list = busyByDate.get(bk.preferred_date);
    if (list) list.push({ ...block, id: bk.id } as BusyBlock & { id: string });
    else busyByDate.set(bk.preferred_date, [{ ...block, id: bk.id } as BusyBlock & { id: string }]);
  }
  /** Which cleaners could take this job, keyed by cleaner id. */
  const fitFor = (bk: BookingRow): Map<string, CleanerFit> => {
    const out = new Map<string, CleanerFit>();
    const start = bk.start_time ? toMinutes(bk.start_time) : null;
    if (start === null) return out; // no time yet — nothing to judge them against
    const end = start + Math.round(Number(bk.hours) * 60);
    const busy = (busyByDate.get(bk.preferred_date) ?? []).filter(
      (x) => (x as BusyBlock & { id?: string }).id !== bk.id
    );
    for (const c of schedulable) {
      out.set(c.id, fitForJob({ date: bk.preferred_date, start, end, cleaner: c, busy }));
    }
    return out;
  };

  const schedulable: SchedulableCleaner[] = activeCleaners.map((c) => ({
    id: c.id,
    name: c.name,
    worksDays: Array.isArray(c.works_days) ? c.works_days.map(Number) : [],
    worksFrom: c.works_from ?? "09:00",
    worksTo: c.works_to ?? "17:00",
  }));

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
              className="w-56 border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </form>
          <Link
            href="/admin/new"
            className="bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + New booking
          </Link>
        </div>
      </div>

      {pendingAdjustments.length > 0 && (
        <div className="mb-4 bg-amber-50 p-4 ring-1 ring-amber-300">
          <h2 className="font-semibold text-amber-900">
            {pendingAdjustments.length} price change
            {pendingAdjustments.length === 1 ? "" : "s"} waiting for you
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {pendingAdjustments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/booking/${a.booking_id}`}
                  className="font-medium text-amber-900 underline hover:no-underline"
                >
                  {a.bookings?.customer_name ?? "Booking"}
                </Link>{" "}
                — {a.from_hours}h booked, {a.to_hours}h worked ·{" "}
                {formatGBP(Number(a.from_price))} → {formatGBP(Number(a.to_price))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const rows = bookings.filter((b) => b.status === col.status);
          return (
            <section
              key={col.status}
              className="bg-white p-3 shadow-sm ring-1 ring-slate-200"
            >
              <h2 className="mb-3 flex items-center justify-between px-1 font-semibold text-slate-800">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${col.accent}`} aria-hidden="true" />
                  {col.title}
                </span>
                <span className="text-sm font-normal text-slate-400">{rows.length}</span>
              </h2>
              <div className="space-y-3">
                {rows.length === 0 && <p className="px-1 pb-2 text-sm text-slate-400">Nothing here.</p>}
                {rows.map((b) => (
                  <BookingCard key={b.id} b={b} cleaners={activeCleaners} fit={fitFor(b)} />
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
              <BookingCard key={b.id} b={b} cleaners={activeCleaners} fit={fitFor(b)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BookingCard({
  b,
  cleaners,
  fit,
}: {
  b: BookingRow;
  cleaners: CleanerRow[];
  /** Empty when the booking has no time yet, so there is nothing to judge. */
  fit: Map<string, CleanerFit>;
}) {
  const next = NEXT_ACTION[b.status];
  const isRecurring = b.frequency !== "one_off";
  const needsCleaner = !b.cleaner_id && (b.status === "requested" || b.status === "confirmed");
  const cleaner = b.cleaner_id ? cleaners.find((c) => c.id === b.cleaner_id) : null;
  return (
    <details className="group border border-slate-200 bg-white text-sm shadow-sm open:ring-1 open:ring-brand-200">
      {/* collapsed row: everything you triage at a glance */}
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 hover:bg-slate-50">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-slate-900">{b.customer_name}</span>
            {needsCleaner && (
              <span className="text-amber-500" title="No cleaner assigned">
                ●
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span>
              {b.preferred_date} · {b.hours}h · {b.postcode}
            </span>
            {b.service_type === "deep" && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                DEEP · {b.cleaners_needed ?? 2} cleaners
              </span>
            )}
            {isRecurring && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  b.recurring_active
                    ? "bg-brand-100 text-brand-800"
                    : "bg-slate-100 text-slate-500 line-through"
                }`}
              >
                {FREQUENCY_LABEL[b.frequency]}
              </span>
            )}
            {(b.addons?.length ?? 0) > 0 && (
              <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                +{b.addons.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-semibold text-brand-700">{formatGBP(Number(b.quoted_price))}</span>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={2}
            className="h-4 w-4 text-slate-300 transition-transform group-open:rotate-180"
          />
        </div>
      </summary>

      {/* expanded body: details + actions */}
      <div className="border-t border-slate-100 p-3 pt-2">
        <div className="text-xs text-slate-400">
          {b.reference} ·{" "}
          <a href={`tel:${b.customer_phone}`} className="text-brand-700 hover:underline">
            {b.customer_phone}
          </a>
          {cleaner && <span className="text-slate-500"> · {cleaner.name}</span>}
        </div>
        {b.notes && <p className="mt-1 bg-slate-50 px-2 py-1 text-xs text-slate-500">{b.notes}</p>}

      {cleaners.length > 0 && b.status !== "cancelled" && b.status !== "paid" && (
        <form action={assignCleaner} className="mt-2 flex items-center gap-1">
          <input type="hidden" name="id" value={b.id} />
          <select
            name="cleaner_id"
            defaultValue={b.cleaner_id ?? ""}
            className="w-full border border-slate-200 px-2 py-1 text-xs text-slate-600"
          >
            <option value="">Unassigned</option>
            {cleaners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {FIT_SUFFIX[fit.get(c.id) ?? "free"]}
              </option>
            ))}
          </select>
          <button className="bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
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
            <button className="bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700">
              {next.label}
            </button>
          </form>
        )}
        {isRecurring && b.recurring_active && b.status !== "cancelled" && (
          <form action={stopRecurring}>
            <input type="hidden" name="id" value={b.id} />
            <button className="px-3 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100" title="No further cleans will be auto-booked after this one">
              Stop recurring
            </button>
          </form>
        )}
        {(b.status === "requested" || b.status === "confirmed") && (
          <form action={setBookingStatus}>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="from" value={b.status} />
            <input type="hidden" name="to" value="cancelled" />
            {/* impeccable-disable-next-line gray-on-color -- text turns red-600 on the same hover */}
            <button className="px-3 py-1 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600">
              Cancel
            </button>
          </form>
        )}
        {b.status === "cancelled" && (
          <form action={setBookingStatus}>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="from" value="cancelled" />
            <input type="hidden" name="to" value="requested" />
            <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
              Re-open
            </button>
          </form>
        )}
        <Link
          href={`/admin/booking/${b.id}`}
          className="ml-auto self-center text-xs font-medium text-brand-700 hover:underline"
        >
          View full booking →
        </Link>
      </div>
      </div>
    </details>
  );
}
