// Scheduling engine — which times a job can actually start, given who works when
// and what is already booked. Pure functions: no DB, no clock of its own. The
// caller passes `now`, so every rule here is assertable (scripts/scheduling-check.ts).
//
// Times are minutes from midnight, local to Europe/London. Days are 0=Sunday..
// 6=Saturday, matching JS getUTCDay(), so the DB and the app agree without a remap.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SchedulableCleaner = {
  id: string;
  name: string;
  worksDays: number[];
  worksFrom: string; // "09:00"
  worksTo: string; // "17:00"
};

/** An existing job occupying part of a day. `cleanerId` null = nobody assigned yet. */
export type BusyBlock = {
  cleanerId: string | null;
  start: number; // minutes from midnight
  end: number;
};

export type Slot = {
  /** "09:30" */
  time: string;
  available: boolean;
  /** How many cleaners could take it — surfaced in admin, not to customers. */
  freeCleaners: number;
};

export type SchedulingConfig = {
  slotMinutes: number;
  leadTimeHours: number;
  maxDaysAhead: number;
};

export const schedulingDefaults: SchedulingConfig = {
  slotMinutes: 30,
  leadTimeHours: 24,
  maxDaysAhead: 60,
};

/* ---------- time helpers ---------- */

/** "09:30" or "09:30:00" to 570. Returns null on anything malformed. */
export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mins = Number(m[2]);
  if (h > 23 || mins > 59) return null;
  return h * 60 + mins;
}

/** 570 to "09:30". */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Half-open overlap: a job ending at 11:00 does not clash with one starting at 11:00. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Weekday of a YYYY-MM-DD date, read as UTC so the server's own zone can't shift it. */
export function weekdayOf(date: string): Weekday {
  return new Date(`${date}T00:00:00Z`).getUTCDay() as Weekday;
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** Whole days between two YYYY-MM-DD dates (b minus a), DST-proof via UTC. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * What the wall clock reads in London at instant `now`. The business thinks in
 * local time and the server may not be in the UK, so every "is that too soon?"
 * comparison goes through here rather than through the server's own zone.
 */
export function londonWallClock(now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  // en-GB reports midnight as 24, not 00.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(hour) * 60 + Number(get("minute")),
  };
}

/* ---------- availability ---------- */

export type DayAvailabilityInput = {
  date: string;
  /** Full job length including extras, in hours. */
  durationHours: number;
  cleaners: SchedulableCleaner[];
  busy: BusyBlock[];
  cfg: SchedulingConfig;
  now: Date;
};

/**
 * Why a whole day is closed, or null if it is open. Kept separate from the slot
 * list so the UI can say *why* instead of showing an empty grid.
 */
export function dayClosedReason(input: Omit<DayAvailabilityInput, "busy">): string | null {
  const { date, cleaners, cfg, now } = input;
  if (!isValidDate(date)) return "That isn't a real date.";

  const wall = londonWallClock(now);
  const daysOut = daysBetween(wall.date, date);
  if (daysOut < 0) return "That date has passed.";
  if (daysOut > cfg.maxDaysAhead) return `We only take bookings ${cfg.maxDaysAhead} days ahead.`;

  if (cleaners.length === 0) return "No cleaners are set up yet.";
  const working = cleaners.filter((c) => c.worksDays.includes(weekdayOf(date)));
  if (working.length === 0) return "We don't work that day.";

  return null;
}

/**
 * Every start time that could be staffed for the whole job.
 *
 * A slot needs one cleaner free for the entire duration — jobs are never split
 * across two people. Unassigned bookings still consume capacity: a `requested`
 * job nobody has been put on yet is work the business has taken on, and pretending
 * otherwise is how a Saturday gets double-sold.
 */
export function daySlots(input: DayAvailabilityInput): Slot[] {
  const { date, durationHours, cleaners, busy, cfg, now } = input;
  if (dayClosedReason(input) !== null) return [];

  const duration = Math.round(durationHours * 60);
  if (duration <= 0) return [];

  const weekday = weekdayOf(date);
  const shifts = cleaners
    .filter((c) => c.worksDays.includes(weekday))
    .map((c) => ({
      id: c.id,
      from: toMinutes(c.worksFrom) ?? 0,
      to: toMinutes(c.worksTo) ?? 0,
    }))
    .filter((s) => s.to > s.from);

  if (shifts.length === 0) return [];

  const openFrom = Math.min(...shifts.map((s) => s.from));
  const openTo = Math.max(...shifts.map((s) => s.to));

  // Nothing may start before the notice period is up. Both sides of the
  // comparison are minutes from midnight *today*, so a future date simply
  // carries a whole-day offset.
  const wall = londonWallClock(now);
  const dayOffset = daysBetween(wall.date, date) * 1440;
  const noticeCutoff = wall.minutes + cfg.leadTimeHours * 60;

  const assigned = busy.filter((b) => b.cleanerId !== null);
  const unassigned = busy.filter((b) => b.cleanerId === null);

  const slots: Slot[] = [];
  // Round the first candidate up to the slot grid so the times read cleanly.
  const first = Math.ceil(openFrom / cfg.slotMinutes) * cfg.slotMinutes;

  for (let start = first; start + duration <= openTo; start += cfg.slotMinutes) {
    const end = start + duration;

    if (dayOffset + start < noticeCutoff) {
      slots.push({ time: toHHMM(start), available: false, freeCleaners: 0 });
      continue;
    }

    const freeShifts = shifts.filter((s) => {
      if (start < s.from || end > s.to) return false;
      return !assigned.some((b) => b.cleanerId === s.id && overlaps(start, end, b.start, b.end));
    });

    // Each unassigned job overlapping this window is already eating one of them.
    const claimed = unassigned.filter((b) => overlaps(start, end, b.start, b.end)).length;
    const free = Math.max(0, freeShifts.length - claimed);

    slots.push({ time: toHHMM(start), available: free > 0, freeCleaners: free });
  }

  return slots;
}

/** The single question the booking endpoint asks before it writes a row. */
export function isSlotBookable(input: DayAvailabilityInput & { time: string }): boolean {
  const start = toMinutes(input.time);
  if (start === null) return false;
  const wanted = toHHMM(start);
  return daySlots(input).some((s) => s.time === wanted && s.available);
}

/**
 * Whether putting `cleanerId` on a job at this time would clash with their day.
 * Returns the clashing block, or null. The admin is allowed to override this —
 * the owner may know something the calendar doesn't — so it warns, never blocks.
 */
export function assignmentConflict(opts: {
  cleanerId: string;
  start: number;
  end: number;
  busy: BusyBlock[];
}): BusyBlock | null {
  return (
    opts.busy.find(
      (b) => b.cleanerId === opts.cleanerId && overlaps(opts.start, opts.end, b.start, b.end)
    ) ?? null
  );
}

/** Booking row to busy block. Rows with no start_time occupy nothing, by design. */
export function busyFromBooking(b: {
  cleaner_id: string | null;
  start_time: string | null;
  hours: number;
}): BusyBlock | null {
  if (!b.start_time) return null;
  const start = toMinutes(b.start_time);
  if (start === null) return null;
  return { cleanerId: b.cleaner_id, start, end: start + Math.round(Number(b.hours) * 60) };
}

/** "09:30" to "9:30am", for customer-facing copy. */
export function formatTime(hhmm: string): string {
  const m = toMinutes(hhmm);
  if (m === null) return hhmm;
  const h24 = Math.floor(m / 60);
  const mins = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 || h24 === 24 ? "am" : "pm";
  return `${h12}${mins ? `:${String(mins).padStart(2, "0")}` : ""}${suffix}`;
}

/** "09:30" plus 3.5h reads as "9:30am to 1pm". */
export function formatTimeRange(hhmm: string, hours: number): string {
  const start = toMinutes(hhmm);
  if (start === null) return hhmm;
  return `${formatTime(hhmm)}–${formatTime(toHHMM(start + Math.round(hours * 60)))}`;
}
