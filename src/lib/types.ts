import type { RoomCounts, Frequency, Addon } from "./pricing";

export type BookingRequest = {
  postcode: string;
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
  notes?: string;
};

export type BookingRecord = Omit<BookingRequest, "addons"> & {
  addons: Addon[]; // resolved with labels + prices at booking time
  addonsTotal: number;
  quotedPrice: number;
  status: "requested";
  createdAt: string;
};
