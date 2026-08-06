# Airbnb calendar sync

Two-way **iCal** sync between Airbnb listings and MOJO rooms. Not the Airbnb partner API — calendar feeds only.

## What it does

| Flow | Purpose |
|------|---------|
| **Import** | Airbnb → MOJO. Creates/updates/cancels reservations (`channel=airbnb`) from the listing export calendar. |
| **Export** | MOJO → Airbnb. Public ICS URL blocks dates already booked in MOJO (walk-in, direct, etc.). |

Automatic import runs about every **5 minutes** via GitHub Actions (`/api/cron/ical-sync`), with a daily Vercel backup. Owners can also **Sync now**.

## Owner setup

1. Airbnb listing → **Availability** → **Connect calendars** → **Export calendar** → copy URL.
2. MOJO → **Settings → Channels** → choose room → paste URL → **Connect**.
3. Copy the **MOJO export URL** shown for that room.
4. Airbnb → **Import calendar** → paste the MOJO URL → save.
5. Click **Sync now** once to verify.

Repeat per apartment/room (one active Airbnb import feed per room).

## Ops notes

- Guest phone, Ghana Card, and Airbnb payout amounts are **not** in iCal. Staff still check in and can mark **Channel prepaid**.
- In-house stays are never overwritten or cancelled by sync.
- Cancelled / checked-out iCal rows release their UID so the same Airbnb booking can re-import later.
- Empty or sharply truncated feeds **do not** mass-cancel open bookings (safety guard). Sync status shows an error until the feed looks healthy again.
- If an Airbnb date clashes with an existing non-iCal booking, sync records a **conflict** and skips that event.
- Export feeds exclude reservations imported from the same room’s Airbnb import feed (avoids echo loops).
- Blocked dates import as “Blocked (Airbnb)” occupancy without manager new-booking SMS.

## Security

- Import URLs: HTTPS only, SSRF checks (DNS + private IP block), size/timeout limits, Airbnb host allowlist in the UI.
- Export URLs: unguessable `export_token`; treat like a secret calendar link.
- Cron: `Authorization: Bearer $CRON_SECRET`.

## Apply migration

Requires migration `063_ical_sync_hardening.sql` (etag/hash/lock columns + unique active import per room).

## Related

- Owner UI: `/owner/settings#channels`
- Code: `lib/ical/*`, `app/actions/channel-ical.ts`, `app/api/cron/ical-sync`, `app/api/ical/[token]`
