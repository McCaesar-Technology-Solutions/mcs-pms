# MOJO Apartments — User documentation

Complete guides for every role. Written for MOJO staff and guests — plain language, step by step.

| Guide | Audience | File |
|-------|----------|------|
| **Owner** | Money, tax, portfolio, oversight | [docs/owner-guide.md](docs/owner-guide.md) |
| **Manager** | Daily ops, complaints, housekeeping | [docs/manager-guide.md](docs/manager-guide.md) |
| **Receptionist** | Front desk, bookings, check-in/out | [docs/receptionist-guide.md](docs/receptionist-guide.md) |
| **Technician** | Maintenance jobs + housekeeping tasks | [docs/technician-guide.md](docs/technician-guide.md) |
| **Guest** | Portal via link/QR | [docs/guest-guide.md](docs/guest-guide.md) |

Index and deposit policy summary: [docs/README.md](docs/README.md)

## Quick links

| Task | URL |
|------|-----|
| Staff login | `/login` |
| Owner sign-up | `/signup` |
| Staff invite | `/accept-invite?token=...` |
| Guest portal | `/guest/enter?token=...` |
| Mobile housekeeping | `/mobile/housekeeping` |

## Roles at a glance

| Feature | Owner | Manager | Receptionist | Technician | Guest |
|---------|:-----:|:-------:|:------------:|:----------:|:-----:|
| Dashboard KPIs | ✓ (+ revenue) | ✓ (no revenue) | ✓ (no revenue) | — | — |
| Outstanding balance KPI | ✓ | ✓ | ✓ | — | — |
| Reservations + deposits | ✓ | ✓ | ✓ | — | — |
| Refund deposit | ✓ | — | — | — | — |
| Guest folio posting | ✓ | ✓ | ✓ | — | — |
| Walk-in check-in | ✓ | ✓ | ✓ | — | — |
| Rooms | ✓ (+ delete) | ✓ | Status only | — | — |
| Complaints | Read-only | ✓ full | Log + track | Tasks | Submit |
| Housekeeping board | ✓ | ✓ | — | Claim/tasks | — |
| Billing / partial pay / refunds | ✓ | — | — | — | — |
| GRA / Analytics | ✓ | — | — | — | — |
| Night audit | ✓ | ✓ | — | — | — |
| Settings / multi-property | ✓ | — | — | — | — |

## Payments (MOJO)

- **Deposits** recorded on reservation before checkout.
- **Folio** charges (minibar, etc.) posted on guest profile; included at checkout.
- **Checkout** creates GRA invoice; pay now or bill later (owner in Billing).
- **Cancel / no-show with deposit** → forfeit (staff) or refund (owner only).

Details: [docs/README.md#mojo-deposit-policy-summary](docs/README.md#mojo-deposit-policy-summary)

## Live updates

Staff and guest views refresh when data changes (Supabase Realtime). Keep the browser tab open. Use **Reconnect** if Wi‑Fi drops.

## Technical setup

Hubtel/Arkesel SMS, Supabase migrations through **044**, `.env.local` — see [DEPLOYMENT.md](DEPLOYMENT.md).
