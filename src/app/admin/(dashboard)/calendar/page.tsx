import Link from "next/link";
import { headers } from "next/headers";
import { listBookings, listCleaners, type BookingRow } from "@/lib/supabaseAdmin";
import { formatGBP } from "@/lib/pricing";
import { calendarFeedToken } from "@/lib/calendarFeed";

export const dynamic = "force-dynamic";

const STATUS_DOT: Record<string, string> = {
  requested: "bg-amber-400",
  confirmed: "bg-sky-400",
  completed: "bg-violet-400",
  paid: "bg-brand-500",
};
const STATUS_CHIP: Record<string, string> = {
  requested: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-sky-50 text-sky-800 ring-sky-200",
  completed: "bg-violet-50 text-violet-800 ring-violet-200",
  paid: "bg-brand-50 text-brand-800 ring-brand-200",
};
const STATUS_ORDER = ["requested", "confirmed", "completed", "paid"] as const;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 'YYYY-MM' for the month `delta` months away from `ym`. */
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** UK outward code (the bit before the space), e.g. "OX4 4HT" -> "OX4". */
function outward(postcode: string): string {
  return postcode.trim().split(/\s+/)[0].toUpperCase();
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; cleaner?: string }>;
}) {
  const [allBookings, cleaners] = await Promise.all([listBookings(), listCleaners()]);
  const cleanerName = new Map<string, string>(cleaners.map((c) => [c.id, c.name]));
  const activeCleaners = cleaners.filter((c) => c.active);

  const todayStr = new Date().toISOString().slice(0, 10);
  const { m: mParam, cleaner: cParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(mParam ?? "") ? mParam! : todayStr.slice(0, 7);
  const [year, mon] = month.split("-").map(Number);

  // Cleaner filter: a real id, "none" (unassigned), or unset (all).
  const cleaner = cParam ?? "";
  let bookings = allBookings.filter((b) => b.status !== "cancelled");
  if (cleaner === "none") bookings = bookings.filter((b) => !b.cleaner_id);
  else if (cleaner) bookings = bookings.filter((b) => b.cleaner_id === cleaner);

  // Preserve the cleaner filter across month navigation, and vice-versa.
  const href = (over: { m?: string; cleaner?: string }) => {
    const p = new URLSearchParams();
    const m = over.m ?? month;
    if (m !== todayStr.slice(0, 7)) p.set("m", m);
    const c = over.cleaner ?? cleaner;
    if (c) p.set("cleaner", c);
    const qs = p.toString();
    return qs ? `/admin/calendar?${qs}` : "/admin/calendar";
  };

  // Bookings grouped by date for O(1) lookup while laying out the grid.
  const byDate = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    const list = byDate.get(b.preferred_date);
    if (list) list.push(b);
    else byDate.set(b.preferred_date, [b]);
  }
  for (const list of byDate.values()) {
    list.sort(
      (a, z) =>
        STATUS_ORDER.indexOf(a.status as (typeof STATUS_ORDER)[number]) -
        STATUS_ORDER.indexOf(z.status as (typeof STATUS_ORDER)[number])
    );
  }

  // Monday-start grid covering the whole month plus spill days.
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7;

  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(Date.UTC(year, mon - 1, 1 - lead + i));
    cells.push({ date: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === mon - 1 });
  }

  // Month summary — cleans and value that fall inside the shown month.
  const monthRows = bookings.filter((b) => b.preferred_date.slice(0, 7) === month);
  const monthValue = monthRows.reduce((s, b) => s + Number(b.quoted_price), 0);
  const unassigned = monthRows.filter(
    (b) => !b.cleaner_id && (b.status === "requested" || b.status === "confirmed")
  ).length;

  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const agenda = monthRows
    .slice()
    .sort((a, z) => a.preferred_date.localeCompare(z.preferred_date))
    .filter((b) => b.preferred_date >= todayStr);

  // Subscribe / export feed URL (secret-token, works outside the admin guard).
  const token = await calendarFeedToken();
  let feedUrl: string | null = null;
  if (token) {
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
    const qs = cleaner && cleaner !== "none" ? `?cleaner=${encodeURIComponent(cleaner)}` : "";
    feedUrl = host ? `${proto}://${host}/api/calendar/${token}${qs}` : null;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <div className="flex items-center gap-1">
          <Link
            href={href({ m: shiftMonth(month, -1) })}
            className="border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="Previous month"
          >
            ←
          </Link>
          <span className="min-w-40 text-center text-sm font-semibold text-slate-800">{monthLabel}</span>
          <Link
            href={href({ m: shiftMonth(month, 1) })}
            className="border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="Next month"
          >
            →
          </Link>
          {month !== todayStr.slice(0, 7) && (
            <Link
              href={href({ m: todayStr.slice(0, 7) })}
              className="ml-1 px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Today
            </Link>
          )}
        </div>
      </div>

      {/* cleaner filter */}
      {activeCleaners.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <FilterChip label="All cleaners" active={cleaner === ""} href={href({ cleaner: "" })} />
          {activeCleaners.map((c) => (
            <FilterChip key={c.id} label={c.name} active={cleaner === c.id} href={href({ cleaner: c.id })} />
          ))}
          <FilterChip label="Unassigned" active={cleaner === "none"} href={href({ cleaner: "none" })} amber />
        </div>
      )}

      {/* month summary */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200">
          <span className="font-semibold text-slate-900">{monthRows.length}</span>{" "}
          <span className="text-slate-500">clean{monthRows.length === 1 ? "" : "s"}</span>
        </span>
        <span className="bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200">
          <span className="font-semibold text-brand-700">{formatGBP(monthValue)}</span>{" "}
          <span className="text-slate-500">booked value</span>
        </span>
        {unassigned > 0 && (
          <span className="bg-amber-50 px-3 py-1.5 font-medium text-amber-800 ring-1 ring-amber-200">
            {unassigned} unassigned
          </span>
        )}
        {feedUrl && (
          <details className="relative ml-auto text-xs">
            <summary className="cursor-pointer list-none border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50">
              📅 Subscribe / export
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-80 border border-slate-200 bg-white p-3 text-slate-600 shadow-lg">
              <p className="mb-2">
                Add live cleans to Google/Apple Calendar — paste this secret URL as a subscribed calendar
                {cleaner && cleaner !== "none" ? " (this cleaner only)" : ""}:
              </p>
              <code className="block break-all bg-slate-50 p-2 text-[11px] text-slate-700 ring-1 ring-slate-200">
                {feedUrl}
              </code>
              <div className="mt-2 flex gap-3">
                <a href={feedUrl} className="font-medium text-brand-700 hover:underline">
                  Download .ics
                </a>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Anyone with this link can see the schedule — treat it as a password.
              </p>
            </div>
          </details>
        )}
      </div>

      {/* calendar grid */}
      <div className="overflow-hidden bg-white shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => (
            <DayCell
              key={cell.date}
              date={cell.date}
              inMonth={cell.inMonth}
              isToday={cell.date === todayStr}
              rows={byDate.get(cell.date) ?? []}
              lastCol={i % 7 === 6}
              cleanerName={cleanerName}
            />
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} />
            <span className="capitalize">{s}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="text-amber-500">●</span>
          <span>no cleaner assigned</span>
        </span>
      </div>

      {/* agenda for the shown month, from today forward */}
      {agenda.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Upcoming in {first.toLocaleDateString("en-GB", { month: "long" })}
          </h2>
          <div className="space-y-2">
            {agenda.map((b) => (
              <AgendaRow key={b.id} b={b} isToday={b.preferred_date === todayStr} cleanerName={cleanerName} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
  amber,
}: {
  label: string;
  href: string;
  active: boolean;
  amber?: boolean;
}) {
  const base = "rounded-full px-3 py-1 font-medium ring-1 ring-inset transition";
  const cls = active
    ? amber
      ? "bg-amber-500 text-white ring-amber-500"
      : "bg-brand-600 text-white ring-brand-600"
    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50";
  return (
    <Link href={href} className={`${base} ${cls}`}>
      {label}
    </Link>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  rows,
  lastCol,
  cleanerName,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  rows: BookingRow[];
  lastCol: boolean;
  cleanerName: Map<string, string>;
}) {
  const dayNum = Number(date.slice(8, 10));
  const shown = rows.slice(0, 3);
  const extra = rows.length - shown.length;
  const areas = [...new Set(rows.map((b) => outward(b.postcode)))];

  return (
    <div
      className={[
        "min-h-24 border-b border-slate-100 p-1.5 align-top",
        lastCol ? "" : "border-r",
        inMonth ? "bg-white" : "bg-slate-50/60",
      ].join(" ")}
    >
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span
          className={[
            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
            isToday
              ? "bg-brand-600 font-bold text-white"
              : inMonth
                ? "text-slate-600"
                : "text-slate-300",
          ].join(" ")}
        >
          {dayNum}
        </span>
        {rows.length > 0 && (
          <span className="text-[10px] font-semibold text-slate-400">
            {formatGBP(rows.reduce((s, b) => s + Number(b.quoted_price), 0))}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {shown.map((b) => {
          const cn = b.cleaner_id ? cleanerName.get(b.cleaner_id) : null;
          const needsCleaner = !b.cleaner_id && (b.status === "requested" || b.status === "confirmed");
          return (
            <Link
              key={b.id}
              href={`/admin/booking/${b.id}`}
              title={`${b.customer_name} · ${b.hours}h · ${b.status}${cn ? ` · ${cn}` : " · unassigned"} · ${b.postcode}`}
              className={`block truncate  px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset hover:brightness-95 ${STATUS_CHIP[b.status]}`}
            >
              {b.customer_name.split(" ")[0]}
              {needsCleaner && <span className="ml-1 text-amber-500">●</span>}
            </Link>
          );
        })}
        {extra > 0 && <div className="px-1.5 text-[10px] font-medium text-slate-400">+{extra} more</div>}
      </div>
      {areas.length > 0 && (
        <div className="mt-1 truncate px-0.5 text-[9px] uppercase tracking-wide text-slate-300" title={`Areas: ${areas.join(", ")}`}>
          {areas.slice(0, 3).join(" · ")}
        </div>
      )}
    </div>
  );
}

function AgendaRow({
  b,
  isToday,
  cleanerName,
}: {
  b: BookingRow;
  isToday: boolean;
  cleanerName: Map<string, string>;
}) {
  const cn = b.cleaner_id ? cleanerName.get(b.cleaner_id) : null;
  const d = new Date(b.preferred_date + "T00:00:00");
  return (
    <Link
      href={`/admin/booking/${b.id}`}
      className="flex items-center gap-3 border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
    >
      <div className="w-14 shrink-0 text-center">
        <div className="text-[10px] font-medium uppercase text-slate-400">
          {d.toLocaleDateString("en-GB", { weekday: "short" })}
        </div>
        <div className={`text-lg font-bold leading-none ${isToday ? "text-brand-600" : "text-slate-800"}`}>
          {d.getDate()}
        </div>
      </div>
      <span className={`h-8 w-1 shrink-0 rounded-full ${STATUS_DOT[b.status]}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-slate-900">{b.customer_name}</div>
        <div className="truncate text-xs text-slate-500">
          {b.hours}h · {b.address_line}, {b.postcode}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold text-brand-700">{formatGBP(Number(b.quoted_price))}</div>
        <div className={`text-xs ${cn ? "text-slate-500" : "text-amber-600"}`}>{cn ?? "unassigned"}</div>
      </div>
    </Link>
  );
}
