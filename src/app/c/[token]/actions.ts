"use server";

// Cleaner actions — authenticated by the cleaner's personal token, NOT the admin session.

import { revalidatePath } from "next/cache";
import { getCleanerByToken, getBooking, updateBookingStatus } from "@/lib/supabaseAdmin";

export async function cleanerMarkDone(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const cleaner = await getCleanerByToken(token);
  if (!cleaner || !bookingId) return;

  const booking = await getBooking(bookingId);
  // A cleaner can only complete their own confirmed jobs.
  if (!booking || booking.cleaner_id !== cleaner.id || booking.status !== "confirmed") return;

  await updateBookingStatus(bookingId, "completed");

  // Recurring spawn on cleaner completion too — same engine as the admin path.
  const { FREQUENCY_DAYS } = await import("@/lib/pricing");
  const { insertBooking } = await import("@/lib/supabaseAdmin");
  if (booking.frequency !== "one_off" && booking.recurring_active) {
    const days = FREQUENCY_DAYS[booking.frequency as keyof typeof FREQUENCY_DAYS];
    const next = new Date(booking.preferred_date + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + days);
    await insertBooking({
      reference: `SAAFI-${Date.now().toString(36).toUpperCase()}`,
      customer_id: booking.customer_id,
      customer_name: booking.customer_name,
      customer_email: booking.customer_email,
      customer_phone: booking.customer_phone,
      address_line: booking.address_line,
      postcode: booking.postcode,
      bedrooms: booking.bedrooms,
      bathrooms: booking.bathrooms,
      dining_rooms: booking.dining_rooms,
      living_rooms: booking.living_rooms,
      hours: booking.hours,
      customer_provides_products: booking.customer_provides_products,
      addons: booking.addons,
      addons_total: booking.addons_total,
      frequency: booking.frequency,
      series_id: booking.series_id ?? booking.id,
      recurring_active: true,
      cleaner_id: booking.cleaner_id,
      quoted_price: booking.quoted_price,
      preferred_date: next.toISOString().slice(0, 10),
      notes: booking.notes,
      status: "confirmed",
    }).catch((e) => console.error("[cleaner] recurring spawn failed:", e));
  }

  revalidatePath(`/c/${token}`);
}
