-- Sent-markers for the daily notify cron (/api/notify/daily).
-- They exist so a double-fire, a redeploy mid-run, or a manual re-trigger can
-- never email the same customer twice. NULL = not yet sent.

alter table bookings add column if not exists reminder_sent_at timestamptz;
alter table bookings add column if not exists payment_chased_at timestamptz;

comment on column bookings.reminder_sent_at is
  'Day-before reminder email: stamped when sent, checked before sending.';
comment on column bookings.payment_chased_at is
  'The one unpaid-link nudge: stamped when sent, never sent twice.';
