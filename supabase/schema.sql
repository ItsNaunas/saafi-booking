-- SAAFI Booking CRM — Phase 1 schema
-- Matches build-plan data model: customers · bookings · pricing_config · service_areas

create extension if not exists "pgcrypto";

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text not null,
  address_line text,
  postcode text,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid references customers(id),
  -- captured raw on request; customer row is linked when the admin CRM lands (Phase 2)
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  address_line text not null,
  postcode text not null,
  bedrooms int not null default 0,
  bathrooms int not null default 0,
  dining_rooms int not null default 0,
  living_rooms int not null default 0,
  hours numeric(3,1) not null,
  customer_provides_products boolean not null default true,
  quoted_price numeric(8,2) not null,
  preferred_date date not null,
  notes text,
  status text not null default 'requested'
    check (status in ('requested','confirmed','completed','paid','cancelled')),
  created_at timestamptz not null default now()
);

-- Config-driven pricing: change rates without a deploy (admin UI edits this in Phase 2).
create table if not exists pricing_config (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now()
);

insert into pricing_config (key, value) values
  ('hourly_rate', 25),          -- spec doc 2026-07-29
  ('product_surcharge', 6),     -- PLACEHOLDER (surcharge-or-free still unconfirmed)
  ('base_hours', 1.5),
  ('hours_per_bedroom', 0.5),
  ('hours_per_bathroom', 0.75),
  ('hours_per_dining_room', 0.5),
  ('hours_per_living_room', 0.5),
  ('min_hours', 2),
  ('max_hours', 8)
on conflict (key) do nothing;

-- Postcode outward-code prefixes served. Empty table = serve everywhere (matches app logic).
create table if not exists service_areas (
  prefix text primary key,
  created_at timestamptz not null default now()
);

-- Lock everything down; the public site only gets insert-on-bookings.
alter table customers enable row level security;
alter table bookings enable row level security;
alter table pricing_config enable row level security;
alter table service_areas enable row level security;

-- The booking form (publishable key = anon role) may CREATE requests, never read.
-- Everything else stays service-role-only until the Phase 2 admin lands.
create policy "public can request bookings"
  on bookings for insert to anon
  with check (status = 'requested');

create index if not exists bookings_status_idx on bookings (status);
create index if not exists bookings_preferred_date_idx on bookings (preferred_date);

-- ===== Tier A (2026-07-21): frequency/recurring, add-ons, cleaners =====

alter table bookings add column if not exists frequency text not null default 'one_off'
  check (frequency in ('one_off','weekly','fortnightly','four_weekly'));
alter table bookings add column if not exists series_id uuid;
alter table bookings add column if not exists recurring_active boolean not null default true;
alter table bookings add column if not exists addons jsonb not null default '[]'::jsonb;
alter table bookings add column if not exists addons_total numeric(8,2) not null default 0;
alter table bookings add column if not exists cleaner_id uuid;

create table if not exists cleaners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text unique,
  token uuid not null default gen_random_uuid(), -- magic-link auth for /c/<token>
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table cleaners enable row level security;

create table if not exists addons (
  key text primary key,
  label text not null,
  price numeric(8,2) not null,
  active boolean not null default true,
  sort int not null default 100
);
alter table addons enable row level security;

insert into addons (key,label,price,sort) values
  ('oven','Oven deep clean',25,10),
  ('fridge','Inside the fridge',15,20),
  ('windows','Inside windows',20,30),
  ('ironing','Ironing (up to 1h)',15,40),
  ('cupboards','Inside kitchen cupboards',15,50)
on conflict (key) do nothing;

-- Spec doc 2026-07-29: all recurring at £22.50/h = 10% off £25.
-- Four-weekly isn't in the doc — assumed the same, pending confirmation.
insert into pricing_config (key,value) values
  ('discount_weekly_pct',10),
  ('discount_fortnightly_pct',10),
  ('discount_four_weekly_pct',10)
on conflict (key) do nothing;

-- Customer auto-create trigger (applied 2026-07-21)
-- security definer so it bypasses RLS from the anon insert path
create or replace function public.handle_booking_customer()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare cid uuid;
begin
  insert into customers (name, email, phone, address_line, postcode)
  values (new.customer_name, new.customer_email, new.customer_phone, new.address_line, new.postcode)
  on conflict (email) do update set
    name = excluded.name, phone = excluded.phone,
    address_line = excluded.address_line, postcode = excluded.postcode
  returning id into cid;
  new.customer_id := cid;
  return new;
end $fn$;
drop trigger if exists booking_customer_trigger on bookings;
create trigger booking_customer_trigger before insert on bookings
for each row execute function public.handle_booking_customer();

create index if not exists bookings_series_idx on bookings (series_id);
create index if not exists bookings_cleaner_idx on bookings (cleaner_id);

-- ===== 2026-07-29: extras add time as well as price (client spec doc §9) =====
-- An extra's price is flat and covers its own labour; its hours extend the
-- booked visit length (bookings.hours stores clean + extras time).

alter table addons add column if not exists hours numeric(4,2) not null default 0;

-- PLACEHOLDER times until SAAFI fill in real figures (editable in /admin/pricing)
update addons set hours = 1.0  where key = 'oven'      and hours = 0;
update addons set hours = 0.5  where key = 'fridge'    and hours = 0;
update addons set hours = 0.5  where key = 'windows'   and hours = 0;
update addons set hours = 1.0  where key = 'ironing'   and hours = 0;
update addons set hours = 0.5  where key = 'cupboards' and hours = 0;
