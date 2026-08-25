-- Card on file, so a finished clean can settle itself.
--
-- Today the money is asked for at the weakest possible moment: the job is done,
-- the cleaner has left, and only then does somebody raise a link and chase it.
-- SAAFI carry the credit on every single visit, and the payment half of the flow
-- costs four manual actions per job.
--
-- The card is held by Stripe, never here. What is stored is a customer id and a
-- payment-method id — handles, not card details — so nothing on this database
-- would be worth stealing.
--
-- It lives on `customers` rather than `bookings` because a card belongs to the
-- person, not to one visit: save it once, and every future clean in the series
-- can settle against it.
--
-- Safe to run twice.

alter table customers add column if not exists stripe_customer_id       text;
alter table customers add column if not exists stripe_payment_method_id text;
alter table customers add column if not exists card_brand               text;
alter table customers add column if not exists card_last4               text;
alter table customers add column if not exists card_saved_at            timestamptz;

create unique index if not exists customers_stripe_customer_id_idx
  on customers (stripe_customer_id)
  where stripe_customer_id is not null;

-- Where a booking is in the settle-itself flow.
alter table bookings add column if not exists charge_attempted_at timestamptz;
alter table bookings add column if not exists charge_error        text;

comment on column customers.stripe_payment_method_id is
  'Stripe handle for a saved card. No card details are ever stored here.';
comment on column bookings.charge_error is
  'Why an automatic charge failed — usually a decline, or a card needing the customer present. Null once it succeeds.';
