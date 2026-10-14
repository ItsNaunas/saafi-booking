import Link from "next/link";
import { listCampaigns } from "@/lib/supabaseAdmin";
import { describeFilter } from "@/lib/segments";
import { createCampaignAction } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import { MigrationNotice } from "../data";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  let campaigns;
  try {
    campaigns = await listCampaigns();
  } catch (e) {
    if (/PGRST205|42P01/.test(String(e))) return <MigrationNotice />;
    throw e;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">One-off emails you write and send to a group, in three steps: who, write, check &amp; send.</p>
        <form action={createCampaignAction}>
          <input type="hidden" name="name" value={`Campaign — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`} />
          <PendingButton pendingLabel="Starting…" className="bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            + New campaign
          </PendingButton>
        </form>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          No campaigns yet. Start one here, or from a suggestion on the Overview tab.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white ring-1 ring-slate-200">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/admin/marketing/campaign/${c.id}${c.status === "draft" ? "" : "?step=send"}`}
              className="grid gap-1 px-4 py-3 text-sm hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{c.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {c.subject ? `“${c.subject}” · ` : ""}
                  {describeFilter(c.segment ?? {})}
                </div>
              </div>
              <span
                className={`justify-self-start px-2 py-0.5 text-xs font-semibold ring-1 ring-inset sm:justify-self-end ${
                  c.status === "sent"
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : c.status === "sending"
                      ? "bg-amber-50 text-amber-800 ring-amber-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200"
                }`}
              >
                {c.status === "sent"
                  ? `Sent to ${c.sent_count}${c.sent_at ? ` · ${new Date(c.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`
                  : c.status === "sending"
                    ? `Part sent · ${c.sent_count} so far`
                    : "Draft"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
