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
| On-site agent | `services/hikvision-agent/` |

## Security model

- Device admin passwords live **only** in the agent `.env` on the apartment LAN.
- Agent bearer token is stored as **SHA-256 hash** in `access_integrations` (plaintext shown once on rotate).
- Door PINs in job payloads are **AES-GCM encrypted** at rest and stripped after success.
- Staff RLS is **SELECT-only**; writes go through service role (server actions / agent API).
- Agent endpoints are rate-limited and require `Authorization: Bearer` + `X-Mojo-Hotel-Id`.

## Go-live steps

1. Apply migration `061_access_control.sql` (`supabase db push` or SQL Editor).
2. Owner → **Access** → enable Hikvision sync → rotate agent token.
3. On a LAN machine:
   ```bash
   cd services/hikvision-agent
   cp .env.example .env
   # set MOJO_API_URL, HOTEL_ID, AGENT_TOKEN, DEVICES
   npm install
   npm start
   ```
4. Map doors (device key must match `DEVICES[].key`).
5. Confirm agent status **Online**.
6. Test check-in on one room → credential/job shows **synced**.
7. Test checkout → credential **revoked**.
8. Run agent under systemd/Docker with restart policy.

## Ops notes

- If the agent is offline, jobs stay `pending`/`failed` and retry with backoff.
- Stuck `claimed` jobs are reclaimed on each agent poll, via GitHub Actions every 5 min (Hobby-friendly), and a daily Vercel cron backup.
- Remote unlock is audited as `access` / `remote_unlock`.
- Portal PIN is also used as the door PIN on provision (best-effort per firmware).

## Firmware caveats

ISAPI paths/fields vary slightly by controller model. If provision fails, check agent logs and adjust `services/hikvision-agent/src/isapi.js` for your exact series (still keep MOJO as the source of truth for who should have access).
