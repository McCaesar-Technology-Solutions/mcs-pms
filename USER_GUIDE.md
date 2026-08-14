# MOJO Apartments — User documentation

Complete guides for every role. Written for MOJO staff and guests — plain language, step by step.

In the app, tap the **Help** bubble (bottom-right) for the same topics on the page you are on.

| Guide | Audience | File |
|-------|----------|------|
| **Owner** | Money, tax, payroll, portfolio, oversight | [docs/owner-guide.md](docs/owner-guide.md) |
| **Manager** | Daily ops, complaints, housekeeping, payroll drafts | [docs/manager-guide.md](docs/manager-guide.md) |
| **Receptionist** | Front desk, bookings, check-in/out, stay payments | [docs/receptionist-guide.md](docs/receptionist-guide.md) |
| **Technician** | Maintenance jobs + housekeeping tasks | [docs/technician-guide.md](docs/technician-guide.md) |
| **Guest** | Portal via link/QR | [docs/guest-guide.md](docs/guest-guide.md) |

Index and money-permissions summary: [docs/README.md](docs/README.md)

## Quick links

| Task | URL |
|------|-----|
| Staff login | `/login` |
| Owner sign-up | `/signup` |
| Staff invite | `/accept-invite?token=...` |
| Guest portal | `/guest/enter?token=...` |
| Lobby QR join | `/guest/join/{property}` |
| Mobile housekeeping | `/mobile/housekeeping` |

## Roles at a glance

| Feature | Owner | Manager | Receptionist | Technician | Guest |
|---------|:-----:|:-------:|:------------:|:----------:|:-----:|
| Dashboard KPIs | ✓ (+ revenue) | ✓ (no revenue) | Occupancy in toolbar | — | — |
| Outstanding balance KPI | ✓ | ✓ | — | — | — |
| Reservations + deposits | ✓ | ✓ | ✓ | — | — |
| Guest stay discount (% / ₵) | ✓ | ✓ | — | — | — |
| Refund deposit | ✓ | — | — | — | — |
| Walk-in / register in-house | ✓ | ✓ | ✓ | — | — |
| Guest folio posting | ✓ | ✓ | ✓ | — | — |
| Folio discount credit | ✓ | ✓ | — | — | — |
| Rooms | ✓ (+ delete) | ✓ | Status + view rates | — | — |
| Access (Hikvision) | ✓ full | Ops + staff + attendance | Guest unlock / cards | — | Door PIN if enabled |
| Complaints | Log + read-only | Assign + close | Log + track | Do the work | Submit + sign off |
| Housekeeping board | ✓ | ✓ | — | Claim / tasks | Request clean |
| Inventory | ✓ | ✓ | — | Consume on jobs | — |
| Billing view / print / WhatsApp | ✓ | ✓ | ✓ | — | Own invoices |
| Record stay payments | ✓ | ✓ | ✓ | — | Pay now if enabled |
| Issue unpaid / ad-hoc invoices | ✓ | ✓ | — | — | — |
| Invoice refunds | ✓ | — | — | — | — |
| Payroll | Full | Drafts only | — | — | — |
| GRA / Analytics / Expenses | ✓ | — | — | — | — |
| Night / period audit | ✓ | ✓ | — | — | — |
| Settings / multi-property | ✓ | Portal copy only | — | — | — |

## Payments (MOJO)

- **Stay payment is taken at check-in** (pay before enter). Checkout reuses the same invoice for extras.
- **Deposits** can be recorded on a reservation before check-in.
- **Folio** charges (minibar, laundry, etc.) post on the guest profile and roll into the stay invoice.
- **Discounts** (percent or fixed, before tax) — owner and manager only. Reception asks a manager.
- **Include Ghana tax** is optional when issuing. Taxed invoices use Bill-to Tax ID `GHA-728071939-8`. Guest Ghana Card is optional on the guest record.
- **Cancel / no-show with deposit** → forfeit (staff) or refund (owner only).
- **Refunds** of invoice payments stay owner-only.

Details: [docs/README.md](docs/README.md#deposit-policy-summary)

## Live updates

Staff and guest views refresh when data changes (Supabase Realtime). Keep the browser tab open. Use **Reconnect** if Wi‑Fi drops.

## Technical setup

Hubtel / Arkesel SMS, online payments flag, Supabase migrations through **076**, `.env.local` — see [DEPLOYMENT.md](DEPLOYMENT.md).
