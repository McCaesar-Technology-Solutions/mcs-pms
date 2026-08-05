# Hikvision access control (Mojo)

Production path for the apartment with Hikvision already installed: **MOJO enqueues jobs → on-site agent applies ISAPI**.

**Who uses Access in the app**

| Role | Can do |
|------|--------|
| Owner | Full setup + day-to-day ops (`/owner/access`) |
| Manager | Unlock, assign card, retry (`/manager/access`) |
| Receptionist | Unlock, assign card, retry (`/receptionist/access`) |

Day-to-day steps for staff are in the [owner](owner-guide.md#8-access-control-hikvision), [manager](manager-guide.md#8-access-ops-only), and [receptionist](receptionist-guide.md#8-access) guides. This page is the **technical setup** checklist.

## What was built

| Piece | Location |
|-------|----------|
| Schema | `supabase/migrations/061_access_control.sql` |
| Lifecycle hooks | `app/actions/stays.ts` (check-in, checkout, extend, move) |
| Job queue | `lib/access/jobs.ts` |
| Agent API | `app/api/access/agent/*` |
| Stuck-job reclaim | Agent poll + GitHub Actions every 5 min; daily Vercel backup (`04:45` UTC) |
| Staff UI | `/owner/access`, `/manager/access`, `/receptionist/access` |
| On-site agent | **MOJO Access Agent** desktop app (`services/access-agent-app`) — tray icon + `.dmg`/`.exe` |

## Security model

- **Two password options:**
  - **Local** — Hikvision admin passwords stay only in the agent `.env` on site.
  - **Cloud** — passwords are entered in Owner → Access, stored encrypted (`access_device_secrets`, service role only), and downloaded by the authenticated agent over HTTPS.
- Agent bearer token is stored as **SHA-256 hash** in `access_integrations` (plaintext shown once on rotate).
- Door PINs in job payloads are **AES-GCM encrypted** at rest and stripped after success.
- Staff RLS is **SELECT-only** on access tables; device password ciphertext is never selected in browser loaders.
- Agent endpoints are rate-limited and require `Authorization: Bearer` + `X-Mojo-Hotel-Id`.

## Enrollment station (DS-K1F600U-D6E-F)

Phase 1–2: save the station in Owner → Access with role **Enrollment station**, then use **Enroll card / face / fingerprint** on guest credentials. The agent waits on the station, then pushes credentials to door controllers. Migration `065` adds `device_role` and enroll job types.

## Go-live steps (simplified)

1. Apply migrations through `065` (cloud device secrets + enrollment station).
2. Owner → **Access**:
   - Choose **Store in MOJO** (easier) or **Apartment PC only**
   - If cloud: save door controller(s) and optionally **DS-K1F600U-D6E-F** enrollment station
   - **Start setup** → **Copy full .env**
3. On the apartment PC:
   - Install **MOJO Access Agent** (Windows `.exe` / Mac `.dmg` from `services/access-agent-app/dist`)
   - Paste **Start setup → Copy full .env** when the app asks
   - Leave it running in the tray (auto-starts at login)
4. Map doors (device key must match **door** controller key, not the enrollment station).
5. Confirm **Agent online**, then test one check-in / checkout and optional station enroll.

- If the agent is offline, jobs stay `pending`/`failed` and retry with backoff.
- Stuck `claimed` jobs are reclaimed on each agent poll, via GitHub Actions every 5 min (Hobby-friendly), and a daily Vercel cron backup.
- Remote unlock is audited as `access` / `remote_unlock`.
- Portal PIN is also used as the door PIN on provision (best-effort per firmware).

## Firmware caveats

ISAPI paths/fields vary slightly by controller model. If provision fails, check agent logs and adjust `services/hikvision-agent/src/isapi.js` for your exact series (still keep MOJO as the source of truth for who should have access).
