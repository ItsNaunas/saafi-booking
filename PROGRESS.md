# PROGRESS — SAAFI Booking CRM

*Updated: 2026-08-28 (full functionality audit + fixes: money path, self-serve, hardening)*

**State: LIVE at https://saaficleaningservice.com.**

**2026-09-01 — second audit acted on end-to-end** (commits 3f7051d, 50d6465, 4c0cb41; orchestrated build — money-path corrections done directly, design/UX batches fanned out to parallel agents with file-level specs, then integrated, built, deployed and smoke-tested):
- **Money model**: gross vs net paid split in lib/money.ts (refunds finally subtract), paid-transition gated on money covering the price (a part payment can no longer settle a bill), payment idempotent by intent identity, extra/short/over payments all alert the office, refund records what Stripe actually returned + shortfall alert, Stripe links capped at one completed session, card settle refuses unfinished work, cleaner hours field live-syncs to the clock (ActualHoursField — the stale default was silently billing booked hours), savePricing blank-field zero-wipe fixed, emails lowercased everywhere, per-booking cron error isolation.
- **Public site**: new H1, per-visit copy everywhere (incl. social cards), plan-card hover un-deadened (Reveal releases its inline styles), one CTA colour/shape, a11y pass (accordion aria, focus on dark, contrast, 44px targets), landing page now ISR (1m) prerendered with real DB rates.
- **Quote form**: mobile sticky price bar, "Any time — you pick" chip, per-tab addon selections (deep/standard keyspace collision fixed), on-blur validation + ARIA, human dates.
- **Customer /b page**: two-step cancel, honest requested-state copy, tel: links, tomorrow-floored reschedule, ICS midnight rollover fixed.
- **Admin**: Today run-sheet panel, start time + cleaner on pipeline cards, calendar day view, booking page ordered by urgency (#adjustment anchor), STATUS_LABEL (no raw enums), error boundaries, action feedback + pending states, cleaner-link Copy/WhatsApp buttons.
- **Cleaner portal**: door-order card (address → bold postcode → access notes always shown → Call button), deep-clean crew badge, visible escape hatch, pending states, SAAFI mark.

**2026-08-28 — the audit sweep: every "broken today" finding fixed in one day.** (commits f9f0ca2, 3e646f2, d70c4b2)
- **Money and workflow decoupled** (`src/lib/money.ts` is the single source of what a booking owes). Pay-at-booking no longer freezes a booking at a terminal `paid` — money rides in `amount_paid`/`paid_at`, the booking keeps flowing, and a completed job graduates to `paid` when the money covers it. `ALLOWED.paid → confirmed` is the escape hatch for old stuck rows.
- **Stale payment links die**: the raiser records the amount each link was priced at, deactivates and re-raises on any change; links are also killed on cancel and after payment. `createPaymentLink`/auto-invoice/cleaner-finish all share one implementation now.
- **Refunds exist**: admin button (full refund → cancel future visits → honest email), `charge.refunded`/`charge.dispute.created`/`payment_method.detached` webhook branches, `stripe_events` replay log, part-payment alerts. Cancelling a paid booking routes through the refund.
- **Nightly Stripe reconciliation** in the daily cron repairs any booking paid on Stripe but unmarked here; cron has `maxDuration 300` and reports from a `finally`.
- **Bookings API hardened**: production failures are loud (JSONL fallback is dev-only now), random reference tails, server-side London-clock date validation, 10-minute dedupe on retries, honeypot, length caps.
- **Customer self-serve at `/b/[reference]`** (signed HMAC links in every booking email): view, pay what's due, .ics download, reschedule request, self-serve cancel when >1 day out and unpaid.
- **Visibility**: no_access banner on the pipeline + calendar legend + cleaner receipt; cleaner "Still open" section for past-date confirmed jobs; reports revenue = `amount_paid` net of refunds; manual bookings send confirmation + spawn series + support deep/rooms; PAID chip on prepaid cards.
- **Migration to paste: `supabase/2026-08-28-upgrades.sql`** (supersedes `2026-08-28-daily-notify.sql`; includes its columns). Until pasted, the cron's reminders/chases sections 42703 every morning and stale-link detection is inert.
- Still deliberately open (features, not fixes): multi-cleaner crews for deep cleans, cleaner time-off, day/week dispatch view, pipeline filters, audit trail, customer detail page, photo evidence, Sentry, email outbox/retry.

**2026-08-24 — scheduling: a booking is now a time, not just a date.** (branch `feat/scheduling`)
- `bookings.preferred_date` was a bare date, so nothing knew *when* a clean started. No arrival time for the customer, no order to a cleaner's day, and nothing stopping two jobs landing on one person at the same hour. The quote form was a request form wearing a booking system's clothes.
- **`bookings.start_time`** (nullable — pre-migration rows are "unscheduled", never guessed) and **`cleaners.works_days/works_from/works_to`**, plus `slot_minutes` / `lead_time_hours` / `max_days_ahead` in `pricing_config` so the booking window is editable without a deploy. Migration `supabase/2026-08-24-scheduling.sql`, **not yet applied**.
- **`src/lib/scheduling.ts`** — pure engine, no DB and no clock of its own (`now` is passed in), so all of it is assertable. 59 checks in `scripts/scheduling-check.ts`.
- **Capacity is real.** A slot needs one cleaner free for the whole job; jobs are never split. **Unassigned bookings still consume capacity** — a `requested` job nobody is on yet is work the business has taken, and ignoring that is how a Saturday gets double-sold.
- **`GET /api/availability`** returns only "that time works" or not — never how many cleaners are free, which is the business's information, not the customer's.
- **The wizard gained a "When" step** between How often and Details; the date moved out of Details. Slot state is *derived* from a `day|length` key rather than reset in an effect, so changing either invalidates the previous answer and any time picked from it, with nothing to reset by hand (and no React 19 `set-state-in-effect` violation).
- **The slot is re-checked server-side** at `POST /api/bookings`, exactly like the price — the browser's idea of what was free is never trusted, and a slot taken mid-form returns 409. If availability can't be loaded at all the booking still goes through **unscheduled**, as before: losing a booking is worse than losing a time.
- **Admin overrides on purpose.** Phone bookings and edits set a time with no availability check; the booking page *warns* about a clash in the assigned cleaner's day rather than refusing it.
- **ICS feed now emits timed events** (all-day only when there's no time yet), converted to UTC from London wall-clock so BST and GMT both come out right — verified across the DST boundary and a midnight day-rollback.
- Recurring spawns carry the time forward (same slot every visit); the calendar sorts by time with untimed jobs sinking to the bottom, flagged amber.
- **Degrades safely if the migration hasn't run**: every new query is wrapped, and the UI falls back to unscheduled rather than 500ing.
- Build, typecheck and lint clean; 40/40 pricing + 59/59 scheduling checks pass.
- **Still open:** the deposit/card-on-file work this was the prerequisite for, and a customer-facing reschedule (currently still a phone call).

**Correction to the notes below:** the 2026-08-20 and 2026-08-21 migrations are marked "not yet applied" further down. They **are** applied — verified 2026-08-24 against the live DB (hourly_rate 24, product_surcharge 0, `booking_adjustments` present, Stripe columns present).

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
