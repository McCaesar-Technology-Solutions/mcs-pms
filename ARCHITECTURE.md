# MOJO APARTMENTS — Architecture

System design for the property management application.

---

## High-level architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser (desktop / mobile)                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│  Vercel — Next.js 16 App Router                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Server Components + Server Actions                      │ │
│  │  lib/data/* reads  ·  app/actions/* writes            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Client Components + Supabase Realtime                   │ │
│  │  live complaints, housekeeping, layout refresh        │ │
│  └────────────────────────────────────────────────────────┘ │
│  middleware.ts — session refresh, role route guards         │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Supabase    │  │  Supabase    │  │  External    │
│  PostgreSQL  │  │  Auth        │  │  Twilio /    │
│  + RLS       │  │              │  │  Hubtel SMS  │
│  + Realtime  │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Technology choices

| Layer | Choice | Notes |
|-------|--------|-------|
| UI | Next.js 16, React 19 | App Router; mostly Server Components for pages |
| Styling | Tailwind CSS 4 | Design tokens in `app/globals.css` |
| Database | Supabase PostgreSQL | Migrations in `supabase/migrations/` |
| Tenancy | `hotel_id` on rows | RLS policies scope by hotel / role |
| Auth | Supabase Auth | Staff users; guests use portal tokens |
| Mutations | Server Actions | Not REST `/api/*` for core CRUD |
| Live UI | Supabase Realtime | `postgres_changes` → refresh or client refetch |
| Notifications | Twilio / Hubtel | Optional; console fallback in dev |
| Hosting | Vercel | Preview + production deploys |

---

## Application layers

### 1. Route groups (by role)

```text
app/(owner)/owner/*       → owner only
app/(manager)/manager/*   → manager only
app/(technician)/*        → technician only
app/(guest)/*             → guest portal (token session)
app/(auth)/*              → public login, signup, invite
app/mobile/*              → mobile housekeeping
```

`lib/supabase/middleware.ts` redirects unauthenticated users and wrong roles.

### 2. Data access

**Reads:** Server Components call `lib/data/*.ts` functions that use the server Supabase client. RLS enforces access.

**Writes:** `app/actions/*.ts` Server Actions validate input (Zod), mutate rows, call `revalidatePath`, and optionally trigger notifications.

**Admin client:** `lib/supabase/admin.ts` for trusted server-only operations where RLS would block legitimate self-service (used sparingly).

### 3. Realtime

Migration `015` publishes operational tables to `supabase_realtime`.

`HotelRealtimeProvider` (owner/manager shell) listens for changes filtered by `hotel_id` and:

- Publishes `layout` → `router.refresh()` for server-rendered pages
- Publishes `complaints` / `housekeeping` → client components refetch lists

`TechnicianRealtime` filters by `assigned_to`. Guest portal subscribes to the guest's complaints.

### 4. Notifications

Event-driven SMS/WhatsApp from `lib/notifications/complaints.ts` on assignment, estimate submit/approve, etc. Delivery via `lib/notifications/send.ts`.

---

## Core data model (simplified)

```text
hotels (property)
  ├── profiles (staff: owner | manager | technician)
  ├── staff_invites
  ├── rooms, room_categories
  ├── guests, reservations
  ├── housekeeping_tasks
  ├── complaints
  │     └── complaint_estimates
  ├── invoices
  └── notification_log
```

Guest portal users are `guests` rows with access tokens — not `profiles`.

Complaint states use `status` plus `approval_stage` (`estimate` | `completion`) for the two-step manager approval workflow.

---

## Security architecture

1. **RLS** — primary tenant boundary on all hotel-scoped tables.
2. **Middleware** — session cookie refresh; block `/owner/*` from managers, etc.
3. **Server Actions** — never trust client; re-check role and `hotel_id`.
4. **Contact privacy** — owner phone visible to managers only (migration `014`).
5. **Secrets** — `SUPABASE_SERVICE_ROLE_KEY`, Twilio/Hubtel keys server-only.

See [SECURITY.md](SECURITY.md) for detail.

---

## Integration points

| Integration | Status | Location |
|-------------|--------|----------|
| Supabase Auth | Live | `lib/supabase/*`, `app/actions/auth.ts` |
| Supabase Realtime | Live (migrations `015`, `038`) | `components/realtime/*` |
| Arkesel / Hubtel / Twilio SMS | Optional env | `lib/notifications/send.ts` |
| Resend email | Optional env | `lib/notifications/send-email.ts` |
| Manual payments | Live — billing, partial pay, ledger | `app/actions/invoices.ts`, `lib/billing/*` |
| Hubtel Pay | **Not built** | — |
| OTA / iCal | Not in this version — manual reservations with channel tag | — |
| Supabase Storage | Live with RLS (migration `038`) | guest ID docs, property images |
| Sentry | Optional (`SENTRY_DSN`) | `lib/monitoring/sentry.ts` |
| Vercel Cron | Live | `app/api/cron/*`, `vercel.json` |
| Health / ready | Live | `app/api/health`, `app/api/ready` |

Product gaps (owner complaints UI, pagination, password reset, etc.) are listed in [FEATURES.md](FEATURES.md#what-is-incomplete).

---

## Scalability notes

- **Current scale:** single-digit properties per owner; hundreds of rooms; suitable for pilot properties.
- **Indexes:** on `hotel_id`, reservation dates, complaint status as data grows.
- **Pagination:** default limit 100 on major list queries (`lib/data/pagination.ts`); not cursor-based yet.
- **Realtime:** one channel per hotel shell; acceptable for typical property staff counts.

---

## Related docs

- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — how to add features
- [DEPLOYMENT.md](DEPLOYMENT.md) — migrations and env setup
- [FEATURES.md](FEATURES.md) — product feature reference
