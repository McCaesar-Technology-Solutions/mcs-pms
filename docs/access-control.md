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

- **Two password options:**
  - **Local** — Hikvision admin passwords stay only in the agent `.env` on site.
  - **Cloud** — passwords are entered in Owner → Access, stored encrypted (`access_device_secrets`, service role only), and downloaded by the authenticated agent over HTTPS.
- Agent bearer token is stored as **SHA-256 hash** in `access_integrations` (plaintext shown once on rotate).
- Door PINs in job payloads are **AES-GCM encrypted** at rest and stripped after success.
- Staff RLS is **SELECT-only** on access tables; device password ciphertext is never selected in browser loaders.
- Agent endpoints are rate-limited and require `Authorization: Bearer` + `X-Mojo-Hotel-Id`.

## Go-live steps (simplified)

1. Apply migrations through `064` (includes cloud device secrets).
2. Owner → **Access**:
   - Choose **Store in MOJO** (easier) or **Apartment PC only**
   - If cloud: save controller IP / username / password
   - **Start setup** → **Copy full .env**
3. On the apartment PC:
   ```bash
   cd services/hikvision-agent
   # paste .env (cloud mode needs no DEVICES)
   npm install && npm start
   ```
4. Map doors (device key must match controller key, e.g. `lobby`).
5. Confirm **Agent online**, then test one check-in / checkout.
6. Keep the agent auto-starting after reboot.

## Ops notes

- If the agent is offline, jobs stay `pending`/`failed` and retry with backoff.
- Stuck `claimed` jobs are reclaimed on each agent poll, via GitHub Actions every 5 min (Hobby-friendly), and a daily Vercel cron backup.
- Remote unlock is audited as `access` / `remote_unlock`.
- Portal PIN is also used as the door PIN on provision (best-effort per firmware).

## Firmware caveats

ISAPI paths/fields vary slightly by controller model. If provision fails, check agent logs and adjust `services/hikvision-agent/src/isapi.js` for your exact series (still keep MOJO as the source of truth for who should have access).
