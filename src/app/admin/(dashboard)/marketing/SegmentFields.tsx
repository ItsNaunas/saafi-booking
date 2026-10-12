// The segment builder's inputs, shared by the audience explorer (a GET form)
// and the campaign editor (a POST form). Field names are what
// lib/segments.ts filterFromForm reads.
import { PLAN_LABEL, SOURCES, STAGE_LABEL, WEEKDAY_LABEL, type Plan, type SegmentFilter, type Stage } from "@/lib/segments";

const STAGES = Object.keys(STAGE_LABEL) as Stage[];
const PLANS = Object.keys(PLAN_LABEL) as Plan[];

export default function SegmentFields({ f, areas }: { f: SegmentFilter; areas: string[] }) {
  return (
    <div className="space-y-3 text-sm">
      <Checks legend="Who" name="stage" options={STAGES.map((s) => [s, STAGE_LABEL[s]])} picked={f.stages} hint="None ticked = all of them." />
      <Checks legend="Current plan" name="plan" options={PLANS.map((p) => [p, PLAN_LABEL[p]])} picked={f.plans} />
      {areas.length > 0 && <Checks legend="Area" name="area" options={areas.map((a) => [a, a])} picked={f.areas} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tri name="upcoming" label="Clean booked" value={f.upcoming} yes="Has one booked" no="Nothing booked" />
        <Tri name="deep" label="Deep clean" value={f.deep} yes="Has had one" no="Never had one" />
        <Tri name="mover" label="Movers" value={f.mover} yes="Moved (deep clean for a move)" no="Not movers" />
        <Tri name="addons" label="Extras (oven, windows…)" value={f.addons} yes="Has had extras" no="Never had an extra" />
        <Tri name="host" label="Airbnb host" value={f.host} yes="Hosts only" no="Not hosts" />
        <Select
          name="same_day"
          label="Busy hosts"
          value={f.sameDay}
          options={[["yes", "Same-day turnovers coming up"]]}
        />
        <Select name="usual" label="Usually books" value={f.usual} options={[["weekday", "Weekdays"], ["weekend", "Weekends"]]} />
        <Select
          name="near_day"
          label="Quiet-day filler: cleaner nearby on"
          value={f.nearDay != null ? String(f.nearDay) : undefined}
          options={[1, 2, 3, 4, 5, 6].map((d) => [String(d), WEEKDAY_LABEL[d]])}
        />
        <Select name="happy" label="Happy regulars" value={f.happy} options={[["yes", "3+ cleans, nothing gone wrong"]]} />
        <Select
          name="at_risk"
          label="At risk"
          value={f.atRisk}
          options={[["yes", "Only people where something went wrong"]]}
        />
        <Num name="deep_due" label="No deep clean for (months)" value={f.deepDueMonths} />
        <Num name="min_bedrooms" label="Bedrooms, at least" value={f.minBedrooms} />
        <Num name="min_bathrooms" label="Bathrooms, at least" value={f.minBathrooms} />
        <Num name="min_days" label="Days since last clean, at least" value={f.minDaysSinceClean} />
        <Num name="max_days" label="Days since last clean, at most" value={f.maxDaysSinceClean} />
        <Num name="min_cleans" label="Completed cleans, at least" value={f.minCleans} />
        <Num name="min_spend" label="Spent at least (£)" value={f.minSpend} />
      </div>

      <Checks legend="Heard about us via" name="source" options={SOURCES.map((s) => [s.key, s.label])} picked={f.sources} />
      <p className="text-xs text-slate-400">
        People where something went wrong in the last 30 days (no access, a cancellation, a refund, or a bill above the
        quote) are always left out — unless you pick &ldquo;At risk&rdquo; to write to them on purpose.
      </p>
    </div>
  );
}

function Checks({
  legend,
  name,
  options,
  picked,
  hint,
}: {
  legend: string;
  name: string;
  options: [string, string][];
  picked?: string[];
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1 font-medium text-slate-700">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map(([v, label]) => (
          <label key={v} className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" name={name} value={v} defaultChecked={picked?.includes(v)} className="accent-brand-600" />
            {label}
          </label>
        ))}
      </div>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </fieldset>
  );
}

function Tri({ name, label, value, yes, no }: { name: string; label: string; value?: string; yes: string; no: string }) {
  return <Select name={name} label={label} value={value} options={[["yes", yes], ["no", no]]} />;
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="w-full border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-brand-500">
        <option value="">Any</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Num({ name, label, value }: { name: string; label: string; value?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        name={name}
        type="number"
        min="0"
        defaultValue={value ?? ""}
        className="w-full border border-slate-300 px-2 py-1.5 outline-none focus:border-brand-500"
      />
    </label>
  );
}
