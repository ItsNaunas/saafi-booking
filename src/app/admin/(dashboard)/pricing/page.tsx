import { getPricingRows, getServiceAreaPrefixes, listAllAddons } from "@/lib/supabaseAdmin";
import { savePricing, saveAddon, addServiceArea, removeServiceArea } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const FIELDS: { key: string; label: string; hint?: string; step?: string }[] = [
  { key: "hourly_rate", label: "Hourly rate (£)", step: "0.5" },
  { key: "product_surcharge", label: "Product surcharge (£)", hint: "added when SAAFI bring products", step: "0.5" },
  { key: "base_hours", label: "Base hours", hint: "kitchen, lounge & common areas — always included", step: "0.25" },
  { key: "hours_per_bedroom", label: "Hours per bedroom", step: "0.25" },
  { key: "hours_per_bathroom", label: "Hours per bathroom", step: "0.25" },
  { key: "hours_per_dining_room", label: "Hours per dining room", step: "0.25" },
  { key: "hours_per_living_room", label: "Hours per living room", step: "0.25" },
  { key: "min_hours", label: "Minimum hours", step: "0.5" },
  { key: "max_hours", label: "Maximum hours", step: "0.5" },
  { key: "discount_weekly_pct", label: "Weekly discount (%)", step: "0.5" },
  { key: "discount_fortnightly_pct", label: "Fortnightly discount (%)", step: "0.5" },
  { key: "discount_four_weekly_pct", label: "4-weekly discount (%)", step: "0.5" },
];

export default async function PricingPage() {
  const [rows, prefixes, addons] = await Promise.all([
    getPricingRows(),
    getServiceAreaPrefixes(),
    listAllAddons(),
  ]);
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Pricing</h1>
        <p className="mb-4 text-sm text-slate-500">
          Changes go live on the quote form within a minute — no developer needed.
        </p>
        <form action={savePricing} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{f.label}</span>
                <input
                  type="number"
                  name={f.key}
                  step={f.step}
                  min="0"
                  defaultValue={values[f.key] ?? ""}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
                {f.hint && <span className="mt-0.5 block text-xs text-slate-400">{f.hint}</span>}
              </label>
            ))}
          </div>
          <button className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">
            Save pricing
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-bold text-slate-900">Service area</h2>
        <p className="mb-4 text-sm text-slate-500">
          Postcode prefixes you cover (e.g. IG, RM, E1). Leave the list empty to accept
          any UK postcode.
        </p>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            {prefixes.length === 0 && (
              <span className="text-sm text-slate-400">No restrictions — serving everywhere.</span>
            )}
            {prefixes.map((p) => (
              <form key={p} action={removeServiceArea} className="inline">
                <input type="hidden" name="prefix" value={p} />
                <button
                  /* impeccable-disable-next-line gray-on-color -- text turns red-600 on the same hover */
                  className="group rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600"
                  title={`Remove ${p}`}
                >
                  {p} <span className="text-slate-400 group-hover:text-red-500">×</span>
                </button>
              </form>
            ))}
          </div>
          <form action={addServiceArea} className="mt-4 flex gap-2">
            <input
              name="prefix"
              placeholder="e.g. IG"
              maxLength={4}
              className="w-32 rounded-lg border border-slate-300 px-3 py-2 uppercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            <button className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
              Add area
            </button>
          </form>
        </div>

        <h2 className="mt-8 mb-1 text-2xl font-bold text-slate-900">Extras</h2>
        <p className="mb-4 text-sm text-slate-500">
          Price is what the extra costs the customer; time is added to the visit length
          (it&apos;s not charged again at the hourly rate).
        </p>
        <div className="grid gap-3">
          {addons.map((a) => (
            <form
              key={a.key}
              action={saveAddon}
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
            >
              <input type="hidden" name="key" value={a.key} />
              <div className="grid gap-3 sm:grid-cols-[1fr_6rem_6rem_auto_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
                  <input
                    name="label"
                    defaultValue={a.label}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Price (£)</span>
                  <input
                    type="number"
                    name="price"
                    step="0.5"
                    min="0"
                    defaultValue={a.price}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Time (h)</span>
                  <input
                    type="number"
                    name="hours"
                    step="0.25"
                    min="0"
                    defaultValue={a.hours}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                  <input type="checkbox" name="active" defaultChecked={a.active} />
                  Active
                </label>
                <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  Save
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
