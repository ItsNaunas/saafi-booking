-- Scheduling: a booking becomes a time, not just a date.
--
-- Until now `bookings.preferred_date` was a bare date, so nothing in the system
-- knew when a clean started. That made three things impossible: telling the
-- customer an arrival time, ordering a cleaner's day, and noticing that two jobs
-- had landed on the same person at the same hour. This adds the time, plus the
-- working hours needed to work out which slots can actually be staffed.
--
-- start_time is nullable on purpose: bookings taken before this migration have no
-- time, and the app treats those as "unscheduled" rather than guessing one.
--
-- Safe to run twice.

alter table bookings add column if not exists start_time time;

-- Cleaner working hours. Days are ISO-ish 0=Sunday .. 6=Saturday, matching
-- JavaScript's getUTCDay() so the app never has to remap them.
alter table cleaners add column if not exists works_days int[] not null default '{1,2,3,4,5}';
alter table cleaners add column if not exists works_from time  not null default '09:00';
alter table cleaners add column if not exists works_to   time  not null default '17:00';

alter table cleaners drop constraint if exists cleaners_works_hours_ck;
alter table cleaners add constraint cleaners_works_hours_ck check (works_from < works_to);

-- The availability check reads every live booking for one date, so that is the index.
create index if not exists bookings_schedule_idx
  on bookings (preferred_date, start_time)
  where status in ('requested', 'confirmed', 'completed', 'paid');

-- Booking-window rules. These live in pricing_config because it already has a
-- 60s cache, an admin editor and a static fallback; nothing here is a price.
insert into pricing_config (key, value) values
  ('slot_minutes',     30),   -- granularity of the offered times
  ('lead_time_hours',  24),   -- earliest a customer may book from now
  ('max_days_ahead',   60)    -- furthest ahead the calendar opens
on conflict (key) do nothing;

comment on column bookings.start_time is
  'Local (Europe/London) start time. Null = taken before scheduling existed, or booked without a slot.';
comment on column cleaners.works_days is
  'Days this cleaner works, 0=Sunday..6=Saturday, matching JS getUTCDay().';
