-- 2026-09-17 ops events — one paste. Safe to run twice.
--
-- Two small tables, both in service of the same thing: the office finds out.
--
-- ops_email_failures — every rejected send. The mailer swallows failures by
-- design ("a mail provider having a bad afternoon must never stop a booking,
-- a payment or a cleaner's day"), which is right, and which also meant a
-- quiet day and a dead mailer looked identical from the outside. Resend's
-- free tier stops at 100/day and 3,000/month; the first sign of hitting it
-- would otherwise be a customer ringing about a confirmation that never came.
-- /api/health reads the count, so an external monitor can alarm on it WITHOUT
-- going through the mail provider that is the thing failing.
--
-- ops_office_queue — the FYI notices to the office that used to be one email
-- each, drained into a single digest by the 07:00 cron. Only the notices
-- nobody has to act on the moment they land are queued; a wasted journey, an
-- approval, a money mismatch or a cleaner reporting a problem all still send
-- immediately. See lib/email.ts.

create table if not exists ops_email_failures (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  -- 'resend' | 'brevo' — which one turned it down.
  provider text        not null,
  -- HTTP status. NULL when the request threw before a reply (DNS, timeout).
  status   integer,
  subject  text,
  detail   text
);

create index if not exists ops_email_failures_at_idx on ops_email_failures (at desc);

comment on table ops_email_failures is
  'Rejected email sends. Read by /api/health so an external monitor can alarm.';

create table if not exists ops_office_queue (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  title      text        not null,
  detail     text,
  booking_id uuid,
  -- NULL = still waiting for the next digest.
  sent_at    timestamptz
);

-- Partial index: the only query is "what's still waiting", oldest first.
create index if not exists ops_office_queue_pending_idx
  on ops_office_queue (at) where sent_at is null;

comment on table ops_office_queue is
  'Non-urgent office FYIs, batched into one digest by the daily cron.';
