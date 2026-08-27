// Booking reference generation, shared by the public API and the recurring
// engine. The old form was the millisecond clock alone — two submits in the
// same millisecond collided on the unique constraint and one booking died with
// a 409. The random tail makes that a lottery loss instead of a Tuesday.

import { randomBytes } from "crypto";

export function newReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const tail = randomBytes(2).toString("hex").toUpperCase();
  return `SAAFI-${ts}${tail}`;
}
