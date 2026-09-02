import { notFound } from "next/navigation";
import {
  getBooking,
  listAdjustmentsForBooking,
  listIssuesForBooking,
  listPhotosForBooking,
  amountDueFor,
  isPaidInFull,
  paidSoFar,
  busyBlocksForDate,
  getCustomer,
  type AdjustmentRow,
} from "@/lib/supabaseAdmin";
import { assignmentConflict, toMinutes, toHHMM, formatTimeRange } from "@/lib/scheduling";
import {
  editBooking,
  approveAdjustment,
  rejectAdjustment,
  createPaymentLink,
  emailPaymentLink,
  setBookingStatus,
  sendCardSetupLink,
  chargeCardNow,
  refundBooking,
} from "@/app/admin/actions";
import { stripeConfigured, stripeIsTestMode } from "@/lib/stripe";
import { FREQUENCY_LABEL, formatGBP } from "@/lib/pricing";
import { reasonLabel } from "@/lib/adjustments";
import { outcomeLabel, chargeableJourney } from "@/lib/outcomes";
import { ISSUE_LABEL } from "@/lib/statusLabels";
import { signedPhotoUrl } from "@/lib/storage";
import { DEEP_REASON_LABEL } from "@/lib/deepClean";
import { describeCard } from "@/lib/cardOnFile";
import { STATUS_LABEL } from "@/lib/statusLabels";

export const dynamic = "force-dynamic";

/** Walkthrough files are videos or photos; the extension is server-chosen at upload. */
function isVideoPath(p: string): boolean {
  return /\.(mp4|mov|webm|3gp)$/i.test(p);
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sent?: string;
    why?: string;
    card?: string;
    url?: string;
    saved?: string;
    refund?: string;
  }>;
}) {
  const [{ id }, sendResult] = await Promise.all([params, searchParams]);
  const cardResult = sendResult;
  const b = await getBooking(id);
  if (!b) notFound();

  // Tolerate the table not existing yet (pre-migration) rather than 500ing.
  const adjustments = await listAdjustmentsForBooking(id).catch(() => [] as AdjustmentRow[]);
  // Pre-migration tolerance, same as adjustments.
  const issues = await listIssuesForBooking(id).catch(() => []);
  const photos = await listPhotosForBooking(id).catch(() => []);
  const photoUrls = (
    await Promise.all(
      photos.map(async (ph) => ({ ...ph, url: await signedPhotoUrl(ph.path).catch(() => null) }))
    )
  ).filter((ph) => ph.url);
  const proofUrls = photoUrls.filter((ph) => ph.phase === "proof");
  const jobPhotoUrls = photoUrls.filter((ph) => ph.phase !== "proof");

  // Tolerate the card columns not existing yet (pre-migration).
  const customer = b.customer_id ? await getCustomer(b.customer_id).catch(() => null) : null;
  const card = describeCard(customer);

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
        {b.reference} · status <b>{STATUS_LABEL[b.status]}</b> · {FREQUENCY_LABEL[b.frequency]}
        {b.frequency !== "one_off" && !b.recurring_active && " (recurring stopped)"}
        {b.status !== "paid" && isPaidInFull(b) && (
          <span className="ml-2 bg-brand-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-800">
            paid up front
          </span>
        )}
        {b.refunded_at && (
          <span className="ml-2 bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
            refunded
          </span>
        )}
      </p>

      {sendResult.refund === "needed" && (
        <div className="mb-4 bg-amber-50 p-4 text-sm ring-1 ring-amber-300">
          <p className="font-semibold text-amber-900">
            This booking is paid — cancelling it means giving the money back.
          </p>
          <p className="mt-1 text-amber-800">
            Use the refund button in the payment section below: it refunds{" "}
            {formatGBP(paidSoFar(b))} to their card, cancels the visit, and tells the customer
            what happened, in one go.
          </p>
        </div>
      )}
      {sendResult.refund === "done" && (
        <div className="mb-4 bg-brand-50 p-4 text-sm font-medium text-brand-800 ring-1 ring-brand-200">
          Refund issued — the money is on its way back to their card.
        </div>
      )}
      {sendResult.refund === "fail" && (
        <div className="mb-4 bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
          Refund didn&apos;t go through — {sendResult.why || "unknown problem"}.
        </div>
      )}

      {b.status === "no_access" && b.outcome_reason && (
        <div className="mb-4 bg-rose-50 p-5 text-sm ring-1 ring-rose-200">
          <h2 className="font-semibold text-rose-900">
            This visit didn&apos;t happen — {outcomeLabel(b.outcome_reason).toLowerCase()}
          </h2>
          {b.outcome_note && (
            <p className="mt-1 text-rose-800">&ldquo;{b.outcome_note}&rdquo;</p>
          )}
          <p className="mt-2 text-rose-800">
            Nothing has been charged.{" "}
            {chargeableJourney(b.outcome_reason)
              ? "This one is arguably the customer's to pay for."
              : "This one isn't the customer's fault."}{" "}
            Your call:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={setBookingStatus}>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="from" value={b.status} />
              <input type="hidden" name="to" value="cancelled" />
              <button className="border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100">
                Write it off
              </button>
            </form>
            <form action={setBookingStatus}>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="from" value={b.status} />
              <input type="hidden" name="to" value="completed" />
              <button className="bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800">
                Charge for the journey
              </button>
            </form>
            <form action={setBookingStatus}>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="from" value={b.status} />
              <input type="hidden" name="to" value="confirmed" />
              <button className="border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Put it back on
              </button>
            </form>
          </div>
          <p className="mt-2 text-xs text-rose-700">
            Charging keeps the quoted price — edit it below first if it should be less.
          </p>
        </div>
      )}

      {/* ---------- pending adjustment + schedule clash: urgent, so it comes
          before the money panels and the read-only facts below ---------- */}
      {clash && (
        <p className="mb-4 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
          Heads up — this cleaner has another job overlapping{" "}
          {formatTimeRange(toHHMM(clash.start), (clash.end - clash.start) / 60)} on this date.
        </p>
      )}

      <Adjustments rows={adjustments} />

      {/* ---------- booking facts ---------- */}
      <div className="mb-4 bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
        <Row k="Contact" v={`${b.customer_phone} · ${b.customer_email}`} />
        {(b.started_lat != null || b.finished_lat != null) && (
          <Row
            k="Location stamps"
            v={
              <>
                {b.started_lat != null && (
                  <a
                    className="text-brand-700 hover:underline"
                    href={`https://www.google.com/maps?q=${b.started_lat},${b.started_lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    start ↗
                  </a>
                )}
                {b.started_lat != null && b.finished_lat != null && " · "}
                {b.finished_lat != null && (
                  <a
                    className="text-brand-700 hover:underline"
                    href={`https://www.google.com/maps?q=${b.finished_lat},${b.finished_lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    finish ↗
                  </a>
                )}
              </>
            }
          />
        )}
        {b.service_type === "deep" && (
          <Row
            k="Service"
            v={`Deep clean — ${b.cleaners_needed ?? 2} cleaners, priced per room`}
          />
        )}
        {b.deep_reason && (
          <Row k="Their reason" v={DEEP_REASON_LABEL[b.deep_reason] ?? b.deep_reason} />
        )}
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
        {b.status === "confirmed" && b.cleaner_id && (
          <Row
            k="Cleaner seen it"
            v={
              b.acknowledged_at
                ? `Yes — ${new Date(b.acknowledged_at).toLocaleString("en-GB")}`
                : "Not yet — no proof they know about this job"
            }
          />
        )}
        <Row k="Booked" v={new Date(b.created_at).toLocaleString("en-GB")} />
      </div>

      {issues.length > 0 && (
        <div className="mb-4 bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 font-semibold text-slate-900">Reported from the job</h2>
          <ul className="space-y-2">
            {issues.map((i) => (
              <li key={i.id} className="border-l-2 border-amber-300 pl-3">
                <p className="font-medium text-slate-800">{ISSUE_LABEL[i.category] ?? i.category}</p>
                {i.note && <p className="text-slate-600">&ldquo;{i.note}&rdquo;</p>}
                <p className="text-xs text-slate-400">
                  {new Date(i.created_at).toLocaleString("en-GB")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Customer's deep-clean walkthrough first — it's what gets vetted
          BEFORE confirming; the cleaners' before/after shots come after the
          job. Videos get a player, images a thumbnail. */}
      {proofUrls.length > 0 && (
        <div className="mb-4 bg-white p-5 text-sm shadow-sm ring-1 ring-amber-200">
          <h2 className="mb-1 font-semibold text-slate-900">Walkthrough from the customer</h2>
          <p className="mb-3 text-xs text-amber-700">
            Check this against the rooms they booked before confirming — refuse and refund if
            it&apos;s not a job to send a cleaner into.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {proofUrls.map((ph) =>
              isVideoPath(ph.path) ? (
                <video
                  key={ph.id}
                  src={ph.url!}
                  controls
                  preload="metadata"
                  className="h-40 w-full bg-slate-900 object-contain ring-1 ring-slate-200"
                />
              ) : (
                <a key={ph.id} href={ph.url!} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ph.url!}
                    alt="walkthrough photo"
                    className="h-40 w-full object-cover ring-1 ring-slate-200"
                  />
                </a>
              )
            )}
          </div>
        </div>
      )}

      {jobPhotoUrls.length > 0 && (
        <div className="mb-4 bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 font-semibold text-slate-900">Job photos</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {jobPhotoUrls.map((ph) => (
              <a key={ph.id} href={ph.url!} target="_blank" rel="noreferrer" className="block">
                {/* Signed, short-lived URLs into a private bucket — next/image
                    can't optimise a URL that expires hourly. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ph.url!}
                  alt={`${ph.phase} photo`}
                  className="h-24 w-full object-cover ring-1 ring-slate-200"
                />
                <span className="block text-center text-[10px] uppercase tracking-wide text-slate-400">
                  {ph.phase}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

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

        {b.status === "paid" || isPaidInFull(b) ? (
          <>
            <p className="bg-brand-50 px-3 py-2 text-brand-800 ring-1 ring-brand-200">
              <b>Paid{b.amount_paid != null && ` — ${formatGBP(b.amount_paid)}`}</b>
              {b.paid_at && (
                <span className="text-brand-700">
                  {" "}
                  on {new Date(b.paid_at).toLocaleDateString("en-GB")}
                </span>
              )}
              {b.status !== "paid" && (
                <span className="text-brand-700"> — before the clean; the visit still runs.</span>
              )}
            </p>
            {b.refunded_at ? (
              <p className="mt-2 text-xs text-slate-500">
                Refunded{b.refund_amount != null && ` ${formatGBP(b.refund_amount)}`} on{" "}
                {new Date(b.refunded_at).toLocaleDateString("en-GB")}.
              </p>
            ) : (
              b.stripe_payment_intent &&
              stripeConfigured() && (
                <form action={refundBooking} className="mt-3">
                  <input type="hidden" name="id" value={b.id} />
                  <button className="border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50">
                    Refund {formatGBP(paidSoFar(b))}
                    {["requested", "confirmed", "no_access"].includes(b.status)
                      ? " and cancel the visit"
                      : ""}
                  </button>
                </form>
              )
            )}
          </>
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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <form action={emailPaymentLink}>
                <input type="hidden" name="id" value={b.id} />
                <button className="bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700">
                  {b.payment_link_sent_at ? "Send it again" : "Email it to the customer"}
                </button>
              </form>
              <a
                href={b.stripe_payment_link_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-brand-700 underline underline-offset-2"
              >
                Open the payment page
              </a>
            </div>

            {b.payment_link_sent_at && (
              <p className="mt-2 text-xs text-slate-500">
                Emailed to {b.customer_email} on{" "}
                {new Date(b.payment_link_sent_at).toLocaleString("en-GB")}.
              </p>
            )}

            {sendResult.sent === "ok" && (
              <p className="mt-2 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800 ring-1 ring-brand-200">
                Sent.
              </p>
            )}
            {sendResult.sent === "fail" && (
              <p className="mt-2 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                Couldn&apos;t send it — {sendResult.why || "unknown problem"}. The link above still
                works, so you can copy it across by hand.
              </p>
            )}
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

      {/* ---------- card on file ---------- */}
      {b.status !== "paid" && stripeConfigured() && (
        <div className="mb-4 bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Card on file</h2>
            {card && <span className="text-xs font-medium text-brand-700">{card}</span>}
          </div>

          {card ? (
            <>
              <p className="text-slate-600">
                Finished cleans settle themselves against this card, for whatever the visit
                actually came to. Nothing is taken while a price is still pending.
              </p>
              <form action={chargeCardNow} className="mt-3">
                <input type="hidden" name="id" value={b.id} />
                <button className="bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700">
                  Charge {formatGBP(amountDueFor(b))} now
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-slate-600">
                No card saved. Sending one takes the chasing out of every future clean — they
                save it once on Stripe&apos;s own page and we never see the details.
              </p>
              <form action={sendCardSetupLink} className="mt-3">
                <input type="hidden" name="id" value={b.id} />
                <button className="border border-brand-600 px-4 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-50">
                  Email a card-saving link
                </button>
              </form>
            </>
          )}

          {b.charge_error && (
            <p className="mt-3 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Last automatic charge didn&apos;t go through — {b.charge_error}. The payment link
              below still works.
            </p>
          )}

          {cardResult.card === "sent" && (
            <p className="mt-3 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
              Sent — they&apos;ve got 24 hours to use it before it expires.
            </p>
          )}
          {cardResult.card === "charged" && (
            <p className="mt-3 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
              Charged.
            </p>
          )}
          {(cardResult.card === "declined" || cardResult.card === "fail") && (
            <p className="mt-3 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {cardResult.why || "That didn't work"}. Send a payment link instead.
            </p>
          )}
          {cardResult.card === "link" && cardResult.url && (
            <div className="mt-3 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Couldn&apos;t email it — {cardResult.why || "no usable address"}. Send this by hand:
              <input
                readOnly
                value={cardResult.url}
                className="mt-1 w-full border border-amber-300 bg-white px-2 py-1 font-mono text-[11px]"
              />
            </div>
          )}
        </div>
      )}

      <form action={editBooking} className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <input type="hidden" name="id" value={b.id} />
        {sendResult.saved === "1" && (
          <p className="mb-4 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
            Saved. If you changed the hours and left the price alone, the price
            was recalculated to match.
          </p>
        )}

        {/* Contact details — edits this booking's record. The customer list is
            matched by email at insert time and is left alone here. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Customer name</span>
            <input
              name="customer_name"
              defaultValue={b.customer_name}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Phone</span>
            <input
              name="customer_phone"
              type="tel"
              defaultValue={b.customer_phone}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input
              name="customer_email"
              type="email"
              defaultValue={b.customer_email}
              className="w-full border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Address</span>
              <input
                name="address_line"
                defaultValue={b.address_line ?? ""}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Postcode</span>
              <input
                name="postcode"
                defaultValue={b.postcode ?? ""}
                className="w-full border border-slate-300 px-3 py-2 uppercase"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
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

function Row({ k, v }: { k: string; v: React.ReactNode }) {
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
    <div id="adjustment" className="mb-4 space-y-3">
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
