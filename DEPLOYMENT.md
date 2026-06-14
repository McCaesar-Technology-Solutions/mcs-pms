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
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_SMS_FROM=+1...
# TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
# HUBTEL_CLIENT_ID=
# HUBTEL_CLIENT_SECRET=
# HUBTEL_SENDER_ID=MOJO
# NOTIFICATION_CHANNELS=sms,whatsapp

# Payments (not yet integrated)
# PAYSTACK_SECRET_KEY=sk_live_...
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

Migrations live in `supabase/migrations/` (`001` through `018`). Every tenant table has RLS enabled.

| Migration | Purpose |
|-----------|---------|
| `001`–`004` | Core schema, RLS, rooms |
| `005`–`006` | Multi-property, owner auth |
| `007` | Complaint estimates + realtime for complaints |
| `008` | Room categories |
| `009` | Profile phones |
| `010`–`011` | Invoice numbering |
| `012` | Notification log |
| `013` | Two-step complaint approval (`approval_stage`) |
| `014` | Technician profile visibility (owner phone privacy) |
| `015` | Realtime publication for reservations, guests, invoices, etc. |
| `016` | `staff_invites.phone` for technician invites |
| `017` | `REPLICA IDENTITY FULL` for richer realtime UPDATE payloads |
| `018` | Receptionist role: role constraints + front-desk RLS policies |

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
| `guest-documents` | ID scans, registration forms |
| `property-assets` | Property photos, logos |
| `invoices` | Generated invoice PDFs |

Access via Storage RLS policies tied to `organization_id`.

### 4. Auth redirect URLs

In **Authentication → URL Configuration**, add:

- Site URL: `https://yourdomain.com` (production)
- Redirect URLs: `http://localhost:3000/**`, `https://yourdomain.com/**`, Vercel preview URLs

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

### next.config.mjs

```javascript
const nextConfig = {
  // Enable React Compiler for better performance
  reactCompiler: true,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Static generation
  staticPageGenerationTimeout: 120,
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

## Performance Optimization

### Build Analysis

```bash
# Analyze bundle size
pnpm run build
ANALYZE=true pnpm run build
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

Integrate Sentry:
```bash
pnpm add @sentry/nextjs
```

```typescript
// sentry.config.js
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
})
```

### Logging

```typescript
// Log important events
import { logger } from '@/lib/logger'

logger.info('Booking created', { bookingId: id })
logger.error('Payment failed', { error: err.message })
```

## Continuous Deployment

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm run test
      
      - uses: vercel/action@main
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          production: true
```

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

- [ ] Set NEXTAUTH_SECRET to random 32-character string
- [ ] Configure CORS for API endpoints
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set security headers in next.config.js
- [ ] Validate all user inputs server-side
- [ ] Use parameterized queries to prevent SQL injection
- [ ] Rate limit API endpoints
- [ ] Implement request signing for webhooks
- [ ] Regularly rotate API keys
- [ ] Monitor for suspicious activity with Sentry

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
vercel deploy --prod --force

# Check build logs
vercel logs --prod

# Test locally first
pnpm run build
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

With mock data:
- 1000+ concurrent users
- Unlimited API calls
- Instant page loads

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
