# MOJO APARTMENTS

Property Management System for Ghana hospitality — hotels, guest houses, and Airbnb-style rentals. Manage properties, reservations, housekeeping, billing, channel distribution, and GRA compliance from one dashboard.

---

## Current state (Phase 0 — complete)

This repository is a **working UI prototype**. It demonstrates the full product surface with mock data.

| Area | Status |
|------|--------|
| Dashboard shell (sidebar, topbar, design system) | Done |
| 10 dashboard routes + mobile housekeeping mockup | Done |
| Multi-property switcher + add property (localStorage) | Partial |
| Property-scoped data (rooms, reservations, availability) | Partial |
| Backend, auth, payments, OTA sync | Not started |

**Run locally:**

```bash
npm install
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

**Build:**

```bash
npm run build
npm start
```

---

## Vision — what “final product” means

MOJO APARTMENTS as a **production SaaS** should let a Ghana-based operator:

1. **Manage multiple properties** under one account (portfolio view + per-property operations).
2. **Run daily operations** — bookings, check-in/out, room status, housekeeping, guest records.
3. **Bill and collect payment** — invoices, MoMo/card via local gateways, payment status tracking.
4. **Stay compliant** — GRA-ready reports (VAT, invoices), tourism levy where applicable.
5. **Distribute inventory** — website, walk-in, and OTAs (Airbnb, Booking.com) without double-booking.
6. **Empower staff by role** — admin, manager, front desk, housekeeping with appropriate access.
7. **Work on mobile** — housekeeping task board optimized for phones on property Wi‑Fi.

Until those work with **real data, auth, and integrations**, the app is a prototype — not the final product.

---

## Roadmap overview

```text
Phase 0  UI prototype (mock data)          ← YOU ARE HERE
Phase 1  Foundation (DB, auth, CRUD)
Phase 2  Daily operations (full PMS workflows)
Phase 3  Ghana compliance & payments
Phase 4  Channels, SaaS & scale
Phase 5  Hardening & launch
```

Each phase has a **definition of done** below. Do not skip Phase 1 — everything else depends on it.

---

## Phase 1 — Foundation

**Goal:** Real data persists. Users log in. One vertical slice works end-to-end.

### 1.1 Project hygiene

- [ ] Initialize git repository and `.gitignore` (exclude `.env`, `.next`, `node_modules`).
- [ ] Rename package in `package.json` to `mojo-apartments` (optional but recommended).
- [ ] Add environment variables template: `.env.example`.
- [ ] Deploy preview to Vercel (connect repo, verify build).

### 1.2 Supabase (database + storage)

- [ ] Create a [Supabase](https://supabase.com) project (Free tier is fine for dev).
- [ ] Add `@supabase/supabase-js` + `@supabase/ssr` for Next.js App Router.
- [ ] Define core schema via Supabase SQL migrations (minimum):

```text
organizations
profiles (+ role: admin | manager | staff | guest)
organization_members
properties
rooms
guests
reservations
housekeeping_tasks
invoices (basic)
files (metadata for Storage uploads)
```

- [ ] Enable **Row Level Security (RLS)** on all tenant tables — scope by `organization_id` and optionally `property_id`.
- [ ] Create Storage buckets: `guest-documents`, `property-assets`, `invoices` (private; access via RLS policies).
- [ ] Seed script from current `lib/mock-data.ts` for dev/demo.

### 1.3 Authentication & authorization

- [ ] [Supabase Auth](https://supabase.com/docs/guides/auth) — email/password for staff; magic link optional for guest portal.
- [ ] Login / logout / session via `@supabase/ssr` middleware.
- [ ] Protect `(dashboard)/*` routes — redirect unauthenticated users.
- [ ] Role checks via `profiles.role` + RLS: only `admin` can create properties; staff limited to assigned property; guests see only their bookings.

### 1.4 API layer

- [ ] Next.js Route Handlers under `app/api/`:

```text
/api/properties      GET, POST
/api/properties/[id] GET, PATCH
/api/rooms           GET (by propertyId)
/api/guests          GET, POST, PATCH
/api/reservations    GET, POST, PATCH
/api/tasks           GET, PATCH
```

- [ ] Zod validation on all request bodies.
- [ ] Replace direct `mock-data` imports in components with fetch hooks (SWR or React Query).

### 1.5 First vertical slice (definition of done for Phase 1)

Complete this user story before moving on:

> Admin logs in → selects a property → views rooms and reservations → creates a booking for a guest → assigned room shows **occupied** → a housekeeping task appears in **To Do**.

Checklist:

- [ ] Property context reads from API, not localStorage-only.
- [ ] Create guest + reservation saves to DB.
- [ ] Room status updates when reservation is confirmed/checked-in.
- [ ] Housekeeping task auto-created on checkout or when room marked dirty.
- [ ] Refreshing the page preserves all changes.

**Estimated effort:** 3–6 weeks (solo developer), depending on Supabase/RLS familiarity.

---

## Phase 2 — Daily operations

**Goal:** Front desk and housekeeping can run a property without spreadsheets.

### 2.1 Property scoping everywhere

- [ ] KPI cards, billing, analytics, tasks, channels filter by active property.
- [ ] Admin “All properties” aggregate view for portfolio KPIs.
- [ ] Settings edits (property name, rooms count, address) persist to DB.

### 2.2 Reservation lifecycle

- [ ] States: pending → confirmed → checked_in → checked_out → cancelled.
- [ ] Check-in / check-out actions with date validation.
- [ ] Room assignment and conflict detection (no double booking).
- [ ] Reservation detail drawer wired to API.

### 2.3 Housekeeping

- [ ] Kanban drag-or-click updates task status via API.
- [ ] Task completion syncs room status (dirty → vacant, etc.).
- [ ] Staff assignment from `staffMembers` table (not hardcoded names).

### 2.4 Guests

- [ ] Guest directory from DB; search/filter server-side or client-side on loaded set.
- [ ] Guest modal “Edit profile” saves changes.
- [ ] Stay history linked to reservations.

### 2.5 Billing (basic)

- [ ] Generate invoice from reservation.
- [ ] Status: draft, sent, paid, overdue.
- [ ] Billing overview reads real invoice totals.

### 2.6 UX polish

- [ ] Topbar search queries guests, bookings, rooms.
- [ ] Loading skeletons and error toasts on failed API calls.
- [ ] Empty states when a property has no data.
- [ ] Fix Tailwind semantic tokens project-wide (`text-foreground`, `bg-primary`) — several utilities do not generate; use explicit classes or extend `@theme`.

### 2.7 Mobile housekeeping

- [ ] Rebuild `/mobile/housekeeping` to match current design system.
- [ ] Same API as desktop kanban; touch-friendly task actions.

**Definition of done:** A pilot property can operate for one week using only MOJO APARTMENTS (with manual payment recording).

**Estimated effort:** 4–8 weeks.

---

## Phase 3 — Ghana compliance & payments

**Goal:** Finance and legal requirements for Ghana hospitality businesses.

### 3.1 Tax & GRA

- [ ] Configure VAT rate (15% standard — verify current GRA rate at implementation time).
- [ ] Invoice numbering scheme (property prefix + sequential, e.g. `APH-2026-00001`).
- [ ] GRA reports page exports CSV/PDF from real invoice data.
- [ ] Tourism levy / GTA fields if required for your property types.
- [ ] Audit log for invoice creation and status changes.

See [SECURITY.md](SECURITY.md) and [FEATURES.md](FEATURES.md) for compliance notes.

### 3.2 Payments

- [ ] Integrate [Paystack](https://paystack.com/) or [Hubtel](https://hubtel.com/) for MoMo and cards.
- [ ] Payment webhooks update invoice status.
- [ ] Record manual payments (cash, bank transfer) for front desk.
- [ ] Receipt generation (PDF/email) with tax breakdown.

### 3.3 Localization

- [ ] GHS as default currency; formatting with `Intl.NumberFormat('en-GH', { currency: 'GHS' })`.
- [ ] Ghana regions in property forms (already in add-property dialog).
- [ ] Phone number validation (+233).

**Definition of done:** End-of-month GRA report can be generated from the app; at least one live MoMo test payment completes in staging.

**Estimated effort:** 3–6 weeks (plus gateway onboarding time).

---

## Phase 4 — Channels, SaaS & scale

**Goal:** Multi-tenant product ready for customers beyond your own portfolio.

### 4.1 Channel manager

- [ ] Phase A: iCal import/export per property (Airbnb, Booking.com calendars).
- [ ] Phase B: API integrations where available.
- [ ] Prevent double bookings across channels.
- [ ] Channels page shows live sync status and last sync time.

### 4.2 Multi-tenant SaaS

- [ ] Organization signup and onboarding flow.
- [ ] Invite team members by email with role.
- [ ] Subscription billing (Stripe or Paystack recurring) per property or per room tier.
- [ ] Super-admin console (optional) for support.

### 4.3 Notifications

- [ ] Email: new booking, check-in reminder, overdue invoice.
- [ ] SMS via Hubtel/Nalo for critical alerts (optional).
- [ ] In-app notification bell wired to events.

### 4.4 Analytics

- [ ] Real occupancy, RevPAR, ADR from reservation + room data.
- [ ] Channel mix and revenue trends.
- [ ] Export for accountants.

**Definition of done:** Second organization can sign up, add a property, connect an iCal feed, and receive bookings without developer intervention.

**Estimated effort:** 8–12+ weeks.

---

## Phase 5 — Hardening & launch

**Goal:** Production-grade reliability and security.

- [ ] E2E tests (Playwright) for vertical slice flows.
- [ ] API rate limiting and input sanitization.
- [ ] Backups and restore procedure for Supabase (daily backups on Pro; document restore steps).
- [ ] Error monitoring ([Sentry](https://sentry.io)).
- [ ] Performance: pagination on large tables, DB indexes on `property_id`, `check_in_date`, `status`.
- [ ] Security review per [SECURITY.md](SECURITY.md) — RBAC, CSRF, session expiry, secrets management.
- [ ] Legal: terms of service, privacy policy, data retention for guest PII.
- [ ] Production deployment checklist in [DEPLOYMENT.md](DEPLOYMENT.md).
- [ ] Pilot with 1–2 friendly properties; iterate from feedback.

**Definition of done:** Paid customers (or your own properties) use the system daily with SLA target 99.5% uptime.

---

## Recommended build order (summary)

| Order | Work item | Why first |
|-------|-----------|-----------|
| 1 | Git + Vercel preview | Safe iteration |
| 2 | DB schema + seed | Single source of truth |
| 3 | Auth + protected routes | Security baseline |
| 4 | Properties + rooms API | Multi-property core |
| 5 | Guests + reservations API | Core PMS value |
| 6 | Wire UI components to API | Replace mock data |
| 7 | Housekeeping + room sync | Operations loop |
| 8 | Billing + GRA exports | Ghana market fit |
| 9 | Payments | Revenue collection |
| 10 | OTA / iCal | Distribution |
| 11 | SaaS billing + onboarding | Scale beyond one operator |

---

## Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Next.js 16, React 19, TypeScript | App Router, mostly client components today |
| Styling | Tailwind CSS 4, custom tokens in `app/globals.css` | See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| UI | shadcn/ui, Lucide icons | |
| Backend | [Supabase](https://supabase.com) | PostgreSQL + Auth + Storage + RLS |
| Auth | Supabase Auth | Staff, admin, guest portal roles |
| File uploads | Supabase Storage | Guest IDs, property photos, invoice PDFs |
| Hosting | Vercel | |
| Payments | Paystack / Hubtel | Phase 3 |
| Email | Resend / SendGrid | Phase 4 |

---

## Repository map (today)

```text
app/
  (dashboard)/          # Main app routes
  mobile/housekeeping/  # Legacy mobile mockup
  layout.tsx            # Sidebar + main column shell
components/dashboard/   # Feature UI (24 components)
lib/
  mock-data.ts          # Demo data — replace in Phase 1
  property-context.tsx  # Multi-property (localStorage)
types/index.ts          # Shared TypeScript interfaces
```

**Key UI components already built:** KPI cards, availability strip, reservations table, guests table, housekeeping kanban, billing overview, GRA reports, channels manager, analytics dashboard, settings panel, property switcher, add-property dialog.

---

## Migrating from mock data

Pattern used today:

```typescript
import { reservations } from '@/lib/mock-data'
```

Target pattern (Phase 1):

```typescript
'use client'
import useSWR from 'swr'

export function ReservationsTable() {
  const { activePropertyId } = useProperty()
  const { data, error, isLoading } = useSWR(
    `/api/reservations?propertyId=${activePropertyId}`,
    fetcher
  )
  // ...
}
```

Migrate **one feature at a time** (reservations first, then guests, then tasks). Keep mock data as fallback behind a `USE_MOCK_DATA` env flag until Phase 1 is complete.

---

## Ghana-specific checklist (final product)

- [ ] VAT on invoices (verify current GRA rate).
- [ ] GRA-exportable transaction reports.
- [ ] MoMo and local card payments.
- [ ] GHS currency throughout.
- [ ] Ghana address regions on properties.
- [ ] E-levy / receipt rules (confirm with accountant before implementation).
- [ ] Guest ID / registration fields if required by GTA.

---

## Documentation index

| Document | Purpose |
|----------|---------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | **Team Git workflow, branches, PRs, Phase 1 issues** |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | Full doc map |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and data models |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Components and conventions |
| [FEATURES.md](FEATURES.md) | Feature specifications |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Colors, spacing, elevation |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel and production setup |
| [SECURITY.md](SECURITY.md) | Auth, RBAC, compliance |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues |
| [USER_GUIDE.md](USER_GUIDE.md) | End-user workflows |

---

## What not to do yet

- **Microservices** — monolith + Next.js API routes is enough until Phase 4 scale.
- **Real-time WebSockets** — polling or SWR revalidation is fine for v1.
- **Native mobile apps** — responsive web + PWA first; React Native later if needed.
- **Perfect analytics** — ship operational CRUD before advanced BI.

---

## Contributing to the roadmap

**Team workflow:** see **[CONTRIBUTING.md](CONTRIBUTING.md)** for branch naming, PR process, Phase 1 issue breakdown, and lead checklist.

When starting a phase:

1. Create a GitHub milestone (or project board) matching the phase checklist above.
2. One PR per feature slice (e.g. “API: reservations CRUD”, “UI: wire reservations table”).
3. Tag `main` when the phase definition of done is met (e.g. `v0.1.0-phase1`).
4. Update this README checklist as items ship.

---

## License

Private / unlicensed — set explicitly before open-sourcing or SaaS launch.

---

**Next recommended action:** Start **Phase 1.1–1.4**, then complete the **vertical slice** in Phase 1.5. The UI is ready to drive schema and API design — use the existing screens as the contract for what the backend must support.
