"use client";

import { MapPin, BedDouble, Bath, Repeat, ChevronDown } from "lucide-react";
import Icon from "./Icon";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  normalisePostcode,
  looksLikeUkPostcode,
  FREQUENCY_LABEL,
  type Frequency,
} from "@/lib/pricing";

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
        <Field
          icon={<Icon glyph={MapPin} className="size-[17px]" />}
          label="Postcode"
          className="lg:flex-[1.4]"
        >
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

        {/* Steppers, not dropdowns (2026-08-25 review): the value and both
            ways to change it are permanently visible, nothing behind a click. */}
        <Field
          icon={<Icon glyph={BedDouble} className="size-[17px]" />}
          label="Bedrooms"
        >
          <Stepper
            label="Bedrooms"
            value={bedrooms}
            max={6}
            onChange={setBedrooms}
          />
        </Field>

        <Divider />

        <Field
          icon={<Icon glyph={Bath} className="size-[17px]" />}
          label="Bathrooms"
        >
          <Stepper
            label="Bathrooms"
            value={bathrooms}
            max={4}
            onChange={setBathrooms}
          />
        </Field>

        <Divider />

        <Field
          icon={<Icon glyph={Repeat} className="size-[17px]" />}
          label="How often"
        >
          <Dropdown
            label="How often"
            options={(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => ({
              value: f,
              label: FREQUENCY_LABEL[f],
            }))}
            value={frequency}
            onChange={(v) => setFrequency(v as Frequency)}
          />
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

/**
 * The open control the review asked for: current value in the middle, both
 * ways to change it always on screen. A spinbutton to assistive tech, and the
 * arrow keys work on the value for parity with the old select.
 */
function Stepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const step = (d: number) => onChange(Math.min(max, Math.max(0, value + d)));
  return (
    <div
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); step(1); }
        if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      }}
      className="flex items-center gap-2.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
    >
      <StepBtn label={`Fewer ${label.toLowerCase()}`} disabled={value <= 0} onClick={() => step(-1)}>
        −
      </StepBtn>
      <span className="tnum min-w-[1.25rem] text-center text-[15px] font-semibold text-slate-900">
        {value}
      </span>
      <StepBtn label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => step(1)}>
        +
      </StepBtn>
    </div>
  );
}

function StepBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      // aria-hidden from the spinbutton's perspective would hide the buttons
      // from touch AT users; tabIndex -1 keeps one tab stop (the spinbutton)
      // while leaving the buttons clickable and tappable.
      tabIndex={-1}
      onClick={onClick}
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold text-slate-600 transition enabled:hover:border-brand-500 enabled:hover:text-brand-700 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

type Option = { value: string; label: string };

/**
 * A themed listbox, replacing three native <select>s.
 *
 * A native select's popup is drawn by the operating system and takes none of a
 * site's styling — which is why the bar looked designed until you opened it and
 * got a grey system list in a different typeface. There is no CSS fix for that;
 * the popup has to be ours.
 *
 * So this implements the listbox pattern properly rather than faking it with a
 * div: a real button with aria-haspopup and aria-expanded, a role="listbox"
 * that takes focus and drives aria-activedescendant, arrow/Home/End/Enter/Escape
 * keys, click-outside to dismiss, and focus returned to the trigger on close.
 *
 * It opens UPWARD. The bar sits on the fold inside a section with
 * overflow-hidden, so a downward panel would be clipped — the one thing a
 * native select got for free.
 */
function Dropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [active, setActive] = useState(selectedIndex);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  // Focus moves into the list on open and back to the trigger on close, so the
  // control is never a keyboard trap and never loses the user's place. The
  // effect only touches the DOM — `active` is seeded by openList(), because
  // setting state from inside an effect just to mirror other state is a
  // cascading render, not synchronisation.
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  function openList() {
    setActive(selectedIndex);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close({ refocus = true } = {}) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function commit(i: number) {
    onChange(options[i].value);
    close();
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close({ refocus: false });
        break;
    }
  }

  const current = options[selectedIndex]?.label ?? "";

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close({ refocus: false }) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current}`}
        className="flex w-full cursor-pointer items-center justify-between gap-2 bg-transparent text-left text-[15px] font-semibold text-slate-900 outline-none focus-visible:text-brand-700"
      >
        <span className="truncate">{current}</span>
        <Icon
          glyph={ChevronDown}
          className={`size-4 text-slate-400 transition-transform duration-200 ${
            open ? "-rotate-180 text-brand-600" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
          className="absolute bottom-full left-0 z-30 mb-3 max-h-64 min-w-[max(100%,7rem)] overflow-auto border border-slate-200 bg-white py-1 shadow-2xl outline-none"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(i)}
                onPointerMove={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                  i === active ? "bg-brand-50" : "bg-white"
                } ${isSelected ? "text-brand-700" : "text-slate-700"}`}
              >
                {o.label}
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full bg-brand-500"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
