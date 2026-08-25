-- A visit that could not happen.
--
-- Until now a booking could only be requested, confirmed, completed, paid or
-- cancelled. A cleaner who arrived and could not get in had nowhere to put that:
-- "completed" is a lie, "cancelled" is a lie, and finishing with zero hours
-- silently repriced the job down to the two-hour minimum as though it had been
-- done quickly. So the honest outcome was simply never recorded.
--
-- `no_access` is deliberately NOT a decision about money. Whether SAAFI charge a
-- call-out for a locked door is their policy and they have not set one, so this
-- records what happened and leaves the price alone for the office to resolve —
-- onward to cancelled (no charge) or completed (charge something).
--
-- Safe to run twice.

alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('requested','confirmed','completed','paid','cancelled','no_access'));

alter table bookings add column if not exists outcome_reason text;
alter table bookings add column if not exists outcome_note   text;

alter table bookings drop constraint if exists bookings_outcome_reason_check;
alter table bookings add constraint bookings_outcome_reason_check
  check (outcome_reason is null or outcome_reason in
    ('no_access','turned_away','unsafe','cleaner_unwell'));

comment on column bookings.outcome_reason is
  'Why a visit did not happen. Set alongside status = no_access; null on every normal booking.';
comment on column bookings.outcome_note is
  'What the cleaner typed at the door. Free text, for the office to judge.';
