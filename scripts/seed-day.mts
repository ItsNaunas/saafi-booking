/**
 * Set up a realistic day's work so the cleaner flow can be tested by hand.
 *
 *   npx tsx scripts/seed-day.mts           # create today's jobs, print the link
 *   npx tsx scripts/seed-day.mts --clear   # remove everything it created
 *   npx tsx scripts/seed-day.mts --cleaner "Amina"
 *
 * Why this exists: the cleaner page only shows jobs that are `confirmed` and
 * dated today, and the public form can't produce one because of the 24-hour
 * notice period. Testing the day meant filling in /admin/new by hand, assigning a
 * cleaner, and doing it again for the next attempt — because finishing a job uses
 * it up. This makes the day repeatable.
 *
 * IT WRITES TO THE LIVE DATABASE. Every row it makes is named "ZZ Seed" and is
 * removed by --clear, which lists what it will delete and deletes by id.
 *
 * Tip once you're in: you don't have to wait out the clock. The finish form takes
 * a typed number of hours and prefers it over the timer, so a 3-hour job finished
 * with 4.25 typed in is a 1.25-hour overrun the adjustment engine treats as real.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line
    .slice(i + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

const SUPA = process.env.SUPABASE_URL!;
const SKEY = process.env.SUPABASE_SECRET_KEY!;
const SITE = "https://saaficleaningservice.com";
const MARKER = "ZZ Seed";

type Row = Record<string, string | number | boolean | null>;

async function db(path: string, init?: RequestInit, tries = 5): Promise<Row[]> {
  for (let n = 1; ; n++) {
    try {
      const r = await fetch(`${SUPA}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: SKEY,
          Authorization: `Bearer ${SKEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          ...(init?.headers ?? {}),
        },
      });
      const t = await r.text();
      return t ? JSON.parse(t) : [];
    } catch (e) {
      if (n >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * n));
    }
  }
}

const args = process.argv.slice(2);
const wantedCleaner = args.includes("--cleaner") ? args[args.indexOf("--cleaner") + 1] : null;

/* ---------- teardown ---------- */

if (args.includes("--clear")) {
  const rows = await db(
    `bookings?customer_name=like.*${encodeURIComponent(MARKER)}*&select=id,reference,customer_name`
  );
  if (!rows.length) {
    console.log("nothing to clear");
    process.exit(0);
  }
  console.log(`removing ${rows.length}:`);
  for (const r of rows) console.log(`  ${r.reference}  ${r.customer_name}`);

  for (const r of rows) {
    await db(`booking_adjustments?booking_id=eq.${r.id}`, { method: "DELETE" });
    await db(`bookings?id=eq.${r.id}`, { method: "DELETE" });
  }
  const custs = await db(`customers?email=like.*@seed.saafi*&select=id`);
  for (const c of custs ?? []) await db(`customers?id=eq.${c.id}`, { method: "DELETE" });

  const left = await db(`bookings?customer_name=like.*${encodeURIComponent(MARKER)}*&select=id`);
  console.log(`\ndone — ${left.length} left`);
  process.exit(0);
}

/* ---------- setup ---------- */

const cleaners = await db("cleaners?select=id,name,token&active=eq.true&order=name.asc");
if (!cleaners.length) {
  console.log("no active cleaners — add one in /admin/cleaners first");
  process.exit(1);
}
const cleaner = wantedCleaner
  ? cleaners.find((c) => String(c.name).toLowerCase().includes(wantedCleaner.toLowerCase()))
  : cleaners[0];
if (!cleaner) {
  console.log(`no active cleaner matching "${wantedCleaner}". Available:`);
  cleaners.forEach((c) => console.log(`  ${c.name}`));
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

// A believable morning-to-afternoon run, with a mix worth testing against: one
// that should run long, one short, one ordinary.
const JOBS = [
  { time: "09:00", hours: 3, price: 72, who: "Priya Raman", where: "12 Cannon Road", pc: "IG1 2LT", note: "Key safe by the bins, code on arrival." },
  { time: "12:30", hours: 2, price: 48, who: "Tom Whitfield", where: "4 Elmhurst Court", pc: "E14 9GX", note: "Cat stays indoors — please keep the back door shut." },
  { time: "15:00", hours: 2.5, price: 60, who: "Dele Adeyemi", where: "88 Fairlop Way", pc: "IG6 2JR", note: "Parking is tight after 3pm; use the visitor bay." },
];

console.log(`seeding ${JOBS.length} jobs for ${cleaner.name} on ${today}\n`);

for (const [i, j] of JOBS.entries()) {
  const reference = `SAAFI-SEED${Date.now().toString(36).toUpperCase().slice(-4)}${i}`;
  const [row] = await db("bookings", {
    method: "POST",
    body: JSON.stringify({
      reference,
      customer_name: `${j.who} (${MARKER})`,
      customer_email: `seed${i}@seed.saafi`,
      customer_phone: "07700900000",
      address_line: j.where,
      postcode: j.pc,
      bedrooms: 2,
      bathrooms: 1,
      dining_rooms: 0,
      living_rooms: 1,
      hours: j.hours,
      quoted_hours: j.hours,
      customer_provides_products: true,
      quoted_price: j.price,
      preferred_date: today,
      start_time: j.time,
      frequency: "one_off",
      cleaner_id: cleaner.id,
      notes: j.note,
      status: "confirmed",
    }),
  });
  console.log(`  ${j.time}  ${j.hours}h  £${j.price}  ${j.who}  ${row.reference}`);
}

console.log(`\nCleaner link:\n  ${SITE}/c/${cleaner.token}`);
console.log(`\nThings worth trying:`);
console.log(`  - finish the 09:00 job typing 4.25 hours -> "More rooms than booked"`);
console.log(`    should go PENDING and wait for you to approve it in admin`);
console.log(`  - finish the 12:30 job typing 2 hours -> nothing should change`);
console.log(`  - finish the 15:00 job typing 1 hour -> should reprice DOWN on its own`);
console.log(`\nClear up with:  npx tsx scripts/seed-day.mts --clear`);
