# Part 5 — Receptionist Guide

Receptionists run the front desk: bookings, check-in and check-out, the guest directory, room status, and logging guest complaints. No access to revenue, billing, GRA, analytics, property settings, room pricing, or complaint assignment/approval.

---

## 1. Getting started

### Join the team

1. An owner or manager sends an invite link: `/accept-invite?token=...` (by **email**).
2. Open the link, set your name, password, and phone.
3. You land on the **Reception Dashboard** (`/receptionist/dashboard`).

You are locked to **one property** — no property switcher.

---

## 2. Navigation

| Menu | Path | Purpose |
|------|------|---------|
| Dashboard | `/receptionist/dashboard` | Occupancy, arrivals, recent complaints |
| Reservations | `/receptionist/reservations` | Bookings, check-in / check-out |
| Guests | `/receptionist/guests` | Walk-ins, directory, portal links |
| Rooms | `/receptionist/rooms` | Update room status |
| Complaints | `/receptionist/complaints` | Log issues, track resolution |

### Top bar

- **Search** — guests, reservations, rooms (no invoices).
- **Notifications** — check-outs due today and open complaints.
- **Phone** — add or edit your number.
- **Live updates** — pages refresh automatically when data changes.

---

## 3. Dashboard

**Path:** `/receptionist/dashboard`

- **Today** — occupancy, average nightly rate, bookings. **Revenue is hidden.**
- **Room availability** — 14-day strip plus upcoming bookings.
- **Complaints** — recent guest issues (link to the complaints page).

---

## 4. Reservations

**Path:** `/receptionist/reservations`

- **Gantt** + list of bookings.
- **New reservation** — guest, room, dates, channel, nightly rate.
- **Check in** → issues the guest portal link/QR to share.
- **Check out** → choose payment method; a GRA tax invoice is generated automatically (visible to the owner in Billing).
- Extend stay, move room, cancel, mark no-show.

---

## 5. Guests

**Path:** `/receptionist/guests`

- **Walk-in check-in** — name, phone (required), email, room, checkout date.
- **Directory** — search and filter; edit contact details.
- **Guest portal** — copy link, QR, WhatsApp share, regenerate, revoke.
- **Check out** in-house guests.

---

## 6. Rooms

**Path:** `/receptionist/rooms`

- Tap a room to change its **status**: Available, Occupied, Cleaning, Needs inspection, Maintenance.
- You **cannot** add or delete rooms, change categories, or edit nightly rates — that stays with managers and owners.

---

## 7. Complaints

**Path:** `/receptionist/complaints`

- **Log complaint** — record an issue for a guest: pick the guest (auto-fills their room) or a room, set category, priority, and description.
- **Track** — filter by status and open any complaint to see the technician’s invoice, contacts, and the full lifecycle timeline.
- Assigning technicians and approving work is done by a manager — this view is otherwise read-only.

---

## 8. What receptionists cannot do

| Cannot | Who can |
|--------|---------|
| See revenue / billing / GRA / analytics | Owner |
| Change room prices, categories, add/delete rooms | Owner / Manager |
| Assign technicians or approve complaints | Owner / Manager |
| Manage housekeeping board | Manager |
| Property settings / multi-property | Owner |
| Invite staff | Owner / Manager |

---

## 9. Daily routine (suggested)

**Morning:** Dashboard → notifications → Reservations (today's arrivals and check-outs).

**Day:** Walk-in check-ins, issue portal links, update room status after cleaning, log guest complaints.

**Evening:** Final check-outs, confirm rooms set to the right status for housekeeping.
