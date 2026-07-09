# FreightVerify — Go-Live Checklist

The **code is build-green** as of 2026-07-09: `tsc --noEmit` clean, ESLint 0
errors, **331 tests passing**. Everything left is **operational** — provisioning
production accounts and wiring credentials on Vercel. Work top to bottom.

> Deploy target is **Vercel** (`vercel.json` + `.vercel/` present). See the
> existing `DEPLOYMENT.md` for any app-specific notes; this file is the ordered
> account-setup runbook around it.

---

## 0. Pre-flight
- [ ] Confirm `.env.local` / `.env.vercel-*` are git-ignored (only `.env.example`
      is tracked) — verified clean, keep it that way.
- [ ] Read `DEPLOYMENT.md` for anything project-specific.

## 1. Database — Supabase (Postgres via Drizzle)
- [ ] Create the **production** Supabase project; get the **pooler** connection
      string → `DATABASE_URL`.
- [ ] Apply migrations: `npm run db:migrate` (drizzle-kit) against the prod
      `DATABASE_URL`. The versioned migrations live in `src/lib/db/migrations`
      (`0000_married_doorman.sql`, `0001_swift_kylun.sql`).
- [ ] **Create Supabase Storage buckets** for carrier **documents** and pickup
      **photos**; confirm bucket policies (the app uploads via `@supabase/ssr`).

## 2. Auth — Clerk (multi-tenant orgs)
- [ ] Create the **production** Clerk instance; set publishable + secret keys.
- [ ] Enable **Organizations** — the whole app is org-scoped (`org_id` on every
      table). Confirm new sign-ups get an organization (onboarding + the Clerk
      webhook that provisions the org row).
- [ ] **Clerk webhook (post-deploy):** add the endpoint
      `https://<domain>/api/webhooks/clerk`, set `CLERK_WEBHOOK_SECRET`.
- [ ] Set the sign-in/up + after-auth URLs (`NEXT_PUBLIC_CLERK_*`).

## 3. Payments — Stripe (Live mode)
- [ ] Live mode: create/confirm the **3 subscription products** →
      `STRIPE_STARTER_PRICE_ID`, `STRIPE_PROFESSIONAL_PRICE_ID`,
      `STRIPE_BUSINESS_PRICE_ID`.
- [ ] Set the live `sk_live_…` + `pk_live_…` keys.
- [ ] **Webhook (post-deploy):** endpoint `https://<domain>/api/webhooks/stripe`
      → set `STRIPE_WEBHOOK_SECRET`. (The handler verifies signatures + is
      idempotent on `stripeEventId`.)

## 4. Product integrations (the ones unique to this app)
- [ ] **FMCSA** carrier-verification API: register for a QCMobile API key → set
      `FMCSA_API_KEY`. Without it, carrier auto-verification degrades gracefully
      but does nothing useful.
- [ ] **Twilio** (driver OTP SMS at the dock): provision an SMS-capable phone
      number; set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
      This is core to the pickup-verification flow — verify a real SMS sends.
- [ ] **Resend** (email): verify the sending **domain** (DNS); set
      `RESEND_API_KEY` + `EMAIL_FROM` on that domain.

## 5. Supporting services
- [ ] **Sentry**: set `SENTRY_DSN` + `SENTRY_AUTH_TOKEN` (build-time source maps).
- [ ] **`CRON_SECRET`**: set it — the two Vercel crons already defined in
      `vercel.json` (`/api/cron/daily` at 06:00, `/api/cron/otp-reminders`
      hourly) are `CRON_SECRET`-protected and won't run without it.

## 6. Deploy on Vercel
- [ ] Import the repo; set **all** env vars above (webhook secrets come after the
      first deploy). Do **not** hardcode `NODE_ENV` (Vercel sets it).
- [ ] First deploy (temporary `*.vercel.app` URL).
- [ ] Add the Stripe + Clerk **webhook endpoints** and their secrets; redeploy.
- [ ] Connect the **custom domain**; update `NEXT_PUBLIC_APP_URL`, the Clerk
      URLs, and the Stripe/Clerk webhook URLs to it; redeploy.
- [ ] Confirm the **cron jobs** appear in Vercel → Settings → Cron Jobs.

## 7. Post-launch smoke test (live domain)
- [ ] Sign up → an organization is created → dashboard loads.
- [ ] Onboard a carrier → **FMCSA verification** returns real data.
- [ ] Upload a compliance document → stored in Supabase Storage.
- [ ] Create + tender a load → carrier accepts via the tender link.
- [ ] **Pickup verification:** driver link → **OTP SMS arrives (Twilio)** →
      geo + photo capture → verification receipt.
- [ ] **Chain integrity:** `/api/events/verify-chain` reports intact.
- [ ] **Live Stripe checkout** → subscription active; billing portal opens.
- [ ] Second org **cannot** see the first org's data (multi-tenant spot-check).
- [ ] Trigger a cron (or wait) → completes; Sentry clean.

## 8. Nice-to-have (not blockers)
- [ ] Self-host the Geist fonts (or `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1`)
      so builds don't depend on Google Fonts availability.
- [ ] Migrate `src/middleware.ts` → the Next 16 `proxy` convention (deprecation
      warning today).
- [ ] Clean up the 40 ESLint unused-var warnings.
- [ ] Expand e2e beyond `e2e/smoke.spec.ts` to the full signup→verify flow.

---

**Critical path:** Supabase + migrations + storage → Clerk orgs → Stripe live →
FMCSA + Twilio → Vercel env → deploy → webhooks + domain → smoke test. Budget the
most time for **Twilio SMS delivery** and the **Stripe/Clerk webhook** round-trips.
