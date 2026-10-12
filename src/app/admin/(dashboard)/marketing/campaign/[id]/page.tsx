import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/supabaseAdmin";
import { loadAudience } from "@/lib/marketing";
import { describeFilter, merge, paragraphs, recipients } from "@/lib/segments";
import { saveCampaignAction, deleteCampaignAction } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import SegmentFields from "../../SegmentFields";

export const dynamic = "force-dynamic";
// Sending runs inside this page's server action: give it the full window.
export const maxDuration = 300;

type SP = { saved?: string; test?: string; sent?: string; failed?: string; left?: string; confirm?: string; err?: string };

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await getCampaign(id);
  if (!c) notFound();

  const { profiles } = await loadAudience();
  const list = recipients(profiles, c.segment ?? {});
  const areas = [...new Set(profiles.map((p) => p.area).filter((a): a is string => !!a))].sort();
  const sample = list[0] ?? { firstName: "Sam", name: "Sam Example" };
  const locked = c.status === "sent";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/marketing" className="text-sm text-slate-500 hover:text-slate-800">
        ← Marketing
      </Link>
      <h1 className="mb-1 mt-1 text-2xl font-bold text-slate-900">{c.name}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {locked ? (
          <>Sent to <b>{c.sent_count}</b> {c.sent_at ? `on ${new Date(c.sent_at).toLocaleString("en-GB")}` : ""}.</>
        ) : (
          <>
            Goes to <b className="text-emerald-700">{list.length} people</b> right now — {describeFilter(c.segment ?? {})}, and only
            those who said yes to offers.
            {c.status === "sending" && <> Already sent to {c.sent_count}; sending again only reaches the rest.</>}
          </>
        )}
      </p>

      <Notice sp={sp} />

      <form action={saveCampaignAction} className="space-y-5">
        <input type="hidden" name="id" value={c.id} />
        <fieldset disabled={locked} className="space-y-5">
          <div className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 font-semibold text-slate-900">The email</h2>
            <div className="grid gap-3">
              <Field label="Campaign name (only you see this)" name="name" defaultValue={c.name} />
              <Field label="Subject line" name="subject" defaultValue={c.subject} placeholder="Spring deep clean — 10% off this month" />
              <Field label="Headline inside the email" name="heading" defaultValue={c.heading} placeholder="Hi {first_name}, ready for a spring reset?" />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Message</span>
                <textarea
                  name="body"
                  rows={9}
                  defaultValue={c.body}
                  placeholder={"Write it like a message to a customer.\n\nA blank line starts a new paragraph. {first_name} becomes their first name."}
                  className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Button text" name="cta_label" defaultValue={c.cta_label ?? ""} placeholder="Book a clean" />
                <Field label="Button link" name="cta_url" defaultValue={c.cta_url ?? ""} placeholder="/quote" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 font-semibold text-slate-900">Who gets it</h2>
            <SegmentFields f={c.segment ?? {}} areas={areas} />
            <p className="mt-2 text-xs text-slate-400">Save to update the count above.</p>
          </div>
        </fieldset>

        {/* preview */}
        <div className="bg-slate-100 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Preview{list[0] ? ` — as ${sample.firstName} sees it` : ""}
          </p>
          <div className="mx-auto max-w-md bg-white shadow-sm">
            <div className="bg-[#0d2a48] px-5 py-3 text-sm font-bold tracking-[0.16em] text-white">SAAFI</div>
            <div className="p-5 text-sm">
              <p className="mb-1 text-xs text-slate-400">Subject: {merge(c.subject || "(no subject)", sample)}</p>
              <p className="mb-3 text-lg font-bold text-slate-900">{merge(c.heading || c.subject || "(no headline)", sample)}</p>
              {paragraphs(merge(c.body, sample)).map((p, i) => (
                <p key={i} className="mb-3 leading-relaxed text-slate-800">
                  {p}
                </p>
              ))}
              {c.cta_label && c.cta_url && (
                <span className="inline-block bg-[#1273c4] px-4 py-2 font-semibold text-white">{c.cta_label}</span>
              )}
              <p className="mt-4 text-[11px] text-slate-400">… footer with contact details and an Unsubscribe link</p>
            </div>
          </div>
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <PendingButton name="intent" value="save" pendingLabel="Saving…" className="border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Save
            </PendingButton>
            <PendingButton name="intent" value="test" pendingLabel="Sending test…" className="border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Send me a test
            </PendingButton>
            <span className="flex-1" />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="confirm_send" className="accent-brand-600" />
              Send to {list.length} people now
            </label>
            <PendingButton name="intent" value="send" pendingLabel="Sending… keep this open" className="bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {c.status === "sending" ? "Send to the rest" : "Send"}
            </PendingButton>
          </div>
        )}
      </form>

      {c.status === "draft" && (
        <form action={deleteCampaignAction} className="mt-4 text-right">
          <input type="hidden" name="id" value={c.id} />
          <PendingButton pendingLabel="…" className="text-xs font-medium text-rose-700 hover:underline">
            Delete draft
          </PendingButton>
        </form>
      )}
    </div>
  );
}

function Notice({ sp }: { sp: SP }) {
  let text: string | null = null;
  let bad = false;
  if (sp.saved) text = "Saved.";
  else if (sp.test === "ok") text = "Test sent to the office inbox.";
  else if (sp.test) [text, bad] = [`Test didn't send: ${sp.test}`, true];
  else if (sp.confirm) [text, bad] = ["Tick the box next to Send to confirm.", true];
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

function Field({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
    </label>
  );
}
