// Assertion harness for the Airbnb calendar import: `npx tsx scripts/ical-import-check.ts`
//
// Every case passes an explicit `today`, so these never go stale.
import { parseIcal, planSync, isBlock, linkSuggestionsToBookings, alreadyBooked, type SuggestionRow } from "../src/lib/icalImport";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// Shaped like a real Airbnb export: CRLF, all-day dates, a folded DESCRIPTION.
const AIRBNB = [
  "BEGIN:VCALENDAR",
  "PRODID;X-RICAL-TZSOURCE=TZINFO:-//Airbnb Inc//Hosting Calendar 1.0//EN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20261018",
  "DTSTART;VALUE=DATE:20261015",
  "UID:1418fb94e984-aaa@airbnb.com",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC\\nPhone Number (Last 4 Digits): 1234",
  " 5678",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20261022",
  "DTSTART;VALUE=DATE:20261018",
  "UID:1418fb94e984-bbb@airbnb.com",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20261101",
  "DTSTART;VALUE=DATE:20261025",
  "UID:1418fb94e984-ccc@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

/* ---------- parsing ---------- */

const ev = parseIcal(AIRBNB)!;
check("parses three stays", ev.length, 3);
check("first stay dates", [ev[0].start, ev[0].end], ["2026-10-15", "2026-10-18"]);
check("summary read", ev[0].summary, "Reserved");
check("host block detected", isBlock(ev[2].summary), true);
check("guest is not a block", isBlock(ev[0].summary), false);
check("HTML page is not a calendar", parseIcal("<html>Log in</html>"), null);
check("empty calendar is a calendar", parseIcal("BEGIN:VCALENDAR\r\nEND:VCALENDAR"), []);
check(
  "UTC date-time near midnight lands on the London date (BST)",
  parseIcal("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART:20261014T233000Z\nDTEND:20261017T100000Z\nEND:VEVENT\nEND:VCALENDAR")![0].start,
  "2026-10-15"
);
check(
  "all-day event without DTEND lasts one day",
  parseIcal("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:y\nDTSTART;VALUE=DATE:20261020\nEND:VEVENT\nEND:VCALENDAR")![0].end,
  "2026-10-21"
);
check(
  "event with no UID is skipped",
  parseIcal("BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261020\nEND:VEVENT\nEND:VCALENDAR")!.length,
  0
);

/* ---------- planning ---------- */

const NOW = "2026-10-12T09:00:00.000Z";
const TODAY = "2026-10-12";

function row(over: Partial<SuggestionRow>): SuggestionRow {
  return {
    id: "r1",
    feed_id: "f1",
    uid: "1418fb94e984-aaa@airbnb.com",
    summary: "Reserved",
    checkin_date: "2026-10-15",
    checkout_date: "2026-10-18",
    next_checkin_date: "2026-10-18",
    status: "suggested",
    booking_id: null,
    changed_at: null,
    change_note: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}

const fresh = planSync("f1", ev, [], TODAY, NOW);
check("first sync suggests every upcoming checkout", fresh.inserts.map((i) => i.checkout_date), [
  "2026-10-18",
  "2026-10-22",
  "2026-11-01",
]);
check("same-day turnover: next check-in is the checkout day", fresh.inserts[0].next_checkin_date, "2026-10-18");
check("next check-in after a gap", fresh.inserts[1].next_checkin_date, "2026-10-25");
check("last stay has no next check-in", fresh.inserts[2].next_checkin_date, null);

check(
  "past checkouts are not suggested",
  planSync("f1", ev, [], "2026-10-20", NOW).inserts.map((i) => i.checkout_date),
  ["2026-10-22", "2026-11-01"]
);
check("beyond the horizon is not suggested", planSync("f1", ev, [], TODAY, NOW, 7).inserts.length, 1);

const steady = planSync("f1", ev.slice(0, 1), [row({ next_checkin_date: null })], TODAY, NOW);
check("an unchanged stay changes nothing", [steady.inserts.length, steady.updates.length], [0, 0]);

const movedSuggested = planSync("f1", [{ ...ev[0], end: "2026-10-19" }], [row({})], TODAY, NOW);
check("a suggested stay that moved follows silently", movedSuggested.updates[0].fields.checkout_date, "2026-10-19");
check("...without a flag", movedSuggested.updates[0].fields.changed_at, undefined);

const movedConfirmed = planSync(
  "f1",
  [{ ...ev[0], end: "2026-10-19" }],
  [row({ status: "confirmed", booking_id: "b1" })],
  TODAY,
  NOW
);
check("a confirmed stay that moved is flagged", movedConfirmed.updates[0].fields.changed_at, NOW);
check("...and keeps its status", movedConfirmed.updates[0].fields.status, undefined);

const goneSuggested = planSync("f1", [], [row({})], TODAY, NOW);
check("a suggested stay that vanished is gone", goneSuggested.updates[0].fields.status, "gone");

const goneConfirmed = planSync("f1", [], [row({ status: "confirmed", booking_id: "b1" })], TODAY, NOW);
check("a confirmed stay that vanished is flagged, not cancelled", goneConfirmed.updates[0].fields.status, undefined);
check("...with a note", typeof goneConfirmed.updates[0].fields.change_note, "string");

const goneAgain = planSync(
  "f1",
  [],
  [row({ status: "confirmed", booking_id: "b1", change_note: goneConfirmed.updates[0].fields.change_note! })],
  TODAY,
  NOW
);
check("the same vanish never re-flags after 'Checked'", goneAgain.updates.length, 0);

check(
  "a past stay dropping off the feed is not a cancellation",
  planSync("f1", [], [row({ status: "confirmed", checkout_date: "2026-10-01" })], TODAY, NOW).updates.length,
  0
);
check(
  "a dismissed stay stays dismissed when it vanishes",
  planSync("f1", [], [row({ status: "dismissed" })], TODAY, NOW).updates.length,
  0
);
check(
  "a gone stay that reappears is suggested again",
  planSync("f1", ev.slice(0, 1), [row({ status: "gone" })], TODAY, NOW).updates[0].fields.status,
  "suggested"
);

/* ---------- duplicate guard ---------- */

const bookingsAt = [
  { id: "b1", postcode: "OX43DE", preferred_date: "2026-10-18", status: "confirmed" },
  { id: "b2", postcode: "OX4 3DE", preferred_date: "2026-10-22", status: "cancelled" },
  { id: "b3", postcode: "OX12EZ", preferred_date: "2026-11-01", status: "confirmed" },
];
const sugg = [
  row({ id: "s1", checkout_date: "2026-10-18" }),
  row({ id: "s2", uid: "u2", checkout_date: "2026-10-22" }),
  row({ id: "s3", uid: "u3", checkout_date: "2026-11-01" }),
];
check("links a suggestion already booked at that postcode", linkSuggestionsToBookings(sugg, bookingsAt, "ox4 3de"), [{ id: "s1", bookingId: "b1" }]);
check("a cancelled booking doesn't count", linkSuggestionsToBookings([sugg[1]], bookingsAt, "OX43DE"), []);
check("another address that day doesn't count", linkSuggestionsToBookings([sugg[2]], bookingsAt, "OX43DE"), []);
check("no postcode on the calendar = no guessing", linkSuggestionsToBookings(sugg, bookingsAt, null), []);
check(
  "a booking already linked isn't reused",
  linkSuggestionsToBookings([row({ id: "s0", status: "confirmed", booking_id: "b1" }), sugg[0]], bookingsAt, "OX43DE"),
  []
);
check("alreadyBooked: same postcode + day", alreadyBooked("OX4 3DE", "2026-10-18", bookingsAt), true);
check("alreadyBooked: other day", alreadyBooked("OX4 3DE", "2026-10-19", bookingsAt), false);

if (failed) {
  console.error(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll iCal import checks passed.");
