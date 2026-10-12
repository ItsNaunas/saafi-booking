import { createManualBooking } from "@/app/admin/actions";
import { loadPricingConfig } from "@/lib/pricingServer";
import { getSuggestion } from "@/lib/supabaseAdmin";
import { isBlock } from "@/lib/icalImport";
import ManualPriceFields from "@/components/ManualPriceFields";
import PendingButton from "@/components/PendingButton";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; suggestion?: string }>;
}) {
  const [{ error, suggestion: suggestionId }, cfg] = await Promise.all([searchParams, loadPricingConfig()]);
  // Confirming an Airbnb turnover: the same form, pre-filled from the host's
  // calendar settings and the checkout date. Everything stays editable.
  const s = suggestionId ? await getSuggestion(suggestionId).catch(() => null) : null;
  const feed = s?.ical_feeds ?? null;
  const pre = s && feed
    ? {
        name: feed.host_name,
        phone: feed.host_phone,
        email: feed.host_email ?? "",
        postcode: feed.postcode ?? "",
        address_line: feed.address_line ?? "",
        preferred_date: s.checkout_date,
        start_time: feed.default_start_time.slice(0, 5),
        hours: String(feed.default_hours),
        notes:
          `Airbnb turnover — ${feed.label}. Checkout ${s.checkout_date}` +
          (s.next_checkin_date ? `, next check-in ${s.next_checkin_date}.` : "."),
      }
    : null;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">
        {pre ? "Confirm Airbnb turnover" : "New booking"}
      </h1>
      {pre && s && feed ? (
        <div className="mb-4 bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200">
          <b>{feed.label}</b> · {isBlock(s.summary) ? "host block" : "guest"} checks out{" "}
          <b>{fmtDay(s.checkout_date)}</b>
          {s.next_checkin_date && (
            <>
              {" "}· next guest arrives <b>{fmtDay(s.next_checkin_date)}</b>
              {s.next_checkin_date === s.checkout_date && (
                <span className="font-semibold text-rose-700"> (same-day turnover)</span>
              )}
            </>
          )}
          . Check the time and price, then create — it goes in as <b>confirmed</b>.
          {s.status === "confirmed" && s.booking_id && (
            <span className="mt-1 block font-semibold text-rose-700">
              Already confirmed — <a href={`/admin/booking/${s.booking_id}`} className="underline">open the booking</a>.
            </span>
          )}
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-500">
          For phone bookings — goes straight in as <b>confirmed</b>.
        </p>
      )}
      <form action={createManualBooking} className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
        {s && <input type="hidden" name="suggestion_id" value={s.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name *" name="name" defaultValue={pre?.name} />
          <Field label="Phone *" name="phone" type="tel" defaultValue={pre?.phone} />
          <Field label="Email" name="email" type="email" hint="optional" defaultValue={pre?.email} />
          <Field label="Postcode" name="postcode" defaultValue={pre?.postcode} />
          <Field label="Address line" name="address_line" className="sm:col-span-2" defaultValue={pre?.address_line} />
          <Field label="Bedrooms" name="bedrooms" type="number" hint="optional" />
          <Field label="Bathrooms" name="bathrooms" type="number" hint="optional" />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Service</span>
            <select
              name="service_type"
              className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              <option value="standard">Standard clean</option>
              <option value="deep">Deep clean</option>
            </select>
          </label>
          <Field label="Date *" name="preferred_date" type="date" defaultValue={pre?.preferred_date} />
          <Field label="Start time" name="start_time" type="time" step="900" hint="optional" defaultValue={pre?.start_time} />
          {/* Hours, frequency and price live in one client component so the
              engine's price can follow the first two as the admin types.
              Blank price = the engine's number, server-side too. */}
          <ManualPriceFields cfg={cfg} initialHours={pre?.hours} />
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Notes</span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={pre?.notes}
              className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
            />
          </label>
        </div>
        {error === "2" ? (
          <p className="mt-3 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            The booking couldn&apos;t be saved — nothing was created. Try again, and if it
            keeps failing check the connection to the database.
          </p>
        ) : error ? (
          <p className="mt-3 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Name, phone and date are required.
          </p>
        ) : null}
        <PendingButton
          pendingLabel="Saving…"
          className="mt-5 bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
        >
          {pre ? "Confirm & book" : "Create booking"}
        </PendingButton>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  defaultValue,
  hint,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string;
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
        className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}

function fmtDay(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
