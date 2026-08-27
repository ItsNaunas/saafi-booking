"use client";

// The pricing half of the manual booking form (2026-08-25 review: "a tab for
// manual pricing to handle phone quotes efficiently").
//
// The admin is on the phone. They type hours and frequency and the engine's
// price appears beside the price field as they type — one tap copies it in,
// or they ignore it and type whatever was agreed. The price field stays a
// plain input the admin owns: the engine suggests, it never overrules.
//
// Same quotePrice as the public quote form, so a phone quote and a web quote
// can never disagree about the same job.

import { useState } from "react";
import {
  quotePrice,
  formatGBP,
  FREQUENCY_LABEL,
  type PricingConfig,
  type Frequency,
} from "@/lib/pricing";

export default function ManualPriceFields({ cfg }: { cfg: PricingConfig }) {
  const [hours, setHours] = useState("2");
  const [frequency, setFrequency] = useState<Frequency>("one_off");
  const [price, setPrice] = useState("");

  const h = Number(hours);
  const suggested =
    Number.isFinite(h) && h > 0
      ? quotePrice(h, true, cfg, frequency) // phone bookings assume customer products
      : null;

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Hours</span>
        <input
          name="hours"
          type="number"
          step="0.5"
          min="0.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Frequency</span>
        <select
          name="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency)}
          className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
        >
          {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABEL[f]}
            </option>
          ))}
        </select>
      </label>

      <div className="sm:col-span-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Price (£)</span>
          <input
            name="price"
            type="number"
            step="0.5"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={suggested !== null ? String(suggested) : "0"}
            className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
          />
        </label>
        {suggested !== null && (
          <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
            <span>
              Engine price for {hours}h {FREQUENCY_LABEL[frequency].toLowerCase()}:{" "}
              <span className="tnum font-semibold text-brand-700">{formatGBP(suggested)}</span>
            </span>
            <button
              type="button"
              onClick={() => setPrice(String(suggested))}
              className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900"
            >
              use it
            </button>
          </p>
        )}
      </div>
    </>
  );
}
