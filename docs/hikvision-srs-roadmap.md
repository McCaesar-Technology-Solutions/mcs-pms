# Hikvision / Access Control — Implementation Roadmap

Maps the Mojo Suites Hikvision SRS onto the existing stack:
**Next.js server actions + Supabase + MOJO Access Agent** (not a greenfield `/api/v1`).

## Deferred (product decision)

- **Payment-gated door provision** — skipped for now. Check-in may provision without verified payment because Paystack is not the live gate yet. Revisit when online payments / verification workflow ships.

## Phase status

| Phase | Scope | Status |
|-------|--------|--------|
| 0 | Guest lifecycle, agent, enrollment station, install downloads | Done |
| 1 | Staff physical persons + Reception isolation | Partial (isolation jobs still open — Phase C) |
| 2 | Gym / amenity door policy (room + gym; fix over-grant) | Done |
| 3 | Harden Reception unlock/enroll + audit | Partial (cancel/jobs — Phase C) |
| 4 | Access policies / door groups for staff | Done |
| 5 | Attendance (DS-K1A8503MF-B) schema + pull job + UI | Partial (role fixed; ISAPI pull TBD — Phase F) |
| 6 | Staff / attendance UI on Access pages | Partial (enroll/reactivate — Phase D) |

## Fix sprints

| Sprint | Phases | Status |
|--------|--------|--------|
| 1 | A (attendance role) + B (multi-door rights) | Done |
| 2 | C Reception job isolation | Planned |
| 3 | D+E Staff ops + door edit UX | Planned |
| 4 | F Attendance ISAPI pull | Planned |
| 5 | G Hardening / docs / tests | Planned |

## Source of truth

- **PMS:** who may have access, policies, bookings, staff/tenant records, audit
- **Devices / agent:** physical credential execution, online status, raw events

## Key migrations

- `061` access core · `064` cloud secrets · `065` enrollment station
- `068` persons, policies, gym zone, attendance foundation

## Roles (ops)

| Role | Access |
|------|--------|
| Owner | Setup, staff + guest access, policies, devices |
| Manager | Guest ops + approved staff physical access |
| Reception | **Tenant/guest credentials only**; guest-facing unlock; no staff persons/devices/secrets |
