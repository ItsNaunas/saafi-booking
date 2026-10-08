-- 2026-10-08 Google review requests — one paste. Safe to run twice.
--
-- The morning after a customer's FIRST completed clean, the daily cron asks
-- them for a Google review (only once GOOGLE_REVIEW_URL is set in Vercel).
-- This marker is what makes that once: stamped before sending, so a re-run
-- never asks twice, and a customer already asked on an earlier booking gets
-- their later bookings stamped without a send.
--
-- Until this is pasted, the cron's review section errors into the morning
-- report and sends nothing; everything else in the run is unaffected.

alter table bookings add column if not exists review_requested_at timestamptz;

comment on column bookings.review_requested_at is
  'Google review ask: stamped when sent, or when skipped because this customer was already asked.';

create index if not exists bookings_review_scan_idx
  on bookings (finished_at)
  where review_requested_at is null;
