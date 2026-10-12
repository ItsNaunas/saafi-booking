-- 2026-10-12 Marketing, part 2 — one paste. Safe to run twice.
--
-- * bookings.heard_from: the quote form's new "How did you hear about us?"
-- * email_campaigns.highlight: an optional offer box in the campaign email
-- * four more automations, all OFF until switched on in /admin/marketing:
--     mover_followup     ~14 days after a moving-out / moving-in deep clean
--     seasonal_deep      March and September, to people due a deep clean
--     referral_ask       after a happy customer's 3rd completed clean
--     at_risk_checkin    a few days after something went wrong — a
--                        personal "how did we do", never an offer

alter table bookings add column if not exists heard_from text;
comment on column bookings.heard_from is 'Quote form: how did you hear about us (google, instagram, friend, ...).';

alter table email_campaigns add column if not exists highlight text;

insert into marketing_automations (key, delay_days, subject, heading, body, cta_label) values
  ('mover_followup', 14,
   'Settled into the new place?',
   'Hope the move went smoothly, {first_name}',
   'Thanks for trusting us with your move. Once the boxes are unpacked, a regular clean is the easiest way to keep the new place feeling new.

And if you know a landlord, letting agent or friend who''s moving, we''d be grateful for the introduction — most of our work comes from word of mouth.',
   'Book a clean at the new place'),
  ('seasonal_deep', 0,
   'Time for a proper reset?',
   'A seasonal deep clean, {first_name}',
   'Twice a year is a good rhythm for the jobs a regular clean doesn''t reach: inside cupboards, skirting boards, behind and under things, limescale that''s crept back.

It''s priced by room, so you''ll see the full price before you book.',
   'See deep clean prices'),
  ('referral_ask', 0,
   'A small favour, {first_name}?',
   'Thank you for sticking with us',
   'We''re a small family business and most of our new customers come from people like you mentioning us. If a friend, neighbour or colleague is looking for a cleaner, we''d really appreciate you passing our name on.

They can book online in a couple of minutes, or just ask them to mention your name when they call.',
   'Share SAAFI'),
  ('at_risk_checkin', 2,
   'How did we do, {first_name}?',
   'We''d like to put things right',
   'We noticed your recent clean didn''t go quite to plan, and we''re sorry about that.

If there''s anything we could have done better, just reply to this email — it comes straight to the family, and we read every one.',
   'Get in touch')
on conflict (key) do nothing;
