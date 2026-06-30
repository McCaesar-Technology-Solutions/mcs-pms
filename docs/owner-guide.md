# Owner guide — MOJO Apartments

You own the portfolio. You see **revenue**, **tax**, **billing**, and **settings**. Managers and receptionists run the front desk; you oversee money and compliance.

---

## 1. Sign in and first-time setup

### Create your account

1. Go to **Sign up** (`/signup`).
2. Enter name, email, password.
3. The system creates your owner account, first property, room categories, and numbered rooms.

### After login

You land on **Dashboard** (`/owner/dashboard`). Only **Owner** accounts can open `/owner/*` pages.

### Setup checklist

| Step | Where | Why |
|------|--------|-----|
| Add your phone | Top bar → **Phone** | SMS alerts |
| Property details | **Settings** | Address, VAT TIN, invoice prefix |
| Room rates | **Rooms** → categories | Correct pricing on bookings |
| Invite a manager | **Staff** | Day-to-day operations |
| Run a test booking | **Reservations** | Confirm workflow before go-live |

Optional: add more properties in **Settings** or the sidebar **property switcher**.

### Security (production)

Owners may be required to complete **SMS two-factor authentication** after login. Follow the on-screen prompts on `/enroll-mfa` or `/verify-mfa`.

---

## 2. Navigation

| Menu | Path | Purpose |
|------|------|---------|
| Dashboard | `/owner/dashboard` | KPIs, occupancy, night audit |
| Rooms | `/owner/rooms` | Inventory, categories, delete rooms |
| Reservations | `/owner/reservations` | Full booking lifecycle + payments |
| Guests | `/owner/guests` | Directory, folio, portal links |
| Complaints | `/owner/complaints` | **Read-only** lifecycle view |
| Housekeeping | `/owner/housekeeping` | Full kanban (same as manager) |
| Staff | `/owner/staff` | Invite managers, receptionists, technicians |
| Billing | `/owner/billing` | Invoices, payments, refunds |
| GRA Reports | `/owner/gra-reports` | Tax filing exports |
| Analytics | `/owner/analytics` | Trends and charts |
| Settings | `/owner/settings` | Property, tax, portfolio |

### Property switcher

- Switch between MOJO properties in the sidebar.
- **Add property** → name, address, city, region, room count.
- All lists and reports use the **active** property only.

### Top bar

- **Search** — guests, reservations, rooms, **invoices**.
- **Notifications** — check-outs today, overdue invoices, open complaints.
- **Live updates** — lists refresh when staff change data (keep tab open).

---

## 3. Dashboard

### KPI cards

| Card | Meaning |
|------|---------|
| **Total revenue** | Paid invoice revenue (with RevPAR) |
| **Occupancy rate** | Rooms occupied now |
| **Average nightly rate** | Typical room rate (₵) |
| **Total bookings** | Active reservations + guest count |
| **Outstanding** | **Collectible balance** across open stays and unpaid invoices |

Use **Outstanding** every morning. If it is high, open **Billing** and **Reservations** (filter by payment status).

### Other dashboard sections

- **14-day availability** — occupied / reserved / maintenance / available.
- **Upcoming bookings** — link to Reservations.
- **Housekeeping tasks** — summary; full board on **Housekeeping**.
- **Channel performance** & **GRA tax summary**.
- **Night audit** — close the business day (see §12).

---

## 4. Reservations and payments

**Path:** `/owner/reservations`

### List and filters

- Filter by **stay status** (confirmed, checked in, checked out, cancelled, no-show).
- Filter by **payment** (unpaid, deposit paid, partial, paid, overdue).
- Table shows **payment badge** and **balance due** when money is still owed.

### Payment statuses (what they mean)

| Status | Typical situation |
|--------|------------------|
| **Unpaid** | Booking created, nothing collected |
| **Deposit paid** | Partial payment before checkout |
| **Pending** | Checked out, invoice issued, not paid |
| **Partial** | Some paid, balance remains |
| **Paid** | Fully settled |
| **Overdue** | Invoice past due date with balance |
| **Refunded** | Invoice or deposit refunded |

### Create a booking

1. **New reservation**.
2. Guest name, room, dates, **channel** (Airbnb, Booking.com, direct, walk-in, other).
3. Nightly or monthly rate — total calculates automatically.
4. Status starts as **Confirmed**, payment **Unpaid**.

### Record a deposit (before checkout)

1. Open the reservation.
2. In **Payment**, tap **Record deposit**.
3. Enter amount (cannot exceed balance due), payment method (cash, MoMo, card, etc.).
4. **Save deposit** → status becomes **Deposit paid** (or **Paid** if full amount collected).

**Channel prepaid** (Airbnb / Booking.com): use **Channel prepaid** to mark the stay as collected via the OTA (bank transfer method). Only use when you have actually received funds from the channel.

### Check in

1. Open **Confirmed** reservation → **Check in guest**.
2. Phone required; optional email and guest link to existing profile.
3. Share **guest portal link** or QR with the guest.

### While guest is in-house

- **Extend stay** — updates total; payment status recalculates.
- **Move room** — change room if needed.
- **Guest folio** — post minibar, laundry, etc. from **Guests** (see §6). Folio appears in reservation **Payment** as **Folio (unbilled)** and increases **Estimated total**.

### Check out

1. Open **Checked in** reservation → **Begin checkout** (folio locks).
2. Post final folio charges if needed → **Complete checkout**.
3. Choose **payment method**.
4. **Early checkout** if leaving before booked date.
5. **Payment received now**:
   - **On** → invoice marked **Paid** (deposit counts toward total).
   - **Off** → invoice **Pending**; collect later in **Billing**.
6. **Confirm check-out** → GRA tax invoice created, room → **Cleaning**, clean task created.

**Walkout** and **late checkout approval** are available from the reservation panel when needed (same as manager/receptionist).

### Cancel or no-show **with a deposit**

If money was collected, the system **requires** your choice:

| Option | Who | Result |
|--------|-----|--------|
| **Forfeit deposit** | Owner, manager, receptionist | MOJO keeps the money; audit log recorded |
| **Refund deposit** | **Owner only** | Deposit returned; `amount_paid` cleared |

Without a deposit, cancel uses a normal confirmation dialog.

**Rules:**

- Only **Confirmed** bookings can be cancelled or marked no-show.
- **Checked-in guests cannot be cancelled** — use **Begin checkout** → **Complete checkout**.
- Cancel blocked if there is **unpaid folio** or **unpaid invoice** on the stay.

---

## 5. Rooms

**Path:** `/owner/rooms`

| Room status | Meaning |
|-------------|---------|
| Available | Ready to sell |
| Occupied | Guest in house |
| Cleaning | After checkout |
| Needs inspection | Clean done; awaiting inspect |
| Maintenance | Out of service |

You can **add, edit, and delete** rooms. Managers cannot delete rooms.

---

## 6. Guests

**Path:** `/owner/guests`

### Directory

Search and filter guests. Open a guest to:

- Edit name, phone, email.
- **Guest portal** — copy link, QR, WhatsApp, regenerate, revoke.
- **Guest folio** (in-house only) — post charges:
  - Description, amount (₵), type (incidental, room, etc.).
  - Charges roll into the **checkout invoice** with correct taxes.
- **Check out** — same flow as Reservations checkout.

Walk-in wizard is on the **Manager** and **Receptionist** Guests page; owners can also check in via Reservations.

---

## 7. Billing and invoices

**Path:** `/owner/billing` — **owners only**

### Summary cards

Total revenue, paid count, pending/overdue, collection rate %.

### Invoice list

Filter: All / Paid / Pending / Overdue. Overdue updates automatically when due date passes.

### On an unpaid invoice

| Action | When to use |
|--------|-------------|
| **Record payment** | Guest pays full remaining balance |
| **Partial payment** | Guest pays some now (enter amount + method) |
| **Refund** | Reverse part or all of a payment (reason optional) |
| **Download PDF** | Receipt / records |

### Create manual invoice

For walk-in services **not** tied to a room stay: guest name, description, subtotal, payment method, mark paid or not.

### Payment reconciliation tab

Shows payment **ledger** (all recorded payments) and summary of pending invoice balances.

### Invoice numbers

Format from Settings prefix, e.g. `MOJO-2026-00001`. Sequence resets each calendar year.

---

## 8. GRA tax reports

**Path:** `/owner/gra-reports`

- Period revenue, tax breakdown (NHIL, GETFund, COVID levy, VAT).
- Export **CSV**, **PDF**, or **ZIP** for filing.
- Month marked **Approved** when all issued invoices in that month are paid.

**Month-end routine:** Billing payments up to date → GRA Reports → export → accountant.

---

## 9. Analytics

**Path:** `/owner/analytics`

Charts for revenue, occupancy, bookings, channel mix, month-over-month trends. Use with Dashboard KPIs for owner reviews.

---

## 10. Complaints (read-only)

**Path:** `/owner/complaints`

You see the full complaint lifecycle but **do not** assign technicians or approve invoices. Managers handle that. Use this page to oversee SLA and guest satisfaction.

---

## 11. Housekeeping

**Path:** `/owner/housekeeping` · Mobile: `/mobile/housekeeping`

Same kanban as managers:

1. **To do** → **In progress** → **Done**
2. **Clean** task done → room **Needs inspection** → auto **Inspect** task
3. **Inspect** done → room **Available**
4. Only **assignee** updates status; you can **Override** as owner.

Checkout auto-creates an **unassigned Clean** task. Technicians can **claim** open tasks from their phone.

---

## 12. Night audit

**Path:** Dashboard → **Night audit** panel (owner and manager)

Once per business day:

1. Confirm check-outs and payments are recorded.
2. **Run night audit** (optional notes).
3. System snapshots occupancy, arrivals, departures, revenue posted.

Cannot run twice for the same date. Use this as your end-of-day control.

---

## 13. Staff

**Path:** `/owner/staff`

| Role | Invite by | Can do |
|------|-----------|--------|
| Manager | Email | Full ops except billing/GRA/settings |
| Receptionist | Email | Front desk only |
| Technician | Phone (SMS) | Maintenance + HK tasks |

Share invite link after creating. Disable/reactivate staff; revoke pending invites.

---

## 14. Settings

**Path:** `/owner/settings`

- Your phone.
- Portfolio: add/switch properties.
- Property: name, address, city, region, logo.
- GRA: VAT TIN, **invoice prefix**, VAT mode (exclusive/inclusive).
- Notification preferences.

---

## 15. What owners should not do

| Avoid | Do instead |
|-------|------------|
| Cancel a checked-in guest | **Check out** |
| Skip deposit disposition on cancel | Choose forfeit or refund |
| Ignore **Outstanding** KPI | Collect or follow up in Billing |
| Approve complaints here | Use manager account or ask manager |
| Expect online card pay in app | Record MoMo/cash/card manually |

---

## 16. Recommended routines

**Daily:** Dashboard (Outstanding, notifications) → departures in Reservations → Billing overdue.

**Weekly:** GRA summary check; staff phones up to date.

**Month-end:** All invoices paid or noted → GRA export → accountant.

**New property:** Settings → Rooms → Staff → test reservation end-to-end.
