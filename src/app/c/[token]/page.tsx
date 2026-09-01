import { notFound } from "next/navigation";
import { formatTimeRange, londonWallClock } from "@/lib/scheduling";
import { getCleanerByToken, listBookingsForCleaner, type BookingRow } from "@/lib/supabaseAdmin";
import { cleanerStartJob, cleanerFinishJob, cleanerCannotDoJob } from "./actions";
import JobClock from "./JobClock";
import ActualHoursField from "./ActualHoursField";
import LocationStamp from "./LocationStamp";
import PendingButton from "@/components/PendingButton";
import { REASONS, elapsedHours } from "@/lib/adjustments";
import { OUTCOMES } from "@/lib/outcomes";

export const dynamic = "force-dynamic";

// "Mon 14 Sep" — the raw YYYY-MM-DD read fine in a database and nowhere else;
// a cleaner scanning the list at speed shouldn't have to parse ISO dates.
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export default async function CleanerJobsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cleaner = await getCleanerByToken(token);
  if (!cleaner) notFound();

  const jobs = await listBookingsForCleaner(cleaner.id);
  // London wall clock, not UTC: during BST the first hour after midnight used
  // to show the cleaner yesterday as "today".
  const { date: today } = londonWallClock(new Date());
  const todaysJobs = jobs.filter((j) => j.status === "confirmed" && j.preferred_date === today);
  const upcoming = jobs.filter((j) => j.status === "confirmed" && j.preferred_date > today);
  // A confirmed job whose date has passed used to render in no section at all
  // — a forgotten Finish tap made the job unreachable and only the office
  // could complete it. It stays live here until it's closed out.
  const overdue = jobs.filter((j) => j.status === "confirmed" && j.preferred_date < today);
  const reported = jobs.filter((j) => j.status === "no_access").slice(-3).reverse();
  const recent = jobs.filter((j) => j.status === "completed").slice(-5).reverse();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-800">SAAFI CLEANING</p>
        <h1 className="text-2xl font-bold text-slate-900">
          Hi {cleaner.name.split(" ")[0]} 👋
        </h1>
        <p className="mb-6 text-sm text-slate-500">Your SAAFI jobs</p>

        {overdue.length > 0 && (
          <Section title={`Still open (${overdue.length})`}>
            <p className="mb-2 text-xs text-amber-700">
              These jobs are past their date but never finished — tap finish if the clean
              happened, or ring the office if it didn&apos;t.
            </p>
            {overdue.map((j) => (
              <JobCard key={j.id} j={j} token={token} live />
            ))}
          </Section>
        )}

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

        {reported.length > 0 && (
          <Section title="Reported — with the office">
            {reported.map((j) => (
              <div
                key={j.id}
                className="border border-slate-200 bg-white p-4 text-sm text-slate-500"
              >
                <p className="font-semibold text-slate-700">
                  {formatDate(j.preferred_date)} · {j.postcode}
                </p>
                <p className="mt-1">
                  Recorded as a visit that couldn&apos;t happen — the office has it and will sort
                  out what happens next. Nothing more needed from you.
                </p>
              </div>
            ))}
          </Section>
        )}

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

  // Dining and living rooms are separate columns but one line item to a
  // cleaner deciding what they're walking into.
  const livingTotal = (j.dining_rooms ?? 0) + (j.living_rooms ?? 0);

  return (
    <article className={` bg-white p-4 shadow-sm ring-1 ring-slate-200 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-slate-900">{j.customer_name}</span>
        <span className="text-sm text-slate-500">
          {formatDate(j.preferred_date)}
          {j.start_time ? ` · ${formatTimeRange(j.start_time, booked)}` : ""} · {booked}h booked
        </span>
      </div>

      {j.service_type === "deep" && (
        <span className="mt-1 inline-block bg-indigo-100 px-2 py-0.5 text-xs font-semibold tracking-wide text-indigo-800">
          DEEP CLEAN · {j.cleaners_needed ?? 2} cleaners
        </span>
      )}

      {/* Where, then how in, then who to ring — the order of need at a
          front door, not the order the record was typed in. */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block py-2 text-sm text-brand-700 hover:underline"
      >
        📍 {j.address_line}, {j.postcode}
      </a>
      <p className="text-lg font-bold tracking-wide text-slate-900">{j.postcode}</p>

      <div className="mt-2 bg-amber-50 p-3 ring-1 ring-amber-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
          Getting in / notes
        </p>
        <p className="mt-1 text-sm text-amber-900">
          {j.notes || "No access notes — ring the office if you can't get in."}
        </p>
      </div>

      <a
        href={`tel:${j.customer_phone}`}
        className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-brand-600 text-sm font-semibold text-brand-700 hover:bg-brand-50"
      >
        Call customer
      </a>

      <div className="mt-3 text-sm text-slate-500">
        {j.bedrooms} bed · {j.bathrooms} bath
        {livingTotal > 0 ? ` · ${livingTotal} living` : ""} ·{" "}
        {j.customer_provides_products ? "products at the house" : "bring products"}
      </div>
      {(j.addons?.length ?? 0) > 0 && (
        <div className="mt-1 text-sm text-violet-700">
          Extras: {j.addons.map((a) => a.label).join(", ")}
        </div>
      )}
      {done && (
        <div className="mt-1">
          <span className="text-sm font-medium text-brand-600">
            ✓ Completed{j.actual_hours ? ` · ${j.actual_hours}h` : ""}
          </span>
        </div>
      )}

      {live && !running && (
        <form action={cleanerStartJob} className="mt-3">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="booking_id" value={j.id} />
          <PendingButton
            pendingLabel="Starting…"
            className="w-full rounded-full bg-brand-600 px-4 py-3 text-base font-semibold text-white hover:bg-brand-700"
          >
            ▶ Start job
          </PendingButton>
          <LocationStamp prefix="started" />
        </form>
      )}

      {running && (
        <form action={cleanerFinishJob} className="mt-3 bg-slate-50 p-3 ring-1 ring-slate-200">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="booking_id" value={j.id} />

          {/* The live tracker: ticks every second while the job runs. The
              static line beneath survives without JS. */}
          <JobClock startedAt={j.started_at as string} />
          <p className="mb-2 mt-1 text-sm text-slate-600">
            Started {new Date(j.started_at as string).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {soFar > 0 && ` · about ${soFar}h so far`}
          </p>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Hours worked</span>
            {/* Live-synced to the clock until the cleaner edits it — the old
                server-rendered default froze at the booked hours and billed
                stale time. */}
            <ActualHoursField startedAt={j.started_at as string} bookedHours={booked} />
          </label>

          <label className="mt-2 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Did it run long? Tell us why
            </span>
            <select
              name="reason_code"
              defaultValue=""
              className="w-full border border-slate-300 px-3 py-2 text-base"
            >
              <option value="">No — ran to time</option>
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

          <LocationStamp prefix="finished" />
          <PendingButton
            pendingLabel="Finishing…"
            className="mt-3 w-full rounded-full bg-brand-600 px-4 py-3 text-base font-semibold text-white hover:bg-brand-700"
          >
            ✓ Finish job
          </PendingButton>
          <p className="mt-2 text-xs text-slate-500">
            The price only changes if the job itself was bigger than booked, and the office approves it first.
          </p>
        </form>
      )}

      {live && !done && (
        <details className="mt-2 group">
          <summary className="cursor-pointer list-none py-3 text-sm font-semibold text-amber-700 transition hover:text-amber-800">
            Can&apos;t do this job?
          </summary>
          <form action={cleanerCannotDoJob} className="mt-2 bg-amber-50 p-3 ring-1 ring-amber-200">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="booking_id" value={j.id} />
            <p className="mb-2 text-sm text-amber-900">
              Tell the office now and they&apos;ll sort it. Nothing gets charged either way.
            </p>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">What happened</span>
              <select
                name="outcome_reason"
                required
                defaultValue=""
                className="w-full border border-slate-300 px-3 py-2 text-base"
              >
                <option value="" disabled>
                  Choose one
                </option>
                {OUTCOMES.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label} — {o.hint}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Anything to add (optional)
              </span>
              <input
                type="text"
                name="outcome_note"
                placeholder="e.g. key safe code didn't work"
                className="w-full border border-slate-300 px-3 py-2 text-base"
              />
            </label>
            <PendingButton
              pendingLabel="Sending…"
              className="mt-3 w-full rounded-full bg-amber-600 px-4 py-3 text-base font-semibold text-white hover:bg-amber-700"
            >
              Tell the office
            </PendingButton>
          </form>
        </details>
      )}
    </article>
  );
}
