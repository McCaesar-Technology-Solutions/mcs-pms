# Manager guide — MOJO Apartments

You run **daily operations** for one property: guests, rooms, reservations, complaints, housekeeping, inventory, stay billing, and payroll drafts. You do **not** change GRA exports, analytics, expenses, invoice refunds, or property portfolio / tax-rate settings.

Tap **Help** (bottom-right) for the same topics on the page you are on.

---

## 1. Getting started

### Join the team

1. Owner sends invite: `/accept-invite?token=...`
2. Set name, password, phone.
3. You land on **Manager Dashboard** (`/manager/dashboard`).

In production you may need **SMS two-factor authentication**.

### First day

1. Add **phone** (top bar) — needed for SMS alerts.
2. Walk through: Dashboard → Reservations → Guests → Billing → Complaints → Housekeeping → Staff.

You are locked to **one property** (no property switcher).

**Already have guests in rooms at go-live?** Use **Guests → Register in-house guest** with real arrival dates.

---

## 2. Your menu

| Menu | Path | What you do |
|------|------|-------------|
| Dashboard | `/manager/dashboard` | Ops overview, portal settings, audits |
| Messages | `/manager/messages` | Guest chat + team chat |
| Reservations | `/manager/reservations` | Bookings, check-in/out, deposits, discounts |
| Guests | `/manager/guests` | Walk-ins, register in-house, portal, folio |
| Rooms | `/manager/rooms` | Add/edit rooms & rates (no delete) |
| Access | `/manager/access` | Unlock, cards, staff access, attendance |
| Housekeeping | `/manager/housekeeping` | Full cleaning board |
| Complaints | `/manager/complaints` | Assign technicians and close work |
| Billing | `/manager/invoices` | Issue invoices, record payments, print / WhatsApp |
| Payroll | `/manager/payroll` | Prepare **draft** pay runs |
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
| **Outstanding** | Remaining due on open invoices (same as Billing) |
| **Needs attention** | Unpaid invoices, today’s arrivals and departures |
| Complaints snapshot | Link to full page |
| Housekeeping summary | Link to kanban |
| **Ops calendar** | Add training / meetings / events |
| **Guest portal** tab | Wi‑Fi, rules, local guide |
| **Requests** tab | Housekeeping, late checkout, extensions from the guest portal |
| **Guest reviews** | Portal feedback |
| **Audits** | Night + monthly + yearly |
| **Activity** | Audit / SMS logs |

Also review **Requests** (housekeeping, late checkout, extension) and approve / deny / schedule as needed.

---

## 4. Messages

**Path:** `/manager/messages`

- Chat with in-house guests about the stay.
- Team chat with receptionists and technicians.
- Repair-specific chat lives on each complaint.

---

## 5. Reservations

**Path:** `/manager/reservations`

People currently in a room sit at the top of **All**. Tap **In house** to see only them (including overstay and checkout-in-progress).

Same front-desk tools as the owner **except deposit refunds and invoice refunds** (owner only).

### Typical flow

```
New reservation → (optional) Record deposit → Check in + collect payment → Folio charges → Begin checkout → Complete checkout (collect remaining only if Outstanding)
```

### Create / deposit / prepaid

1. **New reservation** — guest, room, dates, channel, **rate type** (nightly / weekly / monthly).
2. **Guest discount** — percent or fixed ₵ **before tax**, with a reason. Reception cannot do this.
3. **Record deposit** — amount + method.
4. **Channel prepaid** — when Airbnb/Booking.com already paid you.

### Stay statuses you will see

Provisional, Confirmed, Pre-arrival, Checked in, Checkout in progress, Overstay, Checked out, Post stay, Cancelled, No-show.

Owners configure hold timers and automated jobs under **Settings → Reservation lifecycle** (you cannot change those settings).

### Check in

Phone required → optional ID (Ghana Card, passport, or driver’s licence) → optional **Include Ghana tax** → stay invoice created → collect payment (you may leave unpaid) → share portal link / QR → room **Occupied**. Door access queues if Hikvision is enabled.

### While in-house

- **Extend stay**, **Move room**, **Edit** (confirmed only).
- Post **folio** from Guests (including **Discount (credit)**).
- **Approve late checkout** on overstay.
- **Dispute hold** pauses checkout while a billing dispute is open (reason required). You can start it from in-house or **checkout in progress**; the folio unlocks so charges can still be posted. The guest still occupies the room; guest requests stay on this stay. **Release hold** (note required) resumes the stay, or check out / walkout from the hold.

### Check out

1. Read Outstanding carefully.
2. **Begin checkout** (folio locks).
3. **Complete checkout** — stay was paid at check-in; collect remaining only if Outstanding.
4. Room → Cleaning; same stay invoice refreshed (no duplicate). Share PDF / WhatsApp.

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
2. Name, **phone** (required), email, optional ID (Ghana Card, passport, or driver’s licence), room, checkout date, rate type.
3. Portal link + QR immediately.

### Register in-house guest (go-live)

For people already staying: real arrival (can be past) + planned departure. A stay invoice is created. Share portal link / PIN on WhatsApp. Do not use **Walk-in** for guests who arrived days ago.

### Guest detail

- Edit contact and ID document.
- Manage portal link / QR / WhatsApp / regenerate / revoke.
- **Guest folio** — post incidentals; you can post a **Discount (credit)**.
- **Generate stay invoice & collect** if they have no invoice yet.
- **Export PII** or **Erase / delete** (reception cannot erase). Erasing an in-house guest ends the stay and frees the room.
- **Extend stay** — pick a later check-out (same as Reservations). Room total and portal access update automatically.
- **Check out** from guest card when useful. **Dispute hold** stays stay in house — use Reservations to release the hold, begin checkout, or record a walkout.

---

## 7. Rooms

**Path:** `/manager/rooms`

- Add / edit rooms, categories, photos.
- Set nightly, weekly, and monthly rates.
- Update status: Available, Occupied, Cleaning, Needs inspection, Maintenance.
- **Cannot delete rooms** (owner only).

---

## 8. Access (ops)

**Path:** `/manager/access`

Tabs: **Today · Guests · Staff · Attendance** (no Setup).

When Hikvision is enabled by the owner:

- Check-in / checkout sync runs automatically.
- **Unlock** doors remotely (agent online).
- **Assign card** numbers / enroll guests.
- **Staff** — approved physical access (reception cannot see this).
- **Attendance** — pull clock events.
- **Retry** failed credential jobs.

You cannot enable the integration, rotate the agent token, or map doors — ask the owner.

---

## 9. Complaints

**Path:** `/manager/complaints`

### Log a complaint

1. **Log complaint**.
2. Guest (fills room) or room only.
3. Category, priority, description.

### Current workflow

Technicians **start as soon as you assign them**. Invoices are optional cost records — they do **not** block work.

```
Open → Assign technician → Technician starts → Marks complete
  → Guest signs off (portal, if the issue is linked to a guest)
  → You approve & resolve (pick room status)
```

If a **legacy** job is stuck on “invoice pending approval”, use **Release to technician**.

Watch the orange **pending approvals** banner and sidebar badge. Message the guest on the issue thread when needed. Guest must confirm completion before you can close a guest-linked job.

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

## 11. Billing

**Path:** `/manager/invoices`

You **can** issue stay invoices, create unpaid or paid ad-hoc bills, record full/partial payments, print PDFs, and **WhatsApp** bills.

You **cannot** refund invoice payments — send those to the owner.

- Check-in / collect-before-check-in creates the stay invoice. Record **full or partial** payments in the collect dialog — the hotel sets a **check-in minimum** under **Settings → Reservation lifecycle** (default 50% of the stay).
- Reception must meet that minimum before the guest enters; you can **waive** it for prepaid channels or approved exceptions.
- Every payment is logged in **payment history** on the collect dialog and in Billing — one ledger for the stay invoice and reservation.
- Tick **Include Ghana tax** when you need VAT & levies (Bill-to Tax ID `GHA-728071939-8`).
- **Bill to** can differ from the guest name when issuing.
- Apply % or fixed guest discounts when creating/editing a booking or refreshing the invoice.
- Checkout reuses the same stay invoice — it will not create a duplicate.
- **Online payments** tab shows guest Pay-now attempts when that feature is enabled.

**Ledger backfill (once per property after upgrade):** run `npx tsx scripts/backfill-payment-records.ts --dry-run` then without `--dry-run` if gaps are reported.

---

## 12. Payroll (drafts)

**Path:** `/manager/payroll`

Prepare a **draft** pay run for the period. The owner sets pay rates, approves, marks paid, and exports MoMo/bank files.

You cannot change compensation or commission rules.

---

## 13. Inventory

**Path:** `/manager/inventory`

- Create / edit items.
- Receive, issue, adjust stock.
- View movement history.
- You **cannot** delete items or record expenses from stock (owner).
- Reception **cannot** open inventory — they will ask you if supplies are low.

---

## 14. Staff

**Path:** `/manager/staff`

- Invite **technicians** (phone) and **receptionists** (email). Send the link on WhatsApp.
- Cannot invite managers or owners.
- Edit phones, disable / reactivate, revoke invites.
- Pay profiles are owner-only.

---

## 15. Guest portal settings

**Path:** Dashboard → **Guest portal** tab (also sidebar **Guest portal**)

Configure what guests see:

- Wi‑Fi / parking / emergency / welcome copy.
- Which requests are allowed (housekeeping, late checkout, extension).
- Property rules (guests must accept when required).
- Local guide items.

Share personal links and property QR from **Guests**.

---

## 16. Audits

On Dashboard:

1. Finish check-outs and note open balances.
2. **Run night audit** once per date (optional notes).
3. Run **monthly** / **yearly** audits at period close with the owner.

---

## 17. What managers cannot do

| No access | Who has it |
|-----------|------------|
| Invoice refunds / deposit refunds | Owner |
| GRA reports, Analytics, Expenses | Owner |
| Property portfolio / tax rates / lifecycle settings | Owner |
| Delete rooms / inventory items | Owner |
| Approve payroll / mark paid / set pay rates | Owner |
| Invite managers | Owner |
| Access setup (token / door maps) | Owner |

---

## 18. Daily routine

| Time | Tasks |
|------|--------|
| **Morning** | Dashboard → notifications → arrivals/departures → Outstanding |
| **Day** | Walk-ins, check-ins, folio, discounts, complaints, guest requests |
| **After checkouts** | Housekeeping — ensure Clean tasks claimed |
| **Evening** | Final check-outs, guest sign-offs on complaints, **night audit** |

---

## 19. Common mistakes

- Cancelling a **checked-in** guest instead of checking out.
- Forgetting **folio charges** before Begin checkout.
- Promising a **discount** that reception cannot apply — you or the owner must enter it.
- Marking Clean done and forgetting Inspect (room stays “needs inspection”).
- Closing a guest-linked complaint before the guest signs off in the portal.
- Promising a deposit or invoice refund — only the owner can refund in the system.
