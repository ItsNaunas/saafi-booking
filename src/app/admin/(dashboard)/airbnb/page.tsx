import Link from "next/link";
import { listIcalFeeds, type IcalFeedRow } from "@/lib/supabaseAdmin";
import { addIcalFeed, setIcalFeedActive, removeIcalFeed, syncIcalFeedsNow } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import ConfirmButton from "@/components/ConfirmButton";
import { formatTime } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export default async function AirbnbPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let feeds: IcalFeedRow[] = [];
  let missing = false;
  try {
    feeds = await listIcalFeeds();
  } catch (e) {
    if (/PGRST205|42P01/.test(String(e))) missing = true;
    else throw e;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Airbnb calendars</h1>
        {feeds.length > 0 && (
          <form action={syncIcalFeedsNow}>
            <PendingButton
              pendingLabel="Syncing…"
              className="border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ↻ Sync all now
            </PendingButton>
          </form>
        )}
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Paste a host&apos;s Airbnb calendar link and every checkout shows up on the{" "}
        <Link href="/admin/calendar" className="font-medium text-brand-700 hover:underline">
          calendar
        </Link>{" "}
        as a suggested clean. Nothing is booked until you confirm it. Calendars refresh every morning
        and whenever the calendar page is opened.
      </p>

      {missing && (
        <p className="mb-5 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
          One-time setup needed: paste <code>supabase/2026-10-12-airbnb-calendars.sql</code> into the Supabase
          SQL editor, then reload this page.
        </p>
      )}

      {feeds.length > 0 && (
        <div className="mb-6 space-y-2">
          {feeds.map((f) => (
            <div key={f.id} className="bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">
                    {f.label}
                    {!f.active && <span className="ml-2 text-xs font-medium text-slate-400">(paused)</span>}
                  </div>
                  <div className="text-sm text-slate-500">
                    {f.host_name} · {f.host_phone}
                    {f.postcode ? ` · ${f.postcode}` : ""}
                  </div>
                  <div className="text-xs text-slate-400">
                    Default clean {f.default_hours}h from {formatTime(f.default_start_time.slice(0, 5))} · synced{" "}
                    {ago(f.last_synced_at)}
                  </div>
                  {f.last_error && (
                    <div className="mt-1 text-xs font-medium text-rose-700">⚠ Last sync failed: {f.last_error}</div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                  <form action={syncIcalFeedsNow}>
                    <input type="hidden" name="id" value={f.id} />
                    <PendingButton pendingLabel="…" className="px-2 py-1 font-medium text-brand-700 hover:bg-brand-50">
                      Sync
                    </PendingButton>
                  </form>
                  <form action={setIcalFeedActive}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="active" value={f.active ? "0" : "1"} />
                    <PendingButton pendingLabel="…" className="px-2 py-1 font-medium text-slate-600 hover:bg-slate-50">
                      {f.active ? "Pause" : "Resume"}
                    </PendingButton>
                  </form>
                  <form action={removeIcalFeed}>
                    <input type="hidden" name="id" value={f.id} />
                    <ConfirmButton
                      confirm={`Remove ${f.label}? Its suggested cleans disappear from the calendar. Cleans you've already confirmed stay booked. To just stop updates, use Pause instead.`}
                      className="px-2 py-1 font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Remove
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-400">
            Removing a calendar clears its suggestions. Cleans you already confirmed stay booked.
          </p>
        </div>
      )}

      {!missing && (
        <form action={addIcalFeed} className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-1 font-semibold text-slate-900">Connect a calendar</h2>
          <p className="mb-4 text-xs text-slate-500">
            The host gets the link in Airbnb: <b>Calendar → pick the listing → Availability → Connect calendars →
            Export calendar</b>, then copies it. One link per listing. Booking.com and Vrbo export links work too.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Calendar link *" name="url" type="url" className="sm:col-span-2" placeholder="https://www.airbnb.co.uk/calendar/ical/…" />
            <Field label="Property name *" name="label" placeholder="Flat 2, Cowley Rd" />
            <Field label="Host name *" name="host_name" />
            <Field label="Host phone *" name="host_phone" type="tel" />
            <Field label="Host email" name="host_email" type="email" hint="for confirmations" />
            <Field label="Address line" name="address_line" />
            <Field label="Postcode" name="postcode" />
            <Field label="Usual clean length (hours)" name="default_hours" type="number" step="0.5" defaultValue="3" />
            <Field label="Usual start (after checkout)" name="default_start_time" type="time" step="900" defaultValue="11:00" />
          </div>
          {error === "2" ? (
            <p className="mt-3 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              The calendar couldn&apos;t be saved. Try again.
            </p>
          ) : error ? (
            <p className="mt-3 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              A https calendar link, property name, host name and phone are required.
            </p>
          ) : null}
          <p className="mt-3 text-[11px] text-slate-400">
            Anyone with a calendar link can see that listing&apos;s bookings — treat it as a password.
          </p>
          <PendingButton
            pendingLabel="Connecting…"
            className="mt-4 bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
          >
            Connect calendar
          </PendingButton>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  defaultValue,
  placeholder,
  hint,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {hint && <span className="font-normal text-slate-400">({hint})</span>}
      </span>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}
