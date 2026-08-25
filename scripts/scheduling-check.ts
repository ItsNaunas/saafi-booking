// Assertion harness for the scheduling engine: `npx tsx scripts/scheduling-check.ts`
//
// Every case passes an explicit `now`, so these never go stale or flake at
// midnight. 2026-08-24 is a Monday; 2026-08-29 a Saturday; 2026-08-30 a Sunday.
import {
  toMinutes,
  toHHMM,
  overlaps,
  weekdayOf,
  isValidDate,
  daysBetween,
  londonWallClock,
  daySlots,
  dayClosedReason,
  isSlotBookable,
  assignmentConflict,
  busyFromBooking,
  formatTime,
  formatTimeRange,
  fitForJob,
  schedulingDefaults,
  type SchedulableCleaner,
  type BusyBlock,
} from "../src/lib/scheduling";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${actual}, expected ${expected}`);
}

/* ---------- time helpers ---------- */

check("toMinutes 09:30", toMinutes("09:30"), 570);
check("toMinutes accepts postgres time", toMinutes("09:30:00"), 570);
check("toMinutes rejects rubbish", toMinutes("half nine"), null);
check("toMinutes rejects 25:00", toMinutes("25:00"), null);
check("toHHMM pads", toHHMM(570), "09:30");
check("toHHMM midnight", toHHMM(0), "00:00");
check("round trip", toHHMM(toMinutes("14:45")!), "14:45");

check("touching jobs do not overlap", overlaps(540, 660, 660, 720), false);
check("nested job overlaps", overlaps(540, 720, 600, 660), true);
check("partial overlap", overlaps(540, 660, 600, 780), true);

check("2026-08-24 is a Monday", weekdayOf("2026-08-24"), 1);
check("2026-08-30 is a Sunday", weekdayOf("2026-08-30"), 0);
check("valid date", isValidDate("2026-08-24"), true);
check("rejects 31 February", isValidDate("2026-02-31"), false);
check("rejects short form", isValidDate("24/08/2026"), false);
check("daysBetween spans a month end", daysBetween("2026-08-30", "2026-09-02"), 3);
check("daysBetween is signed", daysBetween("2026-09-02", "2026-08-30"), -3);

// BST: 10:00 UTC in August reads as 11:00 in London.
check(
  "london wall clock applies BST",
  londonWallClock(new Date("2026-08-24T10:00:00Z")).minutes,
  11 * 60
);
check(
  "london wall clock in GMT",
  londonWallClock(new Date("2026-01-15T10:00:00Z")).minutes,
  10 * 60
);
check(
  "london wall clock rolls the date",
  londonWallClock(new Date("2026-08-24T23:30:00Z")).date,
  "2026-08-25"
);

/* ---------- availability ---------- */

const weekdayCleaner: SchedulableCleaner = {
  id: "c1",
  name: "Amal",
  worksDays: [1, 2, 3, 4, 5],
  worksFrom: "09:00",
  worksTo: "17:00",
};
const secondCleaner: SchedulableCleaner = { ...weekdayCleaner, id: "c2", name: "Bea" };

const cfg = schedulingDefaults; // 30m slots, 24h notice, 60 days ahead
const now = new Date("2026-08-24T08:00:00Z"); // Mon 09:00 London
const base = { cleaners: [weekdayCleaner], busy: [] as BusyBlock[], cfg, now };

// Wednesday is clear of the notice period entirely.
const wed = { ...base, date: "2026-08-26", durationHours: 3 };

check("open day has no closed reason", dayClosedReason(wed), null);
check("first slot is 09:00", daySlots(wed)[0]?.time, "09:00");
check("3h job last start is 14:00", daySlots(wed).at(-1)?.time, "14:00");
check("3h job on a 9-5 gives 11 slots", daySlots(wed).length, 11);
check("all free when nothing booked", daySlots(wed).every((s) => s.available), true);

check(
  "closed on Saturday",
  dayClosedReason({ ...base, date: "2026-08-29", durationHours: 3 }),
  "We don't work that day."
);
check("no slots on a closed day", daySlots({ ...base, date: "2026-08-29", durationHours: 3 }).length, 0);
check(
  "past dates are closed",
  dayClosedReason({ ...base, date: "2026-08-20", durationHours: 3 }),
  "That date has passed."
);
check(
  "beyond the window is closed",
  dayClosedReason({ ...base, date: "2026-12-25", durationHours: 3 }),
  "We only take bookings 60 days ahead."
);
check(
  "no cleaners means closed",
  dayClosedReason({ ...base, cleaners: [], date: "2026-08-26", durationHours: 3 }),
  "No cleaners are set up yet."
);

// A job longer than the working day can never be placed.
check("8h job does not fit a 9-5 with 30m grid", daySlots({ ...wed, durationHours: 9 }).length, 0);
check("exactly 8h fits once", daySlots({ ...wed, durationHours: 8 }).length, 1);

/* ---------- notice period ---------- */

// It is Monday 09:00 London and notice is 24h, so Tuesday 09:00 is exactly the
// cutoff — 24 hours' notice means 24 hours is enough.
const tue = { ...base, date: "2026-08-25", durationHours: 2 };
check(
  "Tuesday 09:00 is exactly 24h out and allowed",
  daySlots(tue).find((s) => s.time === "09:00")?.available,
  true
);
// Half an hour later the same slot has fallen inside the notice period.
const tueLate = { ...tue, now: new Date("2026-08-24T08:30:00Z") };
check(
  "30 minutes later that slot is too soon",
  daySlots(tueLate).find((s) => s.time === "09:00")?.available,
  false
);
check(
  "but 09:30 still clears it",
  daySlots(tueLate).find((s) => s.time === "09:30")?.available,
  true
);
check("same-day is entirely unavailable", daySlots({ ...base, date: "2026-08-24", durationHours: 2 }).every((s) => !s.available), true);

/* ---------- capacity ---------- */

const busyMorning: BusyBlock[] = [{ cleanerId: "c1", start: 540, end: 720 }]; // 09:00-12:00

check(
  "the one cleaner being busy closes the morning",
  daySlots({ ...wed, busy: busyMorning }).find((s) => s.time === "10:00")?.available,
  false
);
check(
  "afternoon still open",
  daySlots({ ...wed, busy: busyMorning }).find((s) => s.time === "12:00")?.available,
  true
);
check(
  "a second cleaner reopens the morning",
  daySlots({ ...wed, cleaners: [weekdayCleaner, secondCleaner], busy: busyMorning }).find(
    (s) => s.time === "10:00"
  )?.available,
  true
);
check(
  "two cleaners free reports 2",
  daySlots({ ...wed, cleaners: [weekdayCleaner, secondCleaner] }).find((s) => s.time === "13:00")
    ?.freeCleaners,
  2
);

// The important one: a requested job with nobody assigned still eats capacity.
const unassigned: BusyBlock[] = [{ cleanerId: null, start: 540, end: 720 }];
check(
  "an unassigned booking consumes a cleaner",
  daySlots({ ...wed, busy: unassigned }).find((s) => s.time === "10:00")?.available,
  false
);
check(
  "unassigned still leaves the second cleaner free",
  daySlots({ ...wed, cleaners: [weekdayCleaner, secondCleaner], busy: unassigned }).find(
    (s) => s.time === "10:00"
  )?.freeCleaners,
  1
);
check(
  "two unassigned jobs use up both cleaners",
  daySlots({
    ...wed,
    cleaners: [weekdayCleaner, secondCleaner],
    busy: [...unassigned, { cleanerId: null, start: 540, end: 720 }],
  }).find((s) => s.time === "10:00")?.available,
  false
);

/* ---------- the server-side gate ---------- */

check("a real free slot is bookable", isSlotBookable({ ...wed, time: "13:00" }), true);
check("an off-grid time is not bookable", isSlotBookable({ ...wed, time: "13:07" }), false);
check("a taken slot is not bookable", isSlotBookable({ ...wed, busy: busyMorning, time: "10:00" }), false);
check("a slot on a closed day is not bookable", isSlotBookable({ ...base, date: "2026-08-29", durationHours: 3, time: "10:00" }), false);
check("after hours is not bookable", isSlotBookable({ ...wed, time: "16:00" }), false);
check("malformed time is not bookable", isSlotBookable({ ...wed, time: "elevenish" }), false);

/* ---------- assignment conflicts ---------- */

check(
  "clash found",
  assignmentConflict({ cleanerId: "c1", start: 600, end: 720, busy: busyMorning })?.start,
  540
);
check(
  "no clash for a different cleaner",
  assignmentConflict({ cleanerId: "c2", start: 600, end: 720, busy: busyMorning }),
  null
);
check(
  "back-to-back is not a clash",
  assignmentConflict({ cleanerId: "c1", start: 720, end: 840, busy: busyMorning }),
  null
);

check(
  "busyFromBooking reads a postgres time",
  busyFromBooking({ cleaner_id: "c1", start_time: "09:00:00", hours: 3 })?.end,
  720
);
check(
  "a booking with no time occupies nothing",
  busyFromBooking({ cleaner_id: "c1", start_time: null, hours: 3 }),
  null
);

/* ---------- display ---------- */

check("formatTime midday", formatTime("12:00"), "12pm");
check("formatTime midnight", formatTime("00:00"), "12am");
check("formatTime drops :00", formatTime("09:00"), "9am");
check("formatTime keeps minutes", formatTime("09:30"), "9:30am");
check("formatTimeRange", formatTimeRange("09:30", 3.5), "9:30am–1pm");

/* ---------- who can take this job ---------- */

const wedDate = "2026-08-26";
const fit = (cleaner: SchedulableCleaner, busy: BusyBlock[] = []) =>
  fitForJob({ date: wedDate, start: 600, end: 780, cleaner, busy }); // 10:00-13:00

check("a free weekday cleaner fits", fit(weekdayCleaner), "free");
check(
  "a cleaner who does not work that day is off",
  fitForJob({ date: "2026-08-29", start: 600, end: 780, cleaner: weekdayCleaner, busy: [] }),
  "off"
);
check(
  "a job running past their hours is off",
  fitForJob({ date: wedDate, start: 960, end: 1140, cleaner: weekdayCleaner, busy: [] }),
  "off"
);
check(
  "an overlapping job makes them busy",
  fit(weekdayCleaner, [{ cleanerId: "c1", start: 660, end: 720 }]),
  "busy"
);
check(
  "somebody else's job does not",
  fit(weekdayCleaner, [{ cleanerId: "c2", start: 660, end: 720 }]),
  "free"
);
check(
  "back-to-back is still free",
  fit(weekdayCleaner, [{ cleanerId: "c1", start: 780, end: 900 }]),
  "free"
);

if (failed) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll scheduling checks passed.");
