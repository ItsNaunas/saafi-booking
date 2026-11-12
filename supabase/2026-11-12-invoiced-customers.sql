-- 2026-11-12 Invoiced customers: one paste. Safe to run twice.
--
-- Some customers pay SAAFI by invoice, like the Airbnb hosts. With this switch
-- on (Customers page), the site never raises a payment link at booking, never
-- emails one when the clean is done, never sends the day-3 chase and never
-- charges a saved card by itself. The admin's manual buttons still work.

alter table customers add column if not exists invoiced boolean not null default false;

comment on column customers.invoiced is
  'Pays by invoice: no automatic payment links, chases or card charges. Set from the admin Customers page.';
