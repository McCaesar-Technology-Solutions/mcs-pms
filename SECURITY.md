# Abɔfa PMS - Security Guide

## Security Overview

Abɔfa PMS follows security best practices to protect guest data, property information, and financial records.

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

**Implementation with Better Auth:**
```typescript
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
// app/api/auth/[...all]/route.ts
const auth = betterAuth({
  session: {
    updateAge: 15 * 60 * 1000, // 15 minutes
    absoluteLifeTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  cookies: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
  },
})
```

### Two-Factor Authentication

Recommended for:
- Admin accounts
- Users accessing billing
- GRA report submissions

**Setup with Better Auth:**
```typescript
const auth = betterAuth({
  plugins: [
    twoFactor({
      otpOptions: {
        window: 1, // Allow 30s time window
        step: 30,
      },
    }),
  ],
})
```

## Data Security

### Database Encryption

**Neon PostgreSQL:**
- Automatic encryption at rest
- Automated backups with encryption
- SSL connections required
- Row-level security (RLS) policies

**Enable RLS:**
```sql
-- Only users can view their own data
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_reservations ON reservations
  USING (user_id = current_user_id());
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

Built into Better Auth:
```typescript
// CSRF tokens automatically included
// Verified on all POST/PUT/DELETE requests
```

### SQL Injection Prevention

Use parameterized queries:
```typescript
// ❌ UNSAFE - Never do this
const sql = `SELECT * FROM guests WHERE email = '${email}'`

// ✅ SAFE - Use parameterized queries
const guests = await db.query(
  'SELECT * FROM guests WHERE email = $1',
  [email]
)
```

## Access Control

### Role-Based Access Control (RBAC)

Define user roles:

```typescript
type UserRole = 'admin' | 'manager' | 'staff' | 'housekeeping'

const permissions = {
  admin: ['create', 'read', 'update', 'delete', 'settings'],
  manager: ['create', 'read', 'update', 'read:billing'],
  staff: ['read'],
  housekeeping: ['read:tasks', 'update:tasks'],
}
```

**Check permissions in API:**
```typescript
function checkPermission(user: User, action: string, resource: string) {
  const allowed = permissions[user.role]
  return allowed.includes(`${action}:${resource}`)
}

export async function PUT(request: Request, { params }: Props) {
  const user = await getCurrentUser()
  
  if (!checkPermission(user, 'update', 'reservations')) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // Process update
}
```

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

- [ ] HTTPS enabled and certificate valid
- [ ] Security headers configured
- [ ] Authentication implemented (Better Auth)
- [ ] Password policy enforced
- [ ] Session timeout configured
- [ ] Rate limiting on API endpoints
- [ ] Input validation on all forms
- [ ] SQL injection prevention (parameterized queries)
- [ ] CSRF protection enabled
- [ ] RBAC implemented
- [ ] Audit logging enabled
- [ ] Database encryption enabled
- [ ] API keys in environment variables
- [ ] Payment integration (Stripe) secure
- [ ] OTA tokens encrypted
- [ ] Backups tested and working
- [ ] Disaster recovery plan documented
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] GRA tax compliance verified

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
# Automatic with Neon
# View backups in Neon console
# One-click restore to any point in time
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
- Better Auth Docs: https://www.better-auth.com
- PostgreSQL Security: https://www.postgresql.org/docs/current/sql-syntax.html
- Stripe Security: https://stripe.com/docs/security

## Support

Report security vulnerabilities to: security@abcofapms.com

Do not publicly disclose security issues. We appreciate responsible disclosure.
