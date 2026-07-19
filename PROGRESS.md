# PROGRESS — SAAFI Booking CRM

*Updated: 2026-07-19*

**State:** Phase 1 built and verified locally. Next.js 16 + Tailwind 4 (Turbopack). Landing page + full BookingKoala-style quote wizard (postcode → rooms → hours → products → details → quote) + `POST /api/bookings` with server-side validation and price recompute. Pricing engine is config-driven with PLACEHOLDER rates (£18/h, £6 product surcharge) in `src/lib/pricing.ts` until SAAFI's real table lands. 11/11 pricing unit checks pass (`npx tsx scripts/pricing-check.ts`); prod build clean; API exercised end-to-end (valid booking + rejection paths).

**Storage:** Supabase-ready (`supabase/schema.sql` has customers/bookings/pricing_config/service_areas + RLS), but the free tier is full (SNAEB + SITH hold both slots) — **project creation blocked**. Until a slot frees, bookings fall back to `.data/bookings.local.jsonl` and the API still returns success. Email alert (Resend) is wired but dormant until `RESEND_API_KEY`/`ALERT_EMAIL_TO` are set (see `.env.example`).

**Deploy:** Vercel blocked too — the claude.ai Vercel connector can list but not create projects (403), and the CLI isn't logged in on this machine.

**Next steps:**
1. **Unblock deploy (Naunas, ~2 min):** `npx vercel login` then `npx vercel --prod` in this repo — or widen the claude.ai Vercel connector's permission to allow project creation and ask Claude to redeploy.
2. **Unblock Supabase (Naunas decision):** pause an idle free project, upgrade the org, or keep JSONL fallback until Phase 2. Then create project `SAAFI` (eu-west-2), apply `supabase/schema.sql`, set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel env.
3. Swap placeholder rates in `src/lib/pricing.ts` (+ `pricing_config` table) when SAAFI's pricing/hours table arrives (Phase 0 blocker, still open).
4. Set `serviceAreaPrefixes` once SAAFI confirm coverage postcodes.
5. Resend domain verification for `saaficleaningservice.com` → enable booking alert emails.
6. Phase 2: `/admin` bookings pipeline (requested → confirmed → completed → paid), Supabase auth, customer auto-create, confirmation emails.
