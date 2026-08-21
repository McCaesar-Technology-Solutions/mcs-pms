# MOJO Apartments — User documentation

Simple guides for everyone who uses the property management system.

Tap **Help** (bottom-right in the app) for the same topics on the screen you are using.

| Role | Guide | Who it’s for |
|------|--------|----------------|
| **Owner** | [owner-guide.md](owner-guide.md) | Portfolio owner — money, tax, payroll, settings, oversight |
| **Manager** | [manager-guide.md](manager-guide.md) | Daily ops — guests, complaints, housekeeping, payroll drafts; switch among assigned properties |
| **Receptionist** | [receptionist-guide.md](receptionist-guide.md) | Front desk — bookings, check-in/out, stay payments, room status |
| **Technician** | [technician-guide.md](technician-guide.md) | Maintenance + housekeeping on phone |
| **Guest** | [guest-guide.md](guest-guide.md) | In-house guests using the portal (link/QR) |

## Quick links

| Task | URL |
|------|-----|
| Staff login | `/login` |
| Owner sign-up | `/signup` |
| Accept staff invite | `/accept-invite?token=...` |
| Guest portal | `/guest/enter?token=...` |
| Lobby QR join | `/guest/join/{property}` |
| Mobile housekeeping | `/mobile/housekeeping` |
| Access control (Hikvision) | `/owner/access` — [setup guide](access-control.md) |
| Airbnb calendar sync | `/owner/settings#channels` — [setup guide](airbnb-sync.md) |

## Pre-arrival payment & cancel policy (summary)

1. **Pre-arrival payments are optional** unless property policy requires them (check-in minimum is configured separately under Lifecycle).
2. **Forfeit deposit** — hotel keeps money collected before cancel/no-show. Any front-desk staff can confirm forfeit.
3. **Refund deposit** — money returned to guest on cancel/no-show. **Owner only**.
4. **Never cancel an in-house guest** — use **Check out** to settle the bill and free the room.

## Who can see money

| | Owner | Manager | Receptionist |
|--|:-----:|:-------:|:------------:|
| Revenue on dashboard | ✓ | ✗ | ✗ |
| Outstanding balance (dashboard) | ✓ | ✓ | ✗ |
| Record stay payment | ✓ | ✓ | ✓ |
| Refund deposit (cancel/no-show) | ✓ | ✗ | ✗ |
| Guest stay discount | ✓ | ✓ | ✗ |
| Record stay payments | ✓ | ✓ | ✓ |
| Issue unpaid stay invoice / ad-hoc bill | ✓ | ✓ | ✗ |
| Invoice refund | ✓ | ✗ | ✗ |
| Billing view / print / WhatsApp | ✓ | ✓ | ✓ |
| Payroll (approve / mark paid) | ✓ | Draft only | ✗ |
| GRA exports / analytics / expenses | ✓ | ✗ | ✗ |

Stay payment is collected **at check-in**. Reception must record payment when issuing a stay invoice. Managers and owners may leave a stay invoice unpaid (balance due).

## Need technical help?

- [GO-LIVE.md](GO-LIVE.md) — production checklist before real traffic
- [access-control.md](access-control.md) — Hikvision agent setup
- [DEPLOYMENT.md](../DEPLOYMENT.md) — hosting, migrations, env vars
