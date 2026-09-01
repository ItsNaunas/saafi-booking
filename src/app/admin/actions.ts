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
  updateCleanerHours,
  getBooking,
  getCustomer,
  getAdjustment,
  setAdjustmentStatus,
  amountDueFor,
  paidSoFar,
  recordBookingRefund,
  markPaymentLinkSent,
  type BookingStatus,
  type BookingRow,
} from "@/lib/supabaseAdmin";
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
import { toMinutes, toHHMM } from "@/lib/scheduling";

const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_access"],
  completed: ["paid"],
  // Escape hatch for a booking that reached `paid` while the work was still
  // outstanding (the pre-2026-08-28 webhook did this to every prepaid
  // booking): push it back into the flow. Its money survives in amount_paid.
  paid: ["confirmed"],
  cancelled: ["requested"], // allow re-opening a cancelled request
  // A wasted journey is unresolved, not finished. The office decides which it
  // becomes: cancelled and nobody pays, or completed and something is charged.
  no_access: ["cancelled", "completed", "confirmed"],
};

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
    if (updated.cleaner_id) {
      const cleaner = (await listCleaners()).find((c) => c.id === updated.cleaner_id);
      if (cleaner) {
        await sendCleanerJobChangedEmail(cleaner, updated, "cancelled").catch((e) =>
          console.error("[admin] cleaner cancellation email failed:", e)
        );
      }
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
  const cleanerId = String(formData.get("cleaner_id") ?? "");
  if (!id) return;
  const before = await getBooking(id);
  const updated = await updateBooking(id, { cleaner_id: cleanerId || null });

  // Reassignment: the cleaner who just lost the job used to find out by
  // opening their link and noticing it gone — or worse, by both turning up.
  if (updated && before?.cleaner_id && before.cleaner_id !== (cleanerId || null)) {
    const old = (await listCleaners()).find((c) => c.id === before.cleaner_id);
    if (old) {
      await sendCleanerJobChangedEmail(old, updated, "reassigned").catch((e) =>
        console.error("[admin] cleaner reassignment email failed:", e)
      );
    }
  }

  // Tell them. Until this existed a cleaner found out they had a job only by
  // opening their link and noticing something new sitting there.
  if (updated && cleanerId) {
    const cleaner = (await listCleaners()).find((c) => c.id === cleanerId);
    if (cleaner) {
      await sendCleanerAssignedEmail(cleaner, updated).catch((e) =>
        console.error("[admin] cleaner assignment email failed:", e)
      );
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/booking/${id}`);
}

export async function addCleaner(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  if (name.length < 2 || phone.length < 7) return;
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

export async function createManualBooking(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("name");
  const phone = get("phone");
  const preferredDate = get("preferred_date");
  if (name.length < 2 || phone.length < 7 || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    redirect("/admin/new?error=1");
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
  if (!row) redirect("/admin/new?error=2");

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
  redirect("/admin");
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
      if (moved && updated.cleaner_id && updated.status === "confirmed") {
        const cleaner = (await listCleaners()).find((c) => c.id === updated.cleaner_id);
        if (cleaner) {
          await sendCleanerJobChangedEmail(cleaner, updated, "moved").catch((e) =>
            console.error("[admin] cleaner moved email failed:", e)
          );
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
}

export async function addServiceArea(formData: FormData) {
  const prefix = String(formData.get("prefix") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{1,2}\d{0,2}$/.test(prefix)) return;
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
  if (from === null || to === null || to <= from) return;

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
