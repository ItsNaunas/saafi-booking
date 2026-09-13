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
  type RoomCounts,
  type Frequency,
} from "@/lib/pricing";
import { loadPricingAndAddons } from "@/lib/pricingServer";
import { isSlotBookable, isValidDate, londonWallClock, toMinutes, toHHMM } from "@/lib/scheduling";
import { newReference } from "@/lib/reference";
import {
  deepPrice,
  deepMinutes,
  deepCleaners,
  deepElapsedHours,
  DEEP_EXTRAS,
  DEEP_REASON_LABEL,
  type DeepExtraKey,
} from "@/lib/deepClean";
import {
  listSchedulableCleaners,
  listCleanersOnLeave,
  busyBlocksForDate,
  getBookingByReference,
  findRecentDuplicateBooking,
} from "@/lib/supabaseAdmin";
import { raiseBookingPaymentLink } from "@/lib/paymentLink";
import { sendBookingReceivedEmail, sendNewBookingAlertEmail } from "@/lib/email";
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
  // Same ceilings the form itself enforces — the two contracts used to differ.
  const bedrooms = int(roomsIn.bedrooms, 10);
  const bathrooms = int(roomsIn.bathrooms, 6);
  const diningRooms = int(roomsIn.diningRooms, 4);
  const livingRooms = int(roomsIn.livingRooms, 4);
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
  // One casing everywhere: case-variant emails fork the customers table and
  // silently orphan a saved card.
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const addressLine = String(body.addressLine ?? "").trim();
  const preferredDate = String(body.preferredDate ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  // Soft opt-in (PECR reg 22): the form offers a clear way to refuse marketing
  // where the email is collected. Only an explicit true counts — a cached form
  // that never showed the choice sends nothing, and that has to read as no.
  const marketingOk = body.marketingOk === true;
  // A deep clean is priced by room count, not by the state of the house, so
  // the office needs to know which it is before they confirm and send a pair
  // of cleaners. Required on the deep tab; only keys the form offers count.
  const deepReason =
    serviceType === "deep" &&
    typeof body.deepReason === "string" &&
    DEEP_REASON_LABEL[body.deepReason]
      ? body.deepReason
      : null;
  if (serviceType === "deep" && !deepReason)
    return bad("Please tell us why the house needs a deep clean");

  // Honeypot: a field no human ever sees. Bots that fill everything get a
  // quiet success and cost us nothing — no row, no Stripe objects, no email.
  if (String((body as Record<string, unknown>).website ?? "").trim() !== "") {
    return NextResponse.json({ ok: true, reference: newReference(), payUrl: null });
  }

  if (name.length < 2 || name.length > 120) return bad("Please tell us your name");
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) return bad("Please enter a valid email");
  if (phone.replace(/\D/g, "").length < 10 || phone.length > 30)
    return bad("Please enter a valid phone number");
  if (addressLine.length > 240) return bad("That address looks too long — just the first line is fine");
  if (notes.length > 2000) return bad("Those notes are a bit long — keep it under 2000 characters");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || !isValidDate(preferredDate))
    return bad("Please pick a preferred date");

  // Past and far-future dates used to sail through when no time was picked —
  // the regex was the only server-side check on the untimed path.
  {
    const { date: today } = londonWallClock(new Date());
    if (preferredDate < today) return bad("That date has already been — please pick a new one");
    const horizon = new Date(`${today}T12:00:00Z`);
    horizon.setUTCDate(horizon.getUTCDate() + cfg.scheduling.maxDaysAhead);
    if (preferredDate > horizon.toISOString().slice(0, 10))
      return bad(`We only take bookings up to ${cfg.scheduling.maxDaysAhead} days ahead`);
  }

  // The booking's real length: the clean plus whatever the extras add.
  const jobHours = hours + extrasHours;

  // A time is optional — if the customer never got offered one (no cleaners set
  // up yet, or the availability call failed) the booking still goes through as
  // unscheduled and SAAFI slot it by phone, exactly as they did before.
  const rawTime = String(body.startTime ?? "").trim();
  let startTime: string | null = null;
  // True when the customer picked a time we could not honour (the availability
  // re-check failed) — the success screen says so instead of silently
  // vanishing the time they chose.
  let timeDropped = false;
  if (rawTime) {
    const mins = toMinutes(rawTime);
    if (mins === null) return bad("That start time doesn't look right");
    startTime = toHHMM(mins);

    // Never trust the browser's idea of what was free — the slot may have gone
    // while the customer was filling the form in. Same rule as the price.
    try {
      const [allCleaners, busy, onLeave] = await Promise.all([
        listSchedulableCleaners(),
        busyBlocksForDate(preferredDate),
        listCleanersOnLeave(preferredDate).catch(() => new Set<string>()),
      ]);
      const cleaners = allCleaners.filter((c) => !onLeave.has(c.id));
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
      timeDropped = true;
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
    marketingOk,
    deepReason,
    quotedPrice,
    status: "requested",
    createdAt: new Date().toISOString(),
  };

  // A retry of a submit that actually landed (network blip on the response)
  // must return the booking that exists, not mint a twin.
  try {
    const dupe = await findRecentDuplicateBooking(email, preferredDate);
    if (dupe && Number(dupe.hours) === record.hours + record.addonsHours) {
      return NextResponse.json({
        ok: true,
        quotedPrice: Number(dupe.quoted_price),
        reference: dupe.reference,
        payUrl: dupe.stripe_payment_link_url ?? null,
        duplicate: true,
      });
    }
  } catch {
    // Dedupe is a nicety; the booking still goes through without it.
  }

  const stored = await storeBooking(record);
  if (!stored.ok) return bad("Something went wrong saving your booking — please call us instead", 500);

  // Pay-at-booking (2026-08-25 review): raise the Stripe link now, show it on
  // the success screen and put it in the receipt. Every failure mode — Stripe
  // unconfigured, insert went to the local fallback, network — collapses to
  // "no link", which is the settle-by-phone flow this replaced. Recurring
  // visits after the first still settle by admin-sent link; that half is an
  // open family decision.
  let payUrl: string | null = null;
  try {
    const row = await getBookingByReference(stored.reference);
    if (row) payUrl = await raiseBookingPaymentLink(row);
  } catch (e) {
    console.error("[bookings] pay-at-booking link failed:", e);
  }

  await sendNewBookingAlertEmail({
    name: record.name,
    phone: record.phone,
    email: record.email,
    addressLine: record.addressLine,
    postcode: record.postcode,
    preferredDate: record.preferredDate,
    startTime: record.startTime ?? null,
    hours: record.hours + record.addonsHours,
    serviceType: record.serviceType,
    cleanersNeeded: record.cleanersNeeded,
    frequency: record.frequency,
    quotedPrice: record.quotedPrice,
    addonLabels: record.addons.map((a) => a.label),
    deepReason: record.deepReason
      ? DEEP_REASON_LABEL[record.deepReason] ?? record.deepReason
      : null,
    notes: record.notes ?? "",
    reference: stored.reference,
  }).catch((e) => console.error("[bookings] alert email failed:", e));

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
    serviceType: record.serviceType,
    payUrl,
  }).catch((e) => console.error("[bookings] customer receipt failed:", e));

  return NextResponse.json({
    ok: true,
    quotedPrice,
    reference: stored.reference,
    payUrl,
    timeDropped,
  });
}

/** Supabase (PostgREST) when configured; local JSONL fallback for dev. */
async function storeBooking(
  record: BookingRecord
): Promise<{ ok: boolean; reference: string }> {
  const url = process.env.SUPABASE_URL;
  // Prefer the service key; fall back to the publishable key, which can ONLY
  // insert bookings via the insert-only RLS policy (no reads) — fine for Phase 1.
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  let reference = newReference();
  // Flipped when the DB reports marketing_ok missing (migration not pasted
  // yet) — the retry omits it rather than losing the booking over a flag.
  let skipMarketingColumn = false;
  // Same for deep_reason, pre-2026-09-13-deep-reason.sql.
  let skipDeepReasonColumn = false;

  if (url && key) {
    // A 409 on the unique reference is a same-millisecond collision, not a
    // reason to fail the customer — retry once with a fresh reference.
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) reference = newReference();
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
          ? {
              service_type: "deep",
              cleaners_needed: record.cleanersNeeded,
              ...(skipDeepReasonColumn ? {} : { deep_reason: record.deepReason }),
            }
          : {}),
        frequency: record.frequency,
        customer_name: record.name,
        customer_email: record.email,
        customer_phone: record.phone,
        address_line: record.addressLine,
        preferred_date: record.preferredDate,
        start_time: record.startTime,
        notes: record.notes || null,
        ...(skipMarketingColumn ? {} : { marketing_ok: record.marketingOk }),
        quoted_price: record.quotedPrice,
        status: "requested",
      }),
      });
      if (res.ok) return { ok: true, reference };
      const errText = await res.text();
      console.error("[bookings] supabase insert failed:", res.status, errText);
      if (errText.includes("marketing_ok") && !skipMarketingColumn) {
        skipMarketingColumn = true;
        continue;
      }
      if (errText.includes("deep_reason") && !skipDeepReasonColumn) {
        skipDeepReasonColumn = true;
        continue;
      }
      if (res.status === 409 && attempt < 2) continue;
      // On serverless the local file is ephemeral: falling back there returns
      // a success screen, a reference and a confirmation email for a booking
      // nobody will ever see. Every service type fails loudly in production —
      // "please call us" is honest, a vanished booking is not.
      if (inProduction()) return { ok: false, reference };
      break;
    } catch (e) {
      console.error("[bookings] supabase unreachable:", e);
      if (inProduction()) return { ok: false, reference };
      break;
    }
    }
  }

  // Dev-only fallback: append to .data/bookings.local.jsonl so local hacking
  // works without a database. Never reached in production (see above).
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

/** Vercel or any NODE_ENV=production build — where the JSONL fallback lies. */
function inProduction(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}
