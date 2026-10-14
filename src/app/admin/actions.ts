"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import {
  updateBookingStatus,
  updateBooking,
  insertBooking,
  updatePricingRow,
  updateAddon,
  addServiceAreaPrefix,
  removeServiceAreaPrefix,
  createCleaner,
  listCleaners,
  setCleanerActive,
  setCleanerToken,
  updateCleanerEmail,
  updateCleanerHours,
  getBooking,
  getCustomer,
  getAdjustment,
  setAdjustmentStatus,
  setTimeOffStatus,
  amountDueFor,
  paidSoFar,
  recordBookingRefund,
  markPaymentLinkSent,
  getSuggestion,
  updateSuggestion,
  insertIcalFeed,
  getIcalFeed,
  updateIcalFeed,
  deleteIcalFeed,
  type BookingStatus,
  type BookingRow,
} from "@/lib/supabaseAdmin";
import { syncFeed, syncFeeds } from "@/lib/airbnbSync";
import {
  insertCampaign,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  updateAutomation,
  listAutomations,
  recordManualConsent,
  suppressEmail,
  unsuppressEmail,
  type CampaignRow,
} from "@/lib/supabaseAdmin";
import { filterFromForm, type SegmentFilter } from "@/lib/segments";
import { sendCampaign, sendCampaignTest, sendAutomationTest, AUTOMATION_KEYS } from "@/lib/marketing";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaignTemplates";
import { getStripe, fromPence } from "@/lib/stripe";
import {
  sendConfirmationEmail,
  sendAdjustmentEmail,
  sendPaymentLinkEmail,
  sendCleanerAssignedEmail,
  sendCardSetupEmail,
  sendBookingCancelledEmail,
  sendBookingChangedEmail,
  sendCleanerJobChangedEmail,
  sendOpsAlertEmail,
} from "@/lib/email";
import {
  raiseBookingPaymentLink,
  deactivatePaymentLink,
  autoInvoiceIfUnpaid,
} from "@/lib/paymentLink";
import { invalidatePricingCache, loadPricingConfig } from "@/lib/pricingServer";
import { quotePrice, type Frequency } from "@/lib/pricing";
import { newReference, spawnNextOccurrence, ensureSeriesHorizon } from "@/lib/recurring";
import { settleBookingWithSavedCard, createCardSetupLink } from "@/lib/cardOnFile";
import { toMinutes, toHHMM, londonWallClock } from "@/lib/scheduling";
import { smsCleanerAssigned, smsCleanerJobChanged } from "@/lib/sms";
import { ALLOWED_TRANSITIONS as ALLOWED } from "@/lib/statusFlow";

/** The people on a job: the cleaner, and on a deep clean the second one. */
async function assignedCleaners(b: BookingRow) {
  const ids = [b.cleaner_id, b.second_cleaner_id ?? null].filter((x): x is string => Boolean(x));
  if (ids.length === 0) return [];
  const all = await listCleaners();
  return ids
    .map((id) => all.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
}

export async function setBookingStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const from = String(formData.get("from") ?? "") as BookingStatus;
  const to = String(formData.get("to") ?? "") as BookingStatus;
  if (!id || !ALLOWED[from]?.includes(to)) return;

  // Cancelling a booking whose money is already in is a refund decision, not a
  // status change. The cancellation email used to promise "nothing further is
  // charged" to someone we were keeping £70 of — route through the refund
  // button instead, which does both honestly.
  if (to === "cancelled") {
    const current = await getBooking(id);
    // ANY money in and not yet refunded blocks the plain cancel — a part
    // payment deserves its refund conversation as much as a full one.
    if (current && paidSoFar(current) > 0 && !current.refunded_at) {
      redirect(`/admin/booking/${id}?refund=needed`);
    }
  }

  // A job can't be finished before it has happened. "Complete" on a future
  // date used to go through — and from there "Mark paid" — leaving a booking
  // that looked done, vanished from the cleaner's list and calendar (both
  // show confirmed jobs only), and hid the assign control. Same-day is fine:
  // the office closes jobs out in the evening.
  if (to === "completed" || to === "paid") {
    const current = await getBooking(id);
    const { date: today } = londonWallClock(new Date());
    if (current && current.preferred_date > today) {
      redirect(`/admin/booking/${id}?status_error=early`);
    }
  }

  const updated = await updateBookingStatus(id, to);

  // Confirmation email fires exactly on requested -> confirmed (best-effort).
  if (updated && to === "confirmed") {
    await sendConfirmationEmail(updated).catch((e) =>
      console.error("[admin] confirmation email failed:", e)
    );
    // A recurring booking becoming real is when its series should appear in the
    // calendar — not while it was still an unconfirmed request holding slots it
    // might never use.
    await ensureSeriesHorizon(updated).catch((e) =>
      console.error("[admin] series top-up failed:", e)
    );
  }
  // The clean is off: the customer used to find out when nobody turned up,
  // and an assigned cleaner used to find out by travelling there.
  if (updated && to === "cancelled") {
    await sendBookingCancelledEmail(updated).catch((e) =>
      console.error("[admin] cancellation email failed:", e)
    );
    // A live payable link for a clean that won't happen stays payable forever.
    await deactivatePaymentLink(updated).catch(() => {});
    for (const cleaner of await assignedCleaners(updated)) {
      await sendCleanerJobChangedEmail(cleaner, updated, "cancelled").catch((e) =>
        console.error("[admin] cleaner cancellation email failed:", e)
      );
      await smsCleanerJobChanged(cleaner, updated, "cancelled").catch(() => {});
    }
  }
  // Completing a recurring clean books the next one automatically.
  if (updated && to === "completed") {
    await spawnNextOccurrence(updated).catch((e) =>
      console.error("[admin] recurring spawn failed:", e)
    );
    await settle(updated);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  // The no_access resolve buttons live on the booking page itself — leaving it
  // stale made a successful click look like nothing happened.
  revalidatePath(`/admin/booking/${id}`);
}

export async function stopRecurring(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, { recurring_active: false });
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/booking/${id}`);
}

export async function assignCleaner(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const cleanerId = String(formData.get("cleaner_id") ?? "") || null;
  // Only the deep-clean form posts a second cleaner; a standard clean's form
  // doesn't, and "absent" there rightly means none.
  const secondRaw = String(formData.get("second_cleaner_id") ?? "") || null;
  const secondId = secondRaw && secondRaw !== cleanerId ? secondRaw : null;
  if (!id) return;
  const before = await getBooking(id);
  if (!before) return;

  let updated: BookingRow | null;
  try {
    updated = await updateBooking(id, { cleaner_id: cleanerId, second_cleaner_id: secondId });
  } catch (e) {
    // Ahead of supabase/2026-09-13-second-cleaner.sql the column isn't there:
    // save the first cleaner rather than nobody.
    if (!String(e).includes("second_cleaner_id")) throw e;
    updated = await updateBooking(id, { cleaner_id: cleanerId });
  }
  if (!updated) return;

  const all = await listCleaners();
  const byId = (cid: string | null | undefined) => (cid ? all.find((c) => c.id === cid) : undefined);
  const was = [before.cleaner_id, before.second_cleaner_id ?? null];
  const now = [updated.cleaner_id, updated.second_cleaner_id ?? null];

  // Anyone who was on it and isn't now: used to find out by opening their
  // link and noticing it gone — or worse, by both turning up.
  for (const cid of was) {
    const old = cid && !now.includes(cid) ? byId(cid) : undefined;
    if (!old) continue;
    await sendCleanerJobChangedEmail(old, updated, "reassigned").catch((e) =>
      console.error("[admin] cleaner reassignment email failed:", e)
    );
    await smsCleanerJobChanged(old, updated, "reassigned").catch(() => {});
  }
  // Anyone on it now who wasn't: tell them, by email and by text.
  for (const cid of now) {
    const c = cid && !was.includes(cid) ? byId(cid) : undefined;
    if (!c) continue;
    await sendCleanerAssignedEmail(c, updated).catch((e) =>
      console.error("[admin] cleaner assignment email failed:", e)
    );
    await smsCleanerAssigned(c, updated).catch(() => {});
  }

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/booking/${id}`);
}

export async function decideTimeOff(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || (decision !== "approved" && decision !== "denied")) return;

  const row = await setTimeOffStatus(id, decision);
  if (row) {
    const cleaner = (await listCleaners()).find((c) => c.id === row.cleaner_id);
    if (cleaner) {
      const { sendTimeOffDecisionEmail } = await import("@/lib/email");
      await sendTimeOffDecisionEmail(cleaner, row.from_date, row.to_date, decision === "approved").catch(
        () => {}
      );
    }
  }
  revalidatePath("/admin/cleaners");
}

export async function addCleaner(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  if (name.length < 2 || phone.length < 7) {
    redirect(`/admin/cleaners?error=${encodeURIComponent("Name and phone are required")}`);
  }
  await createCleaner(name, phone, email);
  revalidatePath("/admin/cleaners");
}

export async function toggleCleaner(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  await setCleanerActive(id, active);
  revalidatePath("/admin/cleaners");
}

export async function updateCleanerContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  if (!id) return;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    redirect(`/admin/cleaners?error=${encodeURIComponent("That email doesn't look right")}`);
  }
  await updateCleanerEmail(id, email);
  revalidatePath("/admin/cleaners");
}

/** A lost phone is a live link in the wrong hands. New link now; the old one stops working. */
export async function regenerateCleanerLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await setCleanerToken(id, crypto.randomUUID());
  revalidatePath("/admin/cleaners");
}

export async function createManualBooking(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("name");
  const phone = get("phone");
  const preferredDate = get("preferred_date");
  // Confirming an Airbnb turnover suggestion arrives through this same form.
  const suggestionId = get("suggestion_id");
  const back = suggestionId ? `/admin/new?suggestion=${encodeURIComponent(suggestionId)}&` : "/admin/new?";
  if (name.length < 2 || phone.length < 7 || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    redirect(`${back}error=1`);
  }
  if (suggestionId) {
    // A double-submit or a second tab must not book the same turnover twice.
    const s = await getSuggestion(suggestionId);
    if (s?.status === "confirmed" && s.booking_id) {
      // Only if that clean still stands — a cancelled one means book again.
      const linked = await getBooking(s.booking_id);
      if (linked && linked.status !== "cancelled") redirect(`/admin/booking/${s.booking_id}`);
    }
  }
  const hours = Math.max(0.5, Number(get("hours")) || 2);
  // The owner books over the top of availability on purpose — a phone booking is
  // already agreed with the customer, so this records the time, it doesn't police it.
  const startMinutes = toMinutes(get("start_time"));
  const startTime = startMinutes === null ? null : toHHMM(startMinutes);
  const frequency = (
    ["one_off", "weekly", "fortnightly", "four_weekly"].includes(get("frequency"))
      ? get("frequency")
      : "one_off"
  ) as Frequency;
  // Left blank, the price falls back to the engine — the same quotePrice the
  // public form uses — so a phone booking never goes in at £0 by accident.
  // A typed price always wins.
  let price = Math.max(0, Number(get("price")) || 0);
  if (price === 0) {
    const cfg = await loadPricingConfig();
    price = quotePrice(hours, true, cfg, frequency);
  }

  const rooms = (k: string) => {
    const v = Number(get(k));
    return Number.isInteger(v) && v >= 0 && v <= 20 ? v : 0;
  };
  const serviceType = get("service_type") === "deep" ? ("deep" as const) : ("standard" as const);

  const row = await insertBooking({
    reference: newReference(),
    customer_name: name,
    // No email on a phone booking gets the @phone.saafi sentinel: the send()
    // gate refuses it and the customers trigger skips it, so it costs nothing.
    customer_email: get("email").toLowerCase() || `${phone.replace(/\D/g, "")}@phone.saafi`,
    customer_phone: phone,
    address_line: get("address_line") || "—",
    postcode: get("postcode").toUpperCase().replace(/\s+/g, "") || "—",
    bedrooms: rooms("bedrooms"),
    bathrooms: rooms("bathrooms"),
    dining_rooms: 0,
    living_rooms: 0,
    hours,
    customer_provides_products: true,
    ...(serviceType === "deep" ? { service_type: serviceType } : {}),
    frequency,
    quoted_price: price,
    preferred_date: preferredDate,
    start_time: startTime,
    notes: get("notes") || null,
    status: "confirmed", // phone bookings arrive pre-agreed
  }).catch((e) => {
    console.error("[admin] manual booking insert failed:", e);
    return null;
  });
  if (!row) redirect(`${back}error=2`);

  if (row && suggestionId) {
    await updateSuggestion(suggestionId, {
      status: "confirmed",
      booking_id: row.id,
      updated_at: new Date().toISOString(),
    }).catch((e) => console.error("[admin] linking turnover suggestion failed:", e));
  }

  // A phone booking is still a booking: the same confirmation email (a no-op
  // when there's no real address) and the same series top-up as the public
  // path. Before this, a manual weekly booking existed as exactly one visit
  // and the customer heard nothing in writing.
  if (row) {
    await sendConfirmationEmail(row).catch((e) =>
      console.error("[admin] manual booking confirmation failed:", e)
    );
    await ensureSeriesHorizon(row).catch((e) =>
      console.error("[admin] manual booking series top-up failed:", e)
    );
  }
  redirect(suggestionId && row ? `/admin/booking/${row.id}` : "/admin");
}

export async function editBooking(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const before = await getBooking(id);
  if (!before) return;

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const date = get("preferred_date");
  const hours = Number(formData.get("hours"));
  let price = Number(formData.get("quoted_price"));
  const notes = get("notes");
  // An empty time field is meaningful — it puts the job back to "needs a slot".
  const startMinutes = toMinutes(String(formData.get("start_time") ?? ""));

  // Price follows the hours (2026-08-25 review) — but only while the admin has
  // not touched the price field themselves. A submitted price that differs
  // from the stored one is an explicit decision and always wins; an untouched
  // price alongside changed hours means "reprice this for me".
  const hoursChanged = Number.isFinite(hours) && hours > 0 && hours !== Number(before.hours);
  const priceUntouched =
    Number.isFinite(price) && Math.abs(price - Number(before.quoted_price)) < 0.005;
  if (hoursChanged && priceUntouched) {
    const cfg = await loadPricingConfig();
    price = quotePrice(
      hours,
      before.customer_provides_products,
      cfg,
      before.frequency,
      Number(before.addons_total ?? 0),
    );
  }

  // Contact details: only written when the field actually changed, so an old
  // form left open cannot quietly blank a fixed-up record.
  const contact: Record<string, string> = {};
  for (const [form, col] of [
    ["customer_name", "customer_name"],
    ["customer_phone", "customer_phone"],
    ["customer_email", "customer_email"],
    ["address_line", "address_line"],
    ["postcode", "postcode"],
  ] as const) {
    const v =
      form === "postcode"
        ? get(form).toUpperCase().replace(/\s+/g, "")
        : form === "customer_email"
          ? // One casing everywhere: John@Gmail.com forking a second customer
            // row silently loses the saved card attached to the first.
            get(form).toLowerCase()
          : get(form);
    if (v && v !== String((before as unknown as Record<string, unknown>)[col] ?? "")) {
      contact[col] = v;
    }
  }

  // A deliberate reprice after an adjustment was agreed must actually take
  // effect: agreedPriceFor() prefers final_price, so leaving the old agreed
  // figure in place made the edit a silent no-op that still emailed the
  // customer about a change that never happened.
  const willReprice =
    Number.isFinite(price) &&
    price >= 0 &&
    Math.abs(price - Number(before.quoted_price)) >= 0.005;
  const clearAgreed =
    willReprice && before.price_status === "agreed"
      ? { final_price: null, price_status: "quoted" as const }
      : {};

  const updated = await updateBooking(id, {
    ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { preferred_date: date } : {}),
    ...(Number.isFinite(hours) && hours > 0 ? { hours } : {}),
    ...(Number.isFinite(price) && price >= 0 ? { quoted_price: price } : {}),
    ...clearAgreed,
    ...contact,
    start_time: startMinutes === null ? null : toHHMM(startMinutes),
    notes: notes || null,
  } as Parameters<typeof updateBooking>[1]);

  // The written record of what moved. Usually agreed on the phone first —
  // this is what kills "you said Thursday" before it exists. Only material
  // changes count: contact fixes and note edits are not news to the customer.
  if (updated) {
    const moved =
      updated.preferred_date !== before.preferred_date ||
      updated.start_time !== before.start_time;
    const resized = Number(updated.hours) !== Number(before.hours);
    const repriced = Number(updated.quoted_price) !== Number(before.quoted_price);

    if (moved || resized || repriced) {
      const was: [string, string][] = [];
      if (moved)
        was.push([
          "Was",
          before.start_time
            ? `${before.preferred_date}, ${toHHMM(toMinutes(before.start_time) ?? 0)}`
            : before.preferred_date,
        ]);
      if (repriced) was.push(["Was priced", `£${before.quoted_price}`]);
      await sendBookingChangedEmail(updated, was).catch((e) =>
        console.error("[admin] booking-changed email failed:", e)
      );

      // A cleaner planning their day around the old slot needs the new one.
      if (moved && updated.status === "confirmed") {
        for (const cleaner of await assignedCleaners(updated)) {
          await sendCleanerJobChangedEmail(cleaner, updated, "moved").catch((e) =>
            console.error("[admin] cleaner moved email failed:", e)
          );
          await smsCleanerJobChanged(cleaner, updated, "moved").catch(() => {});
        }
      }
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/booking/${id}`);
  // Stay on the booking: bouncing to the pipeline made a successful save look
  // like nothing happened.
  redirect(`/admin/booking/${id}?saved=1`);
}

export async function savePricing(formData: FormData) {
  const keys = [
    "hourly_rate",
    "product_surcharge",
    "base_hours",
    "hours_per_bedroom",
    "hours_per_bathroom",
    "hours_per_dining_room",
    "hours_per_living_room",
    "min_hours",
    "max_hours",
    "discount_weekly_pct",
    "discount_fortnightly_pct",
    "discount_four_weekly_pct",
    "slot_minutes",
    "lead_time_hours",
    "max_days_ahead",
  ];
  // Keys where zero would break every quote on the public site — a cleared
  // field used to submit "" which Number() turned into exactly that zero.
  const mustBePositive = new Set(["hourly_rate", "min_hours", "max_hours", "slot_minutes", "max_days_ahead"]);
  for (const key of keys) {
    const raw = formData.get(key);
    if (raw === null || String(raw).trim() === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) continue;
    if (mustBePositive.has(key) && value <= 0) continue;
    await updatePricingRow(key, value);
  }
  invalidatePricingCache();
  revalidatePath("/admin/pricing");
  revalidatePath("/quote");
  redirect("/admin/pricing?saved=1");
}

export async function saveAddon(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  if (!key) return;
  const label = String(formData.get("label") ?? "").trim();
  const price = Number(formData.get("price"));
  const hours = Number(formData.get("hours"));
  const fields = {
    ...(label.length >= 2 ? { label } : {}),
    ...(Number.isFinite(price) && price >= 0 ? { price } : {}),
    active: formData.get("active") === "on",
  };
  // The hours column landed with 2026-07-29-addon-hours.sql; the old
  // pre-migration fallback here was swallowing every genuine failure as
  // success, which is worse than an error page.
  await updateAddon(key, {
    ...fields,
    ...(Number.isFinite(hours) && hours >= 0 ? { hours } : {}),
  });
  invalidatePricingCache();
  revalidatePath("/admin/pricing");
  revalidatePath("/quote");
  redirect("/admin/pricing?saved=1");
}

export async function addServiceArea(formData: FormData) {
  const prefix = String(formData.get("prefix") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{1,2}\d{0,2}$/.test(prefix)) {
    redirect(
      `/admin/pricing?error=${encodeURIComponent("That prefix doesn't look right — e.g. OX or OX4")}`
    );
  }
  await addServiceAreaPrefix(prefix);
  invalidatePricingCache();
  revalidatePath("/admin/pricing");
}

export async function removeServiceArea(formData: FormData) {
  const prefix = String(formData.get("prefix") ?? "");
  if (!prefix) return;
  await removeServiceAreaPrefix(prefix);
  invalidatePricingCache();
  revalidatePath("/admin/pricing");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/admin/login");
}

/* ---------- price adjustments ---------- */

/**
 * Owner approves a cleaner's proposed price change.
 * This is the only path that can raise what a customer pays, and it is the only
 * path that emails them about it.
 */
export async function approveAdjustment(formData: FormData) {
  const id = String(formData.get("adjustment_id") ?? "");
  if (!id) return;

  const adj = await getAdjustment(id);
  if (!adj || adj.status !== "pending") return;
  const booking = await getBooking(adj.booking_id);
  if (!booking) return;

  await setAdjustmentStatus(id, "approved");
  await updateBooking(adj.booking_id, {
    final_price: Number(adj.to_price),
    price_status: "agreed",
  });

  await sendAdjustmentEmail(booking, adj).catch((e) =>
    console.error("[admin] adjustment email failed:", e)
  );

  // The price is agreed now, so the job can finally settle itself.
  const agreed = await getBooking(adj.booking_id);
  if (agreed) await settle(agreed);

  revalidatePath("/admin");
  revalidatePath(`/admin/booking/${adj.booking_id}`);
}

/** Owner says no — the original quote stands and the customer hears nothing. */
export async function rejectAdjustment(formData: FormData) {
  const id = String(formData.get("adjustment_id") ?? "");
  if (!id) return;

  const adj = await getAdjustment(id);
  if (!adj || adj.status !== "pending") return;
  const booking = await getBooking(adj.booking_id);
  if (!booking) return;

  await setAdjustmentStatus(id, "rejected");
  await updateBooking(adj.booking_id, {
    final_price: Number(booking.quoted_price),
    price_status: "agreed",
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/booking/${adj.booking_id}`);
}


/**
 * Raises a Stripe Payment Link for a booking so the admin can send it to the
 * customer. One shared implementation with the pay-at-booking flow and the
 * auto-invoice (lib/paymentLink): it reuses a live link while the amount still
 * matches, and replaces a stale one — the two copies of this logic used to
 * have different failure behaviour on exactly the money path.
 */
export async function createPaymentLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const booking = await getBooking(id);
  if (!booking || booking.status === "paid") return;

  const url = await raiseBookingPaymentLink(booking);
  revalidatePath(`/admin/booking/${booking.id}`);
  revalidatePath("/admin");
  if (!url) {
    redirect(
      `/admin/booking/${id}?sent=fail&why=${encodeURIComponent(
        amountDueFor(booking) > 0 ? "Stripe couldn't create the link" : "nothing is owed on this booking"
      )}`
    );
  }
}

/**
 * Give the money back, and cancel the visit if it hasn't happened yet.
 *
 * Refunds the full amount taken via Stripe. The `charge.refunded` webhook and
 * the direct write below both record it — whichever lands first wins, the
 * other is idempotent noise.
 */
export async function refundBooking(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const booking = await getBooking(id);
  if (!booking) return;

  const paid = paidSoFar(booking);
  if (!booking.stripe_payment_intent || paid <= 0 || booking.refunded_at) {
    redirect(`/admin/booking/${id}?refund=fail&why=${encodeURIComponent("nothing to refund")}`);
  }

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/admin/booking/${id}?refund=fail&why=${encodeURIComponent("Stripe isn't configured")}`);
  }

  let failure: string | null = null;
  let refunded = 0;
  try {
    const refund = await stripe!.refunds.create(
      { payment_intent: booking.stripe_payment_intent! },
      // A double-click must not refund twice.
      { idempotencyKey: `saafi-refund-${booking.id}` }
    );
    refunded = fromPence(refund.amount);
  } catch (e) {
    failure = (e as Error).message ?? "the refund could not be created";
  }
  if (failure) {
    redirect(`/admin/booking/${id}?refund=fail&why=${encodeURIComponent(failure)}`);
  }

  // Record what Stripe ACTUALLY returned, never the running total. Only the
  // last payment intent is stored, so a booking paid in two payments (deposit
  // by link, remainder on card) refunds only the last one here — the office
  // must finish the rest in the Stripe dashboard, and is told so plainly.
  await recordBookingRefund(booking.id, refunded).catch((e) =>
    // The charge.refunded webhook records it as well; this is just the fast path.
    console.error("[admin] refund made but not recorded locally:", e)
  );

  const shortfall = Math.round((paid - refunded) * 100) / 100;
  if (shortfall > 0) {
    await sendOpsAlertEmail({
      subject: `⚠ Refund incomplete — ${booking.reference}`,
      heading: "Only part of this booking's money could be refunded automatically",
      lines: [
        `${booking.customer_name} paid £${paid} in more than one payment; the button refunded the most recent one (£${refunded}).`,
        `Refund the remaining £${shortfall} from the Stripe dashboard — search for ${booking.reference}.`,
      ],
    }).catch(() => {});
  }

  // A refunded future visit is a cancelled visit. A refunded finished job
  // keeps its status — the money story is told by refunded_at.
  if (["requested", "confirmed", "no_access"].includes(booking.status)) {
    const updated = await updateBookingStatus(id, "cancelled");
    const b = updated ?? booking;
    await deactivatePaymentLink(b).catch(() => {});
    await sendBookingCancelledEmail(b, { refundedAmount: refunded }).catch((e) =>
      console.error("[admin] refund cancellation email failed:", e)
    );
    if (b.cleaner_id) {
      const cleaner = (await listCleaners()).find((c) => c.id === b.cleaner_id);
      if (cleaner) {
        await sendCleanerJobChangedEmail(cleaner, b, "cancelled").catch(() => {});
      }
    }
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/booking/${id}`);
  redirect(`/admin/booking/${id}?refund=done`);
}

/* ---------- scheduling ---------- */

/** A cleaner's working pattern — what the availability engine offers customers. */
export async function updateCleanerSchedule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const days = formData
    .getAll("works_days")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  const from = toMinutes(String(formData.get("works_from") ?? ""));
  const to = toMinutes(String(formData.get("works_to") ?? ""));
  // A backwards or zero-length day would make every slot vanish with no clue why.
  if (from === null || to === null || to <= from) {
    redirect(
      `/admin/cleaners?error=${encodeURIComponent("The finish time has to be after the start time")}`
    );
  }

  await updateCleanerHours(id, days, toHHMM(from), toHHMM(to));
  revalidatePath("/admin/cleaners");
}

/**
 * Email the customer their payment link.
 *
 * Separate from raising the link on purpose. Creating a link is reversible and
 * private; sending one is neither, so the owner gets to see the amount on screen
 * before anything reaches a customer — and can still send it over WhatsApp
 * instead, which some customers prefer.
 */
export async function emailPaymentLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const booking = await getBooking(id);
  if (!booking) return;
  if (booking.status === "paid") redirect(`/admin/booking/${id}?sent=already-paid`);

  // Make sure what goes out matches what Stripe will charge: a repriced job
  // gets its stale link replaced here rather than emailed as-is.
  await raiseBookingPaymentLink(booking).catch(() => null);
  const fresh = (await getBooking(id)) ?? booking;

  const result = await sendPaymentLinkEmail(fresh, amountDueFor(fresh));
  if (!result.ok) {
    redirect(`/admin/booking/${id}?sent=fail&why=${encodeURIComponent(result.reason ?? "")}`);
  }

  await markPaymentLinkSent(id);
  revalidatePath(`/admin/booking/${id}`);
  redirect(`/admin/booking/${id}?sent=ok`);
}

/**
 * Take the money off the card on file, if the booking is ready and there is one.
 *
 * Every outcome is fine: no card, price not agreed, a decline, a card that wants
 * the customer present. All of them just mean the payment link is still how this
 * one gets paid, which is exactly how every booking worked before.
 */
async function settle(booking: BookingRow) {
  const result = await settleBookingWithSavedCard(booking).catch((e) => {
    console.error("[admin] automatic charge threw:", e);
    return { ok: false as const, reason: "the charge could not be attempted" };
  });
  console.log(
    result.ok
      ? `[admin] ${booking.reference} settled on the card on file`
      : `[admin] ${booking.reference} not auto-charged — ${result.reason}`
  );

  // No card to charge: the payment link goes out by itself, closing the gap
  // where a completed job sat unbilled until somebody pressed the button.
  // Failures stay silent — the admin's manual send button still exists.
  if (!result.ok) {
    await autoInvoiceIfUnpaid(booking.id);
  }

  revalidatePath(`/admin/booking/${booking.id}`);
}

/**
 * Raise a hosted Stripe page where the customer saves a card, and email it.
 *
 * Setup sessions expire after 24 hours, unlike payment links, so this is raised
 * on demand rather than stored — there is nothing useful to keep.
 */
export async function sendCardSetupLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const booking = await getBooking(id);
  if (!booking) return;

  const customer = booking.customer_id ? await getCustomer(booking.customer_id) : null;
  const link = await createCardSetupLink(booking, customer?.stripe_customer_id ?? null);

  if ("error" in link) {
    redirect(`/admin/booking/${id}?card=fail&why=${encodeURIComponent(link.error)}`);
  }

  const sent = await sendCardSetupEmail(booking, link.url);
  redirect(
    sent.ok
      ? `/admin/booking/${id}?card=sent`
      : `/admin/booking/${id}?card=link&why=${encodeURIComponent(sent.reason ?? "")}&url=${encodeURIComponent(link.url)}`
  );
}

/** Charge the card on file now, rather than waiting for the job to complete. */
export async function chargeCardNow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const booking = await getBooking(id);
  if (!booking) return;

  // The one deliberate "charge before the clean is finished" path.
  const result = await settleBookingWithSavedCard(booking, { allowBeforeCompletion: true }).catch(
    () => ({
      ok: false as const,
      reason: "the charge could not be attempted",
    })
  );

  revalidatePath(`/admin/booking/${id}`);
  redirect(
    result.ok
      ? `/admin/booking/${id}?card=charged`
      : `/admin/booking/${id}?card=declined&why=${encodeURIComponent(result.reason)}`
  );
}

/* ---------- Airbnb calendars ---------- */

function normPostcode(v: string): string | null {
  const p = v.toUpperCase().replace(/\s+/g, "");
  return p || null;
}

export async function addIcalFeed(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const url = get("url").replace(/^webcal:\/\//i, "https://");
  const label = get("label");
  const hostName = get("host_name");
  const hostPhone = get("host_phone");
  let ok = label.length >= 2 && hostName.length >= 2 && hostPhone.length >= 7;
  try {
    if (new URL(url).protocol !== "https:") ok = false;
  } catch {
    ok = false;
  }
  if (!ok) redirect("/admin/airbnb?error=1");

  const hours = Number(get("default_hours"));
  const start = toMinutes(get("default_start_time"));
  const feed = await insertIcalFeed({
    label,
    url,
    host_name: hostName,
    host_phone: hostPhone,
    host_email: get("host_email").toLowerCase() || null,
    address_line: get("address_line") || null,
    postcode: normPostcode(get("postcode")),
    default_hours: Number.isFinite(hours) && hours >= 0.5 && hours <= 12 ? hours : 3,
    default_start_time: start === null ? "11:00" : toHHMM(start),
  }).catch((e) => {
    console.error("[admin] add calendar failed:", e);
    return null;
  });
  if (!feed) redirect("/admin/airbnb?error=2");
  // Read it straight away, so a wrong link shows its error now, not tomorrow.
  if (feed) await syncFeed(feed);
  revalidatePath("/admin/airbnb");
  revalidatePath("/admin/calendar");
  redirect("/admin/airbnb");
}

export async function setIcalFeedActive(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateIcalFeed(id, { active: formData.get("active") === "1" });
  revalidatePath("/admin/airbnb");
}

export async function removeIcalFeed(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const feed = await getIcalFeed(id).catch(() => null);
  // Cascades to its suggestions; confirmed bookings stay — they're real cleans.
  await deleteIcalFeed(id);
  // A removed calendar stops every future Airbnb checkout reaching the CRM,
  // silently. Leave a trail in the office inbox (2026-10-15: one went missing
  // and nobody could say when).
  if (feed) {
    const when = new Date().toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
    await sendOpsAlertEmail({
      subject: `Airbnb calendar removed: ${feed.label}`,
      heading: "An Airbnb calendar was disconnected",
      lines: [
        `${feed.label} was removed from Admin → Airbnb at ${when}.`,
        "New Airbnb bookings for this listing will no longer appear on the calendar until the link is added again.",
      ],
    }).catch(() => {});
  }
  revalidatePath("/admin/airbnb");
  revalidatePath("/admin/calendar");
}

export async function syncIcalFeedsNow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const feed = await getIcalFeed(id);
    if (feed) await syncFeed(feed);
  } else {
    await syncFeeds();
  }
  revalidatePath("/admin/airbnb");
  revalidatePath("/admin/calendar");
}

export async function dismissSuggestion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const s = await getSuggestion(id);
  if (!s) return;
  if (s.status !== "suggested") {
    // A stay shown again because its clean was cancelled may be dismissed too.
    const linked = s.status === "confirmed" && s.booking_id ? await getBooking(s.booking_id) : null;
    const released = s.status === "confirmed" && (!linked || linked.status === "cancelled");
    if (!released) return;
  }
  await updateSuggestion(id, { status: "dismissed", updated_at: new Date().toISOString() });
  revalidatePath("/admin/calendar");
}

/** "I've checked this" on an Airbnb change flag. The note stays, so the same change never re-flags. */
export async function clearSuggestionFlag(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateSuggestion(id, { changed_at: null, updated_at: new Date().toISOString() });
  revalidatePath("/admin/calendar");
  const bookingId = String(formData.get("booking_id") ?? "");
  if (bookingId) revalidatePath(`/admin/booking/${bookingId}`);
}

/* ---------- marketing ---------- */

const segmentOf = (formData: FormData): SegmentFilter =>
  filterFromForm(
    (k) => (formData.get(k) === null ? null : String(formData.get(k))),
    (k) => formData.getAll(k).map(String)
  );

export async function createCampaignAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "Untitled campaign";
  const row = await insertCampaign({ name: name.slice(0, 120), segment: segmentOf(formData) });
  if (!row) redirect("/admin/marketing/campaigns?error=1");
  // A segment picked on the way in means "who" is done: go straight to writing.
  const step = formData.get("from") === "segment" ? "write" : "who";
  redirect(`/admin/marketing/campaign/${row!.id}?step=${step}`);
}

/**
 * The campaign editor, one action for all three steps. Each step's form only
 * carries its own fields, so only fields actually present are written —
 * saving "who" must never blank the message, and the reverse.
 *
 * intent: save (then go to `next`), template:<key>, test, send.
 */
export async function saveCampaignAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const c = id ? await getCampaign(id) : null;
  if (!c) redirect("/admin/marketing/campaigns");
  const base = `/admin/marketing/campaign/${id}`;
  if (c!.status === "sent") redirect(base);

  const has = (k: string) => formData.has(k);
  const get = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max);
  const fields: Partial<CampaignRow> = {};
  if (has("name")) fields.name = get("name", 120) || c!.name;
  if (has("subject")) fields.subject = get("subject", 200);
  if (has("heading")) fields.heading = get("heading", 200);
  if (has("body")) fields.body = String(formData.get("body") ?? "").slice(0, 10_000);
  if (has("highlight")) fields.highlight = get("highlight", 200) || null;
  if (has("cta_label")) fields.cta_label = get("cta_label", 60) || null;
  if (has("cta_url")) {
    const u = get("cta_url", 500);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saaficleaningservice.com";
    fields.cta_url = /^https?:\/\//.test(u) ? u : u.startsWith("/") ? site + u : null;
  }
  // The "who" step marks itself, because an empty filter ("everyone") is a
  // real answer and has no fields of its own.
  if (has("segment_step")) fields.segment = segmentOf(formData);

  const intent = String(formData.get("intent") ?? "save");
  if (intent.startsWith("template:")) {
    const t = CAMPAIGN_TEMPLATES.find((x) => x.key === intent.slice(9));
    if (t) Object.assign(fields, { subject: t.subject, heading: t.heading, body: t.body, highlight: t.highlight, cta_label: t.cta_label, cta_url: t.cta_url });
  }
  if (Object.keys(fields).length) await updateCampaign(id, fields);

  if (intent === "test") {
    const to = process.env.ALERT_EMAIL_TO ?? "";
    const r = to ? await sendCampaignTest(id, to) : { ok: false, reason: "ALERT_EMAIL_TO isn't set" };
    redirect(`${base}?step=send&test=${r.ok ? "ok" : encodeURIComponent(r.reason ?? "failed")}`);
  }
  if (intent === "send") {
    if (formData.get("confirm_send") !== "on") redirect(`${base}?step=send&confirm=1`);
    const r = await sendCampaign(id);
    if (r.error) redirect(`${base}?step=send&err=${encodeURIComponent(r.error)}`);
    redirect(`${base}?step=send&sent=${r.sent}&failed=${r.failed}&left=${r.remaining}`);
  }
  revalidatePath(base);
  const next = String(formData.get("next") ?? "");
  const step = ["who", "write", "send"].includes(next) ? next : String(formData.get("step") ?? "write");
  redirect(`${base}?step=${step}${intent.startsWith("template:") ? "&saved=template" : next ? "" : "&saved=1"}`);
}

export async function testAutomationAction(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  const a = (await listAutomations()).find((x) => x.key === key);
  const to = process.env.ALERT_EMAIL_TO ?? "";
  const r = !a
    ? { ok: false, reason: "not found" }
    : to
      ? await sendAutomationTest(a, to)
      : { ok: false, reason: "ALERT_EMAIL_TO isn't set" };
  redirect(`/admin/marketing/automations?tested=${encodeURIComponent(key)}&ok=${r.ok ? 1 : 0}${r.reason ? `&why=${encodeURIComponent(r.reason)}` : ""}#${key}`);
}

export async function deleteCampaignAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await deleteCampaign(id);
  redirect("/admin/marketing/campaigns");
}

export async function saveAutomationAction(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  if (!(AUTOMATION_KEYS as readonly string[]).includes(key)) return;
  const get = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max);
  const days = Number(get("delay_days", 4));
  const fields: Record<string, unknown> = { enabled: formData.get("enabled") === "on" };
  if (formData.has("subject")) {
    Object.assign(fields, {
      subject: get("subject", 200),
      heading: get("heading", 200),
      body: String(formData.get("body") ?? "").slice(0, 5000),
      cta_label: get("cta_label", 60) || "Book a clean",
      ...(Number.isInteger(days) && days >= 0 && days <= 365 ? { delay_days: days } : {}),
    });
  }
  await updateAutomation(key, fields);
  revalidatePath("/admin/marketing");
  revalidatePath("/admin/marketing/automations");
}

/* ---------- contacts ---------- */

const contactEmail = (formData: FormData) => {
  const e = String(formData.get("email") ?? "").trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(e) ? e : null;
};
const contactPage = (email: string) => `/admin/marketing/contacts/${Buffer.from(email).toString("base64url")}`;

/** "They said yes/no on the phone" — the office's record, with a note of how. */
export async function recordConsentAction(formData: FormData) {
  const email = contactEmail(formData);
  if (!email) return;
  const ok = formData.get("ok") === "yes";
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  await recordManualConsent(email, ok, note);
  redirect(`${contactPage(email)}?done=${ok ? "yes" : "no"}`);
}

export async function unsubscribeContactAction(formData: FormData) {
  const email = contactEmail(formData);
  if (!email) return;
  await suppressEmail(email, "by hand in the CRM");
  redirect(`${contactPage(email)}?done=unsubscribed`);
}

/**
 * Only when the person has asked to be emailed again. Lifts the unsubscribe
 * and records a yes with the office's note, so there's a trail of why.
 */
export async function resubscribeContactAction(formData: FormData) {
  const email = contactEmail(formData);
  if (!email) return;
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  if (!note) redirect(`${contactPage(email)}?done=need-note`);
  await unsuppressEmail(email);
  await recordManualConsent(email, true, `Re-subscribed: ${note}`);
  redirect(`${contactPage(email)}?done=resubscribed`);
}
