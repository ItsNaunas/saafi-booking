-- 2026-08-28 upgrades — one paste covers everything from the functionality
-- audit. Safe to run twice; every statement is idempotent.
-- SUPERSEDES 2026-08-28-daily-notify.sql (its two columns are included here).

-- ===== daily notify cron sent-markers ====================================
-- NULL = not yet sent. Stamped before sending so a crash mid-run can never
-- email the same customer twice.
alter table bookings add column if not exists reminder_sent_at timestamptz;
alter table bookings add column if not exists payment_chased_at timestamptz;

comment on column bookings.reminder_sent_at is
  'Day-before reminder email: stamped when sent, checked before sending.';
comment on column bookings.payment_chased_at is
  'The one unpaid-link nudge: stamped when sent, never sent twice.';

-- ===== stale payment-link detection ======================================
-- The pounds a booking''s current Stripe link was raised for. When the price
-- moves (approved adjustment, part-payment) the code deactivates the old link
-- and raises a fresh one instead of emailing a link that charges the wrong
-- amount.
alter table bookings add column if not exists payment_link_amount numeric(8,2);

-- ===== refunds ===========================================================
alter table bookings add column if not exists refunded_at timestamptz;
alter table bookings add column if not exists refund_amount numeric(8,2);

comment on column bookings.refunded_at is
  'Money went back to the customer (admin refund button or Stripe dashboard).';

-- ===== Stripe webhook replay log =========================================
-- One row per Stripe event id. Insert-on-conflict-do-nothing makes the
-- webhook idempotent by construction and answers "which events did we see".
create table if not exists stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table stripe_events enable row level security;

-- ===== indexes the audit found missing ===================================
-- Unindexed FK: /admin/reports joins customers -> bookings(count).
create index if not exists bookings_customer_idx on bookings (customer_id);
-- Reconciliation and refund webhooks look bookings up by payment intent.
create index if not exists bookings_payment_intent_idx
  on bookings (stripe_payment_intent) where stripe_payment_intent is not null;
-- The daily cron's two marker scans.
create index if not exists bookings_reminder_scan_idx
  on bookings (preferred_date) where reminder_sent_at is null and status = 'confirmed';
create index if not exists bookings_chase_scan_idx
  on bookings (payment_link_sent_at)
  where payment_chased_at is null and status = 'completed';

-- ===== customer trigger: stop fake/blank emails polluting the table ======
-- Phone bookings without an email used to get a fabricated
-- <digits>@phone.saafi address, which the trigger then upserted into the
-- customers master table — and every fresh booking insert overwrote the
-- customer's real name/phone/address with whatever the new row carried.
-- Now: sentinel/blank emails never touch the customers table, and the upsert
-- only fills gaps rather than overwriting curated fields with blanks.
create or replace function public.handle_booking_customer()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare cid uuid;
begin
  if new.customer_email is null
     or new.customer_email = ''
     or new.customer_email like '%@phone.saafi' then
    return new;
  end if;
  insert into customers (name, email, phone, address_line, postcode)
  values (new.customer_name, new.customer_email, new.customer_phone, new.address_line, new.postcode)
  on conflict (email) do update set
    name = coalesce(nullif(excluded.name, ''), customers.name),
    phone = coalesce(nullif(excluded.phone, ''), customers.phone),
    address_line = coalesce(nullif(excluded.address_line, ''), customers.address_line),
    postcode = coalesce(nullif(excluded.postcode, ''), customers.postcode)
  returning id into cid;
  new.customer_id := cid;
  return new;
end $fn$;
