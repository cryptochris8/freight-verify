# FreightVerify - Deployment Guide

Complete guide to deploying FreightVerify to production on Vercel with all required third-party services.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Supabase Setup (Database & Storage)](#2-supabase-setup-database--storage)
3. [Clerk Setup (Authentication)](#3-clerk-setup-authentication)
4. [Stripe Setup (Billing)](#4-stripe-setup-billing)
5. [Twilio Setup (SMS)](#5-twilio-setup-sms)
6. [FMCSA API Registration](#6-fmcsa-api-registration)
7. [Resend Setup (Email)](#7-resend-setup-email)
8. [Sentry Setup (Error Monitoring)](#8-sentry-setup-error-monitoring)
9. [Vercel Deployment](#9-vercel-deployment)
10. [Environment Variables Configuration](#10-environment-variables-configuration)
11. [Post-Deployment Verification](#11-post-deployment-verification)
12. [Custom Domain Setup](#12-custom-domain-setup)

---

## 1. Prerequisites

You will need accounts with each of the following services. Create them before proceeding.

| Service | URL | Purpose |
|---------|-----|---------|
| **Vercel** | https://vercel.com | Hosting & deployment |
| **Clerk** | https://clerk.com | Authentication & multi-tenant orgs |
| **Supabase** | https://supabase.com | PostgreSQL database & file storage |
| **Stripe** | https://stripe.com | Subscription billing |
| **Twilio** | https://twilio.com | SMS delivery for OTP |
| **Resend** | https://resend.com | Transactional email (daily digests) |
| **Sentry** | https://sentry.io | Error monitoring & performance |
| **FMCSA** | https://mobile.fmcsa.dot.gov/developer | Carrier verification API |

**Local tooling required:**

- Node.js 20+ and npm
- Git
- Vercel CLI: `npm i -g vercel`
- Stripe CLI (for local webhook testing): https://stripe.com/docs/stripe-cli

---

## 2. Supabase Setup (Database & Storage)

Supabase provides the PostgreSQL database (accessed via Drizzle ORM) and object storage for documents and photos. Supabase is **not** used for authentication; Clerk handles that.

### 2.1 Create a Supabase Project

1. Go to https://supabase.com/dashboard and click **New Project**.
2. Choose your organization (or create one).
3. Enter a project name (e.g., `freightverify-prod`).
4. Set a strong database password -- save it securely; you will need it for `DATABASE_URL`.
5. Select the region closest to your users (e.g., `us-east-1`).
6. Click **Create new project** and wait for provisioning to complete.

### 2.2 Get Connection Credentials

1. Go to **Project Settings > Database**.
2. Under **Connection string**, select the **URI** tab.
3. Copy the connection string. It will look like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
4. Use the **port 6543** (Transaction mode / PgBouncer) variant for production. This is your `DATABASE_URL`.

5. Go to **Project Settings > API** and copy:
   - **Project URL** --> `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** --> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** --> `SUPABASE_SERVICE_ROLE_KEY`

### 2.3 Run Drizzle Migrations

With `DATABASE_URL` set in your `.env.local` (or exported in your shell), run:

```bash
npx drizzle-kit push
```

Or if you have a migration folder already generated:

```bash
npx drizzle-kit migrate
```

Verify the tables were created by checking **Table Editor** in the Supabase dashboard.

### 2.4 Configure Storage Buckets

1. In the Supabase dashboard, go to **Storage**.
2. Create the following buckets:

   | Bucket Name | Public | Purpose |
   |-------------|--------|---------|
   | `documents` | No (private) | BOL uploads, carrier documents, compliance files |
   | `photos` | No (private) | Shipment condition photos, proof of delivery |

3. For each bucket, click **Policies** and add RLS policies. Since authentication is handled by Clerk (not Supabase Auth), you will use the **service role key** on the server side to manage uploads. Example policy approach:
   - Keep buckets **private** (no public access).
   - All uploads and downloads go through your Next.js API routes, which authenticate via Clerk and then use the Supabase service role client to interact with storage.

4. (Optional) Set file size limits under each bucket's settings:
   - `documents`: 10 MB max
   - `photos`: 5 MB max

---

## 3. Clerk Setup (Authentication)

Clerk provides authentication with built-in support for multi-tenant organizations, which FreightVerify uses to separate carrier companies, brokers, and shippers.

### 3.1 Create a Clerk Application

1. Go to https://dashboard.clerk.com and click **Create application**.
2. Name it `FreightVerify` (or `FreightVerify Production`).
3. Under **Sign in options**, enable:
   - Email address
   - Phone number (for Twilio OTP -- see note below)
4. Click **Create application**.

### 3.2 Get API Keys

1. Go to **API Keys** in the left sidebar.
2. Copy:
   - **Publishable key** --> `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** --> `CLERK_SECRET_KEY`

### 3.3 Enable Organizations (Multi-Tenant)

1. Go to **Organizations** in the left sidebar.
2. Toggle **Enable organizations** to ON.
3. Under **Organization settings**, configure:
   - Allow users to create organizations: **Yes** (carriers/brokers create their own org on signup).
   - Max allowed memberships: Set per your business rules or leave unlimited.
4. Configure organization roles if needed (e.g., `admin`, `dispatcher`, `driver`, `viewer`).

### 3.4 Configure Redirect URLs

1. Go to **Paths** (or **URLs & Redirects**) in the Clerk dashboard.
2. Set the following:
   - **Sign-in URL**: `/login`
   - **Sign-up URL**: `/signup`
   - **After sign-in URL**: `/dashboard`
   - **After sign-up URL**: `/onboarding`
3. Under **Allowed redirect origins**, add:
   - `http://localhost:3000` (development)
   - `https://your-production-domain.com` (production)
   - `https://your-app.vercel.app` (Vercel preview)

### 3.5 Configure Webhook for User Sync

This webhook syncs Clerk user/org events to your Supabase database.

1. Go to **Webhooks** in the Clerk dashboard.
2. Click **Add Endpoint**.
3. Set the URL to: `https://your-domain.com/api/webhooks/clerk`
4. Select the following events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
   - `organization.created`
   - `organization.updated`
   - `organization.deleted`
   - `organizationMembership.created`
   - `organizationMembership.updated`
   - `organizationMembership.deleted`
5. Click **Create**.
6. Copy the **Signing Secret** --> `CLERK_WEBHOOK_SECRET`.

### 3.6 Twilio Integration for OTP (Optional)

If you want Clerk to use your own Twilio number for SMS OTP rather than Clerk's built-in SMS:

1. In Clerk dashboard, go to **SMS** settings.
2. Choose **Custom SMS provider**.
3. Enter your Twilio credentials (Account SID, Auth Token, Phone Number).

Alternatively, if your app sends OTP via its own API routes using Twilio directly, skip this step and use the `TWILIO_*` env vars in your app code.

---

## 4. Stripe Setup (Billing)

FreightVerify uses Stripe for subscription billing with three tiers.

### 4.1 Create Products and Prices

1. Go to https://dashboard.stripe.com/products and click **Add product**.
2. Create each of the following products:

   **Product 1: Starter**
   - Name: `Starter`
   - Description: `For small carriers and owner-operators`
   - Click **Add price**:
     - Pricing model: Standard
     - Price: `$149.00`
     - Billing period: Monthly
     - Click **Save**
   - Copy the **Price ID** (starts with `price_`) --> `STRIPE_STARTER_PRICE_ID`

   **Product 2: Professional**
   - Name: `Professional`
   - Description: `For growing carriers and mid-size brokers`
   - Price: `$399.00` / month
   - Copy Price ID --> `STRIPE_PROFESSIONAL_PRICE_ID`

   **Product 3: Business**
   - Name: `Business`
   - Description: `For large fleets and enterprise brokers`
   - Price: `$799.00` / month
   - Copy Price ID --> `STRIPE_BUSINESS_PRICE_ID`

### 4.2 Get API Keys

1. Go to **Developers > API keys**.
2. Copy:
   - **Publishable key** --> `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** --> `STRIPE_SECRET_KEY`

### 4.3 Configure Webhook

1. Go to **Developers > Webhooks** and click **Add endpoint**.
2. Set the URL to: `https://your-domain.com/api/webhooks/stripe`
3. Select the following events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Click **Add endpoint**.
5. Copy the **Signing secret** --> `STRIPE_WEBHOOK_SECRET`.

### 4.4 Local Development with Stripe CLI

For testing webhooks locally:

```bash
# Login to Stripe CLI
stripe login

# Forward webhook events to your local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# The CLI will print a webhook signing secret (whsec_...) -- use that as
# STRIPE_WEBHOOK_SECRET in your .env.local for development
```

### 4.5 Switch to Live Mode

When ready for production:

1. Complete Stripe account activation (business details, bank account).
2. Toggle from **Test mode** to **Live mode** in the Stripe dashboard.
3. Recreate products/prices in live mode (or use the Stripe API to copy them).
4. Update all `STRIPE_*` environment variables with live-mode keys and price IDs.

---

## 5. Twilio Setup (SMS)

Twilio is used to send SMS messages for OTP delivery and shipment notifications.

### 5.1 Create a Twilio Account

1. Sign up at https://www.twilio.com/try-twilio.
2. Verify your email and phone number.

### 5.2 Get Credentials

1. From the **Console Dashboard** (https://console.twilio.com), copy:
   - **Account SID** --> `TWILIO_ACCOUNT_SID`
   - **Auth Token** --> `TWILIO_AUTH_TOKEN`

### 5.3 Get a Phone Number

1. Go to **Phone Numbers > Manage > Buy a Number**.
2. Search for a number with **SMS** capability in your desired area code.
3. Purchase the number.
4. Copy the number in E.164 format (e.g., `+15551234567`) --> `TWILIO_PHONE_NUMBER`.

### 5.4 Configure Messaging (Optional)

- If you expect high volume, register for **A2P 10DLC** (application-to-person messaging) under **Messaging > Services** to improve deliverability and avoid carrier filtering.
- Create a Messaging Service and assign your phone number to it.

---

## 6. FMCSA API Registration

The FMCSA SAFER Web API is used to verify motor carrier authority, USDOT numbers, and safety ratings. The API is free.

### 6.1 Register for an API Key

1. Go to https://mobile.fmcsa.dot.gov/developer/home.
2. Click **Register** and create an account.
3. After email verification, log in and request an API key.
4. Copy the key --> `FMCSA_API_KEY`.

### 6.2 API Endpoints Used

The app uses the following FMCSA endpoints:

- `GET /qc/services/carriers/{dotNumber}` -- Carrier details by DOT number
- `GET /qc/services/carriers/name/{name}` -- Search carriers by name
- `GET /qc/services/carriers/{dotNumber}/basics` -- Safety measurement data (BASICs)

Rate limits are generous for the free tier, but cache responses where possible.

---

## 7. Resend Setup (Email)

Resend is used for transactional emails including daily shipment digest emails and system notifications.

### 7.1 Create a Resend Account

1. Sign up at https://resend.com.
2. Go to **API Keys** and create a new key.
3. Copy the key (starts with `re_`) --> `RESEND_API_KEY`.

### 7.2 Verify Your Domain

To send from your own domain (e.g., `notifications@freightverify.com`):

1. Go to **Domains** in the Resend dashboard.
2. Click **Add Domain** and enter your domain (e.g., `freightverify.com`).
3. Resend will provide DNS records to add:
   - **SPF** (TXT record)
   - **DKIM** (CNAME records, typically 3)
   - **DMARC** (TXT record -- recommended)
4. Add these records in your DNS provider (e.g., Cloudflare, Namecheap, Route 53).
5. Click **Verify** in Resend. DNS propagation may take up to 48 hours.

### 7.3 Configure Sender Address

Set the `EMAIL_FROM` environment variable using your verified domain:

```
EMAIL_FROM=FreightVerify <notifications@freightverify.com>
```

During development, you can use Resend's test domain: `onboarding@resend.dev`.

---

## 8. Sentry Setup (Error Monitoring)

### 8.1 Create a Sentry Project

1. Go to https://sentry.io and sign in.
2. Click **Create Project**.
3. Select **Next.js** as the platform.
4. Name the project `freightverify`.
5. Click **Create Project**.

### 8.2 Get Credentials

1. Go to **Settings > Projects > freightverify > Client Keys (DSN)**.
2. Copy the **DSN** --> `SENTRY_DSN`.
3. Go to **Settings > Auth Tokens** (organization level).
4. Create a new token with the `project:releases` and `org:read` scopes.
5. Copy the token --> `SENTRY_AUTH_TOKEN`.

### 8.3 Source Maps

The Next.js Sentry integration automatically uploads source maps during the build when `SENTRY_AUTH_TOKEN` is set. Verify your `next.config.ts` includes the Sentry webpack plugin (typically via `@sentry/nextjs`).

---

## 9. Vercel Deployment

### 9.1 Connect Repository

1. Push your code to a GitHub repository (if not already done).
2. Go to https://vercel.com/new.
3. Import your `freight-verify` repository.
4. Vercel will auto-detect Next.js. Confirm the framework preset is **Next.js**.

### 9.2 Configure Build Settings

The defaults should work, but verify:

- **Build Command**: `next build` (or `npm run build`)
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node.js Version**: 20.x

### 9.3 Add Environment Variables

Before deploying, add all environment variables from `.env.example` in the Vercel dashboard:

1. Go to **Project Settings > Environment Variables**.
2. Add each variable for the appropriate environments:
   - **Production**: Use live/production keys.
   - **Preview**: Use test/development keys (for PR preview deployments).
   - **Development**: Use test/development keys (for `vercel dev`).

> **Important**: Variables prefixed with `NEXT_PUBLIC_` are embedded in the client-side bundle at build time. Changes to them require a redeployment.

### 9.4 Deploy

1. Click **Deploy**. Vercel will build and deploy the application.
2. Note the deployment URL (e.g., `https://freight-verify.vercel.app`).
3. Update webhook URLs in Clerk, Stripe, and any other services that reference your domain.

### 9.5 Configure Vercel Settings

After the first deployment, configure these recommended settings:

- **Functions > Region**: Choose the region closest to your Supabase instance (e.g., `iad1` for US East).
- **Security > Deployment Protection**: Enable Vercel Authentication for preview deployments.
- **Git > Production Branch**: Set to `main`.

---

## 10. Environment Variables Configuration

Here is a summary of all required environment variables organized by service. Refer to `.env.example` for detailed comments.

### Required for All Environments

| Variable | Service | Sensitive |
|----------|---------|-----------|
| `NEXT_PUBLIC_APP_URL` | App | No |
| `NODE_ENV` | App | No |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | No |
| `CLERK_SECRET_KEY` | Clerk | **Yes** |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Clerk | No |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk | No |
| `CLERK_WEBHOOK_SECRET` | Clerk | **Yes** |
| `DATABASE_URL` | Supabase | **Yes** |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | **Yes** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | No |
| `STRIPE_SECRET_KEY` | Stripe | **Yes** |
| `STRIPE_WEBHOOK_SECRET` | Stripe | **Yes** |
| `STRIPE_STARTER_PRICE_ID` | Stripe | No |
| `STRIPE_PROFESSIONAL_PRICE_ID` | Stripe | No |
| `STRIPE_BUSINESS_PRICE_ID` | Stripe | No |
| `RESEND_API_KEY` | Resend | **Yes** |
| `EMAIL_FROM` | Resend | No |
| `TWILIO_ACCOUNT_SID` | Twilio | **Yes** |
| `TWILIO_AUTH_TOKEN` | Twilio | **Yes** |
| `TWILIO_PHONE_NUMBER` | Twilio | No |
| `FMCSA_API_KEY` | FMCSA | **Yes** |
| `SENTRY_DSN` | Sentry | No |
| `SENTRY_AUTH_TOKEN` | Sentry | **Yes** |

---

## 11. Post-Deployment Verification

After deploying, work through this checklist to confirm everything is operational.

### Authentication (Clerk)

- [ ] Visit `/login` -- Clerk sign-in UI loads correctly.
- [ ] Visit `/signup` -- Clerk sign-up UI loads correctly.
- [ ] Create a test account -- user is redirected to `/onboarding`.
- [ ] Create an organization -- org creation flow works.
- [ ] Invite a member to the organization -- invitation email is sent.
- [ ] Check your database -- the Clerk webhook created corresponding user/org rows in Supabase.

### Database (Supabase + Drizzle)

- [ ] Dashboard loads data from the database without errors.
- [ ] Create a test record (e.g., a shipment) and verify it persists.
- [ ] Check Supabase dashboard **Table Editor** to confirm data is written correctly.

### Storage (Supabase)

- [ ] Upload a document (e.g., BOL) -- file appears in the `documents` bucket.
- [ ] Upload a photo -- file appears in the `photos` bucket.
- [ ] Download/view an uploaded file -- signed URL works correctly.

### Billing (Stripe)

- [ ] Navigate to the pricing/billing page -- three plans display with correct prices ($149/$399/$799).
- [ ] Use Stripe test card `4242 4242 4242 4242` to subscribe to a plan.
- [ ] Verify the subscription is created in Stripe dashboard.
- [ ] Verify the subscription status is reflected in the app (plan badge, feature gating).
- [ ] Check that the Stripe webhook fires and your app processes it (check server logs).

### SMS (Twilio)

- [ ] Trigger an OTP or SMS notification flow.
- [ ] Verify the SMS is received on a real phone.
- [ ] Check Twilio Console **Messaging Logs** for delivery status.

### Carrier Verification (FMCSA)

- [ ] Search for a carrier by DOT number (e.g., `2233966` for a known carrier).
- [ ] Verify carrier details are returned (name, authority status, safety rating).
- [ ] Test with an invalid DOT number -- appropriate error handling.

### Email (Resend)

- [ ] Trigger a test email (e.g., daily digest or welcome email).
- [ ] Verify the email is received and renders correctly.
- [ ] Check Resend dashboard for delivery logs.
- [ ] Verify the sender address matches your verified domain.

### Error Monitoring (Sentry)

- [ ] Trigger a test error (e.g., visit a page that throws an intentional error).
- [ ] Verify the error appears in the Sentry dashboard.
- [ ] Confirm source maps are working (stack traces show original TypeScript source).

### General

- [ ] All pages load without console errors.
- [ ] API routes return expected responses.
- [ ] Responsive design works on mobile viewports.
- [ ] HTTPS is enforced (Vercel handles this automatically).
- [ ] Environment variables are not leaked to the client (check page source for secrets).

---

## 12. Custom Domain Setup

### 12.1 Add Domain in Vercel

1. Go to **Project Settings > Domains**.
2. Enter your domain (e.g., `app.freightverify.com` or `freightverify.com`).
3. Click **Add**.

### 12.2 Configure DNS

Vercel will show the DNS records to add. Typical setup:

**For apex domain** (`freightverify.com`):
- Add an **A** record pointing to `76.76.21.21`

**For subdomain** (`app.freightverify.com`):
- Add a **CNAME** record pointing to `cname.vercel-dns.com`

**Recommended**: Set up both and configure a redirect from the apex to the `www` or `app` subdomain (or vice versa).

### 12.3 SSL Certificate

Vercel automatically provisions and renews SSL certificates via Let's Encrypt. No action needed -- just wait a few minutes after DNS propagation.

### 12.4 Update Service Configurations

After your custom domain is live, update the following:

1. **Environment Variables**:
   - `NEXT_PUBLIC_APP_URL` --> `https://app.freightverify.com`

2. **Clerk Dashboard**:
   - Update allowed redirect origins to include your custom domain.
   - Update the webhook endpoint URL.

3. **Stripe Dashboard**:
   - Update the webhook endpoint URL to use your custom domain.

4. **Resend**:
   - No changes needed if your email domain is already verified.

5. **Redeploy** the application so that `NEXT_PUBLIC_APP_URL` is baked into the client bundle with the correct domain.

---

## Troubleshooting

### Common Issues

**Build fails with missing environment variables**
- Ensure all `NEXT_PUBLIC_*` variables are set for the correct environment in Vercel.
- `NEXT_PUBLIC_*` vars must be present at **build time**, not just runtime.

**Clerk webhook returns 401**
- Verify `CLERK_WEBHOOK_SECRET` matches the signing secret in the Clerk dashboard.
- Ensure your webhook route does not have middleware that blocks the request.

**Stripe webhook returns 400**
- Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret (not the global one).
- For local development, use the secret printed by `stripe listen`, not the one from the dashboard.

**Database connection timeouts**
- Use the connection pooling URL (port `6543`) instead of the direct connection (port `5432`).
- Verify the password in `DATABASE_URL` is URL-encoded if it contains special characters.

**Supabase Storage uploads fail**
- Verify the bucket exists and the name matches exactly.
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set (server-side uploads need it to bypass RLS).

**Emails not sending**
- Verify your domain is fully verified in Resend (all DNS records propagated).
- Check that `EMAIL_FROM` uses an address on the verified domain.

**SMS not delivering**
- Check Twilio messaging logs for error codes.
- Verify the `TWILIO_PHONE_NUMBER` has SMS capability.
- For US traffic, ensure A2P 10DLC registration if sending at scale.
