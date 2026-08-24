import { createManualBooking } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">New booking</h1>
      <p className="mb-4 text-sm text-slate-500">
        For phone bookings — goes straight in as <b>confirmed</b>.
      </p>
      <form action={createManualBooking} className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name *" name="name" />
          <Field label="Phone *" name="phone" type="tel" />
          <Field label="Email" name="email" type="email" hint="optional" />
          <Field label="Postcode" name="postcode" />
          <Field label="Address line" name="address_line" className="sm:col-span-2" />
          <Field label="Date *" name="preferred_date" type="date" />
          <Field label="Hours" name="hours" type="number" step="0.5" defaultValue="2" />
          <Field label="Price (£)" name="price" type="number" step="0.5" defaultValue="0" />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Frequency</span>
            <select
              name="frequency"
              className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
            >
              <option value="one_off">One-off</option>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Every 2 weeks</option>
              <option value="four_weekly">Every 4 weeks</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Notes</span>
            <textarea
              name="notes"
              rows={2}
              className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
            />
          </label>
        </div>
        {error && (
          <p className="mt-3 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Name, phone and date are required.
          </p>
        )}
        <button className="mt-5 bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">
          Create booking
        </button>
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
