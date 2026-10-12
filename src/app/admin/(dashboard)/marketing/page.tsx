import Link from "next/link";
import { loadAudience } from "@/lib/marketing";
import { listAutomations, listCampaigns, type AutomationRow, type CampaignRow } from "@/lib/supabaseAdmin";
import {
  CONSENT_LABEL,
  PRESETS,
  STAGE_LABEL,
  describeFilter,
  filterFromForm,
  filterToFields,
  matches,
  SOURCE_LABEL,
  type Consent,
  type SegmentFilter,
  type Profile,
  type Stage,
} from "@/lib/segments";
import { formatGBP } from "@/lib/pricing";
import { createCampaignAction, saveAutomationAction } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import SegmentFields from "./SegmentFields";

export const dynamic = "force-dynamic";

const AUTOMATION_INFO: Record<AutomationRow["key"], { title: string; when: (d: number) => string; delayLabel?: string }> = {
  at_risk_checkin: {
    title: "Something went wrong — check-in",
    when: (d) =>
      `A personal "how did we do" ${d}+ days after a no-access visit, cancellation, refund or bill above the quote. Never an offer; goes before any other email that week.`,
    delayLabel: "Days after the problem",
  },
  abandoned_quote: {
    title: "Abandoned quote",
    when: () => "Typed their email into the quote form but didn't book. Sent once, the next morning (6h+ later), within a week, with their quoted price.",
  },
  one_off_followup: {
    title: "One-off → regular",
    when: (d) => `A one-off customer, ${d}–${d + 30} days after their clean, with nothing else booked.`,
    delayLabel: "Days after their clean",
  },
  lapsed_regular: {
    title: "Lapsed regular win-back",
    when: (d) => `A regular whose plan stopped, ${d}–${d + 60} days after their last clean, with nothing booked.`,
    delayLabel: "Days after their last clean",
  },
  mover_followup: {
    title: "Mover follow-up",
    when: (d) => `${d}–${d + 30} days after a deep clean booked for moving out or moving in. Asks for a clean at the new place and an introduction.`,
    delayLabel: "Days after the move clean",
  },
  seasonal_deep: {
    title: "Seasonal deep clean",
    when: () => "March and September, to regulars and one-offs with no deep clean in 6+ months. Once per season.",
  },
  referral_ask: {
    title: "Referral ask",
    when: () => "Once, to happy regulars: 3+ completed cleans and nothing gone wrong in 90 days. No reward is promised.",
  },
};
const AUTOMATION_ORDER: AutomationRow["key"][] = [
  "abandoned_quote",
  "one_off_followup",
  "lapsed_regular",
  "mover_followup",
  "seasonal_deep",
  "referral_ask",
  "at_risk_checkin",
];

const CONSENT_CHIP: Record<Consent, string> = {
  yes: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  no: "bg-slate-100 text-slate-600 ring-slate-200",
  unsubscribed: "bg-rose-50 text-rose-800 ring-rose-200",
  unknown: "bg-amber-50 text-amber-800 ring-amber-200",
};

type SP = Record<string, string | string[] | undefined>;

export default async function MarketingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] ?? null : v ?? null;
  };
  const all = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v : v ? [v] : [];
  };

  let profiles: Profile[] = [];
  let automations: AutomationRow[] = [];
  let campaigns: CampaignRow[] = [];
  try {
    [{ profiles }, automations, campaigns] = await Promise.all([loadAudience(), listAutomations(), listCampaigns()]);
  } catch (e) {
    if (/PGRST205|42P01/.test(String(e))) {
      return (
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-3 text-2xl font-bold text-slate-900">Marketing</h1>
          <p className="bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
            One-time setup needed: paste <code>supabase/2026-10-12-marketing.sql</code> into the Supabase SQL editor,
            then reload this page.
          </p>
        </div>
      );
    }
    throw e;
  }

  // Segment explorer: a preset, or the builder's fields.
  const preset = PRESETS.find((p) => p.key === one("preset"));
  const filter = preset ? preset.filter : filterFromForm(one, all);
  const inSegment = profiles.filter((p) => matches(p, filter));
  const emailable = inSegment.filter((p) => p.consent === "yes");
  const areas = [...new Set(profiles.map((p) => p.area).filter((a): a is string => !!a))].sort();

  const consentCounts = (Object.keys(CONSENT_LABEL) as Consent[]).map((c) => [c, profiles.filter((p) => p.consent === c).length] as const);
  const stageCounts = (Object.keys(STAGE_LABEL) as Stage[]).map(
    (s) => [s, profiles.filter((p) => p.stage === s).length, profiles.filter((p) => p.stage === s && p.consent === "yes").length] as const
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Marketing</h1>
      <p className="mb-5 text-sm text-slate-500">
        Everyone who has booked or started a quote, grouped so you can email the right people. Only people who left the
        offers box ticked are ever emailed, and every email has an unsubscribe link.
      </p>

      {/* audience */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Contacts · {profiles.length}</h2>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {consentCounts.map(([c, n]) => (
              <span key={c} className={`px-2 py-1 font-medium ring-1 ring-inset ${CONSENT_CHIP[c]}`}>
                {CONSENT_LABEL[c]} {n}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            &ldquo;Never asked&rdquo; = phone bookings and bookings from before 10 Sept. They aren&apos;t emailed.
          </p>
        </div>
        <div className="bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">By stage (can email)</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
            {stageCounts.map(([s, n, ok]) => (
              <div key={s} className="flex justify-between">
                <span className="text-slate-600">{STAGE_LABEL[s]}</span>
                <span className="font-semibold text-slate-900">
                  {n} <span className="font-normal text-slate-400">({ok})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* automations */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Automatic emails</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {automations
            .filter((a) => a.key in AUTOMATION_INFO)
            .sort((x, y) => AUTOMATION_ORDER.indexOf(x.key) - AUTOMATION_ORDER.indexOf(y.key))
            .map((a) => (
              <AutomationCard key={a.key} a={a} />
            ))}
        </div>
        {automations.length < AUTOMATION_ORDER.length && (
          <p className="mt-2 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            Four more automatic emails are ready: paste <code>supabase/2026-10-12-marketing-2.sql</code> into Supabase to add them.
          </p>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Checked every morning. Nobody gets more than one marketing email a week, and at most 40 automatic emails go
          out per day.
        </p>
      </section>

      {/* campaigns */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Campaigns</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-500">No campaigns yet — pick a segment below and press &ldquo;Email this segment&rdquo;.</p>
        ) : (
          <div className="space-y-1.5">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/admin/marketing/campaign/${c.id}`}
                className="flex flex-wrap items-center gap-x-3 border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{c.name}</span>
                <span className="truncate text-xs text-slate-500">{describeFilter(c.segment ?? {})}</span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${
                    c.status === "sent"
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                      : c.status === "sending"
                        ? "bg-amber-50 text-amber-800 ring-amber-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200"
                  }`}
                >
                  {c.status === "sent" ? `sent · ${c.sent_count}` : c.status === "sending" ? `part sent · ${c.sent_count}` : "draft"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* segment explorer */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Segments</h2>
        <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
          {PRESETS.map((p) => {
            const n = profiles.filter((x) => x.consent === "yes" && matches(x, p.filter)).length;
            return (
              <Link
                key={p.key}
                href={`/admin/marketing?preset=${p.key}`}
                title={p.hint}
                className={`px-3 py-1 font-medium ring-1 ring-inset ${
                  preset?.key === p.key ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {p.label} <span className="opacity-70">{n}</span>
              </Link>
            );
          })}
        </div>

        <form method="get" action="/admin/marketing" className="mb-3 bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <SegmentFields f={filter} areas={areas} />
          <div className="mt-3 flex gap-2">
            <button className="bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">Show segment</button>
            <Link href="/admin/marketing" className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800">
              Clear
            </Link>
          </div>
        </form>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            <b>{describeFilter(filter)}</b> — {inSegment.length} contact{inSegment.length === 1 ? "" : "s"},{" "}
            <b className="text-emerald-700">{emailable.length} can be emailed</b>
          </p>
          {emailable.length > 0 && (
            <form action={createCampaignAction}>
              <input type="hidden" name="name" value={`${preset?.label ?? describeFilter(filter)} — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`} />
              <HiddenFilter f={filter} />
              <PendingButton pendingLabel="Creating…" className="bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                ✉ Email this segment
              </PendingButton>
            </form>
          )}
        </div>

        {inSegment.length > 0 && (
          <div className="overflow-x-auto bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Area</th>
                  <th className="px-3 py-2">Last clean</th>
                  <th className="px-3 py-2 text-right">Cleans</th>
                  <th className="px-3 py-2 text-right">Spent</th>
                  <th className="px-3 py-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {inSegment.slice(0, 200).map((p) => (
                  <tr key={p.email} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{p.name || "—"}</div>
                      <div className="text-xs text-slate-500">{p.email}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {STAGE_LABEL[p.stage]}
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {p.isHost && <Tag cls="text-sky-700">host{p.hostListings > 1 ? ` ×${p.hostListings}` : ""}</Tag>}
                        {p.atRisk && <Tag cls="text-rose-700">at risk</Tag>}
                        {p.happy && <Tag cls="text-emerald-700">happy</Tag>}
                        {p.lastMoveClean && <Tag cls="text-violet-700">mover</Tag>}
                        {p.plan && <Tag cls="text-slate-500">{p.plan.replace("_", "-")}</Tag>}
                        {p.heardFrom && <Tag cls="text-slate-500">via {SOURCE_LABEL[p.heardFrom] ?? p.heardFrom}</Tag>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{p.area ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {p.lastClean ? `${p.daysSinceLastClean}d ago` : "—"}
                      {p.nextBooking && <div className="text-xs text-brand-700">next {p.nextBooking}</div>}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800">{p.completed}</td>
                    <td className="px-3 py-2 text-right text-slate-800">{p.spend ? formatGBP(p.spend) : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${CONSENT_CHIP[p.consent]}`}>
                        {CONSENT_LABEL[p.consent]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inSegment.length > 200 && <p className="px-3 py-2 text-xs text-slate-400">Showing the first 200.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

/** Carry a filter into a POST form as the same field names the builder uses. */
function HiddenFilter({ f }: { f: SegmentFilter }) {
  return (
    <>
      {filterToFields(f).map(([k, v], i) => (
        <input key={`${k}${i}`} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

function AutomationCard({ a }: { a: AutomationRow }) {
  const info = AUTOMATION_INFO[a.key];
  return (
    <div className={`bg-white p-4 shadow-sm ring-1 ${a.enabled ? "ring-emerald-300" : "ring-slate-200"}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{info.title}</h3>
        <form action={saveAutomationAction}>
          <input type="hidden" name="key" value={a.key} />
          {!a.enabled && <input type="hidden" name="enabled" value="on" />}
          <PendingButton
            pendingLabel="…"
            className={`px-2.5 py-1 text-xs font-semibold ${a.enabled ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {a.enabled ? "On" : "Off"}
          </PendingButton>
        </form>
      </div>
      <p className="mb-2 text-xs text-slate-500">{info.when(a.delay_days)}</p>
      <p className="mb-2 truncate text-xs text-slate-700">
        <span className="text-slate-400">Subject:</span> {a.subject}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-brand-700">Edit email</summary>
        <form action={saveAutomationAction} className="mt-2 space-y-2">
          <input type="hidden" name="key" value={a.key} />
          {a.enabled && <input type="hidden" name="enabled" value="on" />}
          {info.delayLabel ? (
            <Input label={info.delayLabel} name="delay_days" defaultValue={String(a.delay_days)} type="number" />
          ) : (
            <input type="hidden" name="delay_days" value={String(a.delay_days)} />
          )}
          <Input label="Subject" name="subject" defaultValue={a.subject} />
          <Input label="Headline" name="heading" defaultValue={a.heading} />
          <label className="block">
            <span className="mb-0.5 block text-xs font-medium text-slate-600">Message (blank line = new paragraph)</span>
            <textarea name="body" rows={6} defaultValue={a.body} className="w-full border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500" />
          </label>
          <Input label="Button" name="cta_label" defaultValue={a.cta_label} />
          <p className="text-[11px] text-slate-400">{"{first_name}"} is replaced with their first name.</p>
          <PendingButton pendingLabel="Saving…" className="bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            Save
          </PendingButton>
        </form>
      </details>
    </div>
  );
}

function Input({ label, name, defaultValue, type = "text" }: { label: string; name: string; defaultValue?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} className="w-full border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500" />
    </label>
  );
}

function Tag({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`font-medium ${cls}`}>{children}</span>;
}
