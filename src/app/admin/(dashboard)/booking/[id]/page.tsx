import { notFound } from "next/navigation";
import {
  getBooking,
  listAdjustmentsForBooking,
  amountDueFor,
  busyBlocksForDate,
  type AdjustmentRow,
} from "@/lib/supabaseAdmin";
import { assignmentConflict, toMinutes, toHHMM, formatTimeRange } from "@/lib/scheduling";
import {
  editBooking,
  approveAdjustment,
  rejectAdjustment,
  createPaymentLink,
} from "@/app/admin/actions";
import { stripeConfigured, stripeIsTestMode } from "@/lib/stripe";
import { FREQUENCY_LABEL, formatGBP } from "@/lib/pricing";
import { reasonLabel } from "@/lib/adjustments";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const b = await getBooking(id);
  if (!b) notFound();

  // Tolerate the table not existing yet (pre-migration) rather than 500ing.
  const adjustments = await listAdjustmentsForBooking(id).catch(() => [] as AdjustmentRow[]);

  // Does this job collide with something else in the same cleaner's day? The
  // owner is allowed to do that on purpose, so this only ever warns.
  const startMinutes = b.start_time ? toMinutes(b.start_time) : null;
  const clash =
    b.cleaner_id && startMinutes !== null
      ? assignmentConflict({
          cleanerId: b.cleaner_id,
          start: startMinutes,
          end: startMinutes + Math.round(Number(b.hours) * 60),
          busy: await busyBlocksForDate(b.preferred_date, b.id).catch(() => []),
        })
      : null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{b.customer_name}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {b.reference} · status <b>{b.status}</b> · {FREQUENCY_LABEL[b.frequency]}
        {b.frequency !== "one_off" && !b.recurring_active && " (recurring stopped)"}
      </p>

      {/* ---------- payment ---------- */}
      <div className="mb-4 bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-900">Payment</h2>
          {stripeIsTestMode() && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
              Stripe test mode
            </span>
          )}
        </div>

        {b.status === "paid" ? (
          <p className="bg-brand-50 px-3 py-2 text-brand-800 ring-1 ring-brand-200">
            <b>Paid{b.amount_paid != null && ` — ${formatGBP(b.amount_paid)}`}</b>
            {b.paid_at && (
              <span className="text-brand-700">
                {" "}
                on {new Date(b.paid_at).toLocaleDateString("en-GB")}
              </span>
            )}
          </p>
        ) : !stripeConfigured() ? (
          <p className="text-slate-500">
            Stripe isn&apos;t configured on this environment, so payment links can&apos;t be
            raised here.
          </p>
        ) : b.stripe_payment_link_url ? (
          <>
            <p className="mb-2 text-slate-600">
              Send this link to the customer — it stays valid until it&apos;s paid.
            </p>
            <input
              readOnly
              value={b.stripe_payment_link_url}
              className="w-full border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
            />
            <a
              href={b.stripe_payment_link_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-brand-700 underline underline-offset-2"
            >
              Open the payment page
            </a>
          </>
        ) : (
          <form action={createPaymentLink}>
            <input type="hidden" name="id" value={b.id} />
            <p className="mb-3 text-slate-600">
              Raise a payment link for <b>{formatGBP(amountDueFor(b))}</b>
              {b.price_status === "agreed" && b.final_price != null
                ? " (agreed final price)"
                : " (quoted price)"}
              .
            </p>
            <button className="bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
              Create payment link
            </button>
          </form>
        )}
      </div>

      <div className="mb-4 bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
        <Row k="Contact" v={`${b.customer_phone} · ${b.customer_email}`} />
        <Row k="Address" v={`${b.address_line}, ${b.postcode}`} />
        <Row
          k="When"
          v={
            b.start_time
              ? `${b.preferred_date}, ${formatTimeRange(b.start_time, Number(b.hours))}`
              : `${b.preferred_date} — no time set`
          }
        />
        <Row
          k="Rooms"
          v={`${b.bedrooms} bed · ${b.bathrooms} bath · ${b.dining_rooms} dining · ${b.living_rooms} living`}
        />
        <Row k="Products" v={b.customer_provides_products ? "Customer provides" : "We bring ours"} />
        {(b.addons?.length ?? 0) > 0 && (
          <Row k="Extras" v={b.addons.map((a) => `${a.label} (£${a.price})`).join(", ")} />
        )}
        <Row k="Quoted" v={`${formatGBP(Number(b.quoted_price))} · ${b.quoted_hours ?? b.hours}h`} />
        {b.actual_hours != null && (
          <Row
            k="Actually worked"
            v={`${b.actual_hours}h${b.final_price != null ? ` · ${formatGBP(Number(b.final_price))}` : ""}`}
          />
        )}
        <Row k="Booked" v={new Date(b.created_at).toLocaleString("en-GB")} />
      </div>

      {clash && (
        <p className="mb-4 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
          Heads up — this cleaner has another job overlapping{" "}
          {formatTimeRange(toHHMM(clash.start), (clash.end - clash.start) / 60)} on this date.
        </p>
      )}

      <Adjustments rows={adjustments} />

      <form action={editBooking} className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <input type="hidden" name="id" value={b.id} />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
            <input
              type="date"
              name="preferred_date"
              defaultValue={b.preferred_date}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Start time <span className="font-normal text-slate-400">(blank = unscheduled)</span>
            </span>
            <input
              type="time"
              name="start_time"
              step="900"
              defaultValue={startMinutes === null ? "" : toHHMM(startMinutes)}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Hours</span>
            <input
              type="number"
              step="0.5"
              name="hours"
              defaultValue={String(b.hours)}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Price (£)</span>
            <input
              type="number"
              step="0.5"
              name="quoted_price"
              defaultValue={String(b.quoted_price)}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block sm:col-span-3">
            <span className="mb-1 block text-sm font-medium text-slate-700">Notes</span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={b.notes ?? ""}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <button className="mt-4 bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">
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

function Adjustments({ rows }: { rows: AdjustmentRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-4 space-y-3">
      {rows.map((a) => {
        const longer = Number(a.to_hours) > Number(a.from_hours);
        const delta = Math.round((Number(a.to_hours) - Number(a.from_hours)) * 100) / 100;
        const pending = a.status === "pending";
        return (
          <div
            key={a.id}
            className={` p-5 text-sm shadow-sm ring-1 ${
              pending ? "bg-amber-50 ring-amber-300" : "bg-white ring-slate-200"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-slate-900">
                {pending ? "Price change needs your OK" : "Time logged"}
              </span>
              <span className="text-xs uppercase tracking-wide text-slate-500">{a.status}</span>
            </div>

            <p className="mt-1 text-slate-700">
              {a.from_hours}h booked, {a.to_hours}h worked ({longer ? "+" : ""}
              {delta}h) · {reasonLabel(a.reason_code)}
            </p>
            {a.note && <p className="mt-1 italic text-slate-500">&ldquo;{a.note}&rdquo;</p>}

            {a.chargeable ? (
              <p className="mt-2 font-medium text-slate-900">
                {formatGBP(Number(a.from_price))} → {formatGBP(Number(a.to_price))}
              </p>
            ) : (
              <p className="mt-2 text-slate-600">
                Not billable to the customer — price stays at {formatGBP(Number(a.from_price))}.
              </p>
            )}

            {pending && (
              <div className="mt-3 flex gap-2">
                <form action={approveAdjustment}>
                  <input type="hidden" name="adjustment_id" value={a.id} />
                  <button className="bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
                    Approve {formatGBP(Number(a.to_price))}
                  </button>
                </form>
                <form action={rejectAdjustment}>
                  <input type="hidden" name="adjustment_id" value={a.id} />
                  <button className="bg-white px-4 py-2 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                    Keep {formatGBP(Number(a.from_price))}
                  </button>
                </form>
              </div>
            )}
            {pending && (
              <p className="mt-2 text-xs text-slate-500">
                Approving emails the customer the new total and the reason.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
