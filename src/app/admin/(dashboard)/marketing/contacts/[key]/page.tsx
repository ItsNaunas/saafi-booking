import Link from "next/link";
import { notFound } from "next/navigation";
import { getSuppression, listCampaigns, listManualConsent, listSendsForEmail, type AutomationRow } from "@/lib/supabaseAdmin";
import { CONSENT_LABEL, PLAN_LABEL, SOURCE_LABEL, STAGE_LABEL, type Consent } from "@/lib/segments";
import { quoteLine } from "@/lib/marketing";
import { formatGBP } from "@/lib/pricing";
import { STATUS_LABEL } from "@/lib/statusLabels";
import { recordConsentAction, unsubscribeContactAction, resubscribeContactAction } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import ConfirmButton from "@/components/ConfirmButton";
import { loadAudienceOrMissing, MigrationNotice } from "../../data";
import { AUTOMATION_INFO } from "../../automationInfo";

export const dynamic = "force-dynamic";

const CONSENT_TONE: Record<Consent, string> = {
  yes: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  no: "bg-slate-50 text-slate-800 ring-slate-200",
  unsubscribed: "bg-rose-50 text-rose-900 ring-rose-200",
  unknown: "bg-amber-50 text-amber-900 ring-amber-200",
};

const DONE: Record<string, [string, boolean]> = {
  yes: ["Recorded: they're happy to get offers.", true],
  no: ["Recorded: they don't want offers.", true],
  unsubscribed: ["Unsubscribed. They won't get any more marketing emails.", true],
  resubscribed: ["Re-subscribed, with your note kept on record.", true],
  "need-note": ["Add a note saying how they asked to be re-subscribed.", false],
};

const day = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ key }, { done }] = await Promise.all([params, searchParams]);
  let email = "";
  try {
    email = Buffer.from(key, "base64url").toString("utf8").toLowerCase();
  } catch {
    notFound();
  }
  const audience = await loadAudienceOrMissing();
  if (!audience) return <MigrationNotice />;
  const p = audience.profiles.find((x) => x.email === email);
  if (!p) notFound();

  const [manual, suppression, sends, campaigns] = await Promise.all([
    listManualConsent(),
    getSuppression(email),
    listSendsForEmail(email),
    listCampaigns(),
  ]);
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
  const bookings = audience.bookings
    .filter((b) => b.customer_email.toLowerCase() === email)
    .sort((a, z) => z.preferred_date.localeCompare(a.preferred_date));
  const lead = audience.leads.find((l) => l.email.toLowerCase() === email) ?? null;
  const firstSeen = [...bookings.map((b) => b.created_at), lead?.created_at].filter(Boolean).sort()[0] as string | undefined;
  const manualRow = manual?.get(email) ?? null;
  const notice = done ? DONE[done] : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/admin/marketing/contacts" className="text-sm text-slate-500 hover:text-slate-800">
        ← All contacts
      </Link>

      {/* who */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-900">{p.name || p.email}</h2>
          <p className="text-sm text-slate-600">
            <a href={`mailto:${p.email}`} className="hover:underline">
              {p.email}
            </a>
            {p.phone && (
              <>
                {" · "}
                <a href={`tel:${p.phone}`} className="text-brand-700 hover:underline">
                  {p.phone}
                </a>
              </>
            )}
            {p.postcode && ` · ${p.postcode}`}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
            <Tag>{STAGE_LABEL[p.stage]}</Tag>
            {p.plan && <Tag>{PLAN_LABEL[p.plan]} plan</Tag>}
            {p.happy && <Tag tone="text-emerald-800 bg-emerald-50">Happy regular</Tag>}
            {p.atRisk && <Tag tone="text-rose-800 bg-rose-50">Had a problem recently</Tag>}
            {p.isHost && <Tag tone="text-sky-800 bg-sky-50">Airbnb host{p.hostListings > 1 ? ` · ${p.hostListings} listings` : ""}</Tag>}
            {p.lastMoveClean && <Tag tone="text-violet-800 bg-violet-50">Moved {day(p.lastMoveClean)}</Tag>}
            {p.heardFrom && <Tag>Heard via {SOURCE_LABEL[p.heardFrom] ?? p.heardFrom}</Tag>}
          </div>
        </div>
      </header>

      {notice && (
        <p className={`px-3 py-2 text-sm font-medium ring-1 ${notice[1] ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
          {notice[0]}
        </p>
      )}

      {/* numbers */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Cleans" value={String(p.completed)} />
        <Stat label="Spent" value={p.spend ? formatGBP(p.spend) : "—"} />
        <Stat label="Last clean" value={p.lastClean ? `${day(p.lastClean)}` : "—"} sub={p.lastClean ? `${p.daysSinceLastClean} days ago` : undefined} />
        <Stat label="Next booked" value={p.nextBooking ? day(p.nextBooking) : "—"} sub={firstSeen ? `customer since ${day(firstSeen)}` : undefined} />
      </section>

      {/* consent */}
      <section className={`p-4 ring-1 ${CONSENT_TONE[p.consent]}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Marketing emails: {CONSENT_LABEL[p.consent]}</h3>
          <span className="text-xs opacity-80">
            {p.consent === "unsubscribed" && suppression
              ? `Unsubscribed ${day(suppression.created_at)} (${suppression.reason})`
              : p.consentSource && p.consentAt
                ? `From the ${p.consentSource}, ${day(p.consentAt)}`
                : "They've never been asked"}
          </span>
        </div>
        {manualRow?.note && <p className="mt-1 text-sm opacity-90">Note: {manualRow.note}</p>}

        {manual === null ? (
          <p className="mt-2 text-sm">
            To record answers by hand, paste <code>supabase/2026-10-14-contact-consent.sql</code> into Supabase.
          </p>
        ) : p.consent === "unsubscribed" ? (
          <form action={resubscribeContactAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="email" value={p.email} />
            <label className="block min-w-0 flex-1 basis-64">
              <span className="mb-1 block text-xs font-medium">Only if they asked to be emailed again — how did they ask?</span>
              <input name="note" required placeholder="Asked on the phone, 14 Oct" className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500" />
            </label>
            <ConfirmButton confirm="Re-subscribe them? Only do this if they asked." className="bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50">
              Re-subscribe
            </ConfirmButton>
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <form action={recordConsentAction} className="flex min-w-0 flex-1 basis-80 flex-wrap items-end gap-2">
              <input type="hidden" name="email" value={p.email} />
              <label className="block min-w-0 flex-1 basis-52">
                <span className="mb-1 block text-xs font-medium">Record what they told you</span>
                <input name="note" placeholder="Said yes on the phone, 14 Oct" className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500" />
              </label>
              <PendingButton name="ok" value="yes" pendingLabel="…" className="bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Said yes
              </PendingButton>
              <PendingButton name="ok" value="no" pendingLabel="…" className="bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                Said no
              </PendingButton>
            </form>
            <form action={unsubscribeContactAction}>
              <input type="hidden" name="email" value={p.email} />
              <ConfirmButton
                confirm={`Unsubscribe ${p.name || p.email}? They'll get no more marketing emails. Booking emails still arrive.`}
                className="px-3 py-2 text-sm font-medium text-rose-700 hover:underline"
              >
                Unsubscribe them
              </ConfirmButton>
            </form>
          </div>
        )}
      </section>

      {/* bookings */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Bookings ({bookings.length})</h3>
        {bookings.length === 0 ? (
          <p className="text-sm text-slate-500">No bookings yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 bg-white ring-1 ring-slate-200">
            {bookings.map((b) => (
              <Link key={b.id} href={`/admin/booking/${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm hover:bg-slate-50">
                <span className="w-28 shrink-0 font-medium text-slate-800">{day(b.preferred_date)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {b.service_type === "deep" ? "Deep clean" : "Clean"} · {b.hours}h{b.frequency !== "one_off" ? ` · ${PLAN_LABEL[b.frequency as keyof typeof PLAN_LABEL] ?? b.frequency}` : ""}
                  {b.reference ? ` · ${b.reference}` : ""}
                </span>
                <span className="text-xs text-slate-500">{STATUS_LABEL[b.status] ?? b.status}</span>
                <span className="w-16 text-right font-semibold text-slate-900">{formatGBP(Number(b.final_price ?? b.quoted_price))}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* quote */}
      {lead && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Quote form</h3>
          <div className="bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
            Started a quote {day(lead.created_at)}
            {quoteLine(lead) ? ` — ${quoteLine(lead)!.replace(/^Your quote: /, "")}` : ""}.{" "}
            {lead.converted_at ? "They went on to book." : lead.nudged_at ? `Reminder sent ${day(lead.nudged_at)}.` : "Didn't book."}
          </div>
        </section>
      )}

      {/* emails */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Marketing emails sent ({sends.length})</h3>
        {sends.length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 bg-white text-sm ring-1 ring-slate-200">
            {sends.map((x, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-3 px-4 py-2">
                <span className="w-28 shrink-0 text-slate-500">{day(x.created_at)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-800">
                  {x.kind === "campaign"
                    ? `Campaign: ${(x.campaign_id && campaignName.get(x.campaign_id)) || "(deleted)"}`
                    : AUTOMATION_INFO[x.kind as AutomationRow["key"]]?.title ?? x.kind}
                </span>
                {x.status !== "sent" && <span className="text-xs font-medium text-amber-700">{x.status}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Tag({ children, tone = "text-slate-700 bg-slate-100" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`px-2 py-0.5 font-medium ${tone}`}>{children}</span>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-bold text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
