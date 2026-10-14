import { listAutomations, sendCountsSince, type AutomationRow } from "@/lib/supabaseAdmin";
import { qualifyingCounts, automationCtaUrl } from "@/lib/marketing";
import { renderMarketingPreview } from "@/lib/email";
import { merge, paragraphs } from "@/lib/segments";
import { saveAutomationAction, testAutomationAction } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import ConfirmButton from "@/components/ConfirmButton";
import { loadAudienceOrMissing, MigrationNotice, requestClock } from "../data";
import { AUTOMATION_INFO, AUTOMATION_ORDER } from "../automationInfo";

export const dynamic = "force-dynamic";

const SAMPLE = { firstName: "Sam", name: "Sam Example" };

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tested?: string; ok?: string; why?: string }>;
}) {
  const [audience, sp] = await Promise.all([loadAudienceOrMissing(), searchParams]);
  if (!audience) return <MigrationNotice />;
  const clock = requestClock();
  const [automations, sent30] = await Promise.all([listAutomations(), sendCountsSince(clock.daysAgoIso(30))]);
  const qualifying = qualifyingCounts(automations, audience, clock.today, clock.now);
  const list = automations
    .filter((a) => a.key in AUTOMATION_INFO)
    .sort((x, y) => AUTOMATION_ORDER.indexOf(x.key) - AUTOMATION_ORDER.indexOf(y.key));

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        These send themselves every morning to whoever qualifies that day. Each is off until you switch it on. Nobody gets
        more than one marketing email a week, at most 40 go out a day, and only people who said yes to offers are ever
        emailed.
      </p>
      {sp.tested && (
        <p
          className={`px-3 py-2 text-sm font-medium ring-1 ${
            sp.ok === "1" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          {sp.ok === "1" ? "Test sent to the office inbox." : `The test didn't send: ${sp.why ?? "unknown error"}`}
        </p>
      )}
      {list.length < AUTOMATION_ORDER.length && <MigrationNotice file="supabase/2026-10-12-marketing-2.sql" />}

      {list.map((a) => (
        <AutomationRowCard key={a.key} a={a} qualifies={qualifying[a.key] ?? 0} sent={sent30[a.key] ?? 0} />
      ))}
    </div>
  );
}

function AutomationRowCard({ a, qualifies, sent }: { a: AutomationRow; qualifies: number; sent: number }) {
  const info = AUTOMATION_INFO[a.key];
  const html = renderMarketingPreview({
    subject: merge(a.subject, SAMPLE),
    heading: merge(a.heading, SAMPLE),
    paragraphs: paragraphs(merge(a.body, SAMPLE)),
    highlight: a.key === "abandoned_quote" ? "Your quote: Every 2 weeks, 3 hours — £66 a visit" : null,
    cta: { label: a.cta_label, url: automationCtaUrl(a.key) },
  });
  return (
    <section id={a.key} className={`scroll-mt-4 bg-white shadow-sm ring-1 ${a.enabled ? "ring-emerald-300" : "ring-slate-200"}`}>
      <div className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">{info.title}</h2>
          <p className="text-sm text-slate-500">{info.when(a.delay_days)}</p>
          <p className="mt-1 truncate text-sm text-slate-700">
            <span className="text-slate-400">Subject:</span> {merge(a.subject, SAMPLE)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <Figure n={qualifies} label="qualify today" />
          <Figure n={sent} label="sent, last 30 days" />
          <form action={saveAutomationAction}>
            <input type="hidden" name="key" value={a.key} />
            {!a.enabled && <input type="hidden" name="enabled" value="on" />}
            {a.enabled ? (
              <PendingButton pendingLabel="…" className="w-20 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                On
              </PendingButton>
            ) : (
              <ConfirmButton
                confirm={
                  qualifies > 0
                    ? `Switch on "${info.title}"? ${qualifies} ${qualifies === 1 ? "person qualifies" : "people qualify"} today and will get it tomorrow morning.`
                    : `Switch on "${info.title}"? It will send each morning to whoever qualifies.`
                }
                className="w-20 bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-300"
              >
                Off
              </ConfirmButton>
            )}
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-2 text-sm">
        <details className="w-full">
          <summary className="inline cursor-pointer font-medium text-brand-700 hover:underline">Preview</summary>
          <iframe title={`${info.title} preview`} sandbox="" srcDoc={html} className="mt-2 h-[560px] w-full bg-slate-100" />
        </details>
        <details className="w-full">
          <summary className="inline cursor-pointer font-medium text-brand-700 hover:underline">Edit the email</summary>
          <form action={saveAutomationAction} className="mt-2 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="key" value={a.key} />
            {a.enabled && <input type="hidden" name="enabled" value="on" />}
            {info.delayLabel ? (
              <Input label={info.delayLabel} name="delay_days" defaultValue={String(a.delay_days)} type="number" />
            ) : (
              <input type="hidden" name="delay_days" value={String(a.delay_days)} />
            )}
            <Input label="Subject" name="subject" defaultValue={a.subject} />
            <Input label="Headline" name="heading" defaultValue={a.heading} className="sm:col-span-2" />
            <label className="block sm:col-span-2">
              <span className="mb-0.5 block text-xs font-medium text-slate-600">Message — a blank line starts a new paragraph</span>
              <textarea name="body" rows={6} defaultValue={a.body} className="w-full border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500" />
            </label>
            <Input label="Button text" name="cta_label" defaultValue={a.cta_label} />
            <p className="self-end text-xs text-slate-400">{"{first_name}"} becomes their first name.</p>
            <div>
              <PendingButton pendingLabel="Saving…" className="bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Save
              </PendingButton>
            </div>
          </form>
        </details>
        <form action={testAutomationAction}>
          <input type="hidden" name="key" value={a.key} />
          <PendingButton pendingLabel="Sending…" className="font-medium text-brand-700 hover:underline">
            Send me a test
          </PendingButton>
        </form>
      </div>
    </section>
  );
}

function Figure({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold tabular-nums ${n ? "text-slate-900" : "text-slate-300"}`}>{n}</div>
      <div className="text-[11px] leading-tight text-slate-500">{label}</div>
    </div>
  );
}

function Input({
  label,
  name,
  defaultValue,
  type = "text",
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-0.5 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} className="w-full border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500" />
    </label>
  );
}
