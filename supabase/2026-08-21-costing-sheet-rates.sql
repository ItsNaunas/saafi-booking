-- Repricing to SAAFI's costing sheet (2026-08-18), superseding the 2026-07-29 spec doc.
--
-- Cleaner pay £15/h. Customer pays £24/h one-off, £21.75/h recurring (= 9.375% off).
-- Both of the sheet's worked examples reconcile exactly:
--   1 bed 1 bath (120 mins)                      -> £48 one-off / £43.50 recurring
--   3 bed 1 bath + windows + laundry (240 mins)  -> £87 recurring
--
-- Room times: kitchen 30 + corridor/landing/stairs 30 are the always-included base;
-- bedroom 30, bathroom 30. Extras are billed as TIME at the hourly rate, not as a
-- flat fee, so every add-on price drops to 0.
--
-- Safe to run twice.

update pricing_config set value = 24,     updated_at = now() where key = 'hourly_rate';
update pricing_config set value = 0,      updated_at = now() where key = 'product_surcharge';  -- "included necessities"
update pricing_config set value = 1,      updated_at = now() where key = 'base_hours';         -- kitchen + corridor
update pricing_config set value = 0.5,    updated_at = now() where key = 'hours_per_bedroom';
update pricing_config set value = 0.5,    updated_at = now() where key = 'hours_per_bathroom'; -- was 0.75
update pricing_config set value = 9.375,  updated_at = now() where key in (
  'discount_weekly_pct', 'discount_fortnightly_pct', 'discount_four_weekly_pct'
);

-- Dining/living rooms aren't itemised for standard cleans in the sheet (only deep,
-- at 60 mins). Every other room is exactly half its deep time, so standard = 30 mins.
update pricing_config set value = 0.5, updated_at = now()
  where key in ('hours_per_dining_room', 'hours_per_living_room');

-- Extras: time-billed, so no flat price. Sheet's standard list is
-- windows / laundry / dusting / fridge at 30 mins; oven is a 60-minute deep task.
update addons set price = 0;

update addons set hours = 0.5, label = 'Inside windows'        where key = 'windows';
update addons set hours = 0.5, label = 'Inside the fridge'     where key = 'fridge';
update addons set hours = 1.0, label = 'Oven deep clean'       where key = 'oven';

-- The sheet lists laundry, not ironing — same slot, renamed.
update addons set hours = 0.5, label = 'Laundry'               where key = 'ironing';

insert into addons (key, label, price, hours, active, sort)
  values ('dusting', 'Dusting', 0, 0.5, true, 45)
  on conflict (key) do update set price = 0, hours = 0.5, active = true;

-- Not in the sheet — hidden rather than deleted, so old bookings still read back.
update addons set active = false where key = 'cupboards';
