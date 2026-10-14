import { createCampaignAction } from "@/app/admin/actions";
import PendingButton from "@/components/PendingButton";
import SegmentPicker from "../SegmentPicker";
import { areasOf, loadAudienceOrMissing, MigrationNotice } from "../data";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const audience = await loadAudienceOrMissing();
  if (!audience) return <MigrationNotice />;
  const { profiles } = audience;

  return (
    <form action={createCampaignAction} className="space-y-3">
      <input type="hidden" name="from" value="segment" />
      <p className="text-sm text-slate-500">
        Everyone who has booked or started a quote ({profiles.length}). Pick a group to see who&apos;s in it, then email them
        in one tap.
      </p>
      <SegmentPicker
        profiles={profiles}
        initial={{}}
        areas={areasOf(profiles)}
        mode="contacts"
        action={
          <PendingButton pendingLabel="Starting…" className="bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100">
            ✉ Email these people
          </PendingButton>
        }
      />
    </form>
  );
}
