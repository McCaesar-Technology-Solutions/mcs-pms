# Part 2 — Manager Guide

Managers run daily operations: guests, rooms, reservations, complaints, housekeeping, and technicians. No access to billing, GRA exports, analytics, or property settings.

---

## 1. Getting started

### Join the team

1. Owner sends invite link: `/accept-invite?token=...`
2. Enter name, password, phone.
3. Redirected to **Manager Dashboard** (`/manager/dashboard`).

### First-time setup

1. Add **phone** (top bar or Staff page).
2. Tour: Dashboard, Reservations, Guests, Complaints, Housekeeping.

You are locked to **one property** — no property switcher.

---

## 2. Navigation

| Menu | Path | Notes |
|------|------|-------|
| Dashboard | `/manager/dashboard` | KPIs, complaints snapshot |
| Rooms | `/manager/rooms` | No delete rooms |
| Guests | `/manager/guests` | Includes walk-in check-in |
| Reservations | `/manager/reservations` | Full booking lifecycle |
| Complaints | `/manager/complaints` | Badge = pending approvals |
| Housekeeping | `/manager/housekeeping` | Task kanban |
| Staff | `/manager/staff` | Invite technicians & receptionists |

### Top bar

- Search: guests, reservations, rooms (no invoices).
- Notifications: check-outs today, complaints.
- **Settings** menu → Staff page (not a settings page).
- **Live updates** — complaints, housekeeping, reservations, guests, and notifications refresh automatically when something changes (no manual page refresh).
- Toast alerts for new complaints, technician estimates, and pending approvals.

---

## 3. Dashboard

**Path:** `/manager/dashboard`

- KPI cards: occupancy, average nightly rate, bookings. **Revenue is hidden from managers** (owner-only).
- **Complaints overview** (up to 5) → link to Complaints page.
- **Tasks summary** (read-only housekeeping columns).

---

## 4. Rooms

**Path:** `/manager/rooms`

Same as owner except **cannot delete rooms**. Add/edit rooms, categories, statuses.

| Status | When to use |
|--------|-------------|
| Available | Ready to sell |
| Occupied | Guest in house |
| Cleaning | After checkout |
| Needs inspection | Post-clean QA |
| Maintenance | Repairs |

---

## 5. Guests

**Path:** `/manager/guests`

### Walk-in check-in (manager only)

1. **Walk-in check-in**.
2. Name, phone (required), email, room, checkout date (check-in = today).
3. Confirm → **portal link + QR** (copy, download, print).

### Guest directory

Search, filters, detail modal: edit contact, portal access, in-house checkout.

---

## 6. Reservations

**Path:** `/manager/reservations`

Same as owner:

- Gantt + list + **New reservation**.
- **Check in** → guest portal link.
- **Check out** → payment method, GRA invoice.
- Extend, move room, cancel, no-show.

Deep link: `/manager/reservations?open={id}`.

---

## 7. Complaints

**Path:** `/manager/complaints`

### List

- **Log complaint** button — record an issue on behalf of a guest (see below).
- **Pending approvals** banner (orange).
- Filters: all, open, assigned, in_progress, pending_approval, resolved.

### Log a complaint for a guest

1. Click **Log complaint**.
2. Optionally pick the **guest** (auto-fills their room) or just choose a **room**.
3. Set **category**, **priority** (low–urgent), and a **description**.
4. **Log complaint** → appears as an open complaint, ready to assign.

### Detail panel

- Description, guest/technician phone (call/WhatsApp).
- Invoice card (materials, labour, total).
- Timeline of events.
- Assign technician dropdown.

---

## 8. Two-step approval workflow

### Stage A — Approve invoice (authorize work)

```
Guest submits → Open
Manager assigns → Assigned
Technician submits invoice → Pending (Approve invoice)
Manager approves → Assigned + invoice approved → Technician can START
Manager rejects → Rejected → Technician revises invoice
```

**Technician cannot start until you approve the invoice.**

### Stage B — Approve completion (close job)

```
Technician starts → In progress
Technician marks complete → Pending (Approve completion)
Manager approves + room status → Resolved
Manager rejects → In progress (rework)
```

### Approval actions

| Stage | Approve button | Reject |
|-------|----------------|--------|
| Invoice | **Approve invoice & authorize work** | Sends back to revise invoice |
| Completion | **Approve & resolve** + room status | Returns to in progress |

**Room status options:** Available, Occupied, Maintenance, Needs inspection, Cleaning.

---

## 9. Housekeeping

**Path:** `/manager/housekeeping`  
**Mobile:** `/mobile/housekeeping`

### Kanban

Columns: **To Do** | **In Progress** | **Done**

**Task types:** Clean, Inspect, Maintenance, Restock.

**Per task:** change status, assign staff, delete.

**Add task:** room, type, priority, due date, notes, assignee.

### Auto clean on checkout

Checkout creates a **Clean** task; room → Cleaning. Marking clean task **Done** can set room → Available.

### Other panels

- Room status grid (read-only).
- Staff availability (read-only).

---

## 10. Staff (technicians & receptionists)

**Path:** `/manager/staff`

- Your phone card.
- **Invite technicians** (by phone) and **receptionists** (by email) — not other managers. Share the invite link after creating it.
- Disable/reactivate technicians and receptionists.
- Edit staff phones.
- Pending invites: copy link, revoke.

---

## 11. Manager limitations

| No access | Owner has |
|-----------|-----------|
| Billing / invoices | ✓ |
| GRA reports | ✓ |
| Analytics | ✓ |
| Property settings | ✓ |
| Multi-property | ✓ |
| Delete rooms | ✓ |
| Invite managers | ✓ |

---

## 12. Daily routine (suggested)

**Morning:** Dashboard → notifications → Reservations (check-outs).

**Day:** Walk-ins, room updates, assign complaints, approve invoices/completions.

**Housekeeping:** Kanban after checkouts.

**Evening:** Final check-outs, clear pending approvals.
