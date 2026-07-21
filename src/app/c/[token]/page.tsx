import { notFound } from "next/navigation";
import { getCleanerByToken, listBookingsForCleaner, type BookingRow } from "@/lib/supabaseAdmin";
import { cleanerMarkDone } from "./actions";

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
            <JobCard key={j.id} j={j} token={token} showDone />
          ))}
        </Section>

        <Section title={`Upcoming (${upcoming.length})`}>
          {upcoming.length === 0 && <Empty text="Nothing booked ahead yet." />}
          {upcoming.map((j) => (
            <JobCard key={j.id} j={j} token={token} showDone={false} />
          ))}
        </Section>

        {recent.length > 0 && (
          <Section title="Recently completed">
            {recent.map((j) => (
              <JobCard key={j.id} j={j} token={token} showDone={false} done />
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
  return <p className="rounded-xl bg-white p-4 text-sm text-slate-400 ring-1 ring-slate-200">{text}</p>;
}

function JobCard({
  j,
  token,
  showDone,
  done,
}: {
  j: BookingRow;
  token: string;
  showDone: boolean;
  done?: boolean;
}) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${j.address_line}, ${j.postcode}`
  )}`;
  return (
    <article className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-slate-900">{j.customer_name}</span>
        <span className="text-sm text-slate-500">
          {j.preferred_date} · {j.hours}h
        </span>
      </div>
      <a href={mapsUrl} target="_blank" className="mt-1 block text-sm text-emerald-700 hover:underline">
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
      {j.notes && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">{j.notes}</p>}
      <div className="mt-2 flex items-center gap-3">
        <a href={`tel:${j.customer_phone}`} className="text-sm font-medium text-emerald-700 hover:underline">
          📞 Call customer
        </a>
        {showDone && (
          <form action={cleanerMarkDone}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="booking_id" value={j.id} />
            <button className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
              ✓ Job done
            </button>
          </form>
        )}
        {done && <span className="text-sm font-medium text-emerald-600">✓ Completed</span>}
      </div>
    </article>
  );
}
