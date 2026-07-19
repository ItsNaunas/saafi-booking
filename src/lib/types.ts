import type { RoomCounts } from "./pricing";

export type BookingRequest = {
  postcode: string;
  rooms: RoomCounts;
  hours: number;
  customerProvidesProducts: boolean;
  name: string;
  email: string;
  phone: string;
  addressLine: string;
  preferredDate: string; // YYYY-MM-DD
  notes?: string;
};

export type BookingRecord = BookingRequest & {
  quotedPrice: number;
  status: "requested";
  createdAt: string;
};
