# Realtime updates — setup & verification

How live updates work in MOJO Apartments and how to ensure they behave like a messaging app (no manual refresh).

---

## How it works (three layers)

1. **Supabase Realtime** — Postgres row changes broadcast over a websocket (`postgres_changes`).
2. **Channel listeners** — `HotelRealtimeProvider` (owner/manager) and `TechnicianRealtime` subscribe to relevant tables.
3. **UI refresh** — listeners trigger either:
   - **Client refetch** (`useRealtimeRefresh('complaints', …)`) — instant for complaints board, technician tasks, sidebar badge
   - **Server refetch** (`router.refresh()` on `layout` topic) — updates KPIs, reservations, guest lists

---

## Infrastructure checklist (do this first)

Run in **Supabase SQL Editor** if `supabase db push` fails:

| Migration | Purpose |
|-----------|---------|
| `001`, `003`, `007` | Realtime on `complaints`, `rooms`, `housekeeping_tasks`, `complaint_estimates` |
| `015` | Realtime on `reservations`, `guests`, `invoices`, `profiles`, etc. |
| `017` | `REPLICA IDENTITY FULL` on complaints/estimates/housekeeping for reliable UPDATE events |

**Verify publication:**

```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

Expected includes: `complaints`, `complaint_estimates`, `housekeeping_tasks`, `rooms`, `reservations`, `guests`, …

**Supabase Dashboard**

- Project → **Database** → **Publications** → `supabase_realtime` lists the tables above
- Project → **Project Settings** → ensure Realtime is enabled (default on hosted projects)

**App environment**

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set correctly
- Staff users signed in (Realtime respects **RLS** — anonymous clients do not receive staff events)

---

## What updates live (by role)

| Event | Manager | Technician | Guest |
|-------|---------|------------|-------|
| Guest logs complaint | Toast + list + badge | — | Own list (polling) |
| Manager assigns job | List refresh | Toast + task list | Status via polling |
| Technician submits invoice | Toast + list + badge | Task status | Polling |
| Manager approves invoice | List refresh | Toast + “Start job” | Polling |
| Manager approves completion | List refresh | Toast + closed | Polling |
| Housekeeping task change | Kanban refresh | Toast only | — |

**Guest portal** uses a cookie session, not Supabase Auth — browser Realtime cannot pass RLS. Guest list **polls every 12 seconds** as a fallback.

---

## Test plan (two browsers)

Use two windows (or normal + incognito):

1. **Manager + Guest**
   - Manager on `/manager/complaints`
   - Guest submits complaint on portal
   - Manager should see toast + new row **without F5**

2. **Manager + Technician**
   - Technician on `/technician/tasks`
   - Manager assigns complaint → technician sees toast + task
   - Technician submits invoice → manager sees toast + pending banner
   - Manager approves invoice → technician sees “Invoice approved” + **Ready to start**

3. **Manager dashboard**
   - Manager on `/manager/dashboard` (not complaints page)
   - Technician submits invoice → dashboard complaints widget + sidebar badge update

4. **Connection drop**
   - Toggle offline briefly → amber **Reconnect** banner should appear; tap Reconnect

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Nothing updates until F5 | Migration `015` not applied | Run SQL in editor |
| Complaints page stuck; other pages OK | On complaints page only — check browser console for channel errors | Reconnect; verify RLS |
| Technician never gets events | Not assigned (`assigned_to` filter) | Assign job first |
| Guest never live-updates | Expected — no Supabase Auth | Polling handles this |
| Works locally, not production | Wrong env vars on Vercel | Match Supabase URL/anon key |
| `CHANNEL_ERROR` in console | Realtime disabled or network | Dashboard settings; retry |

**Browser console check:** Network tab → WS connection to `realtime` endpoint → should stay open.

---

## Limits (not WhatsApp)

- Tab must stay **open** — no push when app is closed
- ~1–2 second delay is normal (DB write → replication → websocket → refetch)
- Two users editing the same row simultaneously can still race
- SMS alerts are separate from in-app Realtime (requires Hubtel/Twilio env vars)

---

## Code reference

| File | Role |
|------|------|
| `components/realtime/hotel-realtime.tsx` | Owner/manager websocket |
| `components/realtime/technician-realtime.tsx` | Technician websocket |
| `components/realtime/realtime-refresh-context.tsx` | Pub/sub topics |
| `components/complaints/complaints-manager.tsx` | Manager board refetch |
| `components/technician/technician-tasks.tsx` | Technician refetch |
| `components/dashboard/sidebar.tsx` | Live complaints badge |
| `components/complaints/complaints-overview-live.tsx` | Dashboard widget |
