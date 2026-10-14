import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign, type CampaignRow } from "@/lib/supabaseAdmin";
import { describeFilter, merge, paragraphs, recipients, type Profile } from "@/lib/segments";
import { renderMarketingPreview } from "@/lib/email";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaignTemplates";
import { saveCampaignAction, deleteCampaignAction } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import ConfirmButton from "@/components/ConfirmButton";
import SegmentPicker from "../../SegmentPicker";
import PreviewFrame from "../../PreviewFrame";
import { areasOf, loadAudienceOrMissing, MigrationNotice } from "../../data";

export const dynamic = "force-dynamic";
// Sending runs inside this page's server action: give it the full window.
export const maxDuration = 300;

type Step = "who" | "write" | "send";
type SP = { step?: string; saved?: string; test?: string; sent?: string; failed?: string; left?: string; confirm?: string; err?: string };

const STEPS: [Step, string][] = [
  ["who", "Who"],
  ["write", "Write"],
  ["send", "Check & send"],
];

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await getCampaign(id);
  if (!c) notFound();
  const audience = await loadAudienceOrMissing();
  if (!audience) return <MigrationNotice />;

  const { profiles } = audience;
  const list = recipients(profiles, c.segment ?? {});
  const locked = c.status === "sent";
  const step: Step = locked ? "send" : sp.step === "who" || sp.step === "send" ? sp.step : "write";
  const sample = list[0] ?? { firstName: "Sam", name: "Sam Example" };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/marketing/campaigns" className="text-sm text-slate-500 hover:text-slate-800">
        ← All campaigns
      </Link>
      <div className="mb-4 mt-1 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{c.name}</h2>
        {!locked && (
          <ol className="flex text-sm">
            {STEPS.map(([key, label], i) => {
              const here = key === step;
              const done = STEPS.findIndex(([k]) => k === step) > i;
              return (
                <li key={key}>
                  <Link
                    href={`?step=${key}`}
                    aria-current={here ? "step" : undefined}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${here ? "bg-brand-600 font-semibold text-white" : done ? "text-brand-700" : "text-slate-400"}`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${here ? "bg-white text-brand-700" : "bg-slate-200 text-slate-600"}`}>
                      {done ? "✓" : i + 1}
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <Notice sp={sp} />

      {step === "who" && <WhoStep c={c} profiles={profiles} />}
      {step === "write" && <WriteStep c={c} sample={sample} />}
      {step === "send" && <SendStep c={c} list={list} sample={sample} locked={locked} />}

      {c.status === "draft" && (
        <form action={deleteCampaignAction} className="mt-6 text-right">
          <input type="hidden" name="id" value={c.id} />
          <ConfirmButton confirm="Delete this draft? This can't be undone." className="text-xs font-medium text-rose-700 hover:underline">
            Delete draft
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}

/* ---------- 1. who ---------- */

function WhoStep({ c, profiles }: { c: CampaignRow; profiles: Profile[] }) {
  return (
    <form action={saveCampaignAction} className="space-y-4">
      <input type="hidden" name="id" value={c.id} />
      <input type="hidden" name="step" value="who" />
      <label className="block max-w-md">
        <span className="mb-1 block text-sm font-medium text-slate-700">Campaign name (only you see this)</span>
        <input name="name" defaultValue={c.name} className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
      </label>
      <h3 className="text-sm font-semibold text-slate-700">Who do you want to email?</h3>
      <SegmentPicker profiles={profiles} initial={c.segment ?? {}} areas={areasOf(profiles)} mode="campaign" />
      <div className="flex justify-end">
        <PendingButton name="next" value="write" pendingLabel="Saving…" className="bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Next: write the email →
        </PendingButton>
      </div>
    </form>
  );
}

/* ---------- 2. write ---------- */

function WriteStep({ c, sample }: { c: CampaignRow; sample: Pick<Profile, "firstName" | "name"> }) {
  const html = preview(c, sample);
  const blank = !c.subject && !c.body;
  return (
    <form action={saveCampaignAction}>
      <input type="hidden" name="id" value={c.id} />
      <input type="hidden" name="step" value="write" />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Start from:</span>
        {CAMPAIGN_TEMPLATES.map((t) =>
          blank ? (
            <PendingButton key={t.key} name="intent" value={`template:${t.key}`} pendingLabel="…" className="bg-white px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              {t.label}
            </PendingButton>
          ) : (
            <ConfirmButton
              key={t.key}
              name="intent"
              value={`template:${t.key}`}
              confirm={`Replace what you've written with the "${t.label}" template?`}
              className="bg-white px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              {t.label}
            </ConfirmButton>
          )
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Subject line" name="subject" defaultValue={c.subject} placeholder="A fresh start for spring, {first_name}" hint="What they see in their inbox. Keep it under ~50 characters." />
          <Field label="Headline" name="heading" defaultValue={c.heading} placeholder="Time for a proper spring clean?" />
          <Field label="Highlight box (optional)" name="highlight" defaultValue={c.highlight ?? ""} placeholder="10% off any deep clean booked before 31 March" hint="Your offer, in a tinted box above the message." />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Message</span>
            <textarea
              name="body"
              rows={10}
              defaultValue={c.body}
              placeholder={"Write it like a message to a customer.\n\nA blank line starts a new paragraph."}
              className="w-full border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-brand-500"
            />
            <span className="text-xs text-slate-400">{"{first_name}"} becomes their first name. Anything in [brackets] is for you to fill in.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Button text" name="cta_label" defaultValue={c.cta_label ?? ""} placeholder="Book a clean" />
            <Field label="Button goes to" name="cta_url" defaultValue={c.cta_url ?? ""} placeholder="/quote" />
          </div>
          {/\[[^\]]+\]/.test(`${c.subject}${c.heading}${c.body}${c.highlight ?? ""}`) && (
            <p className="bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
              There&apos;s still text in [brackets] to replace before sending.
            </p>
          )}
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <PreviewFrame html={html} subject={merge(c.subject, sample)} />
          <p className="mt-1 text-xs text-slate-400">The preview updates when you save.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        <PendingButton name="next" value="who" pendingLabel="…" className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          ← Who
        </PendingButton>
        <span className="flex-1" />
        <PendingButton name="intent" value="save" pendingLabel="Saving…" className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Save &amp; update preview
        </PendingButton>
        <PendingButton name="next" value="send" pendingLabel="Saving…" className="bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Next: check &amp; send →
        </PendingButton>
      </div>
    </form>
  );
}

/* ---------- 3. check & send ---------- */

function SendStep({
  c,
  list,
  sample,
  locked,
}: {
  c: CampaignRow;
  list: Profile[];
  sample: Pick<Profile, "firstName" | "name">;
  locked: boolean;
}) {
  const problems = [
    !c.subject.trim() && "There's no subject line.",
    !c.body.trim() && "There's no message.",
    /\[[^\]]+\]/.test(`${c.subject}${c.heading}${c.body}${c.highlight ?? ""}`) && "There's still text in [brackets] to replace.",
    !locked && list.length === 0 && "Nobody in this group can be emailed.",
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <Summary label="Goes to">
          {locked ? (
            <>
              Sent to <b>{c.sent_count}</b> {c.sent_at ? `on ${new Date(c.sent_at).toLocaleString("en-GB")}` : ""}.
            </>
          ) : (
            <>
              <b className="text-lg">{list.length}</b> {list.length === 1 ? "person" : "people"} — {describeFilter(c.segment ?? {})}
              {list.length > 0 && (
                <span className="mt-1 block text-xs text-slate-500">
                  {list.slice(0, 8).map((p) => p.name || p.email).join(", ")}
                  {list.length > 8 ? ` and ${list.length - 8} more` : ""}
                </span>
              )}
              {c.status === "sending" && <span className="mt-1 block text-xs text-amber-700">Already sent to {c.sent_count}; sending again only reaches the rest.</span>}
            </>
          )}
        </Summary>
        <Summary label="Subject">{merge(c.subject, sample) || <span className="text-rose-700">none yet</span>}</Summary>

        {!locked && (
          <>
            {problems.length > 0 && (
              <ul className="space-y-1 bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
                {problems.map((p) => (
                  <li key={p}>⚠ {p}</li>
                ))}
              </ul>
            )}
            <form action={saveCampaignAction} className="space-y-3 bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="step" value="send" />
              <PendingButton name="intent" value="test" pendingLabel="Sending test…" className="w-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Send me a test first
              </PendingButton>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" name="confirm_send" className="mt-0.5 accent-brand-600" />
                <span>
                  I&apos;ve checked it — send to <b>{list.length}</b> {list.length === 1 ? "person" : "people"} now. This can&apos;t be undone.
                </span>
              </label>
              <PendingButton
                name="intent"
                value="send"
                pendingLabel="Sending… keep this page open"
                className="w-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                {c.status === "sending" ? "Send to the rest" : `Send to ${list.length} ${list.length === 1 ? "person" : "people"}`}
              </PendingButton>
            </form>
            <Link href="?step=write" className="inline-block text-sm text-slate-600 hover:underline">
              ← Back to edit
            </Link>
          </>
        )}
      </div>
      <PreviewFrame html={preview(c, sample)} subject={merge(c.subject, sample)} />
    </div>
  );
}

/* ---------- bits ---------- */

function preview(c: CampaignRow, sample: Pick<Profile, "firstName" | "name">): string {
  return renderMarketingPreview({
    subject: merge(c.subject, sample),
    heading: merge(c.heading || c.subject || "Your headline", sample),
    paragraphs: paragraphs(merge(c.body || "Your message will appear here.", sample)),
    highlight: c.highlight ? merge(c.highlight, sample) : null,
    cta: c.cta_label && c.cta_url ? { label: c.cta_label, url: c.cta_url } : null,
  });
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm text-slate-900">{children}</div>
    </div>
  );
}

function Notice({ sp }: { sp: SP }) {
  let text: string | null = null;
  let bad = false;
  if (sp.saved === "template") text = "Template added — replace anything in [brackets], then save.";
  else if (sp.saved) text = "Saved.";
  else if (sp.test === "ok") text = "Test sent to the office inbox — have a look before sending.";
  else if (sp.test) [text, bad] = [`The test didn't send: ${sp.test}`, true];
  else if (sp.confirm) [text, bad] = ["Tick the box to confirm, then press Send.", true];
  else if (sp.err) [text, bad] = [sp.err, true];
  else if (sp.sent !== undefined) {
    const left = Number(sp.left ?? 0);
    const failed = Number(sp.failed ?? 0);
    text =
      `Sent ${sp.sent}.` +
      (failed ? ` ${failed} failed — press Send again to retry them.` : "") +
      (left ? ` ${left} still to go — press Send again to carry on.` : "");
    bad = failed > 0 || left > 0;
  }
  if (!text) return null;
  return (
    <p className={`mb-4 px-3 py-2 text-sm font-medium ring-1 ${bad ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"}`}>
      {text}
    </p>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
