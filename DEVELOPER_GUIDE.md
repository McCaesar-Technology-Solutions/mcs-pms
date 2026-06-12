# MOJO APARTMENTS — Developer Guide

Technical reference for extending the property management system.

---

## Project structure

```text
app/
├── (auth)/                 login, signup, accept-invite
├── (owner)/owner/          owner-only pages + layout
├── (manager)/manager/      manager pages + layout
├── (technician)/           technician tasks + layout
├── (guest)/                token-based guest portal
├── mobile/housekeeping/    mobile kanban (owner/manager)
├── actions/                Server Actions (mutations)
└── layout.tsx              root layout

components/
├── dashboard/              AppShell, tables, KPIs, kanban
├── complaints/             complaint manager UI
├── guest/                  guest portal components
├── technician/             technician shell + tasks
├── realtime/               Supabase Realtime providers
└── ui/                     shadcn primitives

lib/
├── data/                   read helpers (used by Server Components)
├── supabase/               browser/server clients, middleware, admin
├── auth/                   getProfile, roles, redirects
├── notifications/          Twilio, Hubtel, complaint triggers
├── complaints/workflow.ts  status + approval_stage rules
└── validations.ts          Zod schemas

types/index.ts              shared TypeScript types
supabase/migrations/        numbered SQL migrations (001–015)
```

There is **no** `lib/mock-data.ts`. All production paths read from Supabase via `lib/data/*` and `app/actions/*`.

---

## Roles and routing

```typescript
// types/index.ts
type UserRole = 'owner' | 'manager' | 'technician'
```

| Role | Layout | Home |
|------|--------|------|
| owner | `app/(owner)/layout.tsx` | `/owner/dashboard` |
| manager | `app/(manager)/layout.tsx` | `/manager/dashboard` |
| technician | `app/(technician)/layout.tsx` | `/technician/tasks` |
| guest | `app/(guest)/layout.tsx` | `/guest` (session token, not Supabase Auth staff) |

`lib/supabase/middleware.ts` refreshes the session and enforces role paths. `lib/auth/roles.ts` maps roles to home URLs.

Navigation arrays live in `lib/navigation.ts` (`ownerNavigation`, `managerNavigation`).

---

## Data flow

### Reads (Server Components)

Pages fetch data on the server:

```tsx
// app/(manager)/manager/complaints/page.tsx
export default async function ComplaintsPage() {
  const complaints = await getComplaints()
  return <ComplaintsManager initial={complaints} />
}
```

Loaders in `lib/data/` use `createClient()` from `lib/supabase/server.ts` and respect RLS.

### Writes (Server Actions)

Mutations live in `app/actions/`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateComplaintStatus(...) {
  const supabase = await createClient()
  // validate with Zod from lib/validations.ts
  // update row
  revalidatePath('/manager/complaints')
}
```

Use `createAdminClient()` from `lib/supabase/admin.ts` only when RLS must be bypassed for a trusted server action (e.g. profile self-update edge cases).

### Client interactivity

Interactive components are `'use client'`. They receive **initial data as props** from the server page, then refresh via:

- Server Action callbacks + `router.refresh()`
- Supabase Realtime subscriptions (see below)

---

## Realtime

Live updates use **Supabase Realtime** (Postgres `postgres_changes`), not custom WebSockets.

| Provider | Used by | Subscribes to |
|----------|---------|-------------|
| `HotelRealtimeProvider` | Owner/manager `AppShell` (`enableRealtime`) | Hotel-scoped tables; triggers `router.refresh()` on layout topic |
| `TechnicianRealtime` | Technician shell | Complaints/housekeeping assigned to user |
| Guest portal channel | `GuestPortal` | Guest's complaints (`guest_id` filter) |

Key files:

- `components/realtime/hotel-realtime.tsx` — unified owner/manager channel
- `components/realtime/realtime-refresh-context.tsx` — pub/sub topics: `complaints`, `housekeeping`, `layout`
- `components/realtime/realtime-layout-refresh.tsx` — `router.refresh()` on `layout` events
- `supabase/migrations/015_realtime_publication.sql` — adds tables to `supabase_realtime` publication

Subscribers call `useRealtimeRefresh('complaints', callback)` to refetch client state without a full page reload.

---

## Notifications

`lib/notifications/send.ts` sends SMS and optional WhatsApp:

- **Twilio** — if `TWILIO_*` env vars are set (SMS + WhatsApp).
- **Hubtel** — SMS fallback for Ghana (`HUBTEL_*`); sender ID validated in `lib/notifications/hubtel-sender.ts`.

Triggers are wired from complaint assign, estimate submit/approve, and related flows in `lib/notifications/complaints.ts`. Without credentials, messages log to the server console in development.

---

## Complaint workflow

Two approval stages (`approval_stage`: `estimate` | `completion`):

1. Technician submits invoice → `pending_approval` + `estimate`
2. Manager approves → `assigned` + `estimate_approved_at` → technician can start
3. Technician marks complete → `pending_approval` + `completion`
4. Manager approves → `resolved`

Logic is centralized in `lib/complaints/workflow.ts` and enforced in `app/actions/complaints.ts` / `complaint-estimates.ts`.

---

## Adding a feature

1. **Schema** — new migration in `supabase/migrations/` (enable RLS; add to realtime publication if UI should live-update).
2. **Types** — extend `types/index.ts` and `lib/supabase/types.ts` if needed.
3. **Validation** — Zod schema in `lib/validations.ts`.
4. **Data loader** — `lib/data/your-feature.ts` for reads.
5. **Server Action** — `app/actions/your-feature.ts` for writes + `revalidatePath`.
6. **UI** — page under the correct role folder; component in `components/`.
7. **Realtime** — if managers should see changes instantly, add table to `015`-style publication and hook in `hotel-realtime.tsx` or `useRealtimeRefresh`.

---

## Commands

```bash
npm run dev      # local dev (port 3000)
npm run build    # production build
npm run lint     # ESLint
npm run seed     # optional demo data (scripts/seed.mjs)
```

---

## Environment

Copy `.env.example` → `.env.local`. Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_APP_URL`

Optional: Twilio or Hubtel for outbound notifications.

---

## Conventions

- Match existing file naming: kebab-case components, camelCase functions.
- Prefer Server Components for data fetching; `'use client'` only when needed.
- Scope all queries by `hotel_id` (tenant = hotel/property).
- Do not expose owner phone numbers to technicians or guests (`lib/data/contacts.ts`, migration `014`).
- Use `sonner` toasts for realtime user feedback; avoid duplicate polling when Realtime is active.

---

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — diagrams and integration points
- [DEPLOYMENT.md](DEPLOYMENT.md) — production setup
- [SECURITY.md](SECURITY.md) — RLS and roles
