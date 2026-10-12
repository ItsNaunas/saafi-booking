// The segment builder's inputs, shared by the audience explorer (a GET form)
// and the campaign editor (a POST form). Field names are what
// lib/segments.ts filterFromForm reads.
import { STAGE_LABEL, type SegmentFilter, type Stage } from "@/lib/segments";

const STAGES = Object.keys(STAGE_LABEL) as Stage[];

export default function SegmentFields({ f, areas }: { f: SegmentFilter; areas: string[] }) {
  return (
    <div className="space-y-3 text-sm">
      <fieldset>
        <legend className="mb-1 font-medium text-slate-700">Who</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {STAGES.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" name="stage" value={s} defaultChecked={f.stages?.includes(s)} className="accent-brand-600" />
              {STAGE_LABEL[s]}
            </label>
          ))}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">None ticked = all of them.</p>
      </fieldset>

      {areas.length > 0 && (
        <fieldset>
          <legend className="mb-1 font-medium text-slate-700">Area</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {areas.map((a) => (
              <label key={a} className="flex items-center gap-1.5 text-slate-600">
                <input type="checkbox" name="area" value={a} defaultChecked={f.areas?.includes(a)} className="accent-brand-600" />
                {a}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tri name="upcoming" label="Clean booked" value={f.upcoming} yes="Has one booked" no="Nothing booked" />
        <Tri name="deep" label="Deep clean" value={f.deep} yes="Has had one" no="Never had one" />
        <Tri name="host" label="Airbnb host" value={f.host} yes="Hosts only" no="Not hosts" />
        <Num name="min_days" label="Days since last clean, at least" value={f.minDaysSinceClean} />
        <Num name="max_days" label="Days since last clean, at most" value={f.maxDaysSinceClean} />
        <Num name="min_cleans" label="Completed cleans, at least" value={f.minCleans} />
        <Num name="min_spend" label="Spent at least (£)" value={f.minSpend} />
      </div>
    </div>
  );
}

function Tri({ name, label, value, yes, no }: { name: string; label: string; value?: string; yes: string; no: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="w-full border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-brand-500">
        <option value="">Any</option>
        <option value="yes">{yes}</option>
        <option value="no">{no}</option>
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
