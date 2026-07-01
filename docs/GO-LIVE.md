# Production go-live checklist

Use this before pointing real staff and guests at MOJO in production. Complete **every** section; skip nothing unless you explicitly accept the risk.

---

## 1. Supabase migrations

Apply all **51** migrations in `supabase/migrations/` (`001` → `051`) in order.

**Fresh project:**

```bash
supabase link --project-ref YOUR_REF
supabase db push
```

**Existing project** (partial history): run only missing files in the SQL Editor, or repair `supabase_migrations.schema_migrations` then `db push`.

Verify locally:

```bash
npm run check:migrations
```

Verify in Supabase SQL Editor after apply:

```sql
-- Lifecycle v2 (051)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'hotels' AND column_name = 'use_lifecycle_v2';

-- Notification outbox (038)
SELECT to_regclass('public.notification_outbox');

-- Realtime (015)
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' ORDER BY tablename;
```

Enable **Reservation lifecycle v2** per property after `051` is applied: Owner → Settings → Lifecycle → turn on v2 when ready.

---

## 2. Vercel environment variables

Set in **Project → Settings → Environment Variables** (Production):

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only — never expose to client |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://mcs-pms.vercel.app` (no trailing space) |
| `MFA_OTP_SECRET` | Yes | Random 32+ char string |
| `GUEST_SESSION_SECRET` | Yes | Random 32+ char string |
| `CRON_SECRET` | Yes | Random string; same value in GitHub secrets |
| `DISABLE_PUBLIC_SIGNUP` | Recommended | Set `true` after first owner exists |
| `ARKESEL_API_KEY` + `ARKESEL_SENDER_ID` | Yes (with Resend or Termii) | Ghana SMS |
| `TERMII_API_KEY` + `TERMII_WHATSAPP_SENDER` | Yes when using WhatsApp | WhatsApp (Termii) |
| `TERMII_BASE_URL` | If Termii dashboard differs | Default `https://api.ng.termii.com` |
| `NOTIFICATION_CHANNELS` | Recommended | `sms,whatsapp` |
| `RESEND_API_KEY` + `RESEND_FROM` | Yes (with Arkesel) | Staff email invites, email MFA — **verified domain only** |
| `SENTRY_DSN` | Recommended | Error monitoring |

**Redeploy** after changing env vars.

Post-deploy smoke:

```bash
PRODUCTION_APP_URL=https://mcs-pms.vercel.app npm run smoke:prod
```

Or manually: `GET /api/health` → `200`, `GET /api/ready` → `200` with `{ "status": "ready" }`.

---

## 3. Resend email (production)

Sandbox sender `onboarding@resend.dev` **only delivers to your Resend account email**.

Before staff invites or guest emails work for everyone:

1. Add and verify your domain at [resend.com/domains](https://resend.com/domains).
2. Set `RESEND_FROM=MOJO Apartments <alerts@yourdomain.com>` on Vercel.
3. Send a test staff invite to a non-owner inbox and confirm delivery.

---

## 4. GitHub Actions crons (Vercel Hobby)

Vercel Hobby allows **daily** crons only (`vercel.json`). Sub-daily jobs run via GitHub Actions.

In **GitHub → Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `CRON_SECRET` | Same as Vercel `CRON_SECRET` |
| `PRODUCTION_APP_URL` | `https://mcs-pms.vercel.app` |

Workflow: [`.github/workflows/scheduled-crons.yml`](../.github/workflows/scheduled-crons.yml)

| Schedule | Routes |
|----------|--------|
| Every 5 min | `/api/cron/notifications`, `/api/cron/reservation-holds` |
| Hourly :00 | `/api/cron/reservation-pre-arrival` |
| Hourly :15 | `/api/cron/reservation-overstay` |
| Hourly :30 | `/api/cron/reservation-auto-checkout-prompt` |

**Manual test:** Actions → Scheduled crons → Run workflow.

Daily Vercel crons (`vercel.json`): cleanup (03:00 UTC), no-show (00:05 UTC), archive (04:30 UTC).

---

## 5. Supabase Auth URLs

**Authentication → URL Configuration:**

- Site URL: your production domain
- Redirect URLs: `https://yourdomain.com/**`, preview URLs if needed
- Include `/auth/callback` for password reset

Configure **SMTP** (or use Supabase default for dev only) for password-reset emails in production.

---

## 6. Security before traffic

- [ ] Owner and manager accounts enrolled in **2FA** (mandatory in production)
- [ ] `DISABLE_PUBLIC_SIGNUP=true` after first owner created
- [ ] Never run `npm run seed` against production
- [ ] Service role key not in client bundle or public repos
- [ ] GitHub cron secrets configured and workflow green

---

## 7. Smoke test (one property)

Run in order with a test owner account:

1. Sign in → MFA enroll/verify → owner dashboard
2. `/get-started` onboarding (new owner) or skip if already complete
3. Create reservation → check-in → post folio charge → begin checkout → complete checkout
4. Log complaint (manager) → assign technician → verify SMS/email if configured
5. Guest portal link → submit request → staff acknowledges
6. Night audit (owner/manager) if using billing close

---

## 8. Monitoring

- Watch Vercel deployment logs for `[startup] Production env validation failed`
- Configure Sentry alerts for notification dead-letters and 5xx spikes
- Weekly: confirm GitHub **Scheduled crons** workflow runs successfully

---

## Quick reference

| Check | Command / URL |
|-------|----------------|
| Migrations on disk | `npm run check:migrations` |
| Production ready | `GET /api/ready` |
| Liveness | `GET /api/health` |
| Full deploy guide | [DEPLOYMENT.md](../DEPLOYMENT.md) |
