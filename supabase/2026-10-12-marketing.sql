-- 2026-10-12 Marketing emails — one paste. Safe to run twice.
--
-- Built into the CRM: segments are computed live from bookings (nothing to
-- sync), campaigns and automations send through the same Resend account as
-- booking emails, and every marketing email carries a working unsubscribe.
--
--   quote_leads          people who typed an email into the quote form,
--                        whether or not they finished — the abandoned-quote nudge
--   email_suppressions   unsubscribed addresses. Absolute: nothing marketing
--                        ever goes to an address in here
--   email_campaigns      one-off sends to a segment, written in /admin/marketing
--   email_sends          the log. dedupe_key makes every send happen once, so a
--                        campaign that stopped half way resumes, never repeats
--   marketing_automations the automatic emails (abandoned quote, one-off
--                        follow-up, lapsed regular). Off until switched on.

create table if not exists quote_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  phone text,
  postcode text,
  quote jsonb not null default '{}'::jsonb,  -- service, frequency, hours, price, date
  marketing_ok boolean,
  converted_at timestamptz,
  nudged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_suppressions (
  email text primary key,
  reason text not null default 'unsubscribed',
  created_at timestamptz not null default now()
);

create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  heading text not null default '',
  body text not null default '',
  cta_label text,
  cta_url text,
  segment jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  sent_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_sends (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  kind text not null,                         -- 'campaign' | automation key
  campaign_id uuid references email_campaigns(id) on delete set null,
  email text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists email_sends_email_idx on email_sends (email, created_at desc);
create index if not exists email_sends_campaign_idx on email_sends (campaign_id);

create table if not exists marketing_automations (
  key text primary key,
  enabled boolean not null default false,
  delay_days integer not null,
  subject text not null,
  heading text not null,
  body text not null,
  cta_label text not null,
  updated_at timestamptz not null default now()
);

insert into marketing_automations (key, delay_days, subject, heading, body, cta_label) values
  ('abandoned_quote', 0,
   'Your cleaning quote is saved',
   'Still looking for a cleaner, {first_name}?',
   'You started a quote with us but didn''t quite finish. It only takes a minute to pick a time, and nothing is charged until we''ve confirmed your clean.

If anything put you off or you have a question, just reply to this email — it comes straight to us.',
   'Finish my booking'),
  ('one_off_followup', 21,
   'Want that feeling every week?',
   'Thanks again for choosing SAAFI',
   'It''s been a few weeks since your clean. Most people find a regular slot is the easiest way to keep on top of things, and regular cleans cost less per visit than one-offs.

Same cleaner where we can, same time each visit, and you can pause or cancel whenever you like.',
   'See regular prices'),
  ('lapsed_regular', 30,
   'We''d love to have you back',
   'It''s been a while, {first_name}',
   'We noticed your regular cleans stopped. If anything wasn''t right we''d genuinely like to hear about it — just reply.

If you''d like to pick things back up, booking takes a minute and we''ll do our best to get you your old slot.',
   'Book a clean')
on conflict (key) do nothing;

-- Server-only (secret key). Emails and phone numbers: no public policies.
alter table quote_leads enable row level security;
alter table email_suppressions enable row level security;
alter table email_campaigns enable row level security;
alter table email_sends enable row level security;
alter table marketing_automations enable row level security;
