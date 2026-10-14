// Marketing audience and segments, computed live from bookings — no copy of
// the customer list to drift out of date. Pure: no DB and no clock of its own
// (`today` is passed in), so every rule is assertable in
// scripts/segments-check.ts.
//
// One person = one email address. Their profile is built from every booking
// and quote under that address, and the segment builder filters profiles.

export type Stage =
  /** Typed an email into the quote form, never booked. */
  | "lead"
  /** Only ever cancelled. */
  | "cancelled"
  /** Booked, first clean still to come. */
  | "new"
  /** On a live recurring plan. */
  | "regular"
  /** Was on a recurring plan, isn't now. */
  | "lapsed"
  /** Had cleans, never on a plan. */
  | "one_off";

export const STAGE_LABEL: Record<Stage, string> = {
  lead: "Quoted, never booked",
  cancelled: "Only ever cancelled",
  new: "First clean booked",
  regular: "On a regular plan",
  lapsed: "Stopped their regular plan",
  one_off: "One-off customer",
};

export type Plan = "weekly" | "fortnightly" | "four_weekly";
export const PLAN_LABEL: Record<Plan, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  four_weekly: "Every 4 weeks",
};

/** "How did you hear about us?" — the quote form's options. */
export const SOURCES = [
  { key: "google", label: "Google search or Maps" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "friend", label: "A friend or neighbour" },
  { key: "letting_agent", label: "Letting agent or landlord" },
  { key: "airbnb", label: "Airbnb / host community" },
  { key: "leaflet", label: "Leaflet or flyer" },
  { key: "other", label: "Somewhere else" },
] as const;
export type SourceKey = (typeof SOURCES)[number]["key"];
export const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.map((s) => [s.key, s.label]));

export const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type Consent = "yes" | "no" | "unsubscribed" | "unknown";

export const CONSENT_LABEL: Record<Consent, string> = {
  yes: "Can email",
  no: "Said no at booking",
  unsubscribed: "Unsubscribed",
  unknown: "Never asked",
};

/** The booking fields segmentation reads — a subset of BookingRow. */
export type SegBooking = {
  customer_name: string;
  customer_email: string;
  postcode: string;
  status: string;
  frequency: string;
  recurring_active: boolean;
  service_type?: string | null;
  deep_reason?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  addons?: { key: string }[] | null;
  preferred_date: string;
  quoted_price: number | string;
  final_price: number | string | null;
  refund_amount?: number | string | null;
  created_at: string;
  marketing_ok?: boolean | null;
  heard_from?: string | null;
};

export type SegLead = {
  email: string;
  name: string | null;
  postcode: string | null;
  marketing_ok: boolean | null;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
};

/** Per host email: listings connected and same-day turnovers coming up. */
export type HostStats = { listings: number; sameDay: number };

export type Profile = {
  email: string;
  name: string;
  firstName: string;
  stage: Stage;
  consent: Consent;
  /** Outward postcode, "OX4". Null when unknown. */
  area: string | null;
  bookings: number;
  completed: number;
  lastClean: string | null;
  daysSinceLastClean: number | null;
  nextBooking: string | null;
  hadDeep: boolean;
  lastDeep: string | null;
  daysSinceDeep: number | null;
  spend: number;
  isHost: boolean;
  hostListings: number;
  hostSameDay: number;
  hasLead: boolean;
  /** Current recurring plan, if on one. */
  plan: Plan | null;
  /** Has ever added an extra (oven, windows…). */
  hadAddon: boolean;
  bedrooms: number;
  bathrooms: number;
  /** Which kind of day they book on most. */
  usualDays: "weekday" | "weekend" | null;
  /** Latest deep clean booked because of a move. */
  lastMoveClean: string | null;
  /** Latest thing that went wrong: a no-access visit, a cancellation, a
   *  refund, or a bill that came out higher than the quote. */
  lastIssue: string | null;
  /** Something went wrong in the last 30 days — keep offers away. */
  atRisk: boolean;
  /** 3+ cleans and nothing gone wrong in the last 90 days. */
  happy: boolean;
  heardFrom: string | null;
  /** Weekdays (0=Sun) a cleaner is already booked in their area, next 14 days. */
  nearbyDays: number[];
};

export type SegmentFilter = {
  stages?: Stage[];
  areas?: string[];
  /** "yes" = had a deep clean, "no" = never. */
  deep?: "yes" | "no";
  upcoming?: "yes" | "no";
  host?: "yes" | "no";
  minDaysSinceClean?: number;
  maxDaysSinceClean?: number;
  minSpend?: number;
  minCleans?: number;
  plans?: Plan[];
  addons?: "yes" | "no";
  minBedrooms?: number;
  minBathrooms?: number;
  usual?: "weekday" | "weekend";
  mover?: "yes" | "no";
  /** No deep clean for this many months (or never). */
  deepDueMonths?: number;
  /** 0–6: a cleaner is already in their area on this weekday soon. */
  nearDay?: number;
  happy?: "yes";
  /** "yes" = only at-risk people. Otherwise at-risk people are always left out. */
  atRisk?: "yes";
  sources?: string[];
  /** Hosts with same-day turnovers coming up. */
  sameDay?: "yes";
};

const DONE = new Set(["completed", "paid"]);
const LIVE = new Set(["requested", "confirmed"]);
const MOVE_REASONS = new Set(["end_of_tenancy", "moving_in"]);

/** Phone bookings get a made-up address; it is nobody's inbox. */
export function isRealEmail(email: string): boolean {
  return !email.endsWith("@phone.saafi") && /^\S+@\S+\.\S+$/.test(email);
}

export function outwardCode(postcode: string | null | undefined): string | null {
  const p = (postcode ?? "").toUpperCase().replace(/\s+/g, "");
  if (p.length < 5 || p === "—") return null;
  // UK inward code is always the last three characters.
  return p.slice(0, -3);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** What went wrong on a booking, if anything. */
function hadIssue(b: SegBooking): boolean {
  if (b.status === "no_access" || b.status === "cancelled") return true;
  if (Number(b.refund_amount ?? 0) > 0) return true;
  return b.final_price != null && Number(b.final_price) > Number(b.quoted_price) + 0.01;
}

export function buildProfiles(opts: {
  bookings: SegBooking[];
  leads: SegLead[];
  suppressed: Set<string>;
  hostEmails: Set<string>;
  hostStats?: Map<string, HostStats>;
  today: string;
}): Profile[] {
  const { today } = opts;
  type Acc = { bookings: SegBooking[]; lead: SegLead | null };
  const byEmail = new Map<string, Acc>();
  const acc = (email: string) => {
    let a = byEmail.get(email);
    if (!a) byEmail.set(email, (a = { bookings: [], lead: null }));
    return a;
  };
  for (const b of opts.bookings) {
    const email = b.customer_email.trim().toLowerCase();
    if (isRealEmail(email)) acc(email).bookings.push(b);
  }
  for (const l of opts.leads) {
    const email = l.email.trim().toLowerCase();
    if (isRealEmail(email)) acc(email).lead = l;
  }

  // Where cleaners already are over the next fortnight: area -> weekdays.
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 14);
  const horizonStr = horizon.toISOString().slice(0, 10);
  const areaDays = new Map<string, Map<number, Set<string>>>();
  for (const b of opts.bookings) {
    if (!LIVE.has(b.status) || b.preferred_date < today || b.preferred_date > horizonStr) continue;
    const area = outwardCode(b.postcode);
    if (!area) continue;
    let days = areaDays.get(area);
    if (!days) areaDays.set(area, (days = new Map()));
    const d = weekday(b.preferred_date);
    let who = days.get(d);
    if (!who) days.set(d, (who = new Set()));
    who.add(b.customer_email.trim().toLowerCase());
  }

  const out: Profile[] = [];
  for (const [email, { bookings, lead }] of byEmail) {
    const sorted = bookings.slice().sort((a, z) => a.created_at.localeCompare(z.created_at));
    const live = sorted.filter((b) => b.status !== "cancelled");
    const done = live.filter((b) => DONE.has(b.status));
    const upcoming = live
      .filter((b) => LIVE.has(b.status) && b.preferred_date >= today)
      .map((b) => b.preferred_date)
      .sort();
    const lastClean = done.map((b) => b.preferred_date).sort().at(-1) ?? null;
    const everRecurring = live.some((b) => b.frequency !== "one_off");
    const activePlan = live
      .filter((b) => b.frequency !== "one_off" && b.recurring_active && LIVE.has(b.status) && b.preferred_date >= today)
      .sort((a, z) => a.preferred_date.localeCompare(z.preferred_date))[0];

    let stage: Stage;
    if (sorted.length === 0) stage = "lead";
    else if (live.length === 0) stage = "cancelled";
    else if (activePlan) stage = "regular";
    else if (done.length === 0) stage = "new";
    else if (everRecurring) stage = upcoming.length > 0 ? "regular" : "lapsed";
    else stage = "one_off";

    // Consent: an unsubscribe is final. Otherwise the most recent answer the
    // person gave (booking or quote form) wins; never answered = unknown,
    // which is treated as no.
    let consent: Consent = "unknown";
    if (opts.suppressed.has(email)) consent = "unsubscribed";
    else {
      const answers: { at: string; ok: boolean }[] = [];
      for (const b of sorted) if (typeof b.marketing_ok === "boolean") answers.push({ at: b.created_at, ok: b.marketing_ok });
      if (lead && typeof lead.marketing_ok === "boolean") answers.push({ at: lead.updated_at, ok: lead.marketing_ok });
      answers.sort((a, z) => a.at.localeCompare(z.at));
      const latest = answers.at(-1);
      if (latest) consent = latest.ok ? "yes" : "no";
    }

    const deeps = live.filter((b) => b.service_type === "deep").map((b) => b.preferred_date).sort();
    const moves = live
      .filter((b) => b.service_type === "deep" && MOVE_REASONS.has(b.deep_reason ?? ""))
      .map((b) => b.preferred_date)
      .sort();
    // Issues only count once they've happened (a future cancelled date still
    // counts from when it was cancelled — approximated by its created date).
    const issues = sorted
      .filter(hadIssue)
      .map((b) => (b.preferred_date <= today ? b.preferred_date : b.created_at.slice(0, 10)))
      .sort();
    const lastIssue = issues.at(-1) ?? null;
    const issueAge = lastIssue ? daysBetween(lastIssue, today) : null;

    let wkd = 0;
    let wke = 0;
    for (const b of live) {
      const d = weekday(b.preferred_date);
      if (d === 0 || d === 6) wke++;
      else wkd++;
    }

    const latestBooking = sorted.at(-1);
    const area = outwardCode(latestBooking?.postcode ?? lead?.postcode);
    const nearbyDays: number[] = [];
    for (const [d, who] of areaDays.get(area ?? "") ?? []) {
      // Someone else's clean: their own booking doesn't make the day "nearby".
      if ([...who].some((e) => e !== email)) nearbyDays.push(d);
    }
    const name = (latestBooking?.customer_name ?? lead?.name ?? "").trim();
    const stats = opts.hostStats?.get(email);
    out.push({
      email,
      name,
      firstName: name.split(/\s+/)[0] || "there",
      stage,
      consent,
      area,
      bookings: live.length,
      completed: done.length,
      lastClean,
      daysSinceLastClean: lastClean ? daysBetween(lastClean, today) : null,
      nextBooking: upcoming[0] ?? null,
      hadDeep: deeps.length > 0,
      lastDeep: deeps.filter((d) => d <= today).at(-1) ?? null,
      daysSinceDeep: (() => {
        const d = deeps.filter((x) => x <= today).at(-1);
        return d ? daysBetween(d, today) : null;
      })(),
      spend: done.reduce((s, b) => s + Number(b.final_price ?? b.quoted_price ?? 0), 0),
      isHost: opts.hostEmails.has(email),
      hostListings: stats?.listings ?? 0,
      hostSameDay: stats?.sameDay ?? 0,
      hasLead: !!lead,
      plan: activePlan ? (activePlan.frequency as Plan) : null,
      hadAddon: live.some((b) => (b.addons ?? []).length > 0),
      bedrooms: Number(latestBooking?.bedrooms ?? 0),
      bathrooms: Number(latestBooking?.bathrooms ?? 0),
      usualDays: wkd + wke === 0 ? null : wke > wkd ? "weekend" : "weekday",
      lastMoveClean: moves.filter((d) => d <= today).at(-1) ?? null,
      lastIssue,
      atRisk: issueAge != null && issueAge <= 30,
      happy: done.length >= 3 && (issueAge == null || issueAge > 90),
      heardFrom: sorted.map((b) => b.heard_from).filter(Boolean).at(-1) ?? null,
      nearbyDays: nearbyDays.sort(),
    });
  }
  return out.sort((a, z) => a.name.localeCompare(z.name));
}

export function matches(p: Profile, f: SegmentFilter): boolean {
  if (f.stages?.length && !f.stages.includes(p.stage)) return false;
  if (f.areas?.length && !(p.area && f.areas.includes(p.area))) return false;
  if (f.deep === "yes" && !p.hadDeep) return false;
  if (f.deep === "no" && p.hadDeep) return false;
  if (f.upcoming === "yes" && !p.nextBooking) return false;
  if (f.upcoming === "no" && p.nextBooking) return false;
  if (f.host === "yes" && !p.isHost) return false;
  if (f.host === "no" && p.isHost) return false;
  if (f.minDaysSinceClean != null && (p.daysSinceLastClean == null || p.daysSinceLastClean < f.minDaysSinceClean))
    return false;
  if (f.maxDaysSinceClean != null && (p.daysSinceLastClean == null || p.daysSinceLastClean > f.maxDaysSinceClean))
    return false;
  if (f.minSpend != null && p.spend < f.minSpend) return false;
  if (f.minCleans != null && p.completed < f.minCleans) return false;
  if (f.plans?.length && !(p.plan && f.plans.includes(p.plan))) return false;
  if (f.addons === "yes" && !p.hadAddon) return false;
  if (f.addons === "no" && p.hadAddon) return false;
  if (f.minBedrooms != null && p.bedrooms < f.minBedrooms) return false;
  if (f.minBathrooms != null && p.bathrooms < f.minBathrooms) return false;
  if (f.usual && p.usualDays !== f.usual) return false;
  if (f.mover === "yes" && !p.lastMoveClean) return false;
  if (f.mover === "no" && p.lastMoveClean) return false;
  if (f.deepDueMonths != null) {
    if (p.completed === 0) return false;
    if (p.daysSinceDeep != null && p.daysSinceDeep < f.deepDueMonths * 30.4) return false;
  }
  if (f.nearDay != null && !p.nearbyDays.includes(f.nearDay)) return false;
  if (f.nearDay != null && p.nextBooking) return false; // already booked: nothing to fill
  if (f.happy === "yes" && !p.happy) return false;
  if (f.atRisk === "yes" ? !p.atRisk : p.atRisk) return false;
  if (f.sources?.length && !(p.heardFrom && f.sources.includes(p.heardFrom))) return false;
  if (f.sameDay === "yes" && p.hostSameDay === 0) return false;
  return true;
}

/** Who a marketing email may actually go to: in the segment AND said yes. */
export function recipients(profiles: Profile[], f: SegmentFilter): Profile[] {
  return profiles.filter((p) => p.consent === "yes" && matches(p, f));
}

export const PRESETS: { key: string; label: string; hint: string; filter: SegmentFilter }[] = [
  { key: "all", label: "Everyone who said yes", hint: "every contact that can be emailed", filter: {} },
  { key: "leads", label: "Quoted, never booked", hint: "typed an email into the quote form", filter: { stages: ["lead"] } },
  {
    key: "one_off_back",
    label: "One-offs not back yet",
    hint: "one-off clean 30+ days ago, nothing booked",
    filter: { stages: ["one_off"], minDaysSinceClean: 30, upcoming: "no" },
  },
  { key: "regulars", label: "Regular customers", hint: "on a weekly, fortnightly or 4-weekly plan", filter: { stages: ["regular"] } },
  { key: "lapsed", label: "Stopped their plan", hint: "were regular, nothing booked now", filter: { stages: ["lapsed"], upcoming: "no" } },
  { key: "deep", label: "Had a deep clean", hint: "deep or end-of-tenancy", filter: { deep: "yes" } },
  { key: "hosts", label: "Airbnb hosts", hint: "has a connected calendar", filter: { host: "yes" } },
  { key: "big", label: "Best customers", hint: "3+ completed cleans", filter: { minCleans: 3 } },
  {
    key: "upgrade",
    label: "Frequency upgrade",
    hint: "every-4-weeks or fortnightly regulars",
    filter: { plans: ["four_weekly", "fortnightly"] },
  },
  { key: "addon_upsell", label: "Never had an extra", hint: "regulars who've never added oven, windows…", filter: { stages: ["regular"], addons: "no" } },
  { key: "big_homes", label: "Bigger homes", hint: "3+ bedrooms", filter: { minBedrooms: 3 } },
  { key: "weekday", label: "Weekday bookers", hint: "usually book Mon–Fri", filter: { usual: "weekday" } },
  { key: "weekend", label: "Weekend bookers", hint: "usually book Sat/Sun", filter: { usual: "weekend" } },
  { key: "movers", label: "Movers", hint: "deep clean for moving out or in", filter: { mover: "yes" } },
  {
    key: "deep_due",
    label: "Due a deep clean",
    hint: "regulars, no deep clean in 6+ months",
    filter: { stages: ["regular"], deepDueMonths: 6 },
  },
  { key: "happy", label: "Happy regulars", hint: "3+ cleans, nothing gone wrong in 90 days", filter: { happy: "yes" } },
  { key: "at_risk", label: "Had a problem recently", hint: "no access, cancellation, refund or a higher bill in the last 30 days — check-ins only", filter: { atRisk: "yes" } },
  { key: "busy_hosts", label: "Busy hosts", hint: "hosts with same-day turnovers coming up", filter: { host: "yes", sameDay: "yes" } },
];

/** Parse the segment builder's form (or a stored campaign segment) into a filter. */
export function filterFromForm(get: (k: string) => string | null, getAll: (k: string) => string[]): SegmentFilter {
  const num = (k: string, max = 100_000) => {
    const v = get(k);
    if (v == null || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
  };
  const tri = (k: string) => {
    const v = get(k);
    return v === "yes" || v === "no" ? v : undefined;
  };
  const only = <T extends string>(k: string, ok: readonly T[]) => {
    const v = get(k);
    return ok.includes(v as T) ? (v as T) : undefined;
  };
  const stages = getAll("stage").filter((s): s is Stage => s in STAGE_LABEL);
  const areas = getAll("area").map((a) => a.toUpperCase()).filter((a) => /^[A-Z]{1,2}\d[A-Z\d]?$/.test(a));
  const plans = getAll("plan").filter((s): s is Plan => s in PLAN_LABEL);
  const sources = getAll("source").filter((s) => s in SOURCE_LABEL);
  const nearDay = num("near_day", 6);
  const f: SegmentFilter = {
    stages: stages.length ? stages : undefined,
    areas: areas.length ? areas : undefined,
    deep: tri("deep"),
    upcoming: tri("upcoming"),
    host: tri("host"),
    minDaysSinceClean: num("min_days"),
    maxDaysSinceClean: num("max_days"),
    minSpend: num("min_spend"),
    minCleans: num("min_cleans"),
    plans: plans.length ? plans : undefined,
    addons: tri("addons"),
    minBedrooms: num("min_bedrooms", 20),
    minBathrooms: num("min_bathrooms", 20),
    usual: only("usual", ["weekday", "weekend"] as const),
    mover: tri("mover"),
    deepDueMonths: num("deep_due", 60),
    nearDay: nearDay != null && Number.isInteger(nearDay) ? nearDay : undefined,
    happy: only("happy", ["yes"] as const),
    atRisk: only("at_risk", ["yes"] as const),
    sources: sources.length ? sources : undefined,
    sameDay: only("same_day", ["yes"] as const),
  };
  // Drop undefined keys so stored JSON stays readable.
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as SegmentFilter;
}

/** The same filter as form fields — for carrying a segment into a POST form. */
export function filterToFields(f: SegmentFilter): [string, string][] {
  const out: [string, string][] = [];
  f.stages?.forEach((s) => out.push(["stage", s]));
  f.areas?.forEach((a) => out.push(["area", a]));
  f.plans?.forEach((p) => out.push(["plan", p]));
  f.sources?.forEach((s) => out.push(["source", s]));
  const pairs: [string, unknown][] = [
    ["deep", f.deep],
    ["upcoming", f.upcoming],
    ["host", f.host],
    ["min_days", f.minDaysSinceClean],
    ["max_days", f.maxDaysSinceClean],
    ["min_spend", f.minSpend],
    ["min_cleans", f.minCleans],
    ["addons", f.addons],
    ["min_bedrooms", f.minBedrooms],
    ["min_bathrooms", f.minBathrooms],
    ["usual", f.usual],
    ["mover", f.mover],
    ["deep_due", f.deepDueMonths],
    ["near_day", f.nearDay],
    ["happy", f.happy],
    ["at_risk", f.atRisk],
    ["same_day", f.sameDay],
  ];
  for (const [k, v] of pairs) if (v != null) out.push([k, String(v)]);
  return out;
}

/** "One-off customer · OX4 · 30+ days since last clean" — for lists and confirmations. */
export function describeFilter(f: SegmentFilter): string {
  const parts: string[] = [];
  if (f.atRisk) parts.push("Had a problem recently");
  if (f.stages?.length) parts.push(f.stages.map((s) => STAGE_LABEL[s]).join(" or "));
  if (f.plans?.length) parts.push(`on ${f.plans.map((p) => PLAN_LABEL[p].toLowerCase()).join("/")} plans`);
  if (f.areas?.length) parts.push(f.areas.join("/"));
  if (f.nearDay != null) parts.push(`cleaner nearby on ${WEEKDAY_LABEL[f.nearDay]}s, nothing booked`);
  if (f.deep) parts.push(f.deep === "yes" ? "had a deep clean" : "never had a deep clean");
  if (f.deepDueMonths != null) parts.push(`no deep clean in ${f.deepDueMonths}+ months`);
  if (f.mover) parts.push(f.mover === "yes" ? "movers" : "not movers");
  if (f.upcoming) parts.push(f.upcoming === "yes" ? "has a clean booked" : "nothing booked");
  if (f.host) parts.push(f.host === "yes" ? "Airbnb hosts" : "not Airbnb hosts");
  if (f.sameDay) parts.push("same-day turnovers coming up");
  if (f.addons) parts.push(f.addons === "yes" ? "has had extras" : "never had an extra");
  if (f.minBedrooms != null) parts.push(`${f.minBedrooms}+ bedrooms`);
  if (f.minBathrooms != null) parts.push(`${f.minBathrooms}+ bathrooms`);
  if (f.usual) parts.push(`usually books ${f.usual === "weekday" ? "weekdays" : "weekends"}`);
  if (f.happy) parts.push("happy regulars");
  if (f.sources?.length) parts.push(`heard via ${f.sources.map((s) => SOURCE_LABEL[s]).join(" or ")}`);
  if (f.minDaysSinceClean != null) parts.push(`${f.minDaysSinceClean}+ days since last clean`);
  if (f.maxDaysSinceClean != null) parts.push(`cleaned within ${f.maxDaysSinceClean} days`);
  if (f.minSpend != null) parts.push(`spent £${f.minSpend}+`);
  if (f.minCleans != null) parts.push(`${f.minCleans}+ cleans`);
  return parts.length ? parts.join(" · ") : "Everyone who said yes";
}

/** Fill {first_name} / {name} merge tags. */
export function merge(text: string, p: Pick<Profile, "firstName" | "name">): string {
  return text.replace(/\{first_name\}/g, p.firstName).replace(/\{name\}/g, p.name || p.firstName);
}

/** Blank-line separated paragraphs, as the campaign editor writes them. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
}
