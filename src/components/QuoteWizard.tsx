"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  pricingConfig,
  recommendedHours,
  quotePrice,
  formatGBP,
  formatDuration,
  normalisePostcode,
  looksLikeUkPostcode,
  inServiceArea,
  clampHours,
  addonsHours,
  FREQUENCY_LABEL,
  type RoomCounts,
  type PricingConfig,
  type Frequency,
  type Addon,
} from "@/lib/pricing";
import { formatTime, formatTimeRange, type Slot } from "@/lib/scheduling";

/** Which field a validation message belongs to, so it can be shown in place. */
type FieldKey = "postcode" | "date" | "time" | "name" | "email" | "phone" | "address";

/**
 * The whole quote on one page, kept as short as it can honestly be.
 *
 * Only what changes the price is asked outright: postcode, bedrooms, bathrooms.
 * Living and dining rooms, extras and notes are folded away because their
 * defaults are right for most homes, and the products question only appears
 * while there is actually a surcharge to choose between. Start times are the one
 * thing that has to appear late — they cannot be known before there is a date
 * and a duration to look them up with.
 */
export default function QuoteWizard({
  cfg = pricingConfig,
  addons = [],
  initialPostcode = "",
  initialRooms,
  initialFrequency,
  initialAddons,
}: {
  cfg?: PricingConfig;
  addons?: Addon[];
  /** Postcode captured on the landing page — checked quietly on mount. */
  initialPostcode?: string;
  /** Rooms captured by the hero search bar. */
  initialRooms?: Partial<RoomCounts>;
  initialFrequency?: Frequency;
  /** Add-on keys already chosen on the landing page builder. */
  initialAddons?: string[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const [postcode, setPostcode] = useState(initialPostcode);
  const [postcodeState, setPostcodeState] = useState<"idle" | "checking" | "ok" | "unknown">("idle");
  const [rooms, setRooms] = useState<RoomCounts>({
    bedrooms: 2,
    bathrooms: 1,
    diningRooms: 0,
    livingRooms: 1,
    ...initialRooms,
  });
  const [hours, setHours] = useState<number | null>(null); // null = follow the recommendation
  const [customerProvidesProducts, setCustomerProvidesProducts] = useState(true);
  const [selectedAddons, setSelectedAddons] = useState<string[]>(initialAddons ?? []);
  const [frequency, setFrequency] = useState<Frequency>(initialFrequency ?? "one_off");
  const [preferredDate, setPreferredDate] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState<string | null>(null);

  // Availability is keyed by day+length: change either and the old answer — and
  // any time picked from it — stop applying, with nothing to reset by hand.
  const [loadedSlots, setLoadedSlots] = useState<{
    key: string;
    slots: Slot[];
    closed: string | null;
  } | null>(null);
  const [pickedSlot, setPickedSlot] = useState<{ key: string; time: string } | null>(null);

  const recommended = useMemo(() => recommendedHours(rooms, cfg), [rooms, cfg]);
  const chosenHours = hours ?? recommended;
  const chosenAddons = useMemo(
    () => addons.filter((a) => selectedAddons.includes(a.key)),
    [addons, selectedAddons]
  );
  const addonsTotal = useMemo(() => chosenAddons.reduce((s, a) => s + a.price, 0), [chosenAddons]);
  // Extras add time to the visit, and that time is what gets billed.
  const extrasHours = useMemo(() => addonsHours(chosenAddons), [chosenAddons]);
  const totalHours = chosenHours + extrasHours;
  const price = useMemo(
    () => quotePrice(totalHours, customerProvidesProducts, cfg, frequency, addonsTotal),
    [totalHours, customerProvidesProducts, cfg, frequency, addonsTotal]
  );

  /* ---------- postcode ---------- */

  /** Quiet check — never blocks typing, and a dead API is not the customer's problem. */
  async function checkPostcode(raw: string) {
    const norm = normalisePostcode(raw);
    if (!looksLikeUkPostcode(norm) || !inServiceArea(norm, cfg)) {
      setPostcodeState("idle");
      return;
    }
    setPostcodeState("checking");
    try {
      // postcodes.io is free + keyless; the regex check already passed either way.
      const res = await fetch(`https://api.postcodes.io/postcodes/${norm}/validate`);
      const data = res.ok ? ((await res.json()) as { result: boolean }) : { result: true };
      setPostcodeState(data.result ? "ok" : "unknown");
    } catch {
      setPostcodeState("ok"); // offline: trust the regex rather than nag
    }
  }

  // The landing page already took a postcode — check it quietly so the field
  // shows a tick rather than making them prove it again.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoChecked.current || !initialPostcode) return;
    autoChecked.current = true;
    void checkPostcode(initialPostcode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- availability ---------- */

  const slotKey = `${preferredDate}|${totalHours}`;
  const slotRequest = useRef(0);
  useEffect(() => {
    if (!preferredDate) return;
    const ticket = ++slotRequest.current;

    fetch(`/api/availability?date=${preferredDate}&hours=${totalHours}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; slots?: Slot[]; closed?: string | null }) => {
        // A slower earlier request must never overwrite a newer answer.
        if (ticket !== slotRequest.current) return;
        setLoadedSlots({
          key: slotKey,
          slots: data.ok && Array.isArray(data.slots) ? data.slots : [],
          closed: data.closed ?? null,
        });
      })
      .catch(() => {
        // Offline or the endpoint fell over: let them book the day anyway.
        if (ticket !== slotRequest.current) return;
        setLoadedSlots({ key: slotKey, slots: [], closed: null });
      });
  }, [preferredDate, totalHours, slotKey]);

  // Anything loaded under a different key is stale by definition.
  const fresh = loadedSlots?.key === slotKey ? loadedSlots : null;
  const slots = fresh?.slots ?? null;
  const closedReason = fresh?.closed ?? null;
  const slotsBusy = Boolean(preferredDate) && fresh === null;
  const startTime = pickedSlot?.key === slotKey ? pickedSlot.time : null;
  const anySlotFree = (slots ?? []).some((s) => s.available);

  const today = new Date().toISOString().slice(0, 10);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + cfg.scheduling.maxDaysAhead);
    return d.toISOString().slice(0, 10);
  }, [cfg.scheduling.maxDaysAhead]);

  /* ---------- submit ---------- */

  const formRef = useRef<HTMLFormElement>(null);

  /** Every problem at once — a single form should not reveal them one at a time. */
  function validate(): Partial<Record<FieldKey, string>> {
    const found: Partial<Record<FieldKey, string>> = {};
    const norm = normalisePostcode(postcode);

    if (!looksLikeUkPostcode(norm)) found.postcode = "That doesn't look like a UK postcode.";
    else if (!inServiceArea(norm, cfg))
      found.postcode = "We don't cover that area yet — give us a call.";

    if (!preferredDate) found.date = "Pick a date.";
    else if (closedReason) found.time = closedReason;
    else if (anySlotFree && !startTime) found.time = "Pick a start time.";

    if (name.trim().length < 2) found.name = "Please tell us your name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) found.email = "Please enter a valid email.";
    if (phone.replace(/\D/g, "").length < 10) found.phone = "Please enter a valid phone number.";
    if (addressLine.trim().length < 3) found.address = "Please enter your address.";

    return found;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Take them to the first thing that needs fixing rather than leaving them
      // to hunt for the red text.
      const first = formRef.current?.querySelector<HTMLElement>("[data-invalid='true']");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.focus({ preventScroll: true });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postcode,
          rooms,
          hours: chosenHours,
          customerProvidesProducts,
          addons: selectedAddons,
          frequency,
          name,
          email,
          phone,
          addressLine,
          preferredDate,
          startTime,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFormError(data.error ?? "Something went wrong — please try again or call us");
        // A 409 means the slot went while they were filling this in; drop the
        // cached times so they choose from what is actually free now.
        if (res.status === 409) setLoadedSlots(null);
        return;
      }
      setReference(data.reference);
    } catch {
      setFormError("Network problem — please try again or call us");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- done ---------- */

  if (reference) {
    return (
      <div className="mx-auto max-w-lg bg-white p-8 text-center shadow-lg ring-1 ring-slate-200">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-3xl">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Request received!</h2>
        <p className="mt-2 text-slate-600">
          Your reference is <span className="font-semibold text-slate-900">{reference}</span>.
          We&apos;ll call you shortly to confirm your{" "}
          <span className="font-semibold">{totalHours}-hour clean</span> on{" "}
          <span className="font-semibold">{preferredDate}</span>
          {startTime ? (
            <>
              , <span className="font-semibold">{formatTimeRange(startTime, totalHours)}</span>.
            </>
          ) : (
            <>, and agree a time with you.</>
          )}
        </p>
        <p className="mt-4 text-lg font-semibold text-brand-700">
          Estimated price: {formatGBP(price)}
        </p>
      </div>
    );
  }

  /* ---------- form ---------- */

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_19rem] lg:items-start lg:gap-8">
      {/* Price sits above the form on mobile so it is seen before scrolling,
          and rides alongside it on desktop. */}
      <aside className="order-first lg:order-last lg:sticky lg:top-6">
        <PricePanel
          price={price}
          frequency={frequency}
          cfg={cfg}
          totalHours={totalHours}
          chosenHours={chosenHours}
          extrasHours={extrasHours}
          addonsTotal={addonsTotal}
          customerProvidesProducts={customerProvidesProducts}
          preferredDate={preferredDate}
          startTime={startTime}
        />
      </aside>

      <form ref={formRef} onSubmit={submit} noValidate className="space-y-5">
        {/* ---------- home + length ---------- */}
        <Section title="Your home" sub="Kitchen, hallways and landings are always included.">
          <Field label="Postcode" error={errors.postcode}>
            <div className="relative">
              <input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                onBlur={(e) => void checkPostcode(e.target.value)}
                placeholder="e.g. IG1 1BA"
                autoComplete="postal-code"
                data-invalid={errors.postcode ? "true" : undefined}
                className={`w-full border px-3 py-2 pr-24 uppercase tracking-wide outline-none placeholder:normal-case placeholder:tracking-normal focus:ring-2 focus:ring-brand-200 ${
                  errors.postcode ? "border-red-400" : "border-slate-300 focus:border-brand-500"
                }`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium">
                {postcodeState === "checking" && (
                  <span className="text-slate-400">checking&hellip;</span>
                )}
                {postcodeState === "ok" && <span className="text-brand-600">✓ covered</span>}
                {postcodeState === "unknown" && <span className="text-amber-600">not found</span>}
              </span>
            </div>
          </Field>

          {/* The two rooms that decide most of the price. */}
          <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Counter
              label="Bedrooms"
              value={rooms.bedrooms}
              max={10}
              onChange={(v) => setRooms({ ...rooms, bedrooms: v })}
            />
            <Counter
              label="Bathrooms"
              value={rooms.bathrooms}
              max={6}
              onChange={(v) => setRooms({ ...rooms, bathrooms: v })}
            />
          </div>

          {/* Almost every home is 1 living / 0 dining, so these are folded away
              rather than made compulsory. They still price when opened. */}
          <Disclosure
            summary={`Living and dining rooms (${rooms.livingRooms} + ${rooms.diningRooms})`}
          >
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Counter
                label="Living rooms"
                value={rooms.livingRooms}
                max={4}
                onChange={(v) => setRooms({ ...rooms, livingRooms: v })}
              />
              <Counter
                label="Dining rooms"
                value={rooms.diningRooms}
                max={4}
                onChange={(v) => setRooms({ ...rooms, diningRooms: v })}
              />
            </div>
          </Disclosure>

          {/* Hours follow the rooms — a nudge, not a question. */}
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-700">How long we&apos;ll stay</p>
              <p className="text-xs text-slate-500">
                {chosenHours === recommended ? (
                  "Recommended for a home this size"
                ) : (
                  <button
                    type="button"
                    onClick={() => setHours(null)}
                    className="underline underline-offset-2 hover:text-brand-600"
                  >
                    reset to {recommended}h
                  </button>
                )}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-3">
              <RoundBtn
                small
                label="Fewer hours"
                onClick={() => setHours(clampHours(chosenHours - 0.5, cfg))}
                disabled={chosenHours <= cfg.minHours}
              >
                −
              </RoundBtn>
              <span className="tnum w-12 text-center text-xl font-bold text-slate-900">
                {chosenHours}h
              </span>
              <RoundBtn
                small
                label="More hours"
                onClick={() => setHours(clampHours(chosenHours + 0.5, cfg))}
                disabled={chosenHours >= cfg.maxHours}
              >
                +
              </RoundBtn>
            </span>
          </div>

          {/* Only worth asking while it changes the price. At a £0 surcharge it
              was a question that did nothing. */}
          {cfg.productSurcharge > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                active={customerProvidesProducts}
                title="I'll provide products"
                subtitle="Use what's already at home"
                onClick={() => setCustomerProvidesProducts(true)}
              />
              <ChoiceCard
                active={!customerProvidesProducts}
                title="Bring your products"
                subtitle={`Fully stocked (+${formatGBP(cfg.productSurcharge)})`}
                onClick={() => setCustomerProvidesProducts(false)}
              />
            </div>
          )}

          {addons.length > 0 && (
            <Disclosure
              summary={
                chosenAddons.length > 0
                  ? `Extras — ${chosenAddons.map((a) => a.label).join(", ")}`
                  : `Add extras (${addons.length} available)`
              }
              open={chosenAddons.length > 0}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {addons.map((a) => {
                  const on = selectedAddons.includes(a.key);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setSelectedAddons(
                          on
                            ? selectedAddons.filter((k) => k !== a.key)
                            : [...selectedAddons, a.key]
                        )
                      }
                      className={`flex items-center justify-between border-2 px-3 py-2 text-left text-sm transition ${
                        on
                          ? "border-brand-500 bg-brand-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-medium text-slate-800">{a.label}</span>
                      <span className={on ? "font-semibold text-brand-700" : "text-slate-500"}>
                        {a.price > 0 ? `+${formatGBP(a.price)}` : `+${formatDuration(a.hours)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Disclosure>
          )}
        </Section>

        {/* ---------- when ---------- */}
        <Section title="When?" sub="How often, then the day and time.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => {
              const pct = cfg.discounts[f] ?? 0;
              const perClean = quotePrice(totalHours, customerProvidesProducts, cfg, f, addonsTotal);
              const on = frequency === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFrequency(f)}
                  className={`border-2 px-2 py-2 text-center transition ${
                    on ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${
                      on ? "text-brand-800" : "text-slate-800"
                    }`}
                  >
                    {FREQUENCY_LABEL[f]}
                  </span>
                  <span className="tnum block text-xs text-slate-500">
                    {formatGBP(perClean)}
                    {pct > 0 && <span className="text-brand-600"> −{pct}%</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Field
              label={frequency === "one_off" ? "Preferred date" : "Date of the first clean"}
              error={errors.date}
            >
              <input
                type="date"
                value={preferredDate}
                min={today}
                max={maxDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                data-invalid={errors.date ? "true" : undefined}
                className={`w-full border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200 ${
                  errors.date ? "border-red-400" : "border-slate-300 focus:border-brand-500"
                }`}
              />
            </Field>
          </div>

          {preferredDate && (
            <div className="mt-4" data-invalid={errors.time ? "true" : undefined} tabIndex={-1}>
              {slotsBusy && (
                <p className="text-sm text-slate-500">Checking what&apos;s free&hellip;</p>
              )}

              {!slotsBusy && closedReason && (
                <p className="bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {closedReason} Try another day.
                </p>
              )}

              {!slotsBusy && !closedReason && slots?.length === 0 && (
                <p className="bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  We couldn&apos;t load times just now — carry on, and we&apos;ll agree a time when
                  we call to confirm.
                </p>
              )}

              {!slotsBusy && !closedReason && !!slots?.length && (
                <>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slots.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!s.available}
                        aria-pressed={startTime === s.time}
                        onClick={() => setPickedSlot({ key: slotKey, time: s.time })}
                        className={`px-1 py-2 text-sm font-semibold transition ${
                          startTime === s.time
                            ? "bg-brand-600 text-white"
                            : s.available
                              ? "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-800"
                              : "cursor-not-allowed bg-slate-50 text-slate-300 line-through"
                        }`}
                      >
                        {formatTime(s.time)}
                      </button>
                    ))}
                  </div>
                  {startTime && (
                    <p className="mt-3 text-sm text-slate-600">
                      We&apos;d be with you{" "}
                      <span className="font-semibold text-slate-900">
                        {formatTimeRange(startTime, totalHours)}
                      </span>
                      .
                    </p>
                  )}
                  {!anySlotFree && (
                    <p className="mt-3 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      We&apos;re fully booked that day. Please pick another.
                    </p>
                  )}
                </>
              )}
              {errors.time && <p className="mt-2 text-sm text-red-600">{errors.time}</p>}
            </div>
          )}
        </Section>

        {/* ---------- details ---------- */}
        <Section title="Your details" sub="So we can confirm your clean by phone.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errors.name}>
              <Input value={name} onChange={setName} autoComplete="name" invalid={!!errors.name} />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input
                value={phone}
                onChange={setPhone}
                type="tel"
                autoComplete="tel"
                invalid={!!errors.phone}
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                invalid={!!errors.email}
              />
            </Field>
            <Field label="First line of address" error={errors.address}>
              <Input
                value={addressLine}
                onChange={setAddressLine}
                autoComplete="address-line1"
                invalid={!!errors.address}
              />
            </Field>
          </div>

          <Disclosure summary="Add a note (parking, pets, access)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </Disclosure>
        </Section>

        {formError && (
          <p className="bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{formError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 px-6 py-3.5 text-base font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? "Sending…" : `Request booking · ${formatGBP(price)}`}
        </button>
        <p className="text-center text-xs text-slate-400">
          No payment now — we&apos;ll call to confirm before anything is charged.
        </p>
      </form>
    </div>
  );
}

/* ---------- price panel ---------- */

function PricePanel({
  price,
  frequency,
  cfg,
  totalHours,
  chosenHours,
  extrasHours,
  addonsTotal,
  customerProvidesProducts,
  preferredDate,
  startTime,
}: {
  price: number;
  frequency: Frequency;
  cfg: PricingConfig;
  totalHours: number;
  chosenHours: number;
  extrasHours: number;
  addonsTotal: number;
  customerProvidesProducts: boolean;
  preferredDate: string;
  startTime: string | null;
}) {
  const discount = cfg.discounts[frequency] ?? 0;
  return (
    <div className="bg-brand-50 p-5 ring-1 ring-brand-100">
      <div className="text-sm font-medium text-brand-800">
        {frequency === "one_off" ? "Your price" : "Your price per clean"}
      </div>
      <div className="tnum text-4xl font-bold text-brand-700">{formatGBP(price)}</div>

      <dl className="mt-4 space-y-1.5 border-t border-brand-100 pt-3 text-sm">
        <PanelRow k="Rate" v={`${formatGBP(cfg.hourlyRate)}/h`} />
        <PanelRow
          k="Duration"
          v={
            extrasHours > 0
              ? `${totalHours}h (${chosenHours}h + ${formatDuration(extrasHours)})`
              : `${totalHours}h`
          }
        />
        {addonsTotal > 0 && <PanelRow k="Extras" v={`+${formatGBP(addonsTotal)}`} />}
        {!customerProvidesProducts && cfg.productSurcharge > 0 && (
          <PanelRow k="Products" v={`+${formatGBP(cfg.productSurcharge)}`} />
        )}
        {discount > 0 && <PanelRow k={FREQUENCY_LABEL[frequency]} v={`−${discount}%`} highlight />}
        <PanelRow
          k="When"
          v={
            preferredDate
              ? startTime
                ? `${preferredDate}, ${formatTime(startTime)}`
                : preferredDate
              : "not chosen yet"
          }
        />
      </dl>
    </div>
  );
}

function PanelRow({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-brand-800/60">{k}</dt>
      <dd className={`text-right font-medium ${highlight ? "text-brand-700" : "text-brand-900"}`}>
        {v}
      </dd>
    </div>
  );
}

/* ---------- building blocks ---------- */

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {sub && <p className="mb-4 mt-0.5 text-sm text-slate-500">{sub}</p>}
      {children}
    </section>
  );
}

/**
 * Native <details>, so the folded-away parts of the form cost no JavaScript and
 * are still reachable by keyboard and by search-in-page.
 */
function Disclosure({
  summary,
  open,
  children,
}: {
  summary: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group mt-3 border-t border-slate-100 pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-700">
        <span className="text-xs transition group-open:rotate-90">▶</span>
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {hint && <span className="font-normal text-slate-400">({hint})</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  autoComplete,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  invalid?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      data-invalid={invalid ? "true" : undefined}
      className={`w-full border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-200 ${
        invalid ? "border-red-400" : "border-slate-300 focus:border-brand-500"
      }`}
    />
  );
}

function Counter({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="flex items-center gap-3">
        <RoundBtn
          small
          label={`Fewer ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
        >
          −
        </RoundBtn>
        <span className="tnum w-5 text-center font-bold text-slate-900">{value}</span>
        <RoundBtn
          small
          label={`More ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          +
        </RoundBtn>
      </span>
    </div>
  );
}

function RoundBtn({
  children,
  onClick,
  disabled,
  small,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600 transition hover:bg-brand-100 hover:text-brand-700 active:scale-90 disabled:opacity-35 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 ${
        small ? "h-8 w-8 text-base" : "h-11 w-11 text-xl"
      }`}
    >
      {children}
    </button>
  );
}

function ChoiceCard({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`border-2 px-4 py-3 text-left transition ${
        active ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className={`font-semibold ${active ? "text-brand-800" : "text-slate-800"}`}>{title}</div>
      <div className="text-sm text-slate-500">{subtitle}</div>
    </button>
  );
}
