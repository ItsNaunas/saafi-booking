# PROGRESS — SAAFI Booking CRM

*Updated: 2026-07-19*

**State:** Phase 1 built and verified locally. Next.js 16 + Tailwind 4 (Turbopack). Landing page + full BookingKoala-style quote wizard (postcode → rooms → hours → products → details → quote) + `POST /api/bookings` with server-side validation and price recompute. Pricing engine is config-driven with PLACEHOLDER rates (£18/h, £6 product surcharge) in `src/lib/pricing.ts` until SAAFI's real table lands. 11/11 pricing unit checks pass (`npx tsx scripts/pricing-check.ts`); prod build clean; API exercised end-to-end (valid booking + rejection paths).

**Storage: LIVE (2026-07-19).** Supabase project `SAAFI` (`mnrdupxnyahyfgancran`, **London eu-west-2**) in SAAFI's own account (naufalnassor123@gmail.com's org). Schema + insert-only RLS applied; end-to-end verified: test booking inserted via the app, confirmed in the table, then deleted. Security verified: publishable key can't read bookings and can't insert non-`requested` rows (401). App uses the publishable key (`.env.local`); service keys stay in the Supabase dashboard until Phase 2 needs them. The old auto-created Sydney project (`jfhymeokkkmyriszdezq`) is unused — delete it in their dashboard. Local JSONL fallback still exists for dev without env.

**Deploy: LIVE (2026-07-19).** Vercel project `saafi-booking` (itsnaunas-projects, Hobby), production at **https://saafi-booking.vercel.app**. Env (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) set on Production. Prod smoke test passed: booking submitted on the live site landed in the London Supabase (then deleted).

**Next steps:**
1. Revoke the temporary Supabase PAT (supabase.com/dashboard/account/tokens in SAAFI's account) — build used it, no longer needed. For future hands-off DB work: invite the main Naunas Supabase account into SAAFI's org as Developer.
2. Point `saaficleaningservice.com` (or a subdomain, e.g. `book.`) at the Vercel project — Vercel dashboard → saafi-booking → Domains.
3. Swap placeholder rates in `pricing_config` (DB) + `src/lib/pricing.ts` when SAAFI's pricing/hours table arrives (Phase 0 blocker, still open).
4. Set `serviceAreaPrefixes` once SAAFI confirm coverage postcodes.
5. Resend domain verification for `saaficleaningservice.com` → enable booking alert emails (`RESEND_API_KEY`, `ALERT_EMAIL_TO` in Vercel env).
6. Phase 2: `/admin` bookings pipeline (requested → confirmed → completed → paid), Supabase auth (needs `sb_secret` key), customer auto-create, confirmation emails.
