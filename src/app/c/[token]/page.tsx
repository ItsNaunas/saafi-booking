import { notFound } from "next/navigation";
import { formatTimeRange } from "@/lib/scheduling";
import { getCleanerByToken, listBookingsForCleaner, type BookingRow } from "@/lib/supabaseAdmin";
import { cleanerStartJob, cleanerFinishJob } from "./actions";
import { REASONS, elapsedHours } from "@/lib/adjustments";

export const dynamic = "force-dynamic";

export default async function CleanerJobsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cleaner = await getCleanerByToken(token);
  if (!cleaner) notFound();

  const jobs = await listBookingsForCleaner(cleaner.id);
  const today = new Date().toISOString().slice(0, 10);
  const todaysJobs = jobs.filter((j) => j.status === "confirmed" && j.preferred_date === today);
  const upcoming = jobs.filter((j) => j.status === "confirmed" && j.preferred_date > today);
  const recent = jobs.filter((j) => j.status === "completed").slice(-5).reverse();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-slate-900">
          Hi {cleaner.name.split(" ")[0]} 👋
        </h1>
        <p className="mb-6 text-sm text-slate-500">Your SAAFI jobs</p>

        <Section title={`Today (${todaysJobs.length})`}>
          {todaysJobs.length === 0 && <Empty text="No jobs today." />}
          {todaysJobs.map((j) => (
            <JobCard key={j.id} j={j} token={token} live />
          ))}
        </Section>

        <Section title={`Upcoming (${upcoming.length})`}>
          {upcoming.length === 0 && <Empty text="Nothing booked ahead yet." />}
          {upcoming.map((j) => (
            <JobCard key={j.id} j={j} token={token} live={false} />
          ))}
        </Section>

        {recent.length > 0 && (
          <Section title="Recently completed">
            {recent.map((j) => (
              <JobCard key={j.id} j={j} token={token} live={false} done />
            ))}
          </Section>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold text-slate-700">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="bg-white p-4 text-sm text-slate-400 ring-1 ring-slate-200">{text}</p>;
}

function JobCard({
  j,
  token,
  live,
  done,
}: {
  j: BookingRow;
  token: string;
  live: boolean;
  done?: boolean;
}) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${j.address_line}, ${j.postcode}`
  )}`;
  const booked = Number(j.quoted_hours ?? j.hours);
  const running = live && Boolean(j.started_at);
  // Server-rendered, so this is the elapsed time as of page load.
  const soFar = j.started_at ? elapsedHours(j.started_at, new Date().toISOString()) : 0;

  return (
    <article className={` bg-white p-4 shadow-sm ring-1 ring-slate-200 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-slate-900">{j.customer_name}</span>
        <span className="text-sm text-slate-500">
          {j.preferred_date}
          {j.start_time ? ` · ${formatTimeRange(j.start_time, booked)}` : ""} · {booked}h booked
        </span>
      </div>
      <a href={mapsUrl} target="_blank" className="mt-1 block text-sm text-brand-700 hover:underline">
        📍 {j.address_line}, {j.postcode}
      </a>
      <div className="mt-1 text-sm text-slate-500">
        {j.bedrooms} bed · {j.bathrooms} bath ·{" "}
        {j.customer_provides_products ? "products at the house" : "bring products"}
      </div>
      {(j.addons?.length ?? 0) > 0 && (
        <div className="mt-1 text-sm text-violet-700">
          Extras: {j.addons.map((a) => a.label).join(", ")}
        </div>
      )}
      {j.notes && <p className="mt-1 bg-amber-50 px-2 py-1 text-sm text-amber-800">{j.notes}</p>}

      <div className="mt-2 flex items-center gap-3">
        <a href={`tel:${j.customer_phone}`} className="text-sm font-medium text-brand-700 hover:underline">
          📞 Call customer
        </a>
        {done && (
          <span className="text-sm font-medium text-brand-600">
            ✓ Completed{j.actual_hours ? ` · ${j.actual_hours}h` : ""}
          </span>
        )}
      </div>

      {live && !running && (
        <form action={cleanerStartJob} className="mt-3">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="booking_id" value={j.id} />
          <button className="w-full rounded-full bg-brand-600 px-4 py-3 text-base font-semibold text-white hover:bg-brand-700">
            ▶ Start job
          </button>
        </form>
      )}

      {running && (
        <form action={cleanerFinishJob} className="mt-3 bg-slate-50 p-3 ring-1 ring-slate-200">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="booking_id" value={j.id} />

          <p className="mb-2 text-sm text-slate-600">
            Started {new Date(j.started_at as string).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {soFar > 0 && ` · about ${soFar}h so far`}
          </p>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Hours worked</span>
            <input
              type="number"
              name="actual_hours"
              step="0.25"
              min="0.25"
              defaultValue={String(soFar > 0 ? soFar : booked)}
              className="w-full border border-slate-300 px-3 py-2 text-base"
            />
          </label>

          <label className="mt-2 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Longer than the {booked}h booked? Why
            </span>
            <select
              name="reason_code"
              defaultValue=""
              className="w-full border border-slate-300 px-3 py-2 text-base"
            >
              <option value="">Ran to time</option>
              {REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-2 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Anything to add (optional)</span>
            <input
              type="text"
              name="note"
              placeholder="e.g. two extra bedrooms"
              className="w-full border border-slate-300 px-3 py-2 text-base"
            />
          </label>

          <button className="mt-3 w-full rounded-full bg-brand-600 px-4 py-3 text-base font-semibold text-white hover:bg-brand-700">
            ✓ Finish job
          </button>
          <p className="mt-2 text-xs text-slate-500">
            The price only changes if the job itself was bigger than booked, and the office approves it first.
          </p>
        </form>
      )}
    </article>
  );
}
