"use client";

import { MapPin, BedDouble, Bath, Repeat } from "lucide-react";
import Icon from "./Icon";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalisePostcode, looksLikeUkPostcode, FREQUENCY_LABEL, type Frequency } from "@/lib/pricing";

/**
 * The hero search bar — the landing page IS step 0 of the quote flow.
 * Captures postcode + rooms + frequency, then hands them to the wizard, which
 * re-checks the postcode authoritatively and drops the customer on Hours.
 */
export default function HeroSearchBar() {
  const router = useRouter();
  const [postcode, setPostcode] = useState("");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [frequency, setFrequency] = useState<Frequency>("one_off");
  const [error, setError] = useState<string | null>(null);

  function go() {
    const norm = normalisePostcode(postcode);
    if (!norm) {
      setError("Pop your postcode in to get started");
      return;
    }
    if (!looksLikeUkPostcode(norm)) {
      setError("That doesn't look like a UK postcode — try e.g. IG1 1BA");
      return;
    }
    setError(null);
    const qs = new URLSearchParams({
      postcode: norm,
      bedrooms: String(bedrooms),
      bathrooms: String(bathrooms),
      frequency,
    });
    router.push(`/quote?${qs.toString()}`);
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-2 bg-white p-2 shadow-2xl lg:flex-row lg:items-center lg:gap-0 lg:rounded-full">
        <Field icon={<Icon glyph={MapPin} className="size-[17px]" />} label="Postcode" className="lg:flex-[1.4]">
          <input
            value={postcode}
            onChange={(e) => {
              setPostcode(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="e.g. IG1 1BA"
            autoComplete="postal-code"
            aria-label="Your postcode"
            className="w-full bg-transparent text-[15px] font-semibold uppercase tracking-wide text-slate-900 outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400"
          />
        </Field>

        <Divider />

        <Field icon={<Icon glyph={BedDouble} className="size-[17px]" />} label="Bedrooms">
          <Select value={bedrooms} onChange={setBedrooms} max={6} aria-label="Bedrooms" />
        </Field>

        <Divider />

        <Field icon={<Icon glyph={Bath} className="size-[17px]" />} label="Bathrooms">
          <Select value={bathrooms} onChange={setBathrooms} max={4} aria-label="Bathrooms" />
        </Field>

        <Divider />

        <Field icon={<Icon glyph={Repeat} className="size-[17px]" />} label="How often">
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            aria-label="How often"
            className="w-full cursor-pointer appearance-none bg-transparent text-[15px] font-semibold text-slate-900 outline-none"
          >
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABEL[f]}
              </option>
            ))}
          </select>
        </Field>

        <button
          onClick={go}
          className="shrink-0 bg-slate-900 px-8 py-4 text-base font-semibold text-white transition hover:bg-slate-800 lg:ml-2 lg:rounded-full"
        >
          Get my price
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-full bg-rose-50 px-4 py-2 text-center text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- bits ---------- */

function Field({
  icon,
  label,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-1 items-center gap-3 px-4 py-2.5 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="hidden w-px self-stretch bg-slate-200 lg:block" />;
}

function Select({
  value,
  onChange,
  max,
  ...rest
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
  "aria-label": string;
}) {
  return (
    <select
      {...rest}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full cursor-pointer appearance-none bg-transparent text-[15px] font-semibold text-slate-900 outline-none"
    >
      {Array.from({ length: max + 1 }, (_, i) => i).map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

