# MOJO APARTMENTS — Documentation Index

Quick map of all documentation. **Last updated:** June 2026.

---

## Start here

| Document | Audience | Purpose |
|----------|----------|---------|
| [README.md](README.md) | Everyone | Project overview, quick start, current status |
| [USER_GUIDE.md](USER_GUIDE.md) | End users | Index to role-specific guides |

---

## User guides (by role)

| Guide | File |
|-------|------|
| Owner | [docs/owner-guide.md](docs/owner-guide.md) |
| Manager | [docs/manager-guide.md](docs/manager-guide.md) |
| Guest | [docs/guest-guide.md](docs/guest-guide.md) |
| Technician | [docs/technician-guide.md](docs/technician-guide.md) |

---

## Technical docs

| Document | Purpose |
|----------|---------|
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Code structure, Server Actions, Realtime |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, data model, integrations |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel, Supabase, migrations `001`–`015`, env vars |
| [SECURITY.md](SECURITY.md) | RLS, roles, compliance |
| [FEATURES.md](FEATURES.md) | Product features + screen reference |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Colors, typography, components |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Build errors, migrations, realtime FAQ |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Git workflow, PRs |

---

## Find what you need

| I want to… | Read |
|------------|------|
| Run the app locally | [README.md](README.md) |
| Set up Supabase + migrations | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Understand roles and routes | [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md) |
| Add a feature | [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) |
| Fix `db push` / realtime | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Train staff | [USER_GUIDE.md](USER_GUIDE.md) → role guides |

---

## Reading order

**Property manager:** USER_GUIDE → manager-guide → TROUBLESHOOTING FAQ

**Developer:** README → DEVELOPER_GUIDE → ARCHITECTURE → DEPLOYMENT

**DevOps:** DEPLOYMENT → SECURITY → TROUBLESHOOTING

---

## Maintenance

When shipping features that change behavior or setup:

1. Update the relevant role guide in `docs/`.
2. Update README “Current state” table if major.
3. Add migrations to DEPLOYMENT migration table.
4. Bump “Last updated” in this file.
