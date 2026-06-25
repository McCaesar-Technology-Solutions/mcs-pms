# Apply migration 038 without deadlocks

PostgreSQL deadlocks (`40P01`) happen when this migration runs **while something else is using the same tables** — typically:

- Next.js dev server (`npm run dev`)
- Another Supabase SQL Editor tab
- Realtime subscriptions from an open dashboard
- A previous half-finished run of `038_production_hardening.sql`

## Before you start

1. **Stop** `npm run dev` and any Vercel preview hitting this database.
2. **Close** all other SQL Editor tabs except one.
3. Wait ~30 seconds for idle connections to release locks.

## Apply in order

Run each file **once**, in order. Wait for "Success" before the next.

| Step | File | Touches |
|------|------|---------|
| 1 | `01_rate_limits_invites_invoices.sql` | rate limits, invites, invoices policies |
| 2 | `02_reservations_complaints.sql` | reservations constraint, complaints SLA |
| 3 | `03_folio_night_audit_payments.sql` | new tables + RLS |
| 4 | `04_outbox_realtime_storage.sql` | outbox, realtime, storage policies |

## Verify

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'guest_charges', 'night_audits', 'payment_records', 'notification_outbox'
  )
ORDER BY tablename;
-- Expect 4 rows

SELECT policyname FROM pg_policies
WHERE tablename = 'invoices' AND policyname = 'manager_read_invoices';
-- Expect 1 row
```

## If a chunk partially applied

Re-run the **same chunk** — statements use `IF NOT EXISTS`, `IF EXISTS`, and `duplicate_object` guards where possible.

## After all chunks succeed

Record migration 038 in Supabase (if using CLI tracking):

```sql
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('038')
ON CONFLICT DO NOTHING;
```

Or use `supabase migration repair --status applied 038` if linked via CLI.
