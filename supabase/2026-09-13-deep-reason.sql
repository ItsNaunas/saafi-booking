-- 2026-09-13 deep-clean reason — one paste. Safe to run twice.
--
-- A deep clean is priced by the size of the house, not the state of it, so
-- the booking form now makes the customer say why the house needs one
-- (moving out, after building work, and so on). The office reads it before
-- confirming — it is the only warning they get about what they are sending
-- a pair of cleaners into.
--
-- NULL on every standard clean, and on deep bookings taken by phone.

alter table bookings add column if not exists deep_reason text;

comment on column bookings.deep_reason is
  'Deep cleans only: customer''s stated reason (key from DEEP_REASONS in lib/deepClean.ts).';
