-- Run once in the Supabase SQL editor (project SAAFI / mnrdupxnyahyfgancran).
-- Extras add time as well as price (client spec doc §9): an extra's price is
-- flat and covers its own labour; its hours extend the booked visit length.
-- Times below are PLACEHOLDERS — editable afterwards in /admin/pricing.

alter table addons add column if not exists hours numeric(4,2) not null default 0;

update addons set hours = 1.0  where key = 'oven'      and hours = 0;
update addons set hours = 0.5  where key = 'fridge'    and hours = 0;
update addons set hours = 0.5  where key = 'windows'   and hours = 0;
update addons set hours = 1.0  where key = 'ironing'   and hours = 0;
update addons set hours = 0.5  where key = 'cupboards' and hours = 0;

select key, label, price, hours, active from addons order by sort;
