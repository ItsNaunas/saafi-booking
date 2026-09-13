-- 2026-09-13 second cleaner — one paste. Safe to run twice.
--
-- A deep clean is a two-person job (it is priced and scheduled that way) but
-- a booking could only hold one cleaner, so the second person had nothing in
-- their portal, no calendar entry and no "Got it" — and the office was
-- coordinating them by phone, which is the thing the portal exists to end.
--
-- Acknowledgment is per person: two cleaners, two taps, two timestamps.

alter table bookings add column if not exists second_cleaner_id uuid references cleaners(id) on delete set null;
alter table bookings add column if not exists second_acknowledged_at timestamptz;

create index if not exists bookings_second_cleaner_idx on bookings (second_cleaner_id);

comment on column bookings.second_cleaner_id is
  'Deep cleans: the second cleaner on the job. NULL on standard cleans.';
comment on column bookings.second_acknowledged_at is
  'When the second cleaner tapped Got it. Mirrors acknowledged_at for the first.';
