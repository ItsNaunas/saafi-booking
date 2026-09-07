import type { RoomCounts, Frequency, Addon } from "./pricing";

export type BookingRequest = {
  postcode: string;
  /** "standard" (hourly) or "deep" (flat per-room). Absent = standard. */
  serviceType?: "standard" | "deep";
  rooms: RoomCounts;
  hours: number;
  customerProvidesProducts: boolean;
  addons: string[]; // addon keys — priced server-side from the DB
  frequency: Frequency;
  name: string;
  email: string;
  phone: string;
  addressLine: string;
  preferredDate: string; // YYYY-MM-DD
  /** "09:30". Optional — an unscheduled booking is a request SAAFI slots by phone. */
  startTime?: string | null;
  notes?: string;
};

export type BookingRecord = Omit<BookingRequest, "addons"> & {
  // `hours` here is the core clean only; extras time is tracked separately and
  // folded into the stored booking duration (hours + addonsHours) at insert.
  addons: Addon[]; // resolved with labels + prices at booking time
  addonsTotal: number;
  addonsHours: number;
  serviceType: "standard" | "deep";
  /** 1 for standard; 2 or 3 for deep, from the elapsed-hours rule. */
  cleanersNeeded: number;
  quotedPrice: number;
  status: "requested";
  createdAt: string;
};
