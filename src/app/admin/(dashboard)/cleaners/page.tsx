import { listCleaners, type CleanerRow } from "@/lib/supabaseAdmin";
import { site } from "@/lib/business";
import { addCleaner, toggleCleaner, updateCleanerSchedule } from "@/app/admin/actions";

/** 0=Sunday..6=Saturday, matching JS getUTCDay() and the works_days column. */
const DAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 0, label: "Sun" },
];

export const dynamic = "force-dynamic";

export default async function CleanersPage() {
  const cleaners = await listCleaners();
  // Always the real public domain, never the environment's. These links get pasted
  // into WhatsApp — one opened from a local admin session must not hand a cleaner
  // a localhost or preview URL. NEXT_PUBLIC_SITE_URL deliberately isn't used here:
  // it follows the environment, which is right for the Stripe redirect and wrong
  // for anything a human is given.
  const base = site.url;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Cleaners</h1>
      <p className="mb-4 text-sm text-slate-500">
        Each cleaner gets a personal link — send it to them on WhatsApp; it shows their assigned
        jobs, no password needed. Their working days and hours decide which slots customers are
        offered, so keep them right.
      </p>

      <form action={addCleaner} className="mb-5 flex flex-wrap items-end gap-2 bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <label className="block flex-1 min-w-36">
          <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
          <input name="name" className="w-full border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block flex-1 min-w-36">
          <span className="mb-1 block text-xs font-medium text-slate-500">Phone</span>
          <input name="phone" type="tel" className="w-full border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block flex-1 min-w-36">
          <span className="mb-1 block text-xs font-medium text-slate-500">Email (optional)</span>
          <input name="email" type="email" className="w-full border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button className="bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Add cleaner
        </button>
      </form>

      <div className="space-y-3">
        {cleaners.length === 0 && <p className="text-sm text-slate-400">No cleaners yet.</p>}
        {cleaners.map((c) => (
          <div
            key={c.id}
            className={` bg-white p-4 shadow-sm ring-1 ring-slate-200 ${!c.active ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-slate-900">{c.name}</span>
                <span className="ml-2 text-sm text-slate-500">{c.phone}</span>
                {!c.active && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    inactive
                  </span>
                )}
              </div>
              <form action={toggleCleaner}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={String(!c.active)} />
                <button className="px-3 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100">
                  {c.active ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
            {c.active && <Schedule c={c} />}

            {c.active && (
              <div className="mt-2 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Job link:{" "}
                <code className="select-all break-all text-brand-700">
                  {base}/c/{c.token}
                </code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Working pattern. This is the only thing that opens slots to customers — a
 * cleaner with no days ticked simply never gets offered, which is also how you
 * take someone off the rota without deactivating them.
 */
function Schedule({ c }: { c: CleanerRow }) {
  const days = Array.isArray(c.works_days) ? c.works_days : [];
  return (
    <form
      action={updateCleanerSchedule}
      className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-slate-100 pt-3"
    >
      <input type="hidden" name="id" value={c.id} />
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-slate-500">Working days</legend>
        <div className="flex flex-wrap gap-1">
          {DAYS.map((d) => (
            <label
              key={d.n}
              className="cursor-pointer select-none border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800"
            >
              <input
                type="checkbox"
                name="works_days"
                value={d.n}
                defaultChecked={days.includes(d.n)}
                className="sr-only"
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">From</span>
        <input
          type="time"
          name="works_from"
          step="900"
          defaultValue={(c.works_from ?? "09:00").slice(0, 5)}
          className="border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">To</span>
        <input
          type="time"
          name="works_to"
          step="900"
          defaultValue={(c.works_to ?? "17:00").slice(0, 5)}
          className="border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <button className="border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        Save hours
      </button>
    </form>
  );
}
