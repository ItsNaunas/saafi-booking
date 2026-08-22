-- Price adjustments (2026-08-20)
-- A visit that runs longer or shorter than quoted. The customer only ever pays
-- more when the JOB was bigger than booked, never because the cleaner was slow.
--
-- Safe to run twice.

-- The original quote is now immutable; actuals live in their own columns.
alter table bookings add column if not exists quoted_hours numeric(4,2);
update bookings set quoted_hours = hours where quoted_hours is null;

alter table bookings add column if not exists actual_hours  numeric(4,2);
alter table bookings add column if not exists final_price   numeric(8,2);
alter table bookings add column if not exists started_at    timestamptz;
alter table bookings add column if not exists finished_at   timestamptz;
alter table bookings add column if not exists price_status  text not null default 'quoted';

do $$ begin
  alter table bookings add constraint bookings_price_status_check
    check (price_status in ('quoted','pending','agreed'));
exception when duplicate_object then null; end $$;

-- One row per time difference, whether or not it changed the price.
-- This is the audit trail: who said what, when, and who approved it.
create table if not exists booking_adjustments (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  from_hours  numeric(4,2) not null,
  to_hours    numeric(4,2) not null,
  from_price  numeric(8,2) not null,
  to_price    numeric(8,2) not null,
  reason_code text not null
    check (reason_code in ('extra_rooms','worse_condition','customer_added','access_delay','cleaner_pace')),
  note        text,
  chargeable  boolean not null default false,
  cleaner_id  uuid,
  -- 'auto' = no approval needed (job ran short, or the reason doesn't bill)
  status      text not null default 'pending'
    check (status in ('pending','approved','rejected','auto')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

alter table booking_adjustments enable row level security;

create index if not exists adjustments_booking_idx on booking_adjustments (booking_id);
create index if not exists adjustments_status_idx  on booking_adjustments (status);
create index if not exists bookings_price_status_idx on bookings (price_status);
