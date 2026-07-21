"use client";

import { useMemo, useState } from "react";
import {
  pricingConfig,
  recommendedHours,
  quotePrice,
  formatGBP,
  normalisePostcode,
  looksLikeUkPostcode,
  inServiceArea,
  clampHours,
  type RoomCounts,
  type PricingConfig,
} from "@/lib/pricing";

const STEPS = ["Postcode", "Rooms", "Hours", "Products", "Details", "Quote"] as const;

type RoomKey = keyof RoomCounts;

const ROOM_TABS: { key: RoomKey; label: string }[] = [
  { key: "bedrooms", label: "Bedrooms" },
  { key: "diningRooms", label: "Dining rooms" },
  { key: "livingRooms", label: "Living rooms" },
];

export default function QuoteWizard({ cfg = pricingConfig }: { cfg?: PricingConfig }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form state
  const [postcode, setPostcode] = useState("");
  const [rooms, setRooms] = useState<RoomCounts>({
    bedrooms: 2,
    bathrooms: 1,
    diningRooms: 0,
    livingRooms: 1,
  });
  const [roomTab, setRoomTab] = useState<RoomKey>("bedrooms");
  const [hours, setHours] = useState<number | null>(null); // null = follow recommendation
  const [customerProvidesProducts, setCustomerProvidesProducts] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState<string | null>(null);

  const recommended = useMemo(() => recommendedHours(rooms, cfg), [rooms, cfg]);
  const chosenHours = hours ?? recommended;
  const price = useMemo(
    () => quotePrice(chosenHours, customerProvidesProducts, cfg),
    [chosenHours, customerProvidesProducts, cfg]
  );

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function validatePostcode() {
    const norm = normalisePostcode(postcode);
    if (!looksLikeUkPostcode(norm)) {
      setError("That doesn't look like a UK postcode — try e.g. IG1 1AA");
      return;
    }
    if (!inServiceArea(norm, cfg)) {
      setError("Sorry — we don't cover that area yet. Call us to check!");
      return;
    }
    setBusy(true);
    try {
      // postcodes.io is free + keyless; fall back to the regex check if it's unreachable
      const res = await fetch(`https://api.postcodes.io/postcodes/${norm}/validate`);
      if (res.ok) {
        const data = (await res.json()) as { result: boolean };
        if (!data.result) {
          setError("We couldn't find that postcode — double-check it?");
          return;
        }
      }
      next();
    } catch {
      next(); // offline — regex check already passed
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postcode,
          rooms,
          hours: chosenHours,
          customerProvidesProducts,
          name,
          email,
          phone,
          addressLine,
          preferredDate,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong — please try again or call us");
        return;
      }
      setReference(data.reference);
    } catch {
      setError("Network problem — please try again or call us");
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Request received!</h2>
        <p className="mt-2 text-slate-600">
          Your reference is <span className="font-semibold text-slate-900">{reference}</span>.
          We&apos;ll call you shortly to confirm your{" "}
          <span className="font-semibold">{chosenHours}-hour clean</span> on{" "}
          <span className="font-semibold">{preferredDate}</span>.
        </p>
        <p className="mt-4 text-lg font-semibold text-emerald-700">
          Estimated price: {formatGBP(price)}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* progress */}
      <ol className="mb-6 flex items-center gap-1">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${i <= step ? "bg-emerald-500" : "bg-slate-200"}`}
            />
            <span
              className={`mt-1 hidden text-[10px] font-medium sm:block ${
                i <= step ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200 sm:p-8">
        {step === 0 && (
          <StepShell title="Where's the clean?" subtitle="We'll check we cover your area.">
            <input
              autoFocus
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && validatePostcode()}
              placeholder="e.g. IG1 1AA"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg uppercase tracking-wide outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
            <Nav onNext={validatePostcode} nextLabel="Check postcode" busy={busy} />
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="Tell us about your home"
            subtitle="Kitchen, lounge and common areas (hallways, landings) are always included."
          >
            <div className="mb-4 flex gap-2">
              {ROOM_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setRoomTab(t.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    roomTab === t.key
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Counter
              label={ROOM_TABS.find((t) => t.key === roomTab)!.label}
              value={rooms[roomTab]}
              onChange={(v) => setRooms({ ...rooms, [roomTab]: v })}
            />
            <div className="my-4 border-t border-slate-100" />
            <Counter
              label="Bathrooms"
              value={rooms.bathrooms}
              onChange={(v) => setRooms({ ...rooms, bathrooms: v })}
            />
            <Nav onBack={back} onNext={next} />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title="How long should we stay?"
            subtitle={`Based on your rooms we recommend ${recommended} hours (minimum ${cfg.minHours}, maximum ${cfg.maxHours}).`}
          >
            <div className="flex items-center justify-center gap-6 py-2">
              <RoundBtn
                onClick={() => setHours(clampHours(chosenHours - 0.5, cfg))}
                disabled={chosenHours <= cfg.minHours}
              >
                −
              </RoundBtn>
              <div className="text-center">
                <div className="text-4xl font-bold text-slate-900">{chosenHours}h</div>
                {chosenHours === recommended && (
                  <div className="text-xs font-medium text-emerald-600">recommended</div>
                )}
              </div>
              <RoundBtn
                onClick={() => setHours(clampHours(chosenHours + 0.5, cfg))}
                disabled={chosenHours >= cfg.maxHours}
              >
                +
              </RoundBtn>
            </div>
            <Nav onBack={back} onNext={next} />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="Cleaning products" subtitle="Yours, or shall we bring ours?">
            <div className="grid gap-3">
              <ChoiceCard
                active={customerProvidesProducts}
                title="I'll provide products"
                subtitle="Use what's already at home"
                onClick={() => setCustomerProvidesProducts(true)}
              />
              <ChoiceCard
                active={!customerProvidesProducts}
                title="Bring your products"
                subtitle={`We come fully stocked (+${formatGBP(cfg.productSurcharge)})`}
                onClick={() => setCustomerProvidesProducts(false)}
              />
            </div>
            <Nav onBack={back} onNext={next} />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell title="Your details" subtitle="So we can confirm your clean by phone.">
            <div className="grid gap-3">
              <Input label="Full name" value={name} onChange={setName} autoComplete="name" />
              <Input label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
              <Input label="Phone" value={phone} onChange={setPhone} type="tel" autoComplete="tel" />
              <Input label="First line of address" value={addressLine} onChange={setAddressLine} autoComplete="address-line1" />
              <Input label="Preferred date" value={preferredDate} onChange={setPreferredDate} type="date" min={new Date().toISOString().slice(0, 10)} />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Anything we should know? <span className="text-slate-400">(optional)</span>
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
              </label>
            </div>
            <Nav
              onBack={back}
              onNext={() => {
                if (name.trim().length < 2) return setError("Please tell us your name");
                if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
                if (phone.replace(/\D/g, "").length < 10)
                  return setError("Please enter a valid phone number");
                if (!preferredDate) return setError("Please pick a preferred date");
                next();
              }}
            />
          </StepShell>
        )}

        {step === 5 && (
          <StepShell title="Your quote" subtitle="Request the booking and we'll confirm by phone.">
            <div className="rounded-xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-100">
              <div className="text-sm font-medium text-emerald-800">Estimated price</div>
              <div className="text-4xl font-bold text-emerald-700">{formatGBP(price)}</div>
              <div className="mt-1 text-xs text-emerald-800/70">
                {chosenHours}h × {formatGBP(cfg.hourlyRate)}/h
                {!customerProvidesProducts &&
                  ` + ${formatGBP(cfg.productSurcharge)} products`}
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Row k="Postcode" v={normalisePostcode(postcode)} />
              <Row
                k="Rooms"
                v={`${rooms.bedrooms} bed · ${rooms.bathrooms} bath · ${rooms.diningRooms} dining · ${rooms.livingRooms} living`}
              />
              <Row k="Always included" v="Kitchen, lounge & common areas" />
              <Row k="Products" v={customerProvidesProducts ? "Customer provides" : "We bring ours"} />
              <Row k="Preferred date" v={preferredDate} />
              <Row k="Contact" v={`${name} · ${phone}`} />
            </dl>
            <Nav onBack={back} onNext={submit} nextLabel="Request booking" busy={busy} />
          </StepShell>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- small building blocks ---------- */

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 mb-4 text-sm text-slate-500">{subtitle}</p>}
      {children}
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  nextLabel = "Continue",
  busy,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {onBack ? (
        <button
          onClick={onBack}
          className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          ← Back
        </button>
      ) : (
        <span />
      )}
      <button
        onClick={onNext}
        disabled={busy}
        className="rounded-xl bg-emerald-600 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "One sec…" : nextLabel}
      </button>
    </div>
  );
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-medium text-slate-800">{label}</span>
      <div className="flex items-center gap-3">
        <RoundBtn onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}>
          −
        </RoundBtn>
        <span className="w-6 text-center text-lg font-semibold text-slate-900">{value}</span>
        <RoundBtn onClick={() => onChange(Math.min(10, value + 1))} disabled={value >= 10}>
          +
        </RoundBtn>
      </div>
    </div>
  );
}

function RoundBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-semibold text-slate-700 transition hover:bg-emerald-100 hover:text-emerald-700 disabled:opacity-30"
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
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition ${
        active
          ? "border-emerald-500 bg-emerald-50"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="text-sm text-slate-500">{subtitle}</div>
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  min?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
      />
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium text-slate-800">{v}</dd>
    </div>
  );
}
