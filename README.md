# FreightVerify

**Carrier Identity & Pickup Verification for Freight Brokers** — the first affordable platform that combines carrier onboarding with physical proof-of-pickup in a single product.

Freight fraud and cargo theft cost the US logistics industry $500M–$1B annually. The average cargo theft is $230,000. The problem: nobody verifies who actually shows up at the loading dock. FreightVerify solves this with FMCSA-powered carrier verification, OTP-based pickup authentication, GPS + photo proof-of-custody, and a tamper-evident hash-chained event log. Highway serves the top 100 brokers — FreightVerify is built for the other 17,000.

---

## Key Features

- **FMCSA Auto-Verification** — Enter a DOT number, instantly pull the carrier's legal name, operating status, safety rating, insurance, and fleet size from the federal database. Automatically flagged if anything is wrong.
- **Document Vault** — Insurance certificates, operating authority, W-9s — uploaded, tracked, with automatic expiration monitoring.
- **Load Tender Workspace** — Create loads, assign to verified carriers, tender via secure link. No more emailing PDFs.
- **OTP Pickup Verification** — 6-digit SMS code sent to the driver. Warehouse worker enters the code at pickup. If it fails 3 times, a CRITICAL alert fires immediately.
- **GPS + Photo Proof** — Capture GPS coordinates, timestamps, and photos of truck/trailer at pickup. If GPS is 5+ miles from expected location, a HIGH alert fires.
- **Tamper-Evident Event Log** — Every action on every load recorded in a SHA-256 hash-chained append-only log. If any record is modified, the chain breaks. Legal-grade chain of custody.
- **6 Anomaly Detection Rules** — Carrier substitution, email domain mismatch, off-location pickup, failed verification, document expiration, FMCSA status change.
- **Alert Dashboard** — Real-time alert management with severity levels, acknowledgment workflow, daily digest emails, and trend charts.
- **Carrier Portal** — External-facing pages for carriers to accept tenders, provide driver info, and complete pickup verification.
- **Stripe Billing** — Starter $149/mo (50 loads), Professional $399/mo (200 loads), Business $799/mo (500 loads).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (React 19, App Router) |
| Language | TypeScript |
| Database | Supabase Postgres |
| ORM | Drizzle ORM |
| Auth | Clerk (multi-tenant organizations) |
| UI | shadcn/ui + Tailwind CSS + Radix UI |
| SMS | Twilio (OTP delivery) |
| Email | Resend (daily digests, notifications) |
| Billing | Stripe (subscriptions + webhooks) |
| Charts | Recharts |
| Carrier Data | FMCSA SAFER API |
| Error Monitoring | Sentry |

## Project Structure

```
src/
├── app/
│   ├── (auth)/             # Login, signup
│   ├── (carrier-portal)/   # External carrier-facing pages
│   │   ├── driver/         # Driver assignment acceptance
│   │   ├── portal/         # Carrier tender portal
│   │   ├── tender/         # Tender acceptance
│   │   └── verify/         # Pickup verification + photo capture
│   ├── (dashboard)/        # Main broker app
│   │   ├── alerts/         # Anomaly alert management
│   │   ├── carriers/       # Carrier directory + FMCSA verification
│   │   ├── events/         # Tamper-evident event log viewer
│   │   ├── loads/          # Load management + tender workflow
│   │   ├── onboarding/     # First-time setup
│   │   └── settings/       # Account, billing, notification preferences
│   ├── (marketing)/        # Landing page, pricing
│   ├── actions/            # Server actions
│   └── api/                # API routes (carriers, loads, verification, alerts, webhooks)
├── components/             # UI components
├── lib/                    # Core libraries (FMCSA client, hash chain, OTP, alerts engine)
└── types/                  # TypeScript type definitions
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (database + storage)
- Clerk account (authentication)
- Twilio account (SMS for OTP)
- FMCSA API key (carrier verification)
- Stripe account (billing)
- Resend account (email)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd freight-verify
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in all values in `.env.local`. Each variable is documented in `.env.example` with instructions on where to find it.

3. **Push the database schema:**
   ```bash
   npx drizzle-kit push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open the app:**
   Visit [http://localhost:3000](http://localhost:3000).

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for a complete step-by-step guide to deploying on Vercel with all service dependencies.

## Environment Variables

All required environment variables are documented in [`.env.example`](.env.example) with descriptions, where to find each value, and which are safe to expose client-side vs. server-only secrets.

## License

Proprietary. All rights reserved.
