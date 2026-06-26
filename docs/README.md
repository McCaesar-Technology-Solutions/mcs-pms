# MOJO Apartments — Staff documentation

Step-by-step guides for everyone who uses the property management system.

| Role | Guide | Who it's for |
|------|--------|----------------|
| **Owner** | [owner-guide.md](owner-guide.md) | Property owner — money, tax, portfolio, oversight |
| **Manager** | [manager-guide.md](manager-guide.md) | Daily operations — guests, complaints, housekeeping |
| **Receptionist** | [receptionist-guide.md](receptionist-guide.md) | Front desk — bookings, check-in/out, room status |
| **Technician** | [technician-guide.md](technician-guide.md) | Maintenance + housekeeping tasks on mobile |
| **Guest** | [guest-guide.md](guest-guide.md) | In-house guests using the portal (link/QR) |

## Quick links

| Task | URL |
|------|-----|
| Staff login | `/login` |
| Owner sign-up | `/signup` |
| Accept staff invite | `/accept-invite?token=...` |
| Guest portal | `/guest/enter?token=...` |
| Mobile housekeeping | `/mobile/housekeeping` |

## MOJO deposit policy (summary)

Use the same rules at every property:

1. **Deposits are optional** unless MOJO policy says otherwise for a channel (e.g. direct bookings).
2. **Forfeit** — hotel keeps the deposit (cancel, no-show, or no-refund policy). Any staff can confirm forfeit.
3. **Refund** — money returned to guest. **Owner only** in the system.
4. **Never cancel an in-house guest** from Reservations — use **Check out** to settle the bill and free the room.

Full payment workflows are in the Owner and Receptionist guides.

## What each role can see (money)

| | Owner | Manager | Receptionist |
|--|:-----:|:-------:|:------------:|
| Revenue on dashboard | ✓ | ✗ | ✗ |
| Outstanding balance KPI | ✓ | ✓ | ✓ |
| Record deposit on booking | ✓ | ✓ | ✓ |
| Refund deposit | ✓ | ✗ | ✗ |
| Billing / partial pay / refunds | ✓ | ✗ | ✗ |
| GRA exports | ✓ | ✗ | ✗ |

## Need technical help?

See [DEPLOYMENT.md](../DEPLOYMENT.md) for migrations and hosting. Database migrations through **044** include reservation payments and housekeeping flow.
