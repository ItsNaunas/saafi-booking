-- Records when the payment link was emailed to the customer.
--
-- Without it the admin has no way to show whether a link has already gone out,
-- so the owner either sends twice or, worse, assumes it went and never checks.
-- Null means "raised but not emailed" — which is a normal state, because a link
-- can legitimately be sent over WhatsApp instead.
--
-- Safe to run twice.

alter table bookings add column if not exists payment_link_sent_at timestamptz;

comment on column bookings.payment_link_sent_at is
  'When the Stripe payment link was emailed to the customer. Null = never emailed (may still have been sent by hand).';
