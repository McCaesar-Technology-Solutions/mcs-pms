# Hikvision access control (Mojo)

Production path for the apartment with Hikvision already installed: **MOJO enqueues jobs → on-site agent applies ISAPI**.

See also: [hikvision-srs-roadmap.md](hikvision-srs-roadmap.md) (phased SRS implementation).

**Who uses Access in the app**

| Role | Can do |
|------|--------|
| Owner | Full setup, staff + guest access, policies, attendance (`/owner/access`) — tabs: Today · Guests · Staff · Attendance · Setup |
| Manager | Guest ops + approved staff physical access + attendance (`/manager/access`) — no Setup tab |
| Receptionist | Guest credentials only; guest-facing unlock; guest jobs only (`/receptionist/access`) — Today · Guests |

Deep links: `#today`, `#guests`, `#staff`, `#attendance`, `#setup` (also `#unlock` → Today, `#install` → Setup).

## What was built

| Piece | Location |
|-------|----------|
| Schema | `061`–`065`, `068` (persons, policies, gym, attendance) |
| Guest lifecycle | `lib/access/lifecycle.ts` + `app/actions/stays.ts` |
| Staff lifecycle | `lib/access/staff-lifecycle.ts` |
| Door resolution | `lib/access/doors.ts` (room + shared + gym) |
| Job queue | `lib/access/jobs.ts` |
| Agent API | `app/api/access/agent/*` |
| Staff UI | `/owner/access`, `/manager/access`, `/receptionist/access` |
| On-site agent | **MOJO Access Agent** (`services/access-agent-app`) |

## Guest door policy

On check-in, guests receive:

1. Unit door(s) mapped to their room
2. Doors with `grants_shared_access` (lobby / corridor)
3. Doors with zone `gym`

They do **not** automatically receive every non-unit door.

## Staff access

Owner/Manager create staff physical persons with an access policy (door group). Reception never sees staff credentials (RLS + server filters).

## Attendance

Save DS-K1A8503MF-B as device role **Attendance**, then **Pull from terminal** on Owner/Manager Access.

- Agent job `pull_attendance` calls ISAPI `POST /ISAPI/AccessControl/AcsEvent` (last 48h, paginated).
- Ingest maps `attendanceStatus` → `clock_in` / `clock_out` / `unknown`, links staff credentials by `employee_no`, never tenants.
- Re-pulls are idempotent (`069` unique index + upsert ignoreDuplicates).
- Requires Access Agent **1.3.8+**.

## Deferred

Payment-gated door provision is deferred (Paystack not the live gate yet).

## Go-live steps

1. Apply migrations through `069`.
2. Owner → Access: Start setup, save controllers + optional enrollment + attendance terminals.
3. Map room doors (zone unit), lobby (shared), gymnasium (zone **gym** — not “Lobby + shared”).
   If Gymnasium was saved earlier as lobby/other with shared access, **Edit** it and set zone to Gymnasium.
4. Map staff policy doors (setup checklist requires ≥1), create staff access, enroll at station.
5. Install MOJO Access Agent **1.3.8+**; leave tray running.
