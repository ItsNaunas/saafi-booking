import Link from "next/link";
import { listAutomations, recentSends, type AutomationRow } from "@/lib/supabaseAdmin";
import { qualifyingCounts } from "@/lib/marketing";
import { CONSENT_LABEL, PRESETS, STAGE_LABEL, filterToFields, recipients, type Consent, type Stage } from "@/lib/segments";
import { createCampaignAction } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import { loadAudienceOrMissing, MigrationNotice, requestClock } from "./data";
import { AUTOMATION_INFO } from "./automationInfo";

export const dynamic = "force-dynamic";

/** Suggested campaigns, in the order they're usually worth most. */
const NUDGES: { preset: string; text: (n: number) => string; action: string }[] = [
  { preset: "leads", text: (n) => `${n} ${n === 1 ? "person" : "people"} got a quote but never booked`, action: "Email them" },
  { preset: "one_off_back", text: (n) => `${n} one-off ${n === 1 ? "customer hasn't" : "customers haven't"} come back in 30+ days`, action: "Invite them back" },
  { preset: "lapsed", text: (n) => `${n} ${n === 1 ? "person" : "people"} stopped their regular plan`, action: "Win them back" },
  { preset: "upgrade", text: (n) => `${n} regular${n === 1 ? " is" : "s are"} on a fortnightly or 4-weekly plan`, action: "Offer more often" },
  { preset: "deep_due", text: (n) => `${n} regular${n === 1 ? " is" : "s are"} due a deep clean`, action: "Offer a deep clean" },
  { preset: "happy", text: (n) => `${n} happy regular${n === 1 ? "" : "s"} could recommend you`, action: "Ask for referrals" },
];

const KIND_LABEL = (k: string) => (k === "campaign" ? "Campaign" : AUTOMATION_INFO[k as AutomationRow["key"]]?.title ?? k);

export default async function OverviewPage() {
  const audience = await loadAudienceOrMissing();
  if (!audience) return <MigrationNotice />;
  const { profiles } = audience;
  const [automations, sends] = await Promise.all([listAutomations(), recentSends(12)]);
  const clock = requestClock();
  const qualifying = qualifyingCounts(automations, audience, clock.today, clock.now);

  const reachable = profiles.filter((p) => p.consent === "yes").length;
  const consent = (Object.keys(CONSENT_LABEL) as Consent[]).map((c) => [c, profiles.filter((p) => p.consent === c).length] as const);
  const nudges = NUDGES.map((n) => {
    const preset = PRESETS.find((p) => p.key === n.preset)!;
    return { ...n, preset, count: recipients(profiles, preset.filter).length };
  }).filter((n) => n.count > 0);
  const idle = automations.filter((a) => !a.enabled && (qualifying[a.key] ?? 0) > 0);
  const on = automations.filter((a) => a.enabled).length;

  return (
    <div className="space-y-6">
      {/* the headline */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat big={reachable} label="people you can email" sub={`of ${profiles.length} contacts`} />
        <Stat big={on} label={`automatic email${on === 1 ? "" : "s"} switched on`} sub={`of ${automations.length}`} href="/admin/marketing/automations" />
        <div className="bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Who can be emailed</p>
          <div className="space-y-1 text-sm">
            {consent.map(([c, n]) => (
              <div key={c} className="flex justify-between">
                <span className="text-slate-600">{CONSENT_LABEL[c]}</span>
                <span className="font-semibold tabular-nums text-slate-900">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {profiles.length < 10 && (
        <section className="bg-brand-50 p-4 text-sm text-brand-900 ring-1 ring-brand-200">
          <p className="font-semibold">Your list is just getting started.</p>
          <p className="mt-1">
            Everyone who books from now on, or types their email into the quote form, lands here automatically, along with
            whether they&apos;re happy to get offers. Phone bookings and bookings from before 10 September never recorded
            that answer, so they aren&apos;t emailed. Suggestions appear below as soon as there&apos;s someone to email.
          </p>
        </section>
      )}

      {/* what to do next */}
      {(nudges.length > 0 || idle.length > 0) && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Suggested next</h2>
          <div className="space-y-2">
            {idle.map((a) => (
              <div key={a.key} className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 shadow-sm ring-1 ring-amber-200">
                <span className="min-w-0 flex-1 text-sm text-slate-800">
                  <b>{qualifying[a.key]}</b> {qualifying[a.key] === 1 ? "person qualifies" : "people qualify"} for{" "}
                  <b>{AUTOMATION_INFO[a.key]?.title ?? a.key}</b> today, but it&apos;s switched off.
                </span>
                <Link href={`/admin/marketing/automations#${a.key}`} className="text-sm font-semibold text-brand-700 hover:underline">
                  Review it →
                </Link>
              </div>
            ))}
            {nudges.map((n) => (
              <form key={n.preset.key} action={createCampaignAction} className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                <input type="hidden" name="from" value="segment" />
                <input type="hidden" name="name" value={`${n.preset.label} — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`} />
                {filterToFields(n.preset.filter).map(([k, v], i) => (
                  <input key={`${k}${i}`} type="hidden" name={k} value={v} />
                ))}
                <span className="min-w-0 flex-1 text-sm text-slate-800">{n.text(n.count)}</span>
                <PendingButton pendingLabel="Starting…" className="bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
                  {n.action}
                </PendingButton>
              </form>
            ))}
          </div>
        </section>
      )}

      {/* where people are */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Your contacts by stage</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(STAGE_LABEL) as Stage[]).map((s) => {
            const all = profiles.filter((p) => p.stage === s);
            const ok = all.filter((p) => p.consent === "yes").length;
            return (
              <div key={s} className="bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs text-slate-500">{STAGE_LABEL[s]}</div>
                <div className="text-lg font-bold tabular-nums text-slate-900">
                  {all.length} <span className="text-xs font-normal text-slate-400">{ok} can be emailed</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* history */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Recent emails</h2>
        {sends.length === 0 ? (
          <p className="text-sm text-slate-500">No marketing emails sent yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 bg-white text-sm ring-1 ring-slate-200">
            {sends.map((x, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-3 px-4 py-2">
                <span className="w-28 shrink-0 text-xs text-slate-400">
                  {new Date(x.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-800">{x.email}</span>
                <span className="text-xs text-slate-500">{KIND_LABEL(x.kind)}</span>
                {x.status !== "sent" && <span className="text-xs font-medium text-amber-700">{x.status}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ big, label, sub, href }: { big: number; label: string; sub: string; href?: string }) {
  const body = (
    <>
      <div className="text-3xl font-bold tabular-nums text-slate-900">{big}</div>
      <div className="text-sm text-slate-700">{label}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </>
  );
  return href ? (
    <Link href={href} className="block bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-brand-300">
      {body}
    </Link>
  ) : (
    <div className="bg-white p-4 shadow-sm ring-1 ring-slate-200">{body}</div>
  );
}
