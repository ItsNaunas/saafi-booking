import Link from "next/link";
import { headers } from "next/headers";
import { listBookings, listCleaners, listOpenSuggestions, type BookingRow } from "@/lib/supabaseAdmin";
import { syncIfStale, FRESH_MINUTES } from "@/lib/airbnbSync";
import { isBlock, alreadyBooked } from "@/lib/icalImport";
import { dismissSuggestion, clearSuggestionFlag } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import { formatGBP } from "@/lib/pricing";
import { formatTime, formatTimeRange, isValidDate, londonWallClock } from "@/lib/scheduling";
import { calendarFeedToken } from "@/lib/calendarFeed";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/statusLabels";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  no_access: "bg-rose-50 text-rose-800 ring-rose-200",
  requested: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-sky-50 text-sky-800 ring-sky-200",
  completed: "bg-violet-50 text-violet-800 ring-violet-200",
  paid: "bg-brand-50 text-brand-800 ring-brand-200",
};
const STATUS_ORDER = ["no_access", "requested", "confirmed", "completed", "paid"] as const;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Suggestion = Awaited<ReturnType<typeof listOpenSuggestions>>[number];

/** Short day label, "Tue 14 Oct". */
function fmtDay(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

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
  searchParams: Promise<{ m?: string; cleaner?: string; d?: string }>;
}) {
  // Fresh before you look: sync any Airbnb calendar more than 10 minutes old
  // first, but never hold the page more than a few seconds for Airbnb.
  await syncIfStale(FRESH_MINUTES, 6000);
  const todayForFeeds = londonWallClock(new Date()).date;
  const [allBookings, cleaners, allSuggestions] = await Promise.all([
    listBookings(),
    listCleaners(),
    // Airbnb turnovers. Empty (never an error page) until the 2026-10-12
    // migration is pasted or if the read hiccups — the calendar must not
    // depend on a convenience feature.
    listOpenSuggestions(todayForFeeds).catch(() => [] as Suggestion[]),
  ]);
  const cleanerName = new Map<string, string>(cleaners.map((c) => [c.id, c.name]));
  const activeCleaners = cleaners.filter((c) => c.active);

  const todayStr = londonWallClock(new Date()).date;
  const { m: mParam, cleaner: cParam, d: dParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(mParam ?? "") ? mParam! : todayStr.slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const selectedDay = dParam && isValidDate(dParam) ? dParam : null;

  // Cleaner filter: a real id, "none" (unassigned), or unset (all).
  const cleaner = cParam ?? "";
  let bookings = allBookings.filter((b) => b.status !== "cancelled");
  if (cleaner === "none") bookings = bookings.filter((b) => !b.cleaner_id);
  else if (cleaner)
    bookings = bookings.filter((b) => b.cleaner_id === cleaner || b.second_cleaner_id === cleaner);

  // Preserve the cleaner filter across month navigation, and vice-versa. Never
  // carries the day-agenda param forward — a new month or cleaner dismisses it.
  const href = (over: { m?: string; cleaner?: string }) => {
    const p = new URLSearchParams();
    const m = over.m ?? month;
    if (m !== todayStr.slice(0, 7)) p.set("m", m);
    const c = over.cleaner ?? cleaner;
    if (c) p.set("cleaner", c);
    const qs = p.toString();
    return qs ? `/admin/calendar?${qs}` : "/admin/calendar";
  };

  // Same as href(), plus the day-agenda param — used by "+N more" links.
  const dayHref = (d: string) => {
    const p = new URLSearchParams();
    if (month !== todayStr.slice(0, 7)) p.set("m", month);
    if (cleaner) p.set("cleaner", cleaner);
    p.set("d", d);
    return `/admin/calendar?${p.toString()}`;
  };

  // Suggestions aren't anyone's job yet, so a single-cleaner view hides them.
  const showSuggestions = cleaner === "" || cleaner === "none";
  // Duplicate guard, instant half: a clean already booked at that address on
  // the checkout day means this one's handled, even before the next sync
  // links them for good.
  // A stay whose linked clean was cancelled or deleted counts as suggested
  // again right away, without waiting for the next sync to release it.
  const liveBookingIds = new Set(allBookings.filter((b) => b.status !== "cancelled").map((b) => b.id));
  const linkedLive = (x: Suggestion) => x.status === "confirmed" && !!x.booking_id && liveBookingIds.has(x.booking_id);
  const needsClean = (x: Suggestion) => x.status === "suggested" || (x.status === "confirmed" && !linkedLive(x));
  const suggested = showSuggestions
    ? allSuggestions.filter(
        (x) => needsClean(x) && !alreadyBooked(x.ical_feeds?.postcode ?? null, x.checkout_date, allBookings)
      )
    : [];
  const flagged = allSuggestions.filter((x) => linkedLive(x) && x.changed_at);
  const suggestedByDate = new Map<string, Suggestion[]>();
  for (const x of suggested) {
    const list = suggestedByDate.get(x.checkout_date);
    if (list) list.push(x);
    else suggestedByDate.set(x.checkout_date, [x]);
  }

  // Bookings grouped by date for O(1) lookup while laying out the grid.
  const byDate = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    const list = byDate.get(b.preferred_date);
    if (list) list.push(b);
    else byDate.set(b.preferred_date, [b]);
  }
  for (const list of byDate.values()) {
    // Time first — a day should read in the order it will be worked. Jobs with no
    // time yet sink to the bottom, where they are visibly still to be slotted.
    list.sort((a, z) => {
      if (a.start_time !== z.start_time) {
        if (!a.start_time) return 1;
        if (!z.start_time) return -1;
        return a.start_time.localeCompare(z.start_time);
      }
      return (
        STATUS_ORDER.indexOf(a.status as (typeof STATUS_ORDER)[number]) -
        STATUS_ORDER.indexOf(z.status as (typeof STATUS_ORDER)[number])
      );
    });
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
  // Wasted journeys aren't month value until the office decides to charge them.
  const monthValue = monthRows
    .filter((b) => b.status !== "no_access")
    .reduce((s, b) => s + Number(b.quoted_price), 0);
  const unassigned = monthRows.filter(
    (b) => !b.cleaner_id && (b.status === "requested" || b.status === "confirmed")
  ).length;

  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const agenda = monthRows
    .slice()
    .sort(
      (a, z) =>
        a.preferred_date.localeCompare(z.preferred_date) ||
        (a.start_time ?? "99").localeCompare(z.start_time ?? "99")
    )
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

      {/* Airbnb: confirmed cleans whose stay changed, then turnovers waiting for a yes */}
      {flagged.length > 0 && (
        <div className="mb-4 bg-rose-50 p-4 ring-1 ring-rose-200">
          <h2 className="mb-2 text-sm font-semibold text-rose-900">⚠ Changed on Airbnb — check these cleans</h2>
          <div className="space-y-1.5">
            {flagged.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-rose-900">{x.ical_feeds?.label ?? "Airbnb"}</span>
                <span className="min-w-0 flex-1 text-rose-800">{x.change_note}</span>
                {x.booking_id && (
                  <Link href={`/admin/booking/${x.booking_id}`} className="text-xs font-semibold text-rose-900 underline">
                    Open booking
                  </Link>
                )}
                <form action={clearSuggestionFlag}>
                  <input type="hidden" name="id" value={x.id} />
                  <PendingButton pendingLabel="…" className="text-xs font-medium text-rose-700 hover:underline">
                    Checked ✓
                  </PendingButton>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
      {suggested.length > 0 && (
        <details className="mb-4 bg-white p-4 shadow-sm ring-1 ring-sky-200" open={suggested.length <= 6}>
          <summary className="cursor-pointer text-sm font-semibold text-sky-900">
            {suggested.length} Airbnb turnover{suggested.length === 1 ? "" : "s"} to confirm
            <span className="ml-2 font-normal text-slate-400">nothing is booked until you confirm</span>
          </summary>
          <div className="mt-2 space-y-1.5">
            {suggested.map((x) => (
              <SuggestionRow key={x.id} x={x} />
            ))}
          </div>
        </details>
      )}

      {/* that day — every booking on a date opened from "+N more", not just the
          three the grid cell has room for */}
      {selectedDay && (
        <div className="mb-4 bg-white p-4 shadow-sm ring-1 ring-brand-200">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">
              {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <Link href={href({})} className="text-xs font-medium text-slate-400 hover:text-slate-700">
              Dismiss ×
            </Link>
          </div>
          <div className="space-y-1.5">
            {(byDate.get(selectedDay) ?? []).length === 0 && !suggestedByDate.has(selectedDay) && (
              <p className="text-sm text-slate-400">Nothing booked this day.</p>
            )}
            {(suggestedByDate.get(selectedDay) ?? []).map((x) => (
              <SuggestionRow key={x.id} x={x} />
            ))}
            {(byDate.get(selectedDay) ?? []).map((b) => {
              const cn = b.cleaner_id ? cleanerName.get(b.cleaner_id) : null;
              return (
                <Link
                  key={b.id}
                  href={`/admin/booking/${b.id}`}
                  className="flex items-center gap-3 border border-slate-100 px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="w-14 shrink-0 text-xs font-medium text-slate-500">
                    {b.start_time ? formatTime(b.start_time) : "TBC"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
                    {b.customer_name}
                  </span>
                  <span className={`shrink-0 text-xs ${cn ? "text-slate-500" : "text-amber-600"}`}>
                    {cn ?? "unassigned"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_CHIP[b.status]}`}
                  >
                    {STATUS_LABEL[b.status]}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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
              suggestions={suggestedByDate.get(cell.date) ?? []}
              lastCol={i % 7 === 6}
              cleanerName={cleanerName}
              dayHref={dayHref}
            />
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} />
            <span>{STATUS_LABEL[s]}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="text-amber-500">●</span>
          <span>no cleaner assigned</span>
        </span>
        {showSuggestions && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 border border-dashed border-sky-400 bg-sky-50/60" />
            <span>Airbnb checkout — suggested, not booked</span>
          </span>
        )}
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

/** "Jennifer Garda" -> "Jennifer G." — enough to tell people apart in the space a cell has. */
function firstNameLastInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  const [first, ...rest] = parts;
  const last = rest[rest.length - 1];
  return last ? `${first} ${last[0]}.` : first;
}

function DayCell({
  date,
  inMonth,
  isToday,
  rows,
  suggestions,
  lastCol,
  cleanerName,
  dayHref,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  rows: BookingRow[];
  suggestions: Suggestion[];
  lastCol: boolean;
  cleanerName: Map<string, string>;
  dayHref: (d: string) => string;
}) {
  const dayNum = Number(date.slice(8, 10));
  const shown = rows.slice(0, 3);
  // Suggestions take whatever room the bookings leave, at least one line.
  const shownSuggestions = suggestions.slice(0, Math.max(1, 3 - shown.length));
  const extra = rows.length - shown.length + (suggestions.length - shownSuggestions.length);
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
              title={`${b.customer_name} · ${b.start_time ? formatTimeRange(b.start_time, Number(b.hours)) : "no time"} · ${b.hours}h · ${b.status}${cn ? ` · ${cn}` : " · unassigned"} · ${b.postcode}`}
              className={`block truncate  px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset hover:brightness-95 ${STATUS_CHIP[b.status]}`}
            >
              {b.start_time && <span className="tabular-nums">{formatTime(b.start_time)} </span>}
              {firstNameLastInitial(b.customer_name)}
              {needsCleaner && <span className="ml-1 text-amber-500">●</span>}
            </Link>
          );
        })}
        {shownSuggestions.map((x) => (
          <Link
            key={x.id}
            href={`/admin/new?suggestion=${x.id}`}
            title={`Airbnb checkout · ${x.ical_feeds?.label ?? ""}${x.next_checkin_date ? ` · next check-in ${x.next_checkin_date}` : ""} · click to confirm`}
            className="block truncate border border-dashed border-sky-400 bg-sky-50/60 px-1.5 py-0.5 text-[11px] font-medium text-sky-800 hover:bg-sky-100"
          >
            ↺ {x.ical_feeds?.label ?? "Airbnb"}
          </Link>
        ))}
        {extra > 0 && (
          <Link
            href={dayHref(date)}
            className="block px-1.5 text-[10px] font-medium text-slate-400 hover:text-brand-700 hover:underline"
          >
            +{extra} more
          </Link>
        )}
      </div>
      {areas.length > 0 && (
        <div className="mt-1 truncate px-0.5 text-[10px] uppercase tracking-wide text-slate-400" title={`Areas: ${areas.join(", ")}`}>
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
          {b.start_time ? (
            <span className="font-medium text-slate-700">
              {formatTimeRange(b.start_time, Number(b.hours))}
            </span>
          ) : (
            <span className="font-medium text-amber-600">no time set</span>
          )}{" "}
          · {b.hours}h · {b.address_line}, {b.postcode}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold text-brand-700">{formatGBP(Number(b.quoted_price))}</div>
        <div className={`text-xs ${cn ? "text-slate-500" : "text-amber-600"}`}>{cn ?? "unassigned"}</div>
      </div>
    </Link>
  );
}

function SuggestionRow({ x }: { x: Suggestion }) {
  const sameDay = x.next_checkin_date === x.checkout_date;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-dashed border-sky-300 bg-sky-50/40 px-2 py-1.5 text-sm">
      <span className="w-24 shrink-0 text-xs font-medium text-slate-600">{fmtDay(x.checkout_date)}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-slate-900">{x.ical_feeds?.label ?? "Airbnb"}</span>
        <span className="text-xs text-slate-500">
          {" "}· {isBlock(x.summary) ? "host block ends" : "guest checks out"}
          {x.next_checkin_date && (
            <span className={sameDay ? "font-semibold text-rose-700" : ""}>
              {" "}· next in {sameDay ? "same day" : fmtDay(x.next_checkin_date)}
            </span>
          )}
        </span>
      </span>
      <Link
        href={`/admin/new?suggestion=${x.id}`}
        className="bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
      >
        Confirm
      </Link>
      <form action={dismissSuggestion}>
        <input type="hidden" name="id" value={x.id} />
        <PendingButton pendingLabel="…" className="px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
          Not needed
        </PendingButton>
      </form>
    </div>
  );
}
