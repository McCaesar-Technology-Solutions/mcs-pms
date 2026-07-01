# MOJO APARTMENTS - Deployment Guide

## Overview

This guide covers deploying MOJO APARTMENTS to production on Vercel, configuring environments, and managing deployments.

## Deployment Platforms

### Vercel (Recommended)

MOJO APARTMENTS is optimized for Vercel deployment with automatic:
- Static site generation for all 11 routes
- Edge caching for optimal performance
- Environment variable management
- Preview deployments for pull requests
- Automatic HTTPS and domain configuration

### Prerequisites

1. GitHub account with repository
2. Vercel account (vercel.com)
3. Next.js 16+ application (already included)

### Deploy to Vercel

**Option 1: Vercel Dashboard**
1. Go to vercel.com and sign in
2. Click "Add New" → "Project"
3. Select GitHub repository
4. Vercel auto-detects Next.js configuration
5. Click "Deploy"

**Option 2: Vercel CLI**
```bash
npm install -g vercel
vercel deploy

# Preview deployment
vercel deploy --prebuilt

# Production deployment
vercel deploy --prod
```

## Environment Variables

### Required Environment Variables

Create `.env.local` in project root:

```env
# Supabase (Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Notifications (optional — logs to console when unset)
# Arkesel (recommended for Ghana SMS):
# ARKESEL_API_KEY=
# ARKESEL_SENDER_ID=MOJO
# SMS_PROVIDER=arkesel
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_SMS_FROM=+1...
# TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
# Hubtel (fallback):
# HUBTEL_CLIENT_ID=
# HUBTEL_CLIENT_SECRET=
# HUBTEL_SENDER_ID=MOJO
# NOTIFICATION_CHANNELS=sms,whatsapp
# MFA_OTP_SECRET=long-random-string

# Production hardening (required in production)
MFA_OTP_SECRET=long-random-string
GUEST_SESSION_SECRET=long-random-string
CRON_SECRET=long-random-string-for-vercel-cron

# Error monitoring (recommended)
# SENTRY_DSN=https://...@sentry.io/...
```

### Setting Environment Variables in Vercel

1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add each Supabase variable from your project dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never prefix with `NEXT_PUBLIC_`)
3. Select which environments: Production, Preview, Development
4. Click "Save"
5. Redeploy to apply changes

## Supabase Setup

### 1. Create project

1. Create account at [supabase.com](https://supabase.com)
2. New project — e.g. **`mcs-pms-dev`** (Free tier is fine for development)
3. Copy from **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only)

### 2. Schema and migrations

Migrations live in `supabase/migrations/` (`001` through **`051`**). Every tenant table has RLS enabled.

Run `npm run check:migrations` locally to verify the repo has a contiguous `001`–`051` sequence before deploy.

| Range | Purpose |
|-------|---------|
| `001`–`018` | Core schema, RLS, housekeeping, categories, MFA SMS, receptionist role, realtime |
| `019`–`027` | MFA email, notification prefs, VAT/property images |
| `028`–`037` | Guest portal, rules, pre-arrival, rate limits, production hardening base |
| **`038`** | **Production hardening**: rate-limit RLS, invite expiry, folio, night audit, notification outbox |
| `039`–`044` | Partial payments, iCal channels, SaaS onboarding, housekeeping flow, reservation payments |
| `045`–`050` | Guest stay chat, conversations realtime, ops features, profile photos, message editing |
| **`051`** | **Reservation lifecycle v2**: expanded statuses, holds, no-show/overstay settings, folio lock |

**Apply all migrations before production go-live.** See [docs/GO-LIVE.md](docs/GO-LIVE.md) for the full checklist and SQL verification queries.

After `051`, enable lifecycle v2 per hotel in Owner → Settings when the property is ready (defaults to off).

**Fresh database** — Supabase CLI:

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

**Existing database** (tables already created, `db push` fails on `001`):

1. Confirm which migrations are already applied.
2. Run only missing SQL files in the **SQL Editor** (safe for `015` — uses `duplicate_object` guards).
3. Or repair `supabase_migrations.schema_migrations` before using `db push` again.

**Realtime:** migration `015` is required for live UI updates on reservations, guests, billing-related tables, and staff. Complaints/housekeeping realtime is enabled in earlier migrations.

Verify publication:

```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' ORDER BY tablename;
```

### 3. Storage buckets

Create private buckets in the Supabase dashboard (or via migration):

| Bucket | Purpose |
|--------|---------|
| `guest-id-documents` | Guest ID scans (private; service role uploads) |
| `guest-complaint-photos` | Guest-submitted complaint photos |
| `property-images` | Property photos, logos, profile images (public read) |
| `complaint-invoices` | Technician-uploaded complaint invoices (PDF/image) |

Invoice PDFs for checkout are generated in-app (jsPDF) — there is no `invoices` storage bucket.

Access private buckets via service role; `property-images` has authenticated upload policies (migration `038`).

### 4. Auth redirect URLs

In **Authentication → URL Configuration**, add:

- Site URL: `https://yourdomain.com` (production)
- Redirect URLs: `http://localhost:3000/**`, `https://yourdomain.com/**`, Vercel preview URLs

Make sure `https://yourdomain.com/auth/callback` is covered by the redirect URL patterns above — the password-reset flow returns the user there.

### 5. Password reset (email)

Flow: `/forgot-password` → Supabase emails a recovery link → `/auth/callback` exchanges the code for a session → `/reset-password` sets the new password → back to `/login`.

Requirements:

- **SMTP** configured in **Authentication → Emails** (Supabase's built-in sender is rate-limited; use a real SMTP/provider for production).
- `NEXT_PUBLIC_APP_URL` set to the public origin so the email link points to the right host (falls back to request headers when unset).
- The **Reset Password** email template should use the default confirmation URL.
- Technician accounts sign in by phone with a synthetic email, so they cannot self-serve reset — an owner/manager re-invites or resets them.

### 6. Two-factor authentication (SMS)

- **Method:** 6-digit code sent by **SMS** (Arkesel, Hubtel, or Twilio — same providers as job alerts).
- **Required** for **owner** and **manager** at every sign-in.
- **Optional** for **receptionist** and **technician** (enable in Settings / Staff).
- Run migration **`019_mfa_sms_otp.sql`** in the Supabase SQL Editor.
- Set **`MFA_OTP_SECRET`** in production (random string; used to hash codes and session keys).
- **Dev without SMS:** codes are logged to the terminal and shown on the verify screen when no SMS provider is configured.
- Flow: sign in → add phone if missing (`/enroll-mfa`) → enter SMS code (`/verify-mfa`) → dashboard.
- **Owner and manager MFA is mandatory in production** (`NODE_ENV=production`).

### 7. Vercel Cron jobs (daily)

Configure `CRON_SECRET` in Vercel env vars. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` to routes in `vercel.json`:

| Route | Schedule (UTC) | Purpose |
|-------|----------------|---------|
| `/api/cron/cleanup` | Daily 03:00 | Purge stale rate limits and MFA challenges |
| `/api/cron/reservation-no-show` | Daily 00:05 | Mark no-shows (lifecycle v2) |
| `/api/cron/reservation-archive` | Daily 04:30 | Archive completed stays |

**Hobby plan limit:** Vercel Hobby only allows cron jobs that run **once per day**. Sub-daily jobs run via [`.github/workflows/scheduled-crons.yml`](.github/workflows/scheduled-crons.yml):

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/notifications` | Every 5 min | Drain notification outbox + retries |
| `/api/cron/reservation-holds` | Every 5 min | Expire provisional holds |
| `/api/cron/reservation-pre-arrival` | Hourly :00 | Pre-arrival reminders |
| `/api/cron/reservation-overstay` | Hourly :15 | Overstay detection |
| `/api/cron/reservation-auto-checkout-prompt` | Hourly :30 | Checkout prompts |

Add GitHub repository secrets **`CRON_SECRET`** (same value as Vercel) and **`PRODUCTION_APP_URL`** (e.g. `https://mcs-pms.vercel.app`). Test manually: Actions → Scheduled crons → Run workflow.

Post-deploy: `PRODUCTION_APP_URL=https://your-app.vercel.app npm run smoke:prod`

On Vercel Pro, you may move sub-daily routes into `vercel.json` if you prefer.

### 8. Production seed policy

**Never run `npm run seed` in production.** The seed script exits when `NODE_ENV=production`. Create the owner account via controlled signup (set `DISABLE_PUBLIC_SIGNUP=true` after the first owner) or Supabase Auth admin.

## Authentication Setup

### Supabase Auth + Next.js (Recommended)

1. Install Supabase client libraries:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

2. Create browser and server clients:

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* getAll / setAll */ } }
  )
}
```

3. Protect dashboard routes in `middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Refresh session; redirect unauthenticated users from /dashboard
}
```

4. Staff roles live in `profiles`: `owner`, `manager`, or `technician`. Guest portal access uses `guests` portal tokens — not staff auth accounts.

5. Role routes: `/owner/*`, `/manager/*`, `/technician/*` are enforced in `lib/supabase/middleware.ts`.

## Build Configuration

Security headers and CSP are defined in the repo’s [`next.config.mjs`](next.config.mjs) (imports [`lib/security/csp.mjs`](lib/security/csp.mjs)). Images use `unoptimized: true` today for simpler Supabase Storage URLs — enable Next.js image optimization when property photo LCP becomes a priority.

```bash
npm run build
npm run start   # production server locally
npm test        # Vitest unit/integration
npm run test:e2e  # Playwright (starts server automatically)
```

## Performance Optimization

### Build Analysis

```bash
# Analyze bundle size (optional @next/bundle-analyzer)
npm run build
```

### Image Optimization

```tsx
import Image from 'next/image'

<Image
  src="/property-photo.jpg"
  alt="Property"
  width={1200}
  height={800}
  priority={false}
  quality={85}
/>
```

### Cache Configuration

```typescript
// Revalidate ISR pages every 1 hour
export const revalidateTime = 3600

// API responses
export async function GET(request: Request) {
  const data = await fetchData()
  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
```

## Monitoring & Analytics

### Vercel Analytics

Enabled automatically - view in Vercel Dashboard:
- Web Vitals (LCP, FID, CLS)
- Real user monitoring
- Page performance
- API performance

### Error Tracking

Lightweight Sentry reporting is built in when `SENTRY_DSN` is set (`lib/monitoring/sentry.ts`). Full `@sentry/nextjs` integration is optional.

### Logging

```typescript
// Log important events
import { logger } from '@/lib/logger'

logger.info('Booking created', { bookingId: id })
logger.error('Payment failed', { error: err.message })
```

## Continuous Deployment

Production deploys use **Vercel** connected to the `main` branch (Git push → automatic build).

CI (`.github/workflows/ci.yml`) runs on every PR and `main` push:

- `npm run lint`
- `npm run check:migrations`
- `npm run test`
- `npm run build`
- `npm run test:e2e` (Playwright smoke)

Optional post-deploy smoke (manual): set GitHub secret `PRODUCTION_APP_URL`, then run the **Production smoke** workflow or:

```bash
PRODUCTION_APP_URL=https://your-app.vercel.app npm run smoke:prod
```

No separate `deploy.yml` is required when Vercel Git integration handles deploys.

## Domain Configuration

### Custom Domain on Vercel

1. Go to Vercel Project Settings → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `abcofapms.com`)
4. Vercel provides nameserver records
5. Update nameservers at domain registrar
6. Wait for DNS propagation (5-30 minutes)
7. HTTPS automatically issued via Let's Encrypt

### DNS Records

```
A Record: 76.76.19.165
AAAA Record: 2606:4700:4700::1111
CNAME: cname.vercel-dns.com
```

## Rollback & Versioning

### Rollback to Previous Deployment

```bash
vercel deploy --prod --prebuilt
# Revert to previous version in Vercel Dashboard:
# Deployments → Click previous version → Promote to Production
```

### Versioning

Tag releases in GitHub:
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## Security Checklist

- [ ] Apply migrations `001`–`051` on Supabase ([GO-LIVE.md](docs/GO-LIVE.md))
- [ ] Set `MFA_OTP_SECRET`, `GUEST_SESSION_SECRET`, `CRON_SECRET`
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain (no trailing spaces)
- [ ] Configure SMS (Arkesel) or email (Resend with verified domain)
- [ ] Set `DISABLE_PUBLIC_SIGNUP=true` after first owner exists
- [ ] Configure GitHub secrets `CRON_SECRET` + `PRODUCTION_APP_URL`
- [ ] Never run seed script against production database
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Configure `SENTRY_DSN` for error monitoring
- [ ] Verify `/api/health` and `/api/ready` after deploy (`npm run smoke:prod`)

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
vercel deploy --prod --force

# Check build logs
vercel logs --prod

# Test locally first
npm run build
npm run test:e2e
```

### Performance Issues

1. Check Vercel Analytics for slow pages
2. Profile with Chrome DevTools
3. Optimize images with next/image
4. Implement caching headers
5. Use ISR for static pages

### Database Connection Issues

```bash
# Verify Supabase env vars are set (do not echo service role key in shared logs)
echo $NEXT_PUBLIC_SUPABASE_URL

# Test API reachability from Supabase dashboard → Project Settings → Database
```

Check the Supabase dashboard for connection limits and paused projects (Free tier may pause after inactivity).

## Monitoring Production

### Key Metrics to Watch

- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Time to Interactive (TTI)**: < 3.8s
- **API Response Time**: < 200ms
- **Error Rate**: < 0.1%

### Alert Configuration

Set up alerts in Vercel for:
- Build failures
- Runtime errors (Sentry)
- Performance degradation
- High CPU/memory usage

## Scaling Considerations

### Current Capacity

Production deployment targets a single property with Supabase Pro recommended for:
- Realtime subscriptions across staff dashboards
- Point-in-time recovery and connection pooling
- Storage for guest ID documents and invoice PDFs

### When Adding Database

1. **Connection pooling**: Enabled by default on Supabase; use server client in Route Handlers
2. **Query optimization**: Add database indexes; use RLS-friendly query patterns
3. **Caching**: Implement Redis for frequent queries if needed (Phase 4+)
4. **CDN**: Vercel serves static assets; Supabase Storage serves uploaded files
5. **Backups**: Enable point-in-time recovery on Supabase Pro for production

## Support Resources

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs
- Supabase Auth (Next.js): https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Storage: https://supabase.com/docs/guides/storage
