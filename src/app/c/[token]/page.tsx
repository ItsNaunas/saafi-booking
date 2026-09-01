import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatTimeRange, londonWallClock } from "@/lib/scheduling";
import {
  getCleanerByToken,
  listBookingsForCleaner,
  listTimeOffForCleaner,
  listPhotosForBooking,
  paidSoFar,
  type BookingRow,
  type TimeOffRow,
} from "@/lib/supabaseAdmin";
import {
  cleanerStartJob,
  cleanerFinishJob,
  cleanerCannotDoJob,
  cleanerAcknowledgeJob,
  cleanerRunningLate,
  cleanerReportIssue,
  cleanerUndoFinish,
  cleanerRequestTimeOff,
  cleanerUploadPhotos,
} from "./actions";
import { ISSUE_LABEL } from "@/lib/statusLabels";
import JobClock from "./JobClock";
import ActualHoursField from "./ActualHoursField";
import LocationStamp from "./LocationStamp";
import PendingButton from "@/components/PendingButton";
import { REASONS, elapsedHours } from "@/lib/adjustments";
import { OUTCOMES } from "@/lib/outcomes";

export const dynamic = "force-dynamic";

// "Add to Home Screen" turns the WhatsApp link into something that feels like
// an app — and survives the message getting buried.
export const metadata: Metadata = {
  title: "SAAFI jobs",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "SAAFI jobs", statusBarStyle: "default" },
};

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

  // Week boundaries (Monday-based) off the London date, for grouping and hours.
  const monday = (iso: string, offsetWeeks = 0) => {
    const d = new Date(`${iso}T12:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0
    d.setUTCDate(d.getUTCDate() - dow + offsetWeeks * 7);
    return d.toISOString().slice(0, 10);
  };
  const thisMonday = monday(today);
  const nextMonday = monday(today, 1);
  const weekAfterMonday = monday(today, 2);
  const lastMonday = monday(today, -1);

  const upThisWeek = upcoming.filter((j) => j.preferred_date < nextMonday);
  const upNextWeek = upcoming.filter(
    (j) => j.preferred_date >= nextMonday && j.preferred_date < weekAfterMonday
  );
  const upLater = upcoming.filter((j) => j.preferred_date >= weekAfterMonday);
  const hoursOf = (list: BookingRow[]) =>
    Math.round(list.reduce((sum, j) => sum + Number(j.hours), 0) * 4) / 4;

  // Worked hours: what actually got done, this week and last. Hours only —
  // whether pay figures appear here is the family's decision, not a default.
  const completedAll = jobs.filter((j) => (j.status === "completed" || j.status === "paid") && j.actual_hours);
  const workedIn = (fromIso: string, beforeIso: string) =>
    Math.round(
      completedAll
        .filter((j) => j.preferred_date >= fromIso && j.preferred_date < beforeIso)
        .reduce((sum, j) => sum + Number(j.actual_hours ?? 0), 0) * 4
    ) / 4;
  const workedThisWeek = workedIn(thisMonday, nextMonday);
  const workedLastWeek = workedIn(lastMonday, thisMonday);

  // Pre-migration the table doesn't exist — the section simply hides.
  const timeOff: TimeOffRow[] | null = await listTimeOffForCleaner(cleaner.id).catch(() => null);

  // Photo counts, only for jobs mid-clean (usually one) — cheap, and the
  // count is the cleaner's receipt that the upload landed.
  const inProgress = [...todaysJobs, ...overdue].filter((j) => j.started_at);
  const photoCounts = new Map<string, { before: number; after: number }>();
  for (const j of inProgress) {
    const photos = await listPhotosForBooking(j.id).catch(() => []);
    photoCounts.set(j.id, {
      before: photos.filter((ph) => ph.phase === "before").length,
      after: photos.filter((ph) => ph.phase === "after").length,
    });
  }

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
              <JobCard key={j.id} j={j} token={token} live photos={photoCounts.get(j.id)} />
            ))}
          </Section>
        )}

        <Section title={`Today (${todaysJobs.length})`}>
          {todaysJobs.length === 0 && <Empty text="No jobs today." />}
          {todaysJobs.map((j) => (
            <JobCard key={j.id} j={j} token={token} live photos={photoCounts.get(j.id)} />
          ))}
        </Section>

        {upcoming.length === 0 ? (
          <Section title="Upcoming (0)">
            <Empty text="Nothing booked ahead yet." />
          </Section>
        ) : (
          <>
            {upThisWeek.length > 0 && (
              <Section title={`Rest of this week — ${upThisWeek.length} job${upThisWeek.length === 1 ? "" : "s"}, ${hoursOf(upThisWeek)}h`}>
                {upThisWeek.map((j) => (
                  <JobCard key={j.id} j={j} token={token} live={false} />
                ))}
              </Section>
            )}
            {upNextWeek.length > 0 && (
              <Section title={`Next week — ${upNextWeek.length} job${upNextWeek.length === 1 ? "" : "s"}, ${hoursOf(upNextWeek)}h`}>
                {upNextWeek.map((j) => (
                  <JobCard key={j.id} j={j} token={token} live={false} />
                ))}
              </Section>
            )}
            {upLater.length > 0 && (
              <Section title={`Later — ${upLater.length} job${upLater.length === 1 ? "" : "s"}`}>
                {upLater.map((j) => (
                  <JobCard key={j.id} j={j} token={token} live={false} />
                ))}
              </Section>
            )}
          </>
        )}

        <Section title="Your hours">
          <div className="bg-white p-4 text-sm ring-1 ring-slate-200">
            <div className="flex items-baseline justify-between">
              <span className="text-slate-500">This week</span>
              <span className="text-lg font-bold text-slate-900">{workedThisWeek}h worked</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-slate-500">Last week</span>
              <span className="font-semibold text-slate-700">{workedLastWeek}h</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Counted from the jobs you finished in the app.
            </p>
          </div>
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
              <JobCard key={j.id} j={j} token={token} live={false} done={recentDone(j)} />
            ))}
          </Section>
        )}

        {timeOff !== null && (
          <Section title="Time off">
            {timeOff.length > 0 && (
              <ul className="space-y-1 text-sm">
                {timeOff.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center justify-between bg-white px-3 py-2 ring-1 ring-slate-200">
                    <span className="text-slate-700">
                      {formatDate(t.from_date)}
                      {t.to_date !== t.from_date && ` – ${formatDate(t.to_date)}`}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase ${
                        t.status === "approved"
                          ? "text-brand-700"
                          : t.status === "denied"
                            ? "text-red-600"
                            : "text-amber-600"
                      }`}
                    >
                      {t.status === "pending" ? "waiting" : t.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <details className="bg-white p-3 ring-1 ring-slate-200">
              <summary className="cursor-pointer py-1 text-sm font-semibold text-slate-700">
                Ask for days off
              </summary>
              <form action={cleanerRequestTimeOff} className="mt-2 space-y-2 text-sm">
                <input type="hidden" name="token" value={token} />
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">From</span>
                    <input type="date" name="from_date" required min={today} className="w-full border border-slate-300 px-2 py-2 text-base" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">To (same day if blank)</span>
                    <input type="date" name="to_date" min={today} className="w-full border border-slate-300 px-2 py-2 text-base" />
                  </label>
                </div>
                <input type="text" name="note" placeholder="Anything to add? (optional)" className="w-full border border-slate-300 px-3 py-2 text-base" />
                <PendingButton pendingLabel="Sending…" className="w-full rounded-full bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900">
                  Send request
                </PendingButton>
                <p className="text-xs text-slate-400">
                  The office says yes or no — approved days are blocked out so nothing gets booked on you.
                </p>
              </form>
            </details>
          </Section>
        )}

        <div className="mt-8 space-y-2 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          <p>
            <a href={`/c/${token}/calendar.ics`} className="font-semibold text-brand-700 underline underline-offset-2">
              📅 Get your jobs in your phone&apos;s calendar
            </a>
          </p>
          <p>
            Tip: add this page to your home screen (Share → &ldquo;Add to Home Screen&rdquo;) and it
            opens like an app.
          </p>
        </div>
      </div>
    </main>
  );

  // A finish can be self-corrected for 15 minutes while no money has moved —
  // the card needs to know to offer the undo.
  function recentDone(j: BookingRow): "undoable" | true {
    const fresh =
      j.finished_at &&
      Date.now() - new Date(j.finished_at).getTime() < 15 * 60 * 1000 &&
      paidSoFar(j) === 0;
    return fresh ? "undoable" : true;
  }
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
  photos,
}: {
  j: BookingRow;
  token: string;
  live: boolean;
  /** true = finished; "undoable" = finished minutes ago and still correctable. */
  done?: boolean | "undoable";
  photos?: { before: number; after: number };
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

      {/* "Got it" — until this existed the office had no proof an assignment
          was ever seen; the failure mode was a customer with nobody coming. */}
      {j.status === "confirmed" && !j.started_at && !done && (
        j.acknowledged_at ? (
          <p className="mt-2 text-center text-xs font-medium text-brand-700">✓ You&apos;re on it — the office knows you&apos;ve seen this job.</p>
        ) : (
          <form action={cleanerAcknowledgeJob} className="mt-2">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="booking_id" value={j.id} />
            <PendingButton
              pendingLabel="Noting…"
              className="w-full rounded-full bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
            >
              👍 Got it — I&apos;ll be there
            </PendingButton>
          </form>
        )
      )}

      {/* One tap replaces the phone call most people avoid making. */}
      {live && !running && !done && (
        <details className="mt-2">
          <summary className="cursor-pointer py-2 text-sm font-semibold text-slate-600">
            Running late?
          </summary>
          <div className="mt-1 bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="mb-2 text-xs text-slate-600">
              One tap tells the customer and the office roughly how far behind you are.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 45].map((m) => (
                <form key={m} action={cleanerRunningLate}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="booking_id" value={j.id} />
                  <input type="hidden" name="minutes" value={m} />
                  <PendingButton
                    pendingLabel="…"
                    className="w-full border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    ~{m} min
                  </PendingButton>
                </form>
              ))}
            </div>
          </div>
        </details>
      )}

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

      {/* Before/after photos — dispute armour for the cleaner as much as for
          SAAFI. Optional on every job by deliberate default. */}
      {running && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["before", "after"] as const).map((phase) => (
            <form key={phase} action={cleanerUploadPhotos} className="bg-white p-2 ring-1 ring-slate-200">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="booking_id" value={j.id} />
              <input type="hidden" name="phase" value={phase} />
              <label className="block text-center">
                <span className="block text-xs font-semibold text-slate-600">
                  📷 {phase === "before" ? "Before" : "After"}
                  {photos && photos[phase] > 0 && ` · ${photos[phase]} saved`}
                </span>
                <input
                  type="file"
                  name="photos"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="mt-1 w-full text-xs text-slate-500 file:mr-2 file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
                />
              </label>
              <PendingButton
                pendingLabel="Uploading…"
                className="mt-1 w-full bg-slate-100 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Upload
              </PendingButton>
            </form>
          ))}
        </div>
      )}

      {/* Mid-job problems get a two-tap outlet that doesn't end the job. */}
      {live && !done && (
        <details className="mt-2">
          <summary className="cursor-pointer py-2 text-sm font-semibold text-slate-600">
            Report something
          </summary>
          <form action={cleanerReportIssue} className="mt-1 bg-slate-50 p-3 ring-1 ring-slate-200">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="booking_id" value={j.id} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">What&apos;s up?</span>
              <select
                name="category"
                required
                defaultValue=""
                className="w-full border border-slate-300 px-3 py-2 text-base"
              >
                <option value="" disabled>
                  Choose one
                </option>
                {Object.entries(ISSUE_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="text"
              name="note"
              placeholder="A line about what happened (optional)"
              className="mt-2 w-full border border-slate-300 px-3 py-2 text-base"
            />
            <PendingButton
              pendingLabel="Sending…"
              className="mt-2 w-full rounded-full bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
            >
              Send to the office
            </PendingButton>
            <p className="mt-1 text-xs text-slate-500">
              The job keeps going — this just makes sure the office knows.
            </p>
          </form>
        </details>
      )}

      {/* A finish tapped in error stays correctable for 15 minutes, while no
          money has moved. After that it's the office's to untangle. */}
      {done === "undoable" && (
        <form action={cleanerUndoFinish} className="mt-2">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="booking_id" value={j.id} />
          <PendingButton
            pendingLabel="Undoing…"
            className="w-full border border-amber-400 bg-amber-50 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
          >
            Made a mistake? Undo this finish
          </PendingButton>
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
