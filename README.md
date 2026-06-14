# MOJO APARTMENTS

Property management for Ghana hospitality — hotels, guest houses, and short-stay rentals. Multi-property owners, managers, receptionists, technicians, and in-house guests share one system backed by **Supabase** (PostgreSQL, Auth, Realtime).

---

## Current state

The app is a **working PMS** with real persistence, role-based access, and live UI updates. It is not yet a full production SaaS — see **[FEATURES.md — What is incomplete](FEATURES.md#what-is-incomplete)** for the full gap list.

| Area | Status |
|------|--------|
| Supabase schema + RLS (migrations `001`–`018`) | Done |
| Auth: owner signup, staff invites, guest portal tokens | Done |
| Roles: owner, manager, receptionist, technician, guest | Done |
| Reservations, check-in/out, walk-ins, guest portal + QR | Done |
| Rooms, categories, housekeeping kanban | Done |
| Complaints + two-step approval (invoice → work → completion) | Done |
| Billing, GRA exports, analytics (owner) | Done |
| SMS/WhatsApp notifications (Twilio / Hubtel SMS) | Done |
| Live updates via Supabase Realtime | Done (run migration `015`) |
| Online payments (Paystack / Hubtel pay) | Not started |
| OTA / channel manager | Not started |

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill Supabase keys
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

**Owner:** sign up at `/signup`.  
**Staff:** accept invite at `/accept-invite?token=...`.  
**Guest:** portal link from front desk — `/guest/enter?token=...`.

### Database

Apply migrations `001`–`018` in `supabase/migrations/`. If the database already exists but `supabase db push` fails on `001`, run only the missing SQL (e.g. `015`–`018`) in the Supabase SQL Editor. See [DEPLOYMENT.md](DEPLOYMENT.md#schema-and-migrations).

Optional seed:

```bash
npm run seed
```

---

## Routes by role

| Role | Home | Key paths |
|------|------|-----------|
| **Owner** | `/owner/dashboard` | billing, GRA, analytics, settings, multi-property |
| **Manager** | `/manager/dashboard` | guests, reservations, complaints, housekeeping |
| **Technician** | `/technician/tasks` | assigned jobs, invoices |
| **Guest** | `/guest` (token) | submit & track complaints |

Mobile housekeeping: `/mobile/housekeeping` (owner/manager).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16, React 19, TypeScript, App Router |
| Styling | Tailwind CSS 4, shadcn/ui |
| Backend | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth + `@supabase/ssr` middleware |
| Mutations | Next.js Server Actions (`app/actions/`) |
| Realtime | Supabase Realtime (`components/realtime/`) |
| Notifications | Twilio (SMS + WhatsApp) or Hubtel (SMS, Ghana) |
| Hosting | Vercel |

---

## Repository map

```text
app/
  (auth)/           login, signup, accept-invite
  (owner)/owner/    owner dashboard routes
  (manager)/manager/ manager operations
  (technician)/     technician tasks
  (guest)/          guest complaint portal
  mobile/           mobile housekeeping
  actions/          server actions (CRUD, auth, notifications)
components/
  dashboard/        shell, KPIs, tables, kanban
  complaints/       manager complaint UI
  realtime/         hotel + technician live channels
lib/
  data/             server-side data loaders
  supabase/         client, server, middleware, admin
  notifications/    SMS/WhatsApp (Twilio, Hubtel)
supabase/migrations/  SQL schema (001–018)
docs/               role-specific user guides
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [USER_GUIDE.md](USER_GUIDE.md) | Index to role guides |
| [docs/owner-guide.md](docs/owner-guide.md) | Owner workflows |
| [docs/manager-guide.md](docs/manager-guide.md) | Manager workflows |
| [docs/guest-guide.md](docs/guest-guide.md) | Guest portal |
| [docs/technician-guide.md](docs/technician-guide.md) | Technician jobs |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Code patterns for contributors |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel, Supabase, env vars, migrations |
| [FEATURES.md](FEATURES.md) | Feature reference |
| [SECURITY.md](SECURITY.md) | Auth, RLS, compliance |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Git workflow |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | Full doc map |

---

## What's next (roadmap)

Priority order: **payments → OTA/iCal → auth recovery + tests → SaaS onboarding**. Details in [FEATURES.md](FEATURES.md#what-is-incomplete).

---

## License

Private / unlicensed — set explicitly before open-sourcing or SaaS launch.
