-- Deep clean as a first-class service type (2026-08-25 review).
-- Pricing is flat-rate per room (£58 first / +£5 additional, £58 extras) and
-- lives in code (src/lib/deepClean.ts), not pricing_config: it shares nothing
-- with the hourly model that table describes.

alter table bookings add column if not exists service_type text not null default 'standard'
  check (service_type in ('standard','deep'));

-- Deep jobs are staffed in pairs (three past the 6h elapsed ceiling); the
-- pipeline needs to see that without re-deriving it.
alter table bookings add column if not exists cleaners_needed int not null default 1;

comment on column bookings.service_type is
  'standard = hourly model (pricing_config); deep = flat per-room model (lib/deepClean.ts)';
comment on column bookings.cleaners_needed is
  'Deep cleans: 2, or 3 past the 6h elapsed ceiling. Standard cleans: 1.';

-- Cleaner job-page location stamps (2026-08-25 review, scoped deliberately):
-- one fix at start, one at finish, nothing continuous. The cleaner page says
-- what is captured before they tap.
alter table bookings add column if not exists started_lat double precision;
alter table bookings add column if not exists started_lng double precision;
alter table bookings add column if not exists finished_lat double precision;
alter table bookings add column if not exists finished_lng double precision;
