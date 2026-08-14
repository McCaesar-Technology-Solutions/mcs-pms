# MOJO APARTMENTS

Property management for Ghana hospitality — hotels, guest houses, and short-stay rentals. Multi-property owners, managers, receptionists, technicians, and in-house guests share one system backed by **Supabase** (PostgreSQL, Auth, Realtime).

---

## Current state

The app is a **working PMS** with real persistence, role-based access, and live UI updates. It is not yet a full production SaaS — see **[FEATURES.md — What is incomplete](FEATURES.md#what-is-incomplete)** for remaining optional work (online payments flag, other OTAs).

| Area | Status |
|------|--------|
| Supabase schema + RLS (migrations `001`–`074`) | Done |
| Auth: owner signup, staff invites, password reset, MFA | Done |
| Roles: owner, manager, receptionist, technician, guest | Done |
| Reservations, lifecycle v2, check-in/out, walk-ins, discounts, guest portal | Done |
| Rooms, nightly/weekly/monthly rates, housekeeping kanban | Done |
| Complaints: assign → start → guest sign-off → close | Done |
| Billing (owner/manager/reception), folio, night audit, GRA, tax rates | Done |
| Payroll (owner full / manager drafts) | Done |
| SMS/email notifications + outbox retry | Done |
| Live updates via Supabase Realtime | Done |
| Online payments (Paystack) | Optional — `PAYMENTS_ENABLED` (off by default) |
| OTA / channel manager | Airbnb iCal import/export (Settings → Channels); other OTAs manual tag only |

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill Supabase keys
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

**Owner:** sign up at `/signup` when public registration is enabled (`DISABLE_PUBLIC_SIGNUP` unset).  
**Staff:** accept invite at `/accept-invite?token=...`.  
**Guest:** portal link from front desk — `/guest/enter?token=...`.

### Database

Apply migrations `001`–`074` in `supabase/migrations/`. See [DEPLOYMENT.md](DEPLOYMENT.md) and [docs/GO-LIVE.md](docs/GO-LIVE.md).

Optional seed:

```bash
npm run seed
```

---

## Routes by role

| Role | Home | Key paths |
|------|------|-----------|
| **Owner** | `/owner/dashboard` | billing, payroll, GRA, analytics, settings, multi-property |
| **Manager** | `/manager/dashboard` | guests, reservations, invoices, complaints, housekeeping, payroll drafts |
| **Receptionist** | `/receptionist/dashboard` | reservations, guests, billing, access |
| **Technician** | `/technician/tasks` | assigned jobs, housekeeping claim |
| **Guest** | `/guest` (token) | stay, messages, invoices, issues |

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
| Notifications | Arkesel (SMS, Ghana), Twilio (SMS + WhatsApp), or Hubtel (SMS fallback) |
| Hosting | Vercel |

---

## Repository map

```text
app/
  (auth)/           login, signup, accept-invite
  (owner)/owner/    owner dashboard routes
  (manager)/manager/ manager operations
  (receptionist)/  receptionist front desk
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
  notifications/    SMS/WhatsApp (Arkesel, Twilio, Hubtel)
supabase/migrations/  SQL schema (001–074)
docs/               role guides + GO-LIVE checklist
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [USER_GUIDE.md](USER_GUIDE.md) | Index to role guides |
| [docs/owner-guide.md](docs/owner-guide.md) | Owner workflows |
| [docs/manager-guide.md](docs/manager-guide.md) | Manager workflows |
| [docs/receptionist-guide.md](docs/receptionist-guide.md) | Front desk |
| [docs/guest-guide.md](docs/guest-guide.md) | Guest portal |
| [docs/technician-guide.md](docs/technician-guide.md) | Technician jobs |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Code patterns for contributors |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel, Supabase, env vars, migrations |
| [docs/GO-LIVE.md](docs/GO-LIVE.md) | Production go-live checklist |
| [FEATURES.md](FEATURES.md) | Feature reference |
| [SECURITY.md](SECURITY.md) | Auth, RLS, compliance |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Git workflow |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | Full doc map |

---

## What's next (roadmap)

Priority optional: enable Paystack Pay now in production, Booking.com iCal. Airbnb calendar sync, payroll, tax rates, and core ops are shipped. Details in [FEATURES.md](FEATURES.md#what-is-incomplete).

---

## License

Private / unlicensed — set explicitly before open-sourcing or SaaS launch.
