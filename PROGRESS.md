# PROGRESS — SAAFI Booking CRM

*Updated: 2026-07-21 (Tier A shipped)*

**State: Phases 1 + 2 + Tier A LIVE at https://saafi-booking.vercel.app.**

**Tier A** (2026-07-21, same day as Phase 2): recurring frequencies on the quote (weekly/fortnightly/4-weekly, % discounts, per-clean price preview) · recurring engine (completing a recurring clean auto-books +7/14/28d, stop-recurring in admin) · add-ons at checkout (oven/fridge/windows/ironing/cupboards, DB-priced) · cleaner layer (admin CRUD, per-booking assignment, magic-link mobile job page `/c/<token>` with mark-done that also spawns the next occurrence) · manual phone bookings (`/admin/new`) · edit booking · pipeline search · Reports (revenue by month, pipeline value, recurring series, repeat rate). 16/16 pricing checks; recurring spawn + cleaner token-scoping verified against the live DB; prod smoke passed (£76.30 fortnightly+oven check).

**Phase 1** (2026-07-19): landing + BookingKoala-style quote wizard (postcode → rooms → hours → products → details → quote) + `POST /api/bookings` (server-side validation + price recompute). 11/11 pricing unit checks (`npx tsx scripts/pricing-check.ts`).

**Phase 2** (2026-07-21): full admin CRM at `/admin` — password login (signed-cookie HMAC session, middleware-guarded), bookings pipeline (requested → confirmed → completed → paid, cancel/re-open), calendar agenda view, customers auto-created via DB trigger on booking insert, pricing + service-area editor. **Pricing is now DB-driven** (pricing_config, 60s cache) — admin edits go live on the quote form without deploys; static config is only the fallback. Confirmation email to customer on confirm (dormant until Resend key). Admin password: `ADMIN_PASSWORD` in `.env.local` / Vercel env. Prod smoke-tested: gate redirects, all four admin pages 200 with valid session, booking → trigger → customer verified then cleaned.

**Storage: LIVE (2026-07-19).** Supabase project `SAAFI` (`mnrdupxnyahyfgancran`, **London eu-west-2**) in SAAFI's own account (naufalnassor123@gmail.com's org). Schema + insert-only RLS applied; end-to-end verified: test booking inserted via the app, confirmed in the table, then deleted. Security verified: publishable key can't read bookings and can't insert non-`requested` rows (401). App uses the publishable key (`.env.local`); service keys stay in the Supabase dashboard until Phase 2 needs them. The old auto-created Sydney project (`jfhymeokkkmyriszdezq`) is unused — delete it in their dashboard. Local JSONL fallback still exists for dev without env.

**Deploy: LIVE (2026-07-19).** Vercel project `saafi-booking` (itsnaunas-projects, Hobby), production at **https://saafi-booking.vercel.app**. Env (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) set on Production. Prod smoke test passed: booking submitted on the live site landed in the London Supabase (then deleted).

**Next steps:**
1. Revoke the temporary Supabase PAT (supabase.com/dashboard/account/tokens in SAAFI's account) — build used it, no longer needed. For future hands-off DB work: invite the main Naunas Supabase account into SAAFI's org as Developer.
2. Point `saaficleaningservice.com` (or a subdomain, e.g. `book.`) at the Vercel project — Vercel dashboard → saafi-booking → Domains.
3. Swap placeholder rates in `pricing_config` (DB) + `src/lib/pricing.ts` when SAAFI's pricing/hours table arrives (Phase 0 blocker, still open).
4. Set `serviceAreaPrefixes` once SAAFI confirm coverage postcodes.
5. Resend domain verification for `saaficleaningservice.com` → enable booking alert emails (`RESEND_API_KEY`, `ALERT_EMAIL_TO` in Vercel env).
6. Phase 2: `/admin` bookings pipeline (requested → confirmed → completed → paid), Supabase auth (needs `sb_secret` key), customer auto-create, confirmation emails.
