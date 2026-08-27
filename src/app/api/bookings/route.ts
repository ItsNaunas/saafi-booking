import { NextRequest, NextResponse } from "next/server";
import { secret } from "@/lib/env";
import { appendFile, mkdir } from "fs/promises";
import path from "path";
import {
  inServiceArea,
  looksLikeUkPostcode,
  normalisePostcode,
  quotePrice,
  clampHours,
  addonsHours,
  FREQUENCY_LABEL,
  type RoomCounts,
  type Frequency,
} from "@/lib/pricing";
import { loadPricingAndAddons } from "@/lib/pricingServer";
import { isSlotBookable, toMinutes, toHHMM, formatTimeRange } from "@/lib/scheduling";
import {
  deepPrice,
  deepMinutes,
  deepCleaners,
  deepElapsedHours,
  DEEP_EXTRAS,
  type DeepExtraKey,
} from "@/lib/deepClean";
import { listSchedulableCleaners, busyBlocksForDate } from "@/lib/supabaseAdmin";
import { sendBookingReceivedEmail } from "@/lib/email";
import type { BookingRecord, BookingRequest } from "@/lib/types";

export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function int(n: unknown, max = 20): number | null {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0 || v > max) return null;
  return v;
}

export async function POST(req: NextRequest) {
  let body: Partial<BookingRequest>;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const { cfg, addons: availableAddons } = await loadPricingAndAddons();

  // --- validate ---
  const postcode = normalisePostcode(String(body.postcode ?? ""));
  if (!looksLikeUkPostcode(postcode)) return bad("Please enter a valid UK postcode");
  if (!inServiceArea(postcode, cfg)) return bad("Sorry, we don't cover that postcode yet");

  const roomsIn = (body.rooms ?? {}) as Partial<RoomCounts>;
  const bedrooms = int(roomsIn.bedrooms);
  const bathrooms = int(roomsIn.bathrooms);
  const diningRooms = int(roomsIn.diningRooms);
  const livingRooms = int(roomsIn.livingRooms);
  if (bedrooms === null || bathrooms === null || diningRooms === null || livingRooms === null)
    return bad("Room counts must be whole numbers");
  const rooms: RoomCounts = { bedrooms, bathrooms, diningRooms, livingRooms };

  const serviceType = body.serviceType === "deep" ? "deep" : "standard";
  const customerProvidesProducts = Boolean(body.customerProvidesProducts);

  // Deep cleans are one-off: the 10% repeat discount SAAFI want is a
  // quarterly/biannual option, which is a frequency the schema doesn't have
  // yet — forcing one_off here keeps a weekly deep clean from being minted at
  // a discount that was never priced.
  const frequency = (
    serviceType === "deep"
      ? "one_off"
      : ["one_off", "weekly", "fortnightly", "four_weekly"].includes(String(body.frequency))
        ? String(body.frequency)
        : "one_off"
  ) as Frequency;

  const requestedKeys = Array.isArray(body.addons) ? body.addons.map(String) : [];

  // Standard add-ons: only keys that exist in the DB count, priced from the DB
  // — never the client. Flat price, hours extend the job. Deep extras are a
  // different product: fixed £58 each from lib/deepClean, one hour of work.
  const deepExtraKeys =
    serviceType === "deep"
      ? DEEP_EXTRAS.filter((e) => requestedKeys.includes(e.key)).map((e) => e.key as DeepExtraKey)
      : [];
  const addons =
    serviceType === "deep"
      ? DEEP_EXTRAS.filter((e) => deepExtraKeys.includes(e.key)).map((e) => ({
          key: e.key,
          label: `${e.label} (deep)`,
          price: 58,
          hours: 1,
        }))
      : availableAddons.filter((a) => requestedKeys.includes(a.key));
  const addonsTotal = serviceType === "deep" ? 0 : addons.reduce((s, a) => s + a.price, 0);
  const extrasHours = serviceType === "deep" ? 0 : addonsHours(addons);

  // Deep geometry: man-minutes -> crew size -> hours on site. The elapsed
  // figure is what the diary blocks out and what the customer is told.
  const deepRooms = {
    bedrooms,
    bathrooms,
    livingRooms,
    diningRooms,
    additionalRooms: 0,
  };
  const deepMans = serviceType === "deep" ? deepMinutes(deepRooms, deepExtraKeys) : 0;
  const cleanersNeeded = serviceType === "deep" ? deepCleaners(deepMans) : 1;

  const hours =
    serviceType === "deep"
      ? deepElapsedHours(deepMans)
      : clampHours(Number(body.hours) || cfg.minHours, cfg);

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const addressLine = String(body.addressLine ?? "").trim();
  const preferredDate = String(body.preferredDate ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (name.length < 2) return bad("Please tell us your name");
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Please enter a valid email");
  if (phone.replace(/\D/g, "").length < 10) return bad("Please enter a valid phone number");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) return bad("Please pick a preferred date");

  // The booking's real length: the clean plus whatever the extras add.
  const jobHours = hours + extrasHours;

  // A time is optional — if the customer never got offered one (no cleaners set
  // up yet, or the availability call failed) the booking still goes through as
  // unscheduled and SAAFI slot it by phone, exactly as they did before.
  const rawTime = String(body.startTime ?? "").trim();
  let startTime: string | null = null;
  if (rawTime) {
    const mins = toMinutes(rawTime);
    if (mins === null) return bad("That start time doesn't look right");
    startTime = toHHMM(mins);

    // Never trust the browser's idea of what was free — the slot may have gone
    // while the customer was filling the form in. Same rule as the price.
    try {
      const [cleaners, busy] = await Promise.all([
        listSchedulableCleaners(),
        busyBlocksForDate(preferredDate),
      ]);
      const bookable = isSlotBookable({
        date: preferredDate,
        time: startTime,
        durationHours: jobHours,
        cleaners,
        busy,
        cfg: cfg.scheduling,
        now: new Date(),
      });
      if (!bookable) {
        return bad("Sorry — that time has just been taken. Please pick another.", 409);
      }
    } catch (e) {
      // Availability is a nicety; losing the booking is not. Take it unscheduled.
      console.error("[bookings] slot re-check failed, accepting as unscheduled:", e);
      startTime = null;
    }
  }

  // Never trust the client's price — recompute server-side from live config.
  // Standard bills time (clean + extras hours); deep bills flat per room and
  // per extra, products and frequency changing nothing.
  const quotedPrice =
    serviceType === "deep"
      ? deepPrice(deepRooms, deepExtraKeys)
      : quotePrice(jobHours, customerProvidesProducts, cfg, frequency, addonsTotal);

  const record: BookingRecord = {
    postcode,
    rooms,
    hours,
    customerProvidesProducts,
    addons,
    addonsTotal,
    addonsHours: extrasHours,
    serviceType,
    cleanersNeeded,
    frequency,
    name,
    email,
    phone,
    addressLine,
    preferredDate,
    startTime,
    notes,
    quotedPrice,
    status: "requested",
    createdAt: new Date().toISOString(),
  };

  const stored = await storeBooking(record);
  if (!stored.ok) return bad("Something went wrong saving your booking — please call us instead", 500);

  await sendAlertEmail(record).catch((e) => console.error("[bookings] alert email failed:", e));

  // And tell the customer. Until this existed they saw a reference on screen and
  // then heard nothing at all until somebody rang them.
  await sendBookingReceivedEmail({
    name: record.name,
    email: record.email,
    reference: stored.reference,
    preferredDate: record.preferredDate,
    startTime: record.startTime ?? null,
    hours: record.hours + record.addonsHours,
    price: record.quotedPrice,
    addressLine: record.addressLine,
    postcode: record.postcode,
    recurring: record.frequency !== "one_off",
  }).catch((e) => console.error("[bookings] customer receipt failed:", e));

  return NextResponse.json({ ok: true, quotedPrice, reference: stored.reference });
}

/** Supabase (PostgREST) when configured; local JSONL fallback for dev. */
async function storeBooking(
  record: BookingRecord
): Promise<{ ok: boolean; reference: string }> {
  const url = process.env.SUPABASE_URL;
  // Prefer the service key; fall back to the publishable key, which can ONLY
  // insert bookings via the insert-only RLS policy (no reads) — fine for Phase 1.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const reference = `SAAFI-${Date.now().toString(36).toUpperCase()}`;

  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/bookings`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // minimal: the publishable key has insert-only RLS (no select),
        // so asking for the row back would 401 — and we don't need it.
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        reference,
        postcode: record.postcode,
        bedrooms: record.rooms.bedrooms,
        bathrooms: record.rooms.bathrooms,
        dining_rooms: record.rooms.diningRooms,
        living_rooms: record.rooms.livingRooms,
        // stored duration = core clean + extras time, so admin/calendar/cleaners
        // see the real job length; price was computed from core hours only.
        hours: record.hours + record.addonsHours,
        customer_provides_products: record.customerProvidesProducts,
        addons: record.addons,
        addons_total: record.addonsTotal,
        // Only sent for deep jobs: PostgREST rejects unknown columns, so
        // standard bookings stay insertable even before
        // supabase/2026-08-27-deep-clean.sql has run. Deep bookings need it.
        ...(record.serviceType === "deep"
          ? { service_type: "deep", cleaners_needed: record.cleanersNeeded }
          : {}),
        frequency: record.frequency,
        customer_name: record.name,
        customer_email: record.email,
        customer_phone: record.phone,
        address_line: record.addressLine,
        preferred_date: record.preferredDate,
        start_time: record.startTime,
        notes: record.notes || null,
        quoted_price: record.quotedPrice,
        status: "requested",
      }),
      });
      if (res.ok) return { ok: true, reference };
      console.error("[bookings] supabase insert failed:", res.status, await res.text());
    } catch (e) {
      // Network down / DNS dead — fall through to the local file so the booking isn't lost.
      console.error("[bookings] supabase unreachable, using local fallback:", e);
    }
  }

  // Fallback: append to .data/bookings.local.jsonl (Supabase unset OR unreachable).
  try {
    const dir = path.join(process.cwd(), ".data");
    await mkdir(dir, { recursive: true });
    await appendFile(
      path.join(dir, "bookings.local.jsonl"),
      JSON.stringify({ reference, ...record }) + "\n",
      "utf8"
    );
    console.log(`[bookings] stored locally: ${reference}`);
    return { ok: true, reference };
  } catch (e) {
    console.error("[bookings] local fallback also failed:", e);
    return { ok: false, reference };
  }
}

/** Instant alert to the business — Resend when configured, no-op otherwise. */
async function sendAlertEmail(record: BookingRecord) {
  const key = secret("RESEND_API_KEY");
  const to = process.env.ALERT_EMAIL_TO; // e.g. info@saaficleaningservice.com
  if (!key || !to) return;

  const from = process.env.ALERT_EMAIL_FROM ?? "bookings@saaficleaningservice.com";
  const r = record.rooms;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `SAAFI Bookings <${from}>`,
      to: [to],
      subject: `New booking request — ${record.name}, ${record.preferredDate} (£${record.quotedPrice})`,
      text: [
        `New booking request`,
        ``,
        `Name:    ${record.name}`,
        `Phone:   ${record.phone}`,
        `Email:   ${record.email}`,
        `Address: ${record.addressLine}, ${record.postcode}`,
        `Date:    ${record.preferredDate}${
          record.startTime
            ? ` at ${formatTimeRange(record.startTime, record.hours + record.addonsHours)}`
            : ` (NO TIME SET — agree one when you call)`
        }`,
        `Rooms:   ${r.bedrooms} bed / ${r.bathrooms} bath / ${r.diningRooms} dining / ${r.livingRooms} living`,
        `Hours:   ${record.hours + record.addonsHours}${
          record.addonsHours > 0 ? ` (${record.hours}h clean + ${record.addonsHours}h extras)` : ""
        }`,
        `Products: ${record.customerProvidesProducts ? "customer provides" : "we bring ours"}`,
        `Frequency: ${FREQUENCY_LABEL[record.frequency]}`,
        record.addons.length
          ? `Extras:  ${record.addons.map((a) => `${a.label} (£${a.price})`).join(", ")}`
          : ``,
        `Quoted:  £${record.quotedPrice}${record.frequency !== "one_off" ? " per clean" : ""}`,
        record.notes ? `Notes:   ${record.notes}` : ``,
        ``,
        `Confirm by phone, then mark it confirmed in the admin.`,
      ].join("\n"),
    }),
  });

  // A rejected send used to look identical to a successful one: the fetch resolves,
  // nothing throws, and the booking returns 200 either way. That is how a BOM in
  // RESEND_API_KEY went unnoticed for days. Make both outcomes visible in the logs.
  if (!res.ok) {
    throw new Error(`Resend rejected the alert: ${res.status} ${await res.text()}`);
  }
  console.log(`[bookings] alert email sent to the office for ${record.name}`);
}
