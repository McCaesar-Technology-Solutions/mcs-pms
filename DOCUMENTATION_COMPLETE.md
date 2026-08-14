# Documentation status

Documentation aligned with the **Supabase-backed** application (August 2026). User guides and in-app Help match current roles, billing, tax, discounts, payroll, and complaint flow.

---

## User documentation

| File | Status |
|------|--------|
| [USER_GUIDE.md](USER_GUIDE.md) | Index + role matrix + payments |
| [docs/README.md](docs/README.md) | Money permissions + deposit policy |
| [docs/owner-guide.md](docs/owner-guide.md) | Current |
| [docs/manager-guide.md](docs/manager-guide.md) | Current |
| [docs/receptionist-guide.md](docs/receptionist-guide.md) | Current (billing, payments, no discounts) |
| [docs/guest-guide.md](docs/guest-guide.md) | Current |
| [docs/technician-guide.md](docs/technician-guide.md) | Current (start-on-assign; optional invoice) |
| In-app Help (`lib/help/topics/`) | Synced with role guides |

---

## Technical documentation

| File | Status |
|------|--------|
| [README.md](README.md) | Stack and routes |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Server Actions, Realtime |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Hosting, migrations, env vars |
| [SECURITY.md](SECURITY.md) | RBAC |
| [FEATURES.md](FEATURES.md) | Current product section (August 2026); older screen notes are illustrative |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Supabase, migrations, realtime |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | Updated |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Visual tokens |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Git workflow |

---

## Still on the roadmap (not documented as shipped)

- Online payment gateway enabled in production (`PAYMENTS_ENABLED` — Paystack path exists, off by default)
- Booking.com / other OTA iCal (Airbnb iCal is shipped)
- Payroll Phase 2 (PAYE/SSNIT engine, timesheets, self-service slips)

---

See [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for navigation.
