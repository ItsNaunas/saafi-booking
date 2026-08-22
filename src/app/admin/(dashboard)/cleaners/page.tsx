import { listCleaners } from "@/lib/supabaseAdmin";
import { addCleaner, toggleCleaner } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function CleanersPage() {
  const cleaners = await listCleaners();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saafi-booking.vercel.app";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Cleaners</h1>
      <p className="mb-4 text-sm text-slate-500">
        Each cleaner gets a personal link — send it to them on WhatsApp; it shows their assigned
        jobs, no password needed.
      </p>

      <form action={addCleaner} className="mb-5 flex flex-wrap items-end gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <label className="block flex-1 min-w-36">
          <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
          <input name="name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block flex-1 min-w-36">
          <span className="mb-1 block text-xs font-medium text-slate-500">Phone</span>
          <input name="phone" type="tel" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block flex-1 min-w-36">
          <span className="mb-1 block text-xs font-medium text-slate-500">Email (optional)</span>
          <input name="email" type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Add cleaner
        </button>
      </form>

      <div className="space-y-3">
        {cleaners.length === 0 && <p className="text-sm text-slate-400">No cleaners yet.</p>}
        {cleaners.map((c) => (
          <div
            key={c.id}
            className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${!c.active ? "opacity-60" : ""}`}
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
                <button className="rounded-lg px-3 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100">
                  {c.active ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
            {c.active && (
              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
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
