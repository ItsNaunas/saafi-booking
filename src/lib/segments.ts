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
  cancelled: "Cancelled only",
  new: "First clean booked",
  regular: "Active regular",
  lapsed: "Lapsed regular",
  one_off: "One-off customer",
};

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
  preferred_date: string;
  quoted_price: number | string;
  final_price: number | string | null;
  created_at: string;
  marketing_ok?: boolean | null;
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
  spend: number;
  isHost: boolean;
  hasLead: boolean;
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
};

const DONE = new Set(["completed", "paid"]);
const LIVE = new Set(["requested", "confirmed"]);

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

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function buildProfiles(opts: {
  bookings: SegBooking[];
  leads: SegLead[];
  suppressed: Set<string>;
  hostEmails: Set<string>;
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
    const activeRecurring = live.some(
      (b) => b.frequency !== "one_off" && b.recurring_active && LIVE.has(b.status) && b.preferred_date >= today
    );

    let stage: Stage;
    if (sorted.length === 0) stage = "lead";
    else if (live.length === 0) stage = "cancelled";
    else if (activeRecurring) stage = "regular";
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

    const latestBooking = sorted.at(-1);
    const name = (latestBooking?.customer_name ?? lead?.name ?? "").trim();
    out.push({
      email,
      name,
      firstName: name.split(/\s+/)[0] || "there",
      stage,
      consent,
      area: outwardCode(latestBooking?.postcode ?? lead?.postcode),
      bookings: live.length,
      completed: done.length,
      lastClean,
      daysSinceLastClean: lastClean ? daysBetween(lastClean, today) : null,
      nextBooking: upcoming[0] ?? null,
      hadDeep: live.some((b) => b.service_type === "deep"),
      spend: done.reduce((s, b) => s + Number(b.final_price ?? b.quoted_price ?? 0), 0),
      isHost: opts.hostEmails.has(email),
      hasLead: !!lead,
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
  { key: "regulars", label: "Active regulars", hint: "on a live weekly/fortnightly plan", filter: { stages: ["regular"] } },
  { key: "lapsed", label: "Lapsed regulars", hint: "plan stopped, nothing booked", filter: { stages: ["lapsed"], upcoming: "no" } },
  { key: "deep", label: "Had a deep clean", hint: "deep or end-of-tenancy", filter: { deep: "yes" } },
  { key: "hosts", label: "Airbnb hosts", hint: "has a connected calendar", filter: { host: "yes" } },
  { key: "big", label: "Best customers", hint: "3+ completed cleans", filter: { minCleans: 3 } },
];

/** Parse the segment builder's form (or a stored campaign segment) into a filter. */
export function filterFromForm(get: (k: string) => string | null, getAll: (k: string) => string[]): SegmentFilter {
  const num = (k: string) => {
    const v = get(k);
    if (v == null || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const tri = (k: string) => {
    const v = get(k);
    return v === "yes" || v === "no" ? v : undefined;
  };
  const stages = getAll("stage").filter((s): s is Stage => s in STAGE_LABEL);
  const areas = getAll("area").map((a) => a.toUpperCase()).filter((a) => /^[A-Z]{1,2}\d[A-Z\d]?$/.test(a));
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
  };
  // Drop undefined keys so stored JSON stays readable.
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as SegmentFilter;
}

/** "One-off customer · OX4 · 30+ days since last clean" — for lists and confirmations. */
export function describeFilter(f: SegmentFilter): string {
  const parts: string[] = [];
  if (f.stages?.length) parts.push(f.stages.map((s) => STAGE_LABEL[s]).join(" or "));
  if (f.areas?.length) parts.push(f.areas.join("/"));
  if (f.deep) parts.push(f.deep === "yes" ? "had a deep clean" : "never had a deep clean");
  if (f.upcoming) parts.push(f.upcoming === "yes" ? "has a clean booked" : "nothing booked");
  if (f.host) parts.push(f.host === "yes" ? "Airbnb hosts" : "not Airbnb hosts");
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
