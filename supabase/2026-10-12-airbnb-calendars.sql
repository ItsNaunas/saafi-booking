-- 2026-10-12 Airbnb calendar import — one paste. Safe to run twice.
--
-- A host pastes their Airbnb "Export calendar" link into /admin/airbnb. The
-- sync reads it and every checkout becomes a SUGGESTED turnover clean on the
-- admin calendar. Nothing is booked or charged until the office confirms one,
-- which opens the normal manual-booking form pre-filled.
--
-- If Airbnb changes a reservation after its clean was confirmed, the booking is
-- never touched automatically — the suggestion is flagged (changed_at) and the
-- office decides. A feed glitch cancelling a real clean is worse than a flag.
--
-- Until this is pasted, /admin/airbnb shows a "paste the migration" notice and
-- the calendar simply shows no suggestions; nothing else is affected.

create table if not exists ical_feeds (
  id uuid primary key default gen_random_uuid(),
  label text not null,                       -- "Flat 2, Cowley Rd"
  url text not null,                         -- the Airbnb export .ics link (secret — treat as a password)
  host_name text not null,
  host_phone text not null,
  host_email text,
  address_line text,
  postcode text,
  default_hours numeric not null default 3,
  default_start_time time not null default '11:00',
  active boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists turnover_suggestions (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references ical_feeds(id) on delete cascade,
  uid text not null,                         -- the reservation's iCal UID — stable across syncs
  summary text,                              -- "Reserved" / "Airbnb (Not available)"
  checkin_date date not null,
  checkout_date date not null,
  next_checkin_date date,                    -- next arrival at this property, if the feed has one
  status text not null default 'suggested'
    check (status in ('suggested', 'confirmed', 'dismissed', 'gone')),
  booking_id uuid references bookings(id) on delete set null,
  changed_at timestamptz,                    -- Airbnb changed after confirmation; needs a human
  change_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (feed_id, uid)
);

create index if not exists turnover_suggestions_checkout_idx
  on turnover_suggestions (checkout_date)
  where status in ('suggested', 'confirmed');

-- Server-only (secret key). No public policies: the feed URLs are secrets.
alter table ical_feeds enable row level security;
alter table turnover_suggestions enable row level security;
