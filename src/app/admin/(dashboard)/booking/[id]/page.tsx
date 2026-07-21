import { notFound } from "next/navigation";
import { getBooking } from "@/lib/supabaseAdmin";
import { editBooking } from "@/app/admin/actions";
import { FREQUENCY_LABEL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const b = await getBooking(id);
  if (!b) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{b.customer_name}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {b.reference} · status <b>{b.status}</b> · {FREQUENCY_LABEL[b.frequency]}
        {b.frequency !== "one_off" && !b.recurring_active && " (recurring stopped)"}
      </p>

      <div className="mb-4 rounded-xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
        <Row k="Contact" v={`${b.customer_phone} · ${b.customer_email}`} />
        <Row k="Address" v={`${b.address_line}, ${b.postcode}`} />
        <Row
          k="Rooms"
          v={`${b.bedrooms} bed · ${b.bathrooms} bath · ${b.dining_rooms} dining · ${b.living_rooms} living`}
        />
        <Row k="Products" v={b.customer_provides_products ? "Customer provides" : "We bring ours"} />
        {(b.addons?.length ?? 0) > 0 && (
          <Row k="Extras" v={b.addons.map((a) => `${a.label} (£${a.price})`).join(", ")} />
        )}
        <Row k="Booked" v={new Date(b.created_at).toLocaleString("en-GB")} />
      </div>

      <form action={editBooking} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <input type="hidden" name="id" value={b.id} />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
            <input
              type="date"
              name="preferred_date"
              defaultValue={b.preferred_date}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Hours</span>
            <input
              type="number"
              step="0.5"
              name="hours"
              defaultValue={String(b.hours)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Price (£)</span>
            <input
              type="number"
              step="0.5"
              name="quoted_price"
              defaultValue={String(b.quoted_price)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block sm:col-span-3">
            <span className="mb-1 block text-sm font-medium text-slate-700">Notes</span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={b.notes ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <button className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700">
          Save changes
        </button>
      </form>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium text-slate-800">{v}</dd>
    </div>
  );
}
