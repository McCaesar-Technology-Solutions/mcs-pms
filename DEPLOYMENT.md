# Abɔfa PMS - Deployment Guide

## Overview

This guide covers deploying Abɔfa PMS to production on Vercel, configuring environments, and managing deployments.

## Deployment Platforms

### Vercel (Recommended)

Abɔfa PMS is optimized for Vercel deployment with automatic:
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
# Database (when connecting)
DATABASE_URL=postgresql://user:password@host:port/dbname
DIRECT_URL=postgresql://user:password@host:port/dbname

# Authentication (when implementing)
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=openssl rand -base64 32

# API Keys (if using external services)
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

# Vercel Project ID
VERCEL_PROJECT_ID=your-project-id
VERCEL_TEAM_ID=team_id
```

### Setting Environment Variables in Vercel

1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add each variable:
   - Key: `DATABASE_URL`
   - Value: `postgresql://...`
3. Select which environments: Production, Preview, Development
4. Click "Save"
5. Redeploy to apply changes

## Database Integration

### Neon PostgreSQL Setup

1. Create account at neon.tech
2. Create new project (select PostgreSQL)
3. Copy connection string: `postgresql://user:password@host/dbname`
4. Set `DATABASE_URL` in Vercel environment variables
5. Create `DIRECT_URL` for migrations

### Vercel Postgres (Built-in)

```env
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=
```

## Authentication Setup

### Better Auth + Neon (Recommended)

1. Install Better Auth:
```bash
pnpm add better-auth
```

2. Create auth configuration:
```typescript
// lib/auth.ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/lib/db"

export const auth = betterAuth({
  database: drizzleAdapter(db),
  emailAndPassword: { enabled: true },
})
```

3. Create auth routes:
```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth"

export const { GET, POST } = auth.toNextApiHandler()
```

4. Migrate database:
```bash
pnpm run db:push
```

### Environment Variables for Auth

```env
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=https://yourdomain.com
```

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
# Verify connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check Neon dashboard for connection limits
```

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

1. **Connection pooling**: Use Neon connection pooling
2. **Query optimization**: Add database indexes
3. **Caching**: Implement Redis for frequent queries
4. **CDN**: Vercel automatically serves static assets globally
5. **Database replication**: Multi-region backup

## Support Resources

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Neon Docs: https://neon.tech/docs
- Better Auth Docs: https://www.better-auth.com
