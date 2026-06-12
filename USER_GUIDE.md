# MOJO Apartments — User Documentation

Complete guides for every role in the property management system.

| Guide | Audience | File |
|-------|----------|------|
| **Part 1 — Owner** | Property owners (billing, GRA, portfolio, analytics) | [docs/owner-guide.md](docs/owner-guide.md) |
| **Part 2 — Manager** | Daily operations (guests, complaints, housekeeping) | [docs/manager-guide.md](docs/manager-guide.md) |
| **Part 3 — Guest** | In-house guests (complaint portal via link/QR) | [docs/guest-guide.md](docs/guest-guide.md) |
| **Part 4 — Technician** | Maintenance staff (tasks, invoices, job workflow) | [docs/technician-guide.md](docs/technician-guide.md) |

## Quick links

- **Sign in:** `/login`
- **Owner sign up:** `/signup`
- **Staff invite:** `/accept-invite?token=...`
- **Guest portal:** `/guest/enter?token=...` (link from front desk)

## Roles at a glance

| Feature | Owner | Manager | Technician | Guest |
|---------|:-----:|:-------:|:----------:|:-----:|
| Dashboard / KPIs | ✓ | ✓ | — | — |
| Reservations | ✓ | ✓ | — | — |
| Guest directory | ✓ | ✓ (+ walk-in) | — | Portal only |
| Rooms | ✓ (+ delete) | ✓ | — | — |
| Complaints UI | — | ✓ | Tasks only | Submit only |
| Housekeeping | Summary only | ✓ | — | — |
| Billing / GRA / Analytics | ✓ | — | — | — |
| Settings / multi-property | ✓ | — | — | — |

## Live updates

Owner, manager, technician, and guest views refresh automatically when data changes (Supabase Realtime). Keep the browser tab open; use the **Reconnect** banner if Wi‑Fi drops.

## Support

For Hubtel SMS setup, apply Supabase migrations `001`–`016` (see [DEPLOYMENT.md](DEPLOYMENT.md)), and configure `.env.local` per `.env.example`.
