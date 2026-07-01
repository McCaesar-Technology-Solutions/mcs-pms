# MOJO APARTMENTS - Security Guide

## Implementation status (June 2026)

This document mixes **what is deployed today** with **future recommendations**. Use this table before relying on a control in production.

| Control | Status | Notes |
|---------|--------|-------|
| HTTPS (Vercel) | **Live** | TLS terminated at Vercel |
| Security headers (`X-Frame-Options`, etc.) | **Live** | `next.config.mjs` |
| HSTS / CSP | **Not in app** | May be added at CDN; not in `next.config.mjs` |
| Supabase Auth + RBAC + RLS | **Live** | Middleware + `loadVerifiedStaffProfile` |
| MFA (owner/manager, production) | **Live** | SMS OTP via Arkesel/Termii |
| Password policy | **8+ characters** | Not 12+ / symbol rules described below |
| Session cookies | **HttpOnly via Supabase** | `SameSite=Lax`; no 15-minute idle timeout in app |
| Rate limiting | **Live** | Postgres-backed (`rate_limits`); not Redis/Upstash |
| Guest HMAC sessions | **Live** | `lib/guest-session.ts` |
| Input validation | **Live** | Zod on server actions |
| Audit logging | **Live** | `audit_log` + guest PII export/erase |
| Notification fail-closed (prod) | **Live** | SMS/email when providers unset |
| Sentry | **Optional** | Lightweight reporter when `SENTRY_DSN` set |

Sections below that describe aspirational patterns (12-char passwords, CSP snippet, 15-minute sessions, Redis rate limits) are **design targets**, not current behavior.

## Security Overview

MOJO APARTMENTS follows security best practices to protect guest data, property information, and financial records.

## Current Security Measures

### Application Security

**HTTPS & TLS**
- All traffic encrypted with TLS 1.3
- HSTS headers enabled
- Certificate auto-renewed by Let's Encrypt

**Headers**
- X-Content-Type-Options: nosniff (prevent MIME sniffing)
- X-Frame-Options: DENY (prevent clickjacking)
- X-XSS-Protection: 1; mode=block

**Data Validation**
- Input validation on all forms
- TypeScript type checking
- Sanitization of user inputs
- Parameterized queries (when using database)

### Browser Security

**Content Security Policy (CSP)**
```
script-src 'self' 'unsafe-inline' cdn.vercel.com
style-src 'self' 'unsafe-inline'
img-src 'self' data: https:
```

**CORS Configuration**
- Only allow requests from your domain
- Preflight requests validated
- Credentials required for API calls

## Authentication Security (When Implemented)

### Password Policy

Enforce strong passwords:
- Minimum 12 characters
- Mix of upper/lowercase, numbers, symbols
- No dictionary words
- Password history (can't reuse last 5)
- Expiration every 90 days

**Implementation with Supabase Auth:**
```typescript
// Enforce via Supabase Auth settings + signUp validation
const passwordPolicy = {
  minLength: 12,
  requireNumbers: true,
  requireSymbols: true,
  requireUppercase: true,
  requireLowercase: true,
}
```

### Session Management

**Secure Sessions:**
- HttpOnly cookies (prevent XSS access)
- Secure flag (HTTPS only)
- SameSite=Strict (prevent CSRF)
- Session timeout: 15 minutes
- Automatic logout on close

**Code:**
```typescript
// middleware.ts — refresh session on each request
import { createServerClient } from '@supabase/ssr'

// Supabase Auth uses HttpOnly cookies by default with @supabase/ssr
// Configure session expiry in Supabase Dashboard → Authentication → Settings
```

### Two-Factor Authentication

Recommended for:
- Admin accounts
- Users accessing billing
- GRA report submissions

**Setup with Supabase Auth:**
Enable MFA in Supabase Dashboard → Authentication → Providers, or use a custom TOTP flow for admin accounts.

## Data Security

### Database Encryption

**Supabase PostgreSQL + Storage:**
- Automatic encryption at rest
- Automated backups (daily on paid plans)
- SSL connections required
- Row Level Security (RLS) policies on all tenant tables
- Storage bucket policies scoped by organization

**Enable RLS (multi-tenant example):**
```sql
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_reservations ON reservations
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

### Sensitive Data Handling

**PCI Compliance (Payment Info):**
- Never store full credit card numbers
- Use Stripe for payment processing
- Only store last 4 digits for reference
- Encrypt stored payment methods

**Personal Data:**
- Encrypt guest phone numbers
- Hash email addresses for lookups
- Mask guest data in logs
- Right to delete (GDPR-compliant)

**Financial Data:**
- Audit logs for billing changes
- Immutable invoice records
- Encrypted payment references
- Tax report encryption

## API Security

### Rate Limiting

Prevent brute force and DDoS:
```typescript
// app/api/guests/route.ts
import { Ratelimit } from '@upstash/ratelimit'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(100, '1 h'), // 100 requests per hour
})

export async function GET(request: Request) {
  const { success } = await ratelimit.limit(request.ip)
  
  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
  
  // Handle request
}
```

### Input Validation

Validate all user input:
```typescript
import { z } from 'zod'

const guestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[\d\-\s]{10,}$/),
  address: z.string().max(500),
})

export async function POST(request: Request) {
  const data = await request.json()
  const validated = guestSchema.parse(data)
  // Process validated data
}
```

### CSRF Protection

Supabase Auth with `@supabase/ssr` uses cookie-based sessions with SameSite protection. For custom API routes, validate the session server-side on every mutating request.

### SQL Injection Prevention

Use Supabase client or parameterized SQL — never string-concatenate user input:
```typescript
// ✅ SAFE — Supabase client
const { data } = await supabase
  .from('guests')
  .select('*')
  .eq('email', email)
  .eq('organization_id', orgId)
```

## Access Control

### Role-Based Access Control (RBAC)

Staff roles in `profiles.role`:

```typescript
type UserRole = 'owner' | 'manager' | 'technician' | 'receptionist'
```

| Role | Route prefix | Typical access |
|------|--------------|----------------|
| owner | `/owner/*` | All hotels in portfolio; billing, GRA, analytics, settings; invite managers/receptionists/technicians |
| manager | `/manager/*` | One hotel; reservations, guests, complaints, housekeeping; invite receptionists/technicians |
| receptionist | `/receptionist/*` | One hotel; reservations, check-in/out, guest directory, room status, log complaints. No revenue/billing/GRA/analytics, room pricing, or complaint assignment/approval (migration `018`) |
| technician | `/technician/*` | Assigned complaints only; no billing or guest directory |
| guest | `/guest` (token) | Own complaints for active stay; no staff UI |

**Enforcement layers:**

1. **Middleware** — `lib/supabase/middleware.ts` blocks wrong role from route prefixes.
2. **RLS** — PostgreSQL policies on `hotel_id` and role (e.g. technicians cannot read owner profiles — migration `014`).
3. **Server Actions** — call `getProfile()` and verify role/hotel before mutations.

```typescript
const profile = await getProfile()
if (!profile || profile.role !== 'manager') {
  return { success: false, error: 'Forbidden' }
}
```

Guests use portal tokens (`lib/guest-session.ts`), not Supabase Auth staff sessions.

### Audit Logging

Track all sensitive actions:
```typescript
async function logAction(
  userId: string,
  action: string,
  resource: string,
  changes: object
) {
  await db.insert(auditLog).values({
    userId,
    action,
    resource,
    changes: JSON.stringify(changes),
    timestamp: new Date(),
    ipAddress: request.ip,
  })
}

// Usage
await logAction(user.id, 'update', 'billing:invoice', { status: 'paid' })
```

## Third-Party Security

### Stripe Integration

When processing payments:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ✅ Use server-side token creation
export async function createPaymentIntent(amount: number) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // Convert to cents
    currency: 'ghs',
    metadata: { invoiceId: invoice.id },
  })
  
  // Send client secret to frontend
  return { clientSecret: paymentIntent.client_secret }
}

// ❌ Never send API keys to frontend
```

### OTA Integrations

Store API keys securely:
```typescript
// ✅ Use environment variables
const airbnbApiKey = process.env.AIRBNB_API_KEY

// ✅ Encrypt stored tokens in database
const encryptedToken = await encryptToken(token)
await db.update(channels).set({ apiToken: encryptedToken })

// ❌ Never hardcode keys
// ❌ Never commit keys to git
```

## Compliance

### Ghana Data Protection

**Guest Privacy:**
- Obtain consent before storing data
- Provide data access on request
- Delete data when guest requests (right to be forgotten)
- Report data breaches within 72 hours

**GDPR-Like Compliance:**
```typescript
// Data access request
export async function GET(request: Request) {
  const user = await getCurrentUser()
  const guestData = await db.query(
    'SELECT * FROM guests WHERE id = $1',
    [user.guestId]
  )
  
  return Response.json(guestData)
}

// Data deletion request
export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  
  // Mark as deleted (don't hard delete for compliance)
  await db.update(guests).set({ deletedAt: new Date() })
  
  // Clear sensitive data
  await db.update(guests).set({
    phone: null,
    email: null,
    address: null,
  })
}
```

### Tax Compliance (Ghana)

**GRA Requirements:**
- Keep records for 5 years
- Monthly tax reporting
- Accurate revenue tracking
- Immutable audit trail

**Implement:**
```typescript
// Immutable invoice records
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  amount DECIMAL NOT NULL,
  status TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL,
  
  -- Make invoice immutable
  CHECK (deletedAt IS NULL),
  CONSTRAINT no_update CHECK (createdAt = createdAt)
)

-- Only allow inserts, never updates
CREATE POLICY invoice_insert ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Prevent updates
CREATE POLICY invoice_no_update ON invoices
  FOR UPDATE
  USING (false);
```

## Security Checklist

Before Production Deployment:

- [x] HTTPS enabled and certificate valid (Vercel)
- [x] Security headers configured (`next.config.mjs`)
- [x] Authentication implemented (Supabase Auth)
- [x] Password policy enforced (8+ chars signup; rate-limited auth)
- [x] Rate limiting on auth and guest portal actions
- [x] Input validation on server actions (Zod)
- [x] RBAC implemented (middleware + RLS)
- [x] Audit logging enabled (`audit_log`, guest ID view/export/erase)
- [x] API keys in environment variables
- [x] Health / ready endpoints
- [x] MFA mandatory for owner/manager in production
- [x] Guest signed session tokens
- [x] Notification fail-closed in production when providers unset
- [x] Privacy policy published (`/privacy`)
- [x] Terms of service published (`/terms`)
- [ ] Backups tested and working (Supabase PITR on Pro)
- [ ] Disaster recovery plan documented
- [ ] GRA tax compliance verified with your accountant
- [ ] `SENTRY_DSN` configured for error alerting

## Incident Response

### Security Incident Plan

1. **Detect** - Monitor logs and alerts
2. **Contain** - Isolate affected systems
3. **Investigate** - Determine scope and cause
4. **Eradicate** - Remove threat
5. **Recover** - Restore normal operations
6. **Report** - Document and notify users

### Data Breach Procedure

```
Step 1: Notify security team immediately
Step 2: Disable affected user accounts (if needed)
Step 3: Change all API keys and secrets
Step 4: Review audit logs for unauthorized access
Step 5: Patch vulnerability
Step 6: Deploy fix to production
Step 7: Notify affected users within 72 hours
Step 8: File report with GRA if required
```

### Backup & Recovery

**Daily Backups:**
```bash
# Automatic with Supabase (paid plans include PITR)
# View backups in Supabase dashboard → Database → Backups
# Storage files are versioned per bucket settings
```

**Recovery Testing:**
```bash
# Monthly test restoration:
# 1. Restore to staging environment
# 2. Verify data integrity
# 3. Document any issues
# 4. Document recovery time
```

## Security Resources

- OWASP Top 10: https://owasp.org/Top10/
- Next.js Security: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
- Supabase Security: https://supabase.com/docs/guides/platform/going-into-prod
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL Security: https://www.postgresql.org/docs/current/sql-syntax.html
- Stripe Security: https://stripe.com/docs/security

## Support

Report security vulnerabilities to: security@abcofapms.com

Do not publicly disclose security issues. We appreciate responsible disclosure.
