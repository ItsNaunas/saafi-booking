# PROGRESS — SAAFI Booking CRM

*Updated: 2026-08-24 (landing page content audit; repriced; price adjustments built)*

**State: Phases 1 + 2 + Tier A LIVE at https://saafi-booking.vercel.app.**

**2026-08-24 — landing page content audit acted on.**
- The page was selling the *booking*, not the cleaning. Every benefit on it was a transaction benefit (instant price, no callback, no card) and the same claim appeared in up to eight places.
- **The dark five-panel section keeps its layout and loses its content.** It repeated the pricing section directly above it; it now carries the reasons to book that have nothing to do with the number: products included, the same slot every time, honest hours, you approve any change, family-run not an agency (`src/components/TrustShowcase.tsx`, replaces `PriceShowcase.tsx`).
- Every claim in it is verifiable from the product itself. **Vetting, insurance and a re-clean guarantee are deliberately absent** until SAAFI confirm what they can commit to — those are the three strongest panels available.
- **Dropped the three worked price examples.** The live builder defaults to a 3-bed and shows a real figure, so static examples were repetition. `EXAMPLE_HOMES`, `priceFor` and `examples` are gone.
- **Optional extras is rendered once**, in the pricing section. It was in two places about 200px apart.
- **Reordered:** hero, plan picker, what's included, what you can count on, pricing, three steps, FAQs, CTA. Was price-price-price-then-what-you-get. Nav order follows. "Three steps" went white so it doesn't merge into the tinted pricing band above it.
- Repetition after: recurring rate rendered 2x (was 5), saving 1x (was 4), extras 1x (was 2).
- **Still open:** seven "see your price instantly" style claims across hero, plan picker, pricing subhead, steps, FAQs and the closing CTA. That is a copy pass, not a structural one. Two FAQs ("How do you work out the price?", "How long will you stay?") are now answered visually by the pricing section.

**2026-08-22 — landing page: editorial redesign of two sections.**
- **"Every room, every visit"** is no longer a checklist. Asymmetric composition of four circular blocks at four sizes on four baselines, heading left-aligned (the one section head that isn't centred), sized to one viewport via `min-h-svh`.
- **"What a typical home works out at"** is now **"What cleaning usually costs"**: a five-panel expandable showcase (`src/components/PriceShowcase.tsx`, client component). The wide "featured" panel is just the open one — clicking animates `flex-grow`, the title rises, a white detail block reveals, and the open tile lifts slightly out of the row. Snap-scroll carousel below `lg` with the detail always visible, so prices are never behind an interaction.
- Every figure still comes from `examples` / `addons` / `cfg`. No pricing was hard-coded or invented. `formatDuration` moved to `lib/pricing` so both the server page and the client showcase can use it.
- **All corners squared** across the public site except pills and circular icons (`rounded-full`), per client direction.
- Fixed a live text bug from the repricing: the products line rendered "+£0" once the surcharge went to zero.
- Photography slots are wired but empty — one photo exists in the project (`hero-cleaner.jpg`). Set `image` on an `EXAMPLE_HOMES` or `ROOMS` entry and that panel becomes a photograph with overlay, hover scale and open/closed brightness already handled.
- Impeccable design detector clean; build, typecheck and lint clean.

**2026-08-21 — repriced to SAAFI's costing sheet.**
- Sheet (2026-08-18, `Saafi` > Pricing tab) supersedes the 2026-07-29 spec doc. Cleaner pay £15/h; **customer pays £24/h one-off, £21.75/h recurring** (9.375% off, was £25/£22.50).
- **Room times:** base is kitchen 30 + corridor/landing/stairs 30 = 1h (was 1.5h); bedroom 30; **bathroom 30 (was 45)**. Dining/living aren't itemised for standard in the sheet, only deep at 60 — every other room is exactly half its deep time, so standard stays 30.
- **Product surcharge dropped to £0** — both sheet prices are quoted "+ included necessities".
- **Extras are now billed as time, not a flat fee.** The sheet's 3-bed example folds windows and laundry into the 240-minute total with no separate charge. All add-on prices set to 0; `quotePrice` now takes billable hours (clean + extras). The flat-price path stays in the engine for any future fixed-fee extra.
- `quotePrice` no longer caps at `max_hours`. That cap limits what the wizard *recommends*; a genuinely long job has to bill its real time (and the adjustment engine depends on that).
- Extras list matched to the sheet: ironing renamed Laundry, dusting added, cupboards deactivated (kept, not deleted, so old bookings still read back).
- **Impact:** the live site was quoting well over the family's own model — a 1 bed 1 bath one-off was £75 against their £48. Both of the sheet's worked examples are now asserted in `scripts/pricing-check.ts` and reproduce exactly.
- 40/40 checks pass; build clean. **Needs `supabase/2026-08-21-costing-sheet-rates.sql` run before deploy.**
- Still open: **deep clean** as a second service type (£58/room +£5 per extra room of the same type; 2 cleaners at £21/h, 3rd past 9h). Its 1-bed baseline doesn't tie out in the sheet (300 mins vs 180 vs £235), and the additional-bedroom rule adds 75 mins of work for £5, which loses money. Needs SAAFI before building.

**2026-08-20 — domain live + price adjustments built.**
- **https://saaficleaningservice.com is LIVE** (www too). GoDaddy A records point at Vercel; MX/M365 untouched. Also fixed a pre-existing SPF record that was failing auth on `info@` mail (was GoDaddy's `secureserver.net` default, now `spf.protection.outlook.com`).
- **Booking emails switched on.** Resend domain verified (eu-west-1), `RESEND_API_KEY` + `ALERT_EMAIL_TO` set on Production, prod redeployed so they take effect. Sends as `bookings@saaficleaningservice.com` regardless of the other domain on the Resend account (the from address is set in code).
- **Price adjustments (client-requested).** A visit that runs longer or shorter than quoted. Cleaner taps Start/Finish on `/c/<token>`, picks a reason; `lib/adjustments.ts` decides whether money moves. Billable reasons (extra rooms, worse condition, customer added) raise the price *only* after the owner approves in `/admin/booking/<id>`; non-billable ones (cleaner pace, access delay) log the time and leave the quote alone. Running short reprices down automatically. Approval emails the customer the new total and why. Full audit trail in `booking_adjustments`.
- Priced as a **delta on the quote** (extra hours x the frequency's effective rate), not a re-quote, so flat-priced extras are never charged hourly. Floors at the 2h minimum charge.
- **Recurring bug fixed en route:** the spawn copied the completed booking's `hours`/`quoted_price` forward, so an adjusted job would have silently repriced every future clean in the series. Engine extracted to `lib/recurring.ts` (one copy, was two) and now always carries the *quoted* figures forward.
- 33/33 pricing checks pass (`npx tsx scripts/pricing-check.ts`); `npm run build` clean.
- **NOT YET DEPLOYED** — needs `supabase/2026-08-20-price-adjustments.sql` run in SAAFI's SQL editor first.

**2026-07-29 — client spec doc landed** ("Cleaning Quote Tool Spec.docx", the full doc owed since 07-12). Reconciled the build against it:
- **Real rates LIVE**: £25/h one-off; all recurring 10% off = £22.50/h (doc prices weekly/fortnightly at £22.50; four-weekly assumed same — *confirm with SAAFI*). Updated in live `pricing_config` + static fallback. Placeholder-rates era over.
- **Extras now add time as well as price** (doc §9): `addons.hours` column + wizard shows "+£25 · +1h", duration on quote summary, and the booked `hours` stores clean + extras time so admin/calendar/cleaner pages see the real job length. An extra's price stays flat (covers its own labour — not charged again hourly). Migration `supabase/2026-07-29-addon-hours.sql` applied 2026-07-29; live quote form verified serving extras with hours.
- **Admin extras editor**: `/admin/pricing` now edits each extra's name/price/time/active.
- **Doc vs build gaps still open** (need SAAFI answers): Deep Clean service type (£300 flat vs hourly — doc itself flags this unconfirmed), minimum contract length for recurring, product surcharge (£6 still placeholder), whether four-weekly stays.
- 17/17 pricing checks pass.

**Tier A** (2026-07-21, same day as Phase 2): recurring frequencies on the quote (weekly/fortnightly/4-weekly, % discounts, per-clean price preview) · recurring engine (completing a recurring clean auto-books +7/14/28d, stop-recurring in admin) · add-ons at checkout (oven/fridge/windows/ironing/cupboards, DB-priced) · cleaner layer (admin CRUD, per-booking assignment, magic-link mobile job page `/c/<token>` with mark-done that also spawns the next occurrence) · manual phone bookings (`/admin/new`) · edit booking · pipeline search · Reports (revenue by month, pipeline value, recurring series, repeat rate). 16/16 pricing checks; recurring spawn + cleaner token-scoping verified against the live DB; prod smoke passed (£76.30 fortnightly+oven check).

**Phase 1** (2026-07-19): landing + BookingKoala-style quote wizard (postcode → rooms → hours → products → details → quote) + `POST /api/bookings` (server-side validation + price recompute). 11/11 pricing unit checks (`npx tsx scripts/pricing-check.ts`).

**Phase 2** (2026-07-21): full admin CRM at `/admin` — password login (signed-cookie HMAC session, middleware-guarded), bookings pipeline (requested → confirmed → completed → paid, cancel/re-open), calendar agenda view, customers auto-created via DB trigger on booking insert, pricing + service-area editor. **Pricing is now DB-driven** (pricing_config, 60s cache) — admin edits go live on the quote form without deploys; static config is only the fallback. Confirmation email to customer on confirm (dormant until Resend key). Admin password: `ADMIN_PASSWORD` in `.env.local` / Vercel env. Prod smoke-tested: gate redirects, all four admin pages 200 with valid session, booking → trigger → customer verified then cleaned.

**Storage: LIVE (2026-07-19).** Supabase project `SAAFI` (`mnrdupxnyahyfgancran`, **London eu-west-2**) in SAAFI's own account (naufalnassor123@gmail.com's org). Schema + insert-only RLS applied; end-to-end verified: test booking inserted via the app, confirmed in the table, then deleted. Security verified: publishable key can't read bookings and can't insert non-`requested` rows (401). App uses the publishable key (`.env.local`); service keys stay in the Supabase dashboard until Phase 2 needs them. The old auto-created Sydney project (`jfhymeokkkmyriszdezq`) is unused — delete it in their dashboard. Local JSONL fallback still exists for dev without env.

**Deploy: LIVE (2026-07-19).** Vercel project `saafi-booking` (itsnaunas-projects, Hobby), production at **https://saafi-booking.vercel.app**. Env (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) set on Production. Prod smoke test passed: booking submitted on the live site landed in the London Supabase (then deleted).

**Next steps:**
1. **Run both migrations** in SAAFI's Supabase SQL editor, then deploy: `2026-08-20-price-adjustments.sql` (adjustment columns) and `2026-08-21-costing-sheet-rates.sql` (the real rates). Until then the live site keeps quoting the old £25/h numbers.
2. Ask SAAFI (spec-doc open items): Deep Clean pricing (£300 flat vs hourly?) -> then build it as a service type; minimum contract for recurring; product surcharge amount; keep four-weekly?
3. Revoke the temporary Supabase PAT (supabase.com/dashboard/account/tokens in SAAFI's account) — build used it, no longer needed. For future hands-off DB work: invite the main Naunas Supabase account into SAAFI's org as Developer.
4. ~~Point `saaficleaningservice.com` at the Vercel project~~ ✅ 2026-08-20 — apex + www live with SSL.
5. Set service-area prefixes once SAAFI confirm coverage postcodes (self-serve in `/admin/pricing`).
6. ~~Resend domain verification -> booking alert emails~~ ✅ 2026-08-20. Twilio if SMS confirmations wanted (doc §11) — still open.
7. Phase 3 payments (Stripe): card saved at booking, charged after the clean at the approved final price. Needs a Stripe account in the business's name. The adjustment engine above is the half that doesn't need Stripe.
