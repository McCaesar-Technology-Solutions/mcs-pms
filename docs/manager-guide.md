# Manager guide — MOJO Apartments

You run **daily operations** for one property: guests, rooms, reservations, complaints, and housekeeping. You do **not** see owner revenue totals, billing, GRA exports, analytics, or property settings.

---

## 1. Getting started

### Join the team

1. Owner sends invite: `/accept-invite?token=...`
2. Set name, password, phone.
3. You land on **Manager Dashboard** (`/manager/dashboard`).

### First day

1. Add **phone** (top bar) — required for SMS alerts.
2. Walk through: Dashboard → Reservations → Guests → Complaints → Housekeeping.

You are locked to **one property** (no property switcher).

---

## 2. Navigation

| Menu | Path |
|------|------|
| Dashboard | `/manager/dashboard` |
| Messages | `/manager/messages` |
| Reservations | `/manager/reservations` |
| Guests | `/manager/guests` |
| Rooms | `/manager/rooms` |
| Housekeeping | `/manager/housekeeping` |
| Complaints | `/manager/complaints` |
| Guest portal | `/manager/dashboard#guest-portal` |
| Inventory | `/manager/inventory` |
| Staff | `/manager/staff` |

### Top bar

- **Search / ⌘K** — jump to pages; search reservations, guests, rooms, complaints, housekeeping.
- **Notifications** — check-outs, complaints, guest requests, messages.
- **Account & team** — profile phone/photo and staff management (`/manager/staff`).
- **Live updates** — pages refresh automatically; toast on new complaints.

**Guest portal settings** (requests, feedback, Wi‑Fi copy, rules) live under **Guest portal** in the sidebar or the **Guest portal** tab on the dashboard.

---

## 3. Dashboard

| Card | Notes |
|------|--------|
| Occupancy, avg rate, bookings | **Revenue hidden** (owner only) |
| **Outstanding** | Collectible balances — flag guests leaving with debt |
| Complaints snapshot | Link to full page |
| Housekeeping summary | Link to kanban |
| **Night audit** | End-of-day close (with owner) |

---

## 4. Reservations and payments

**Path:** `/manager/reservations`

You have the same booking tools as the owner **except deposit refunds** (owner only).

### Payment badges

Reservations show **Unpaid**, **Deposit paid**, **Partial**, **Paid**, **Overdue**, etc. Use payment filters to find open balances.

### Stay status badges

Filters and badges include **Provisional**, **Pre-arrival**, **Checkout in progress**, **Overstay**, and **Post stay** in addition to the classic Confirmed / Checked in / Checked out. Actions on the detail panel match the status (check-in, complete checkout, mark no-show, cancel).

Owners configure hold timers, no-show time, and automated jobs under **Settings → Property → Reservation lifecycle**.

### Typical front-desk flow

```
New reservation → (optional) Record deposit → Check in → (folio charges) → Check out → invoice
```

### Record a deposit

1. Open **Confirmed** or **Checked in** reservation.
2. **Record deposit** → amount + method → **Save**.
3. For Airbnb/Booking.com when channel already paid you: **Channel prepaid**.

### Check in

Phone required → guest portal link/QR for the guest.

### Check out

1. Review **Payment** panel:
   - Room total
   - **Folio (unbilled)** if charges were posted on Guests page
   - **Estimated total** and **Outstanding**
2. Tap **Begin checkout** — folio locks; post any final charges first if needed.
3. Tap **Complete checkout** → choose payment method.
4. Toggle **Payment received now** if guest pays in full at desk.
5. Confirm → invoice created (owner sees in Billing), room → Cleaning.

**Overstay** (past departure time): begin checkout urgently; **Approve late checkout** if policy allows.

**Walkout** (guest left without paying): use **Record walkout** — room is released and balance stays due on the invoice.

### Cancel and no-show

| Rule | Detail |
|------|--------|
| Only **Confirmed** | Cannot cancel checked-in — use checkout |
| Deposit collected | Must choose **Forfeit** or **Refund** (refund = owner only) |
| Folio / unpaid invoice | System blocks cancel until settled |

**Forfeit** = MOJO keeps deposit. **Refund** = ask owner to process if guest is owed money back.

### Other actions

- **Extend stay** — updates nights and balance.
- **Move room** — if another room is free.
- **Edit reservation** — confirmed only (dates, room, rate).

---

## 5. Guests

**Path:** `/manager/guests`

### Walk-in check-in

1. **Walk-in check-in**.
2. Name, **phone** (required), email, room, checkout date (today = check-in).
3. Portal link + QR immediately.

### Guest detail (in-house)

- Edit contact.
- **Guest folio** — post minibar, laundry, damage, etc. (₵). Shows on reservation before checkout.
- Portal link management.
- **Check out** from guest card if needed (same **Begin checkout** → **Complete checkout** flow).

---

## 6. Rooms

**Path:** `/manager/rooms`

Add/edit rooms and categories. **Cannot delete rooms** (owner only).

Update status when needed: Available, Occupied, Cleaning, Needs inspection, Maintenance.

---

## 7. Complaints

**Path:** `/manager/complaints`

### Log a complaint for a guest

1. **Log complaint**.
2. Pick guest (fills room) or room only.
3. Category, priority, description → **Log complaint**.

### Two-step approval

**Stage A — Invoice (before work)**

```
Open → Assign technician → Technician submits invoice → You approve or reject
```

Technician **cannot start** until you **Approve invoice & authorize work**.

**Stage B — Completion (after work)**

```
In progress → Technician marks complete → You approve & resolve (pick room status)
```

### Pending approvals

Orange banner when invoices or completions need you. Sidebar badge counts them.

---

## 8. Housekeeping

**Path:** `/manager/housekeeping` · **Mobile:** `/mobile/housekeeping`

### Kanban columns

**To do** → **In progress** → **Done**

### Clean → inspect flow (important)

1. Guest checks out → room **Cleaning** + **Clean** task (often unassigned).
2. Technician or housekeeper completes **Clean** → room **Needs inspection**.
3. System creates **Inspect** task.
4. **Inspect** marked **Done** → room **Available**.

### Who can move tasks?

| Person | Rule |
|--------|------|
| Assignee | Start and complete their own tasks |
| Manager / owner | **Override** any task |
| Technician | **Claim & start** unassigned tasks from `/technician/tasks` |

### Add a task manually

Room, type (clean / inspect / maintenance / restock), priority, due date, assignee, notes.

### Room grid

Read-only overview with open task indicators per room.

---

## 9. Staff

**Path:** `/manager/staff`

- Invite **technicians** (phone) and **receptionists** (email).
- Cannot invite managers or owners.
- Edit phones, disable/reactivate, revoke invites.

---

## 10. Night audit

On **Dashboard**, after the day’s check-outs:

1. **Run night audit** once per date.
2. Optional notes (e.g. “Late checkout Room 4”).
3. Owner uses this for daily control — run it consistently.

---

## 11. What managers cannot do

| No access | Who has it |
|-----------|------------|
| Billing, partial pay, refunds | Owner |
| GRA reports, Analytics | Owner |
| Property settings, multi-property | Owner |
| Delete rooms | Owner |
| Refund deposits | Owner |
| Invite managers | Owner |

---

## 12. Daily routine (suggested)

| Time | Tasks |
|------|--------|
| **Morning** | Dashboard → notifications → today’s arrivals/departures → Outstanding balances |
| **Day** | Walk-ins, check-ins, folio posts, assign complaints, approve invoices |
| **After checkouts** | Housekeeping kanban — ensure Clean tasks claimed |
| **Evening** | Final check-outs, clear pending complaint approvals, **night audit** |

---

## 13. Common mistakes to avoid

- Cancelling a **checked-in** guest instead of checking out.
- Forgetting **folio charges** before checkout (guest leaves with wrong invoice).
- Marking **Clean** done without **Inspect** (room stays “needs inspection”).
- Approving technician invoice without reading materials/labour totals.
