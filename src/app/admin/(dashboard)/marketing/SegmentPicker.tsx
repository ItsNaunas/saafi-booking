"use client";

// "Who do you want to email?" — ready-made segments as cards, detailed
// filters folded into four groups, and a count that updates as you tick.
// The rules are lib/segments.ts, run right here in the browser on the
// profiles the page passed in, so the count is the same one the send uses.
//
// Inside a form it emits the filter as the builder's field names (hidden
// inputs), so the server reads it with filterFromForm like any other form.

import { useMemo, useState } from "react";
import {
  CONSENT_LABEL,
  PLAN_LABEL,
  PRESETS,
  SOURCES,
  STAGE_LABEL,
  WEEKDAY_LABEL,
  describeFilter,
  filterToFields,
  matches,
  type Consent,
  type Plan,
  type Profile,
  type SegmentFilter,
  type Stage,
} from "@/lib/segments";
import { formatGBP } from "@/lib/pricing";

type Props = {
  profiles: Profile[];
  initial: SegmentFilter;
  areas: string[];
  /** "campaign": hidden inputs + count. "contacts": also the full list. */
  mode: "campaign" | "contacts";
  /** Rendered in the count bar, e.g. an "Email these people" button. */
  action?: React.ReactNode;
};

const sameFilter = (a: SegmentFilter, b: SegmentFilter) =>
  JSON.stringify(filterToFields(a).sort()) === JSON.stringify(filterToFields(b).sort());

export default function SegmentPicker({ profiles, initial, areas, mode, action }: Props) {
  const [f, setF] = useState<SegmentFilter>(initial);
  const [open, setOpen] = useState(() => !PRESETS.some((p) => sameFilter(p.filter, initial)) && Object.keys(initial).length > 0);

  const inSegment = useMemo(() => profiles.filter((p) => matches(p, f)), [profiles, f]);
  const reach = inSegment.filter((p) => p.consent === "yes");
  const blocked = inSegment.length - reach.length;
  // The contacts list with no group picked is everyone, including people who
  // had a problem recently, whom segments leave out of emails by default.
  const shown = mode === "contacts" && Object.keys(f).length === 0 ? profiles : inSegment;

  const set = <K extends keyof SegmentFilter>(k: K, v: SegmentFilter[K] | undefined) =>
    setF((cur) => {
      const next = { ...cur };
      if (v === undefined || (Array.isArray(v) && v.length === 0)) delete next[k];
      else next[k] = v;
      return next;
    });
  const toggle = <T extends string>(k: "stages" | "plans" | "areas" | "sources", v: T) =>
    setF((cur) => {
      const list = new Set((cur[k] as string[] | undefined) ?? []);
      if (list.has(v)) list.delete(v);
      else list.add(v);
      const next = { ...cur, [k]: [...list] } as SegmentFilter;
      if (list.size === 0) delete next[k];
      return next;
    });
  const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Math.max(0, Number(v)));

  return (
    <div className="space-y-4">
      {/* the form value */}
      <input type="hidden" name="segment_step" value="1" />
      {filterToFields(f).map(([k, v], i) => (
        <input key={`${k}${i}`} type="hidden" name={k} value={v} />
      ))}
      {/* Contacts tab only: names the campaign it starts. The campaign editor has its own name field. */}
      {mode === "contacts" && <input type="hidden" name="name" value={describeFilter(f)} />}

      <Fold folded={mode === "contacts"} label={Object.keys(f).length ? `Group: ${describeFilter(f)}` : "Filter by group"} onClear={Object.keys(f).length ? () => setF({}) : undefined}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PRESETS.map((p) => {
          const n = profiles.filter((x) => x.consent === "yes" && matches(x, p.filter)).length;
          const on = sameFilter(p.filter, f);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setF(p.filter)}
              className={`flex items-start justify-between gap-3 px-3 py-2.5 text-left ring-1 ring-inset transition ${
                on ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-slate-200 hover:bg-slate-50"
              } ${p.key === "at_risk" ? "border-l-4 border-rose-300" : ""}`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{p.label}</span>
                <span className="block text-xs leading-snug text-slate-500">{p.hint}</span>
              </span>
              <span className={`shrink-0 text-lg font-bold tabular-nums ${n ? "text-brand-700" : "text-slate-300"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white ring-1 ring-slate-200">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-expanded={open}
        >
          <span>Narrow it down {Object.keys(f).length > 0 && <span className="text-slate-400">· {describeFilter(f)}</span>}</span>
          <span className="text-slate-400">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="grid gap-5 border-t border-slate-100 p-4 md:grid-cols-2">
            <Group title="Stage">
              <Checks
                options={(Object.keys(STAGE_LABEL) as Stage[]).map((s) => [s, STAGE_LABEL[s]])}
                picked={f.stages}
                onToggle={(v) => toggle("stages", v)}
              />
              <Label>On this plan now</Label>
              <Checks
                options={(Object.keys(PLAN_LABEL) as Plan[]).map((p) => [p, PLAN_LABEL[p]])}
                picked={f.plans}
                onToggle={(v) => toggle("plans", v)}
              />
            </Group>

            <Group title="Home & cleans">
              <Row>
                <Num label="Bedrooms, at least" value={f.minBedrooms} onChange={(v) => set("minBedrooms", num(v))} />
                <Num label="Bathrooms, at least" value={f.minBathrooms} onChange={(v) => set("minBathrooms", num(v))} />
              </Row>
              <Row>
                <Pick label="Deep clean" value={f.deep} onChange={(v) => set("deep", v as "yes" | "no" | undefined)} options={[["yes", "Has had one"], ["no", "Never had one"]]} />
                <Pick label="Extras (oven, windows…)" value={f.addons} onChange={(v) => set("addons", v as "yes" | "no" | undefined)} options={[["yes", "Has had extras"], ["no", "Never had one"]]} />
              </Row>
              <Row>
                <Num label="No deep clean for (months)" value={f.deepDueMonths} onChange={(v) => set("deepDueMonths", num(v))} />
                <Pick label="Moved house" value={f.mover} onChange={(v) => set("mover", v as "yes" | "no" | undefined)} options={[["yes", "Deep clean for a move"], ["no", "No"]]} />
              </Row>
            </Group>

            <Group title="Where & when">
              {areas.length > 0 && (
                <>
                  <Label>Area</Label>
                  <Checks options={areas.map((a) => [a, a])} picked={f.areas} onToggle={(v) => toggle("areas", v)} />
                </>
              )}
              <Row>
                <Pick label="Usually books" value={f.usual} onChange={(v) => set("usual", v as "weekday" | "weekend" | undefined)} options={[["weekday", "Weekdays"], ["weekend", "Weekends"]]} />
                <Pick label="Clean booked" value={f.upcoming} onChange={(v) => set("upcoming", v as "yes" | "no" | undefined)} options={[["yes", "Has one booked"], ["no", "Nothing booked"]]} />
              </Row>
              <Pick
                label="Fill a quiet day: a cleaner is already near them on…"
                value={f.nearDay != null ? String(f.nearDay) : undefined}
                onChange={(v) => set("nearDay", v === undefined ? undefined : Number(v))}
                options={[1, 2, 3, 4, 5, 6].map((d) => [String(d), WEEKDAY_LABEL[d]])}
              />
              <Row>
                <Num label="Days since last clean, at least" value={f.minDaysSinceClean} onChange={(v) => set("minDaysSinceClean", num(v))} />
                <Num label="…at most" value={f.maxDaysSinceClean} onChange={(v) => set("maxDaysSinceClean", num(v))} />
              </Row>
            </Group>

            <Group title="Relationship">
              <Row>
                <Pick label="Happy regulars" value={f.happy} onChange={(v) => set("happy", v as "yes" | undefined)} options={[["yes", "3+ cleans, no problems"]]} />
                <Pick label="Had a problem recently" value={f.atRisk} onChange={(v) => set("atRisk", v as "yes" | undefined)} options={[["yes", "Only these people"]]} />
              </Row>
              <Row>
                <Pick label="Airbnb host" value={f.host} onChange={(v) => set("host", v as "yes" | "no" | undefined)} options={[["yes", "Hosts only"], ["no", "Not hosts"]]} />
                <Pick label="Busy hosts" value={f.sameDay} onChange={(v) => set("sameDay", v as "yes" | undefined)} options={[["yes", "Same-day turnovers coming"]]} />
              </Row>
              <Row>
                <Num label="Cleans, at least" value={f.minCleans} onChange={(v) => set("minCleans", num(v))} />
                <Num label="Spent at least (£)" value={f.minSpend} onChange={(v) => set("minSpend", num(v))} />
              </Row>
              <Label>Heard about us via</Label>
              <Checks options={SOURCES.map((s) => [s.key, s.label])} picked={f.sources} onToggle={(v) => toggle("sources", v)} />
            </Group>
            <p className="text-xs text-slate-400 md:col-span-2">
              People who had a problem in the last 30 days are always left out, unless you pick &ldquo;Had a problem
              recently&rdquo; to write to them on purpose.
              <button type="button" onClick={() => setF({})} className="ml-2 font-medium text-brand-700 hover:underline">
                Clear all
              </button>
            </p>
          </div>
        )}
      </div>

      </Fold>

      {/* the answer */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-900 px-4 py-3 text-white shadow-lg">
        <span className="text-2xl font-bold tabular-nums">{reach.length}</span>
        <span className="text-sm">{reach.length === 1 ? "person" : "people"} will get this email</span>
        {blocked > 0 && (
          <span className="text-xs text-slate-400">
            + {blocked} in this group who can&apos;t be emailed (said no, never asked, or unsubscribed)
          </span>
        )}
        {reach.length > 0 && mode === "campaign" && (
          <span className="w-full truncate text-xs text-slate-300">
            {reach.slice(0, 6).map((p) => p.name || p.email).join(", ")}
            {reach.length > 6 ? ` and ${reach.length - 6} more` : ""}
          </span>
        )}
        {action && reach.length > 0 && <span className="ml-auto">{action}</span>}
      </div>

      {mode === "contacts" && <ContactsBrowser people={shown} />}
    </div>
  );
}

const CONSENT_CHIP: Record<Consent, string> = {
  yes: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  no: "bg-slate-100 text-slate-600 ring-slate-200",
  unsubscribed: "bg-rose-50 text-rose-800 ring-rose-200",
  unknown: "bg-amber-50 text-amber-800 ring-amber-200",
};

type Sort = "name" | "recent" | "spend" | "cleans";
type Chip = "all" | "yes" | "no";

function ContactsBrowser({ people }: { people: Profile[] }) {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<Chip>("all");
  const [sort, setSort] = useState<Sort>("recent");

  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/\s+/g, "");
    if (!needle) return people;
    return people.filter((p) =>
      [p.name, p.email, p.phone ?? "", p.postcode ?? ""].some((v) => v.toLowerCase().replace(/\s+/g, "").includes(needle))
    );
  }, [people, q]);
  const counts = { all: searched.length, yes: searched.filter((p) => p.consent === "yes").length };
  const list = useMemo(() => {
    const l = searched.filter((p) => (chip === "all" ? true : chip === "yes" ? p.consent === "yes" : p.consent !== "yes"));
    const by: Record<Sort, (a: Profile, z: Profile) => number> = {
      name: (a, z) => (a.name || a.email).localeCompare(z.name || z.email),
      recent: (a, z) => (z.lastClean ?? z.nextBooking ?? "").localeCompare(a.lastClean ?? a.nextBooking ?? ""),
      spend: (a, z) => z.spend - a.spend,
      cleans: (a, z) => z.completed - a.completed,
    };
    return l.slice().sort(by[sort]);
  }, [searched, chip, sort]);

  const spend = list.reduce((s, p) => s + p.spend, 0);
  const cleans = list.reduce((s, p) => s + p.completed, 0);
  const customers = list.filter((p) => p.completed > 0).length;

  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Name", "Email", "Phone", "Postcode", "Stage", "Can email", "Cleans", "Spent", "Last clean", "Next booking"];
    const rows = list.map((p) =>
      [p.name, p.email, p.phone, p.postcode, STAGE_LABEL[p.stage], CONSENT_LABEL[p.consent], p.completed, p.spend.toFixed(2), p.lastClean, p.nextBooking]
        .map(cell)
        .join(",")
    );
    const blob = new Blob([[head.map(cell).join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `saafi-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone or postcode"
          aria-label="Search contacts"
          className="min-w-0 flex-1 basis-60 border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <div className="flex text-sm ring-1 ring-slate-200" role="group" aria-label="Who can be emailed">
          {(
            [
              ["all", `All ${counts.all}`],
              ["yes", `Can email ${counts.yes}`],
              ["no", `Can't email ${counts.all - counts.yes}`],
            ] as [Chip, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setChip(k)}
              aria-pressed={chip === k}
              className={`px-3 py-2 font-medium ${chip === k ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort contacts"
          className="border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="recent">Most recent clean</option>
          <option value="spend">Most spent</option>
          <option value="cleans">Most cleans</option>
          <option value="name">Name A–Z</option>
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={list.length === 0}
          className="border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <p className="text-xs text-slate-500">
        <b className="text-slate-800">{list.length}</b> shown · {customers} customer{customers === 1 ? "" : "s"} · {cleans} clean
        {cleans === 1 ? "" : "s"} · {formatGBP(spend)} spent{customers > 0 ? ` · ${formatGBP(spend / customers)} per customer` : ""}
      </p>

      {list.length === 0 ? (
        <p className="bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          {people.length === 0 ? "Nobody in this group yet." : "No one matches that."}
        </p>
      ) : (
        <div className="divide-y divide-slate-100 bg-white ring-1 ring-slate-200">
          {list.slice(0, 300).map((p) => (
            <a
              key={p.email}
              href={`/admin/marketing/contacts/${toKey(p.email)}`}
              className="grid gap-1 px-4 py-3 text-sm hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{p.name || p.email}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${CONSENT_CHIP[p.consent]}`}>
                    {CONSENT_LABEL[p.consent]}
                  </span>
                  {p.atRisk && <span className="text-[11px] font-medium text-rose-700">had a problem</span>}
                  {p.happy && <span className="text-[11px] font-medium text-emerald-700">happy</span>}
                  {p.isHost && <span className="text-[11px] font-medium text-sky-700">Airbnb host</span>}
                  {p.lastMoveClean && <span className="text-[11px] font-medium text-violet-700">moved</span>}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {STAGE_LABEL[p.stage]}
                  {p.plan ? ` (${PLAN_LABEL[p.plan].toLowerCase()})` : ""}
                  {p.area ? ` · ${p.area}` : ""}
                  {p.phone ? ` · ${p.phone}` : ""}
                </div>
              </div>
              <div className="flex gap-4 text-xs text-slate-500 sm:text-right">
                <span>
                  <b className="text-slate-800">{p.completed}</b> clean{p.completed === 1 ? "" : "s"}
                </span>
                <span>{p.spend ? formatGBP(p.spend) : "—"}</span>
                <span>{p.lastClean ? `last ${p.daysSinceLastClean}d ago` : "no clean yet"}</span>
                {p.nextBooking && <span className="text-brand-700">next {p.nextBooking}</span>}
                <span className="text-slate-300" aria-hidden>
                  ›
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
      {list.length > 300 && <p className="text-xs text-slate-400">Showing the first 300 — search to narrow it down.</p>}
    </div>
  );
}

/** URL-safe key for a contact page: the address, base64url-encoded. */
function toKey(email: string): string {
  const bytes = new TextEncoder().encode(email);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function Fold({
  folded,
  label,
  onClear,
  children,
}: {
  folded: boolean;
  label: string;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!folded) return <>{children}</>;
  return (
    <div className="bg-white ring-1 ring-slate-200">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <span className="truncate">{label}</span>
          <span className="text-slate-400">{open ? "▲" : "▼"}</span>
        </button>
        {onClear && (
          <button type="button" onClick={onClear} className="px-3 py-2.5 text-xs font-medium text-brand-700 hover:underline">
            Clear
          </button>
        )}
      </div>
      {open && <div className="space-y-4 border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</legend>
      {children}
    </fieldset>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-2">{children}</div>;
const Label = ({ children }: { children: React.ReactNode }) => <p className="text-xs font-medium text-slate-600">{children}</p>;

function Checks({ options, picked, onToggle }: { options: [string, string][]; picked?: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => {
        const on = picked?.includes(v) ?? false;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            aria-pressed={on}
            className={`px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500"
      >
        <option value="">Anyone</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value?: number; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        min="0"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
      />
    </label>
  );
}
