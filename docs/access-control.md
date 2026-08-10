# Hikvision access control (Mojo)

Production path for the apartment with Hikvision already installed: **MOJO enqueues jobs → on-site agent applies ISAPI**.

See also: [hikvision-srs-roadmap.md](hikvision-srs-roadmap.md) (phased SRS implementation).

**Who uses Access in the app**

| Role | Can do |
|------|--------|
| Owner | Full setup, staff + guest access, policies, attendance (`/owner/access`) |
| Manager | Guest ops + approved staff physical access + attendance (`/manager/access`) |
| Receptionist | Guest credentials only; guest-facing unlock (`/receptionist/access`) |

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

Save DS-K1A8503MF-B as device role **Attendance**, then use **Pull from terminal** on Access. Agent job `pull_attendance` (ISAPI event pull TBD per device firmware).

## Deferred

Payment-gated door provision is deferred (Paystack not the live gate yet).

## Go-live steps

1. Apply migrations through `068`.
2. Owner → Access: Start setup, save controllers + optional enrollment + attendance terminals.
3. Map room doors (zone unit), lobby (shared), gymnasium (zone gym).
4. Map staff policy doors, create staff access, enroll at station.
5. Install MOJO Access Agent; leave tray running.
