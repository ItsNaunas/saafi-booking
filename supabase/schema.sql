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
  ('hourly_rate', 18),          -- PLACEHOLDER until SAAFI confirm
  ('product_surcharge', 6),     -- PLACEHOLDER
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
