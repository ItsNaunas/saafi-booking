-- 2026-09-02 deep-clean proof — one paste. Safe to run twice.
--
-- From the 2026-09-01 meeting: a deep clean booking must arrive with evidence
-- of the state of the house (a walkthrough video / photos) or at least a
-- stated reason (moving out, moving in…), so a cleaner never walks into a
-- 5-hour job priced as 2 and SAAFI can refuse work before it damages the
-- reputation rather than after.

-- Why they say the house needs a deep clean. NULL on standard cleans and on
-- deep bookings that attached a walkthrough instead.
alter table bookings add column if not exists deep_reason text;

-- Walkthrough files ride in the existing booking_photos table + private
-- job-photos bucket, phase 'proof' — same plumbing as the cleaners'
-- before/after shots, so the admin page needs no new query.
alter table booking_photos drop constraint if exists booking_photos_phase_check;
alter table booking_photos add constraint booking_photos_phase_check
  check (phase in ('before','after','proof'));
