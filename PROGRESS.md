# PROGRESS — SAAFI Booking CRM

*Updated: 2026-07-29 (spec doc landed — real rates live)*

**State: Phases 1 + 2 + Tier A LIVE at https://saafi-booking.vercel.app.**

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
1. Ask SAAFI (spec-doc open items): Deep Clean pricing (£300 flat vs hourly?) → then build it as a service type; minimum contract for recurring; product surcharge amount; keep four-weekly?
3. Revoke the temporary Supabase PAT (supabase.com/dashboard/account/tokens in SAAFI's account) — build used it, no longer needed. For future hands-off DB work: invite the main Naunas Supabase account into SAAFI's org as Developer.
4. Point `saaficleaningservice.com` (or a subdomain, e.g. `book.`) at the Vercel project — Vercel dashboard → saafi-booking → Domains.
5. Set service-area prefixes once SAAFI confirm coverage postcodes (self-serve in `/admin/pricing`).
6. Resend domain verification for `saaficleaningservice.com` → enable booking alert emails (`RESEND_API_KEY`, `ALERT_EMAIL_TO` in Vercel env); Twilio if SMS confirmations wanted (doc §11).
