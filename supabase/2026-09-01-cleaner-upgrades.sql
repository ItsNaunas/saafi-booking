-- 2026-09-01 cleaner-portal upgrades — one paste. Safe to run twice.
--
-- Everything here serves one goal: a cleaner's day producing honest data
-- without a phone call. Acknowledgments close the "assigned but never seen"
-- gap, issues give mid-job problems a home, time off makes the rota
-- trustworthy, photos are dispute armour.

-- ===== job acknowledgment ================================================
-- Stamped when the cleaner taps "Got it" on an assigned job. NULL = the
-- office has no proof the cleaner knows this job exists.
alter table bookings add column if not exists acknowledged_at timestamptz;

-- ===== mid-job issue reports =============================================
-- Non-terminal problems: breakage, supplies, a worrying situation. The
-- terminal "visit can't happen" flow stays separate (outcome_reason).
create table if not exists booking_issues (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  cleaner_id uuid references cleaners(id) on delete set null,
  category text not null check (category in ('breakage','supplies','customer_request','safety','other')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists booking_issues_booking_idx on booking_issues (booking_id);
alter table booking_issues enable row level security;

-- ===== cleaner time off ==================================================
-- Requested by the cleaner from their portal, decided by the office. Only
-- APPROVED rows affect availability; the scheduling engine treats those
-- dates as the cleaner not existing.
create table if not exists cleaner_time_off (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references cleaners(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint sensible_range check (to_date >= from_date)
);
create index if not exists cleaner_time_off_cleaner_idx on cleaner_time_off (cleaner_id);
create index if not exists cleaner_time_off_range_idx
  on cleaner_time_off (from_date, to_date) where status = 'approved';
alter table cleaner_time_off enable row level security;

-- ===== job photos ========================================================
-- Metadata only — the images live in the private 'job-photos' storage
-- bucket (created via the storage API, not SQL). Optional on every job by
-- deliberate default: whether photos become required is the family's call.
create table if not exists booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  cleaner_id uuid references cleaners(id) on delete set null,
  phase text not null check (phase in ('before','after')),
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists booking_photos_booking_idx on booking_photos (booking_id);
alter table booking_photos enable row level security;
