import { NextRequest, NextResponse } from "next/server";
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

  const hours = clampHours(Number(body.hours) || cfg.minHours, cfg);
  const customerProvidesProducts = Boolean(body.customerProvidesProducts);

  const frequency = (
    ["one_off", "weekly", "fortnightly", "four_weekly"].includes(String(body.frequency))
      ? String(body.frequency)
      : "one_off"
  ) as Frequency;

  // Add-ons: only keys that exist in the DB count, priced from the DB — never the client.
  // Their price is flat (covers their own labour); their hours extend the job duration.
  const requestedKeys = Array.isArray(body.addons) ? body.addons.map(String) : [];
  const addons = availableAddons.filter((a) => requestedKeys.includes(a.key));
  const addonsTotal = addons.reduce((s, a) => s + a.price, 0);
  const extrasHours = addonsHours(addons);

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

  // Never trust the client's price — recompute server-side from live config.
  // Extras are billed as time, so the quote runs on clean + extras hours.
  const quotedPrice = quotePrice(
    hours + extrasHours,
    customerProvidesProducts,
    cfg,
    frequency,
    addonsTotal
  );

  const record: BookingRecord = {
    postcode,
    rooms,
    hours,
    customerProvidesProducts,
    addons,
    addonsTotal,
    addonsHours: extrasHours,
    frequency,
    name,
    email,
    phone,
    addressLine,
    preferredDate,
    notes,
    quotedPrice,
    status: "requested",
    createdAt: new Date().toISOString(),
  };

  const stored = await storeBooking(record);
  if (!stored.ok) return bad("Something went wrong saving your booking — please call us instead", 500);

  await sendAlertEmail(record).catch((e) => console.error("[bookings] alert email failed:", e));

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
        frequency: record.frequency,
        customer_name: record.name,
        customer_email: record.email,
        customer_phone: record.phone,
        address_line: record.addressLine,
        preferred_date: record.preferredDate,
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
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO; // e.g. info@saaficleaningservice.com
  if (!key || !to) return;

  const from = process.env.ALERT_EMAIL_FROM ?? "bookings@saaficleaningservice.com";
  const r = record.rooms;
  await fetch("https://api.resend.com/emails", {
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
        `Date:    ${record.preferredDate}`,
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
}
