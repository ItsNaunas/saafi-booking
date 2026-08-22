-- Stripe payments (Phase 3).
--
-- The business already works quote -> phone confirm -> pay, so this follows the
-- build plan: a Payment Link per booking that the admin sends the customer,
-- rather than checkout in the quote flow. Payment Links (unlike Checkout
-- Sessions, which expire within 24h) stay valid, so the link can be texted and
-- paid days later.
--
-- The link id is what the webhook matches on, so it is the column that must be
-- unique and indexed; the URL is only for the admin to copy.
--
-- Safe to run twice.

alter table bookings add column if not exists stripe_payment_link_id  text;
alter table bookings add column if not exists stripe_payment_link_url text;
alter table bookings add column if not exists stripe_payment_intent   text;
alter table bookings add column if not exists amount_paid             numeric(8,2);
alter table bookings add column if not exists paid_at                 timestamptz;

-- The webhook looks a booking up by the payment link that was paid.
create unique index if not exists bookings_stripe_payment_link_id_idx
  on bookings (stripe_payment_link_id)
  where stripe_payment_link_id is not null;

comment on column bookings.stripe_payment_link_id is
  'Stripe Payment Link id (plink_...). Matched by the webhook on checkout.session.completed.';
comment on column bookings.amount_paid is
  'What Stripe actually collected, in GBP. May differ from quoted_price if the job was repriced.';
