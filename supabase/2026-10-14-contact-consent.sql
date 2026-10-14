-- 2026-10-14 Consent recorded by hand — one paste. Safe to run twice.
--
-- Phone customers never see the quote form's offers box, so they show as
-- "never asked" and are never emailed. When someone says yes (or no) on the
-- phone, the office records it on their contact page. One row per address,
-- the latest answer; it counts alongside the form answers (latest wins), and
-- an unsubscribe still beats everything.
--
-- Until this is pasted, contact pages show a notice instead of the buttons.

create table if not exists contact_consent (
  email text primary key,
  ok boolean not null,
  note text,
  recorded_at timestamptz not null default now()
);

alter table contact_consent enable row level security;
