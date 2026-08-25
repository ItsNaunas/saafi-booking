/**
 * End-to-end check: `npx tsx scripts/e2e-check.mts` (dev server must be running).
 *
 * Drives one booking the whole way through the real endpoints — availability,
 * POST /api/bookings, the database, a Stripe payment link, the webhook route,
 * and the paid status — then deletes everything it created.
 *
 * IT WRITES TO THE LIVE DATABASE. One booking, one customer row, one Stripe
 * payment link, all removed in the finally block whether or not the run passes.
 * If it ever dies hard, look for a booking named "ZZ Test" and a customer on
 * @example.invalid and delete them by hand.
 *
 * Stripe stays in whichever mode STRIPE_SECRET_KEY points at — a sandbox today,
 * so no real money is involved. The one leg this cannot cover is a human typing
 * a card into Stripe's hosted page; everything either side of that is exercised.
 */
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line
    .slice(i + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

const { saveBookingPaymentLink } = await import("../src/lib/supabaseAdmin");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SUPA = process.env.SUPABASE_URL!;
const SKEY = process.env.SUPABASE_SECRET_KEY!;
const STRIPE = process.env.STRIPE_SECRET_KEY!;
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET!;

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = "") {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

/** One dropped connection must never decide whether cleanup runs. */
async function retry<T>(label: string, fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await fn();
    } catch (e) {
      if (n >= tries) throw e;
      console.log(`  (${label}: retry ${n}/${tries - 1})`);
      await new Promise((r) => setTimeout(r, 2000 * n));
    }
  }
}

const db = async (path: string, init?: RequestInit) =>
  retry(`db ${path.split("?")[0]}`, async () => {
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
  return t ? JSON.parse(t) : null;
});

const stripe = async (path: string, body?: Record<string, string>) =>
  retry(`stripe ${path}`, async () => {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${STRIPE}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  return r.json();
});

let bookingId = "";
let clashBookingId = "";
let customerId = "";
let linkId = "";

try {
  /* ---------- 1. a real free slot ---------- */
  const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const avail = await (await fetch(`${BASE}/api/availability?date=${date}&hours=3`)).json();
  const slot = (avail.slots ?? []).find((s: { available: boolean }) => s.available);
  check("availability returned a bookable slot", Boolean(slot), `${date} ${slot?.time ?? avail.closed}`);
  if (!slot) throw new Error("no slot to book — the date landed on a day nobody works");

  /* ---------- 2. book it through the real endpoint ---------- */
  const res = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postcode: "IG1 1BA",
      rooms: { bedrooms: 2, bathrooms: 1, diningRooms: 0, livingRooms: 1 },
      hours: 3,
      customerProvidesProducts: true,
      addons: [],
      frequency: "one_off",
      name: "ZZ Test — automated e2e",
      email: "zz-test-e2e@example.invalid",
      phone: "07000000000",
      addressLine: "1 Test Street",
      preferredDate: date,
      startTime: slot.time,
      notes: "Automated end-to-end test. Safe to delete.",
    }),
  });
  const created = await res.json();
  check("POST /api/bookings accepted it", res.ok && created.ok, created.reference ?? created.error);
  if (!created.ok) throw new Error("booking rejected");

  /* ---------- 3. it landed correctly ---------- */
  const [row] = await db(`bookings?reference=eq.${created.reference}&select=*`);
  bookingId = row.id;
  check("row exists in the live table", Boolean(row));
  check("start_time was stored", row.start_time?.startsWith(slot.time), `${row.start_time}`);
  check("status is requested", row.status === "requested");
  check("price recomputed server-side", Number(row.quoted_price) === 72, `£${row.quoted_price}`);

  const [cust] = await db(`customers?email=eq.zz-test-e2e@example.invalid&select=id`);
  customerId = cust?.id ?? "";
  check("db trigger auto-created the customer", Boolean(customerId));

  /* ---------- 4. a bad slot is refused ---------- */
  const clash = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postcode: "IG1 1BA",
      rooms: { bedrooms: 2, bathrooms: 1, diningRooms: 0, livingRooms: 1 },
      hours: 3,
      customerProvidesProducts: true,
      addons: [],
      frequency: "one_off",
      name: "ZZ Test — off-grid time",
      email: "zz-test-e2e@example.invalid",
      phone: "07000000000",
      addressLine: "1 Test Street",
      preferredDate: date,
      startTime: "03:17",
      notes: "should be refused",
    }),
  });
  // Two acceptable outcomes: refused outright (409), or — if the availability
  // lookup itself failed — taken as UNSCHEDULED. What must never happen is the
  // bad time being stored as though it had been checked.
  const clashBody = await clash.json().catch(() => ({}) as { reference?: string });
  if (clashBody.reference) {
    const [bad] = await db(`bookings?reference=eq.${clashBody.reference}&select=id,start_time`);
    clashBookingId = bad?.id ?? "";
    check(
      "an unbookable time is never stored as booked",
      bad?.start_time === null,
      `accepted unscheduled (availability lookup degraded), start_time=${bad?.start_time}`
    );
  } else {
    check("a time outside working hours is refused", clash.status === 409, `HTTP ${clash.status}`);
  }

  /* ---------- 5. raise a payment link, as the admin action does ---------- */
  const price = await stripe("prices", {
    currency: "gbp",
    unit_amount: String(Math.round(Number(row.quoted_price) * 100)),
    "product_data[name]": `Clean on ${row.preferred_date} — ${row.reference}`,
  });
  const link = await stripe("payment_links", {
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": "1",
    "metadata[booking_id]": row.id,
    "metadata[reference]": row.reference,
    "after_completion[type]": "redirect",
    "after_completion[redirect][url]": `${BASE}/paid?ref=${row.reference}`,
  });
  linkId = link.id;
  check("Stripe payment link created", Boolean(link.url), link.url);
  check("link amount matches the quote", price.unit_amount === 7200, `${price.unit_amount}p`);

  await saveBookingPaymentLink(row.id, link.id, link.url);
  const [withLink] = await db(`bookings?id=eq.${row.id}&select=stripe_payment_link_id`);
  check("link id saved against the booking", withLink.stripe_payment_link_id === link.id);

  /* ---------- 6. Stripe says it was paid ---------- */
  const payload = JSON.stringify({
    id: "evt_e2e",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_e2e",
        object: "checkout.session",
        payment_status: "paid",
        payment_link: link.id,
        payment_intent: "pi_e2e_test",
        amount_total: 7200,
      },
    },
  });
  const sign = (p: string) => {
    const t = Math.floor(Date.now() / 1000);
    return `t=${t},v1=${createHmac("sha256", WHSEC).update(`${t}.${p}`).digest("hex")}`;
  };

  const unsigned = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=nope" },
    body: payload,
  });
  check("an unsigned event is rejected", unsigned.status === 400, `HTTP ${unsigned.status}`);

  const hook = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": sign(payload) },
    body: payload,
  });
  check("webhook accepted the signed event", hook.status === 200, await hook.text());

  const [paid] = await db(`bookings?id=eq.${row.id}&select=*`);
  check("booking flipped to paid", paid.status === "paid", paid.status);
  check("amount collected recorded", Number(paid.amount_paid) === 72, `£${paid.amount_paid}`);
  check("payment intent stored", paid.stripe_payment_intent === "pi_e2e_test");
  check("paid_at timestamped", Boolean(paid.paid_at), paid.paid_at);

  /* ---------- 7. Stripe retries are safe ---------- */
  const replay = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": sign(payload) },
    body: payload,
  });
  const replayBody = await replay.text();
  check("replayed event is ignored", replayBody.includes("already paid"), replayBody);
} catch (e) {
  fail++;
  console.log("ERROR", (e as Error).message);
} finally {
  /* ---------- undo every write ---------- */
  console.log("");
  console.log("--- cleanup ---");
  // Each step stands alone. A thrown cleanup step used to abort the ones after
  // it and strand test rows in the client's live table; never again.
  const step = async (label: string, fn: () => Promise<boolean>) => {
    try {
      console.log(`${label} ${await fn()}`);
    } catch (e) {
      fail++;
      console.log(`${label} FAILED — ${(e as Error).message}`);
      console.log(`   !! remove by hand: booking ${bookingId || "-"}, customer ${customerId || "-"}`);
    }
  };

  if (linkId) {
    await step("payment link deactivated  ", async () =>
      (await stripe(`payment_links/${linkId}`, { active: "false" })).active === false
    );
  }
  if (bookingId) {
    await step("booking deleted           ", async () => {
      await db(`booking_adjustments?booking_id=eq.${bookingId}`, { method: "DELETE" });
      await db(`bookings?id=eq.${bookingId}`, { method: "DELETE" });
      return ((await db(`bookings?id=eq.${bookingId}&select=id`)) ?? []).length === 0;
    });
  }
  if (clashBookingId) {
    await step("clash booking deleted     ", async () => {
      await db(`booking_adjustments?booking_id=eq.${clashBookingId}`, { method: "DELETE" });
      await db(`bookings?id=eq.${clashBookingId}`, { method: "DELETE" });
      return ((await db(`bookings?id=eq.${clashBookingId}&select=id`)) ?? []).length === 0;
    });
  }
  if (customerId) {
    await step("customer deleted          ", async () => {
      await db(`customers?id=eq.${customerId}`, { method: "DELETE" });
      return ((await db(`customers?id=eq.${customerId}&select=id`)) ?? []).length === 0;
    });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
