# MOJO Apartments — User documentation

Simple guides for everyone who uses the property management system.

| Role | Guide | Who it’s for |
|------|--------|----------------|
| **Owner** | [owner-guide.md](owner-guide.md) | Portfolio owner — money, tax, settings, oversight |
| **Manager** | [manager-guide.md](manager-guide.md) | Daily ops — guests, complaints, housekeeping |
| **Receptionist** | [receptionist-guide.md](receptionist-guide.md) | Front desk — bookings, check-in/out, room status |
| **Technician** | [technician-guide.md](technician-guide.md) | Maintenance + housekeeping on phone |
| **Guest** | [guest-guide.md](guest-guide.md) | In-house guests using the portal (link/QR) |

## Quick links

| Task | URL |
|------|-----|
| Staff login | `/login` |
| Owner sign-up | `/signup` |
| Accept staff invite | `/accept-invite?token=...` |
| Guest portal | `/guest/enter?token=...` |
| Mobile housekeeping | `/mobile/housekeeping` |
| Access control (Hikvision) | `/owner/access` — [setup guide](access-control.md) |

## Deposit policy (summary)

1. **Deposits are optional** unless property policy requires them.
2. **Forfeit** — hotel keeps the deposit (cancel, no-show). Any front-desk staff can confirm forfeit.
3. **Refund** — money returned to guest. **Owner only**.
4. **Never cancel an in-house guest** — use **Check out** to settle the bill and free the room.

## Who can see money

| | Owner | Manager | Receptionist |
|--|:-----:|:-------:|:------------:|
| Revenue on dashboard | ✓ | ✗ | ✗ |
| Outstanding balance | ✓ | ✓ | ✓ |
| Record deposit | ✓ | ✓ | ✓ |
| Refund deposit | ✓ | ✗ | ✗ |
| Billing write (pay / refund) | ✓ | ✗ | ✗ |
| Billing view / print | ✓ | ✓ (read-only) | ✗ |
| GRA exports | ✓ | ✗ | ✗ |

## Need technical help?

- [GO-LIVE.md](GO-LIVE.md) — production checklist before real traffic
- [access-control.md](access-control.md) — Hikvision agent setup
- [DEPLOYMENT.md](../DEPLOYMENT.md) — hosting, migrations, env vars
