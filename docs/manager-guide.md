# Manager guide — MOJO Apartments

You run **daily operations** for one property: guests, rooms, reservations, complaints, housekeeping, and inventory. You do **not** change owner billing, GRA exports, analytics, expenses, or property portfolio settings.

---

## 1. Getting started

### Join the team

1. Owner sends invite: `/accept-invite?token=...`
2. Set name, password, phone.
3. You land on **Manager Dashboard** (`/manager/dashboard`).

In production you may need **SMS two-factor authentication**.

### First day

1. Add **phone** (top bar) — needed for SMS alerts.
2. Walk through: Dashboard → Reservations → Guests → Complaints → Housekeeping → Staff.

You are locked to **one property** (no property switcher).

---

## 2. Your menu

| Menu | Path | What you do |
|------|------|-------------|
| Dashboard | `/manager/dashboard` | Ops overview, portal settings, audits |
| Messages | `/manager/messages` | Guest chat + team chat |
| Reservations | `/manager/reservations` | Bookings, check-in/out, deposits |
| Guests | `/manager/guests` | Walk-ins, portal links, folio |
| Rooms | `/manager/rooms` | Add/edit rooms & rates (no delete) |
| Access | `/manager/access` | Unlock, cards, retry sync |
| Housekeeping | `/manager/housekeeping` | Full cleaning board |
| Complaints | `/manager/complaints` | Assign and approve work |
| Billing | `/manager/invoices` | **View / print only** |
| Guest portal | `/manager/dashboard#guest-portal` | Portal copy, rules, requests |
| Inventory | `/manager/inventory` | Stock receive / issue / adjust |
| Staff | `/manager/staff` | Invite technicians + receptionists |

### Top bar

- **Search / ⌘K** — pages, reservations, guests, rooms, complaints, housekeeping.
- **Notifications** — check-outs, complaints, guest requests, messages.
- **Live updates** — lists refresh; toasts for new complaints and approvals.

---

## 3. Dashboard

| Section | Notes |
|---------|--------|
| Occupancy, avg rate, bookings | **Revenue hidden** (owner only) |
| **Outstanding** | Who still owes money |
| Complaints snapshot | Link to full page |
| Housekeeping summary | Link to kanban |
| **Guest portal** tab | Wi‑Fi, rules, request toggles, local guide |
| **Guest reviews** | Portal feedback |
| **Audits** | Night + monthly + yearly |
| **Activity** | Audit / SMS logs |

Also review **guest requests** (housekeeping, late checkout, extension) and approve / deny / schedule as needed.

---

## 4. Messages

**Path:** `/manager/messages`

- Chat with in-house guests about the stay.
- Team chat with receptionists and technicians.
- Repair-specific chat lives on each complaint.

---

## 5. Reservations

**Path:** `/manager/reservations`

Same front-desk tools as the owner **except deposit refunds** (owner only).

### Typical flow

```
New reservation → (optional) Record deposit → Check in + collect payment → Folio charges → Begin checkout → Complete checkout (collect remaining only if Outstanding)
```

### Create / deposit / prepaid

1. **New reservation** — guest, room, dates, channel, rate.
2. **Record deposit** — amount + method.
3. **Channel prepaid** — when Airbnb/Booking.com already paid you.

### Stay statuses you will see

Provisional, Confirmed, Pre-arrival, Checked in, Checkout in progress, Overstay, Checked out, Post stay, Cancelled, No-show.

Owners configure hold timers and automated jobs under **Settings → Reservation lifecycle** (you cannot change those settings).

### Check in

Phone required → share portal link / QR → room becomes Occupied. Door access queues if Hikvision is enabled.

### While in-house

- **Extend stay**, **Move room**, **Edit** (confirmed only).
- Post **folio** from Guests.
- **Approve late checkout** on overstay.
- **Dispute hold** when a lifecycle hold needs review.

### Check out

1. Read Outstanding carefully.
2. **Begin checkout** (folio locks).
3. **Complete checkout** — stay was paid at check-in; collect remaining only if Outstanding.
4. Room → Cleaning; invoice goes to owner Billing.

**Walkout** — guest left without paying (not for desk settlement).

### Cancel / no-show

| Rule | Detail |
|------|--------|
| Only confirmed / pre-arrival | Not checked-in |
| Deposit | **Forfeit** (you) or **Refund** (ask owner) |
| Unpaid folio / invoice | Cancel blocked until settled |

---

## 6. Guests

**Path:** `/manager/guests`

### Walk-in check-in

1. **Walk-in check-in**.
2. Name, **phone** (required), email, room, checkout date.
3. Portal link + QR immediately.

### Guest detail

- Edit contact.
- Manage portal link / QR / WhatsApp / regenerate / revoke.
- **Guest folio** — post incidentals (₵).
- **Export PII** if needed (erase is owner only).
- **Check out** from guest card when useful.

---

## 7. Rooms

**Path:** `/manager/rooms`

- Add / edit rooms, categories, rates, photos.
- Update status: Available, Occupied, Cleaning, Needs inspection, Maintenance.
- **Cannot delete rooms** (owner only).

---

## 8. Access (ops only)

**Path:** `/manager/access`

When Hikvision is enabled by the owner:

- Check-in / checkout sync runs automatically.
- **Unlock** doors remotely (agent online).
- **Assign card** numbers.
- **Retry** failed credential jobs.

You cannot enable the integration, rotate the agent token, or map doors — ask the owner.

---

## 9. Complaints

**Path:** `/manager/complaints`

### Log a complaint

1. **Log complaint**.
2. Guest (fills room) or room only.
3. Category, priority, description.

### Two-step approval

**Stage A — before work**

```
Open → Assign technician → Technician submits invoice → You approve or reject
```

Technician cannot start until you **Approve invoice & authorize work**.

**Stage B — after work**

```
In progress → Technician marks complete → You approve & resolve (pick room status)
```

Watch the orange **pending approvals** banner and sidebar badge. Message the guest on the issue thread when needed.

---

## 10. Housekeeping

**Path:** `/manager/housekeeping` · Mobile: `/mobile/housekeeping`

### Clean → inspect

1. Checkout → room **Cleaning** + **Clean** task.
2. Clean done → **Needs inspection** + **Inspect** task.
3. Inspect done → **Available**.

### Who can move tasks?

| Person | Rule |
|--------|------|
| Assignee | Start / complete own tasks |
| Manager / owner | **Override** |
| Technician | **Claim & start** unassigned tasks |

Add tasks manually: room, type, priority, due date, assignee, notes. Room grid shows open-task indicators.

---

## 11. Billing (read-only)

**Path:** `/manager/invoices`

- View and print invoices from check-outs.
- See online payment attempts when enabled.
- You **cannot** record payments, partials, or refunds — send those to the owner.

---

## 12. Inventory

**Path:** `/manager/inventory`

- Create / edit items.
- Receive, issue, adjust stock.
- View movement history.
- You **cannot** delete items or record expenses from stock (owner).

---

## 13. Staff

**Path:** `/manager/staff`

- Invite **technicians** (phone) and **receptionists** (email).
- Cannot invite managers or owners.
- Edit phones, disable / reactivate, revoke invites.

---

## 14. Guest portal settings

**Path:** Dashboard → **Guest portal** tab (also sidebar **Guest portal**)

Configure what guests see:

- Wi‑Fi / parking / emergency / welcome copy.
- Which requests are allowed (housekeeping, late checkout, extension).
- Property rules (guests must accept when required).
- Local guide items.

Share personal links and property QR from **Guests**.

---

## 15. Audits

On Dashboard:

1. Finish check-outs and note open balances.
2. **Run night audit** once per date (optional notes).
3. Run **monthly** / **yearly** audits at period close with the owner.

---

## 16. What managers cannot do

| No access | Who has it |
|-----------|------------|
| Record invoice payments / refunds | Owner |
| GRA reports, Analytics, Expenses | Owner |
| Property portfolio / lifecycle settings | Owner |
| Delete rooms / inventory items | Owner |
| Refund deposits | Owner |
| Invite managers | Owner |
| Access setup (token / door maps) | Owner |

---

## 17. Daily routine

| Time | Tasks |
|------|--------|
| **Morning** | Dashboard → notifications → arrivals/departures → Outstanding |
| **Day** | Walk-ins, check-ins, folio, complaints, guest requests |
| **After checkouts** | Housekeeping — ensure Clean tasks claimed |
| **Evening** | Final check-outs, clear complaint approvals, **night audit** |

---

## 18. Common mistakes

- Cancelling a **checked-in** guest instead of checking out.
- Forgetting **folio charges** before Begin checkout.
- Marking Clean done and forgetting Inspect (room stays “needs inspection”).
- Approving a technician invoice without reading materials/labour totals.
- Promising a deposit refund — only the owner can refund in the system.
