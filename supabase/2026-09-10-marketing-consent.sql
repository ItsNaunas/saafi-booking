-- 2026-09-10 marketing consent — one paste. Safe to run twice.
--
-- The booking form now offers a clear way to refuse marketing email at the
-- moment the address is collected: the "opportunity to refuse" that PECR's
-- soft opt-in requires. The booking row is the record of that moment —
-- created_at says when, this column says what they chose.
--
-- NULL = never offered the choice (phone bookings, anything before this
-- column existed). Treat NULL as no.

alter table bookings add column if not exists marketing_ok boolean;

comment on column bookings.marketing_ok is
  'Soft opt-in: true = left the marketing box ticked when booking. NULL = never offered, treat as no.';
