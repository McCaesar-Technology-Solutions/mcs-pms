# MOJO Apartments — User Documentation

Complete guides for every role in the property management system.

| Guide | Audience | File |
|-------|----------|------|
| **Part 1 — Owner** | Property owners (billing, GRA, portfolio, analytics) | [docs/owner-guide.md](docs/owner-guide.md) |
| **Part 2 — Manager** | Daily operations (guests, complaints, housekeeping) | [docs/manager-guide.md](docs/manager-guide.md) |
| **Part 3 — Guest** | In-house guests (complaint portal via link/QR) | [docs/guest-guide.md](docs/guest-guide.md) |
| **Part 4 — Technician** | Maintenance staff (tasks, invoices, job workflow) | [docs/technician-guide.md](docs/technician-guide.md) |
| **Part 5 — Receptionist** | Front desk (bookings, check-in/out, room status, complaints) | [docs/receptionist-guide.md](docs/receptionist-guide.md) |

## Quick links

- **Sign in:** `/login`
- **Owner sign up:** `/signup`
- **Staff invite:** `/accept-invite?token=...`
- **Guest portal:** `/guest/enter?token=...` (link from front desk)

## Roles at a glance

| Feature | Owner | Manager | Receptionist | Technician | Guest |
|---------|:-----:|:-------:|:------------:|:----------:|:-----:|
| Dashboard / KPIs | ✓ (+ revenue) | ✓ (no revenue) | ✓ (no revenue) | — | — |
| Reservations | ✓ | ✓ | ✓ | — | — |
| Guest directory | ✓ | ✓ (+ walk-in) | ✓ (+ walk-in) | — | Portal only |
| Rooms | ✓ (+ delete) | ✓ | Status only | — | — |
| Complaints UI | Read-only | ✓ (+ log for guest) | Log + read-only | Tasks only | Submit only |
| Housekeeping | Summary only | ✓ | — | — | — |
| Billing / GRA / Analytics | ✓ | — | — | — | — |
| Settings / multi-property | ✓ | — | — | — | — |

## Live updates

Owner, manager, technician, and guest views refresh automatically when data changes (Supabase Realtime). Keep the browser tab open; use the **Reconnect** banner if Wi‑Fi drops.

## Support

For Hubtel SMS setup, apply Supabase migrations `001`–`016` (see [DEPLOYMENT.md](DEPLOYMENT.md)), and configure `.env.local` per `.env.example`.
