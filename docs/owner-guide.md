# Owner guide — MOJO Apartments

You own the portfolio. You see **money, tax, billing, and settings**. Managers and receptionists run the front desk; you oversee revenue and compliance.

---

## 1. Sign in and first setup

### Create your account

1. Go to **Sign up** (`/signup`).
2. Enter name, email, password.
3. The system creates your owner account and first property.

### After login

You land on **Dashboard** (`/owner/dashboard`). Only owners can open `/owner/*` pages.

In production you may need **SMS two-factor authentication** (`/enroll-mfa` or `/verify-mfa`).

### First-week checklist

| Step | Where | Why |
|------|--------|-----|
| Add your phone | Top bar → **Phone** | SMS alerts |
| Property details | **Settings** | Address, VAT TIN, invoice prefix |
| Room rates | **Rooms** → categories | Correct pricing |
| Invite a manager | **Staff** | Day-to-day ops |
| Guest portal copy | **Settings** → Guest portal | Wi‑Fi, rules, guide |
| Test booking | **Reservations** | End-to-end dry run |

Optional: add more properties in **Settings** or the sidebar **property switcher**.

---

## 2. Your menu

| Menu | Path | What you do |
|------|------|-------------|
| Dashboard | `/owner/dashboard` | KPIs, audits, reviews |
| Messages | `/owner/messages` | Guest chat + team chat |
| Reservations | `/owner/reservations` | Full booking lifecycle + payments |
| Guests | `/owner/guests` | Directory, folio, portal, privacy |
| Rooms | `/owner/rooms` | Rooms, categories, rates (can delete) |
| Access | `/owner/access` | Hikvision setup + unlock / cards |
| Housekeeping | `/owner/housekeeping` | Full cleaning board |
| Complaints | `/owner/complaints` | **Read-only** oversight |
| Billing | `/owner/billing` | Invoices, pay, refund, online payments |
| Expenses | `/owner/expenses` | Property expenses |
| Inventory | `/owner/inventory` | Stock + delete + link to expense |
| GRA Reports | `/owner/gra-reports` | Tax exports |
| Analytics | `/owner/analytics` | Trends and charts |
| Staff | `/owner/staff` | Invite all roles |
| Settings | `/owner/settings` | Property, portal, lifecycle, alerts |

### Top bar

- **Search** — guests, reservations, rooms, invoices.
- **Notifications** — check-outs, overdue invoices, complaints, messages.
- **Property switcher** — switch or add hotels; lists use the **active** property only.
- **Live updates** — keep a tab open for automatic refresh.

---

## 3. Dashboard

### KPI cards

| Card | Meaning |
|------|---------|
| **Total revenue** | Paid invoice revenue |
| **Occupancy rate** | Rooms occupied now |
| **Average nightly rate** | Typical room rate (₵) |
| **Total bookings** | Active reservations |
| **Outstanding** | Money still collectible |

Check **Outstanding** every morning. Follow up in **Billing** and **Reservations** (payment filters).

### Other sections

- **14-day availability** — occupied / reserved / maintenance / available.
- **Upcoming bookings** — next arrivals.
- **Housekeeping summary** — open tasks.
- **Channel performance** — revenue by source.
- **GRA tax summary** — filing snapshot.
- **Guest reviews** — feedback from the portal.
- **Night audit** — close the business day (once per date).
- **Monthly / yearly audits** — period close snapshots.

---

## 4. Messages

**Path:** `/owner/messages`

- **Guest threads** — stay chat with in-house guests (same as front desk).
- **Team chat** — message managers, receptionists, technicians.

Use Messages for general stay questions. Repair talk lives on the complaint itself.

---

## 5. Reservations and payments

**Path:** `/owner/reservations`

### Filters

- **Stay status** — provisional, confirmed, pre-arrival, checked in, checkout in progress, overstay, checked out, post stay, cancelled, no-show.
- **Payment** — unpaid, deposit paid, partial, paid, overdue, refunded.

### Create a booking

1. **New reservation**.
2. Guest, room, dates, **channel** (Airbnb, Booking.com, direct, walk-in, other).
3. Rate fills; total calculates.
4. Status starts **Confirmed**, payment **Unpaid**.

### Record a deposit

1. Open reservation → **Payment** → **Record deposit**.
2. Amount (≤ balance due) + method (cash, MoMo, card).
3. **Channel prepaid** — only when Airbnb/Booking.com already paid you.

### Check in

1. Open **Confirmed** / **Pre-arrival** → **Check in guest**.
2. Phone required.
3. Share **portal link** or QR.
4. If Hikvision is on, door access is queued automatically.

### While in-house

- **Extend stay** — updates nights and balance.
- **Move room** — reassign if free.
- **Guest folio** — post extras from **Guests** (minibar, laundry). Shows as **Folio (unbilled)** on the reservation.
- **Approve late checkout** — when overstay needs more time.
- **Dispute hold / release no-show hold** — when lifecycle holds apply.

### Check out

1. Review Payment box (room total, folio, paid, **Outstanding**).
2. **Begin checkout** — locks folio.
3. Post any final charges → **Complete checkout**.
4. Choose payment method; toggle **Payment received now** if settled at desk.
5. **Early checkout** if leaving before booked date.
6. Confirm → GRA invoice created, room → **Cleaning**, clean task created, door access revoked (if enabled).

**Walkout** — guest already left without paying. Creates invoice with balance due and releases the room. Do not use if the guest is still at the desk.

### Cancel or no-show (with deposit)

| Option | Who | Result |
|--------|-----|--------|
| **Forfeit deposit** | Owner, manager, receptionist | Hotel keeps money |
| **Refund deposit** | **Owner only** | Money returned |

Rules:

- Only **Confirmed** / pre-arrival can be cancelled or marked no-show.
- **Never cancel a checked-in guest** — use checkout.
- Cancel blocked if unpaid folio or unpaid invoice remains.

---

## 6. Guests

**Path:** `/owner/guests`

- Search and open a guest profile.
- Edit name, phone, email.
- **Guest portal** — copy link, QR, WhatsApp, regenerate, revoke.
- **Guest folio** (in-house) — post charges that roll into checkout.
- **Check out** from the guest card (same two-step flow).
- **Export PII** — download guest personal data.
- **Erase PII** — permanently remove guest personal data (**owner only**).

Walk-ins are easiest from Manager/Receptionist Guests; you can also check in via Reservations.

---

## 7. Rooms

**Path:** `/owner/rooms`

| Status | Meaning |
|--------|---------|
| Available | Ready to sell |
| Occupied | Guest in house |
| Cleaning | After checkout |
| Needs inspection | Clean done; awaiting inspect |
| Maintenance | Out of service |

You can **add, edit, and delete** rooms; manage categories, rates, photos, and floor/grid views. Managers cannot delete rooms.

---

## 8. Access control (Hikvision)

**Path:** `/owner/access`  
Full agent setup: [access-control.md](access-control.md)

**Setup (owner only)**

1. Enable Hikvision sync.
2. Rotate agent token (shown once) for the on-site LAN agent.
3. Map doors (device key + door number → room or lobby/gate).

**Day-to-day**

- Check-in enrolls guest access; checkout revokes it.
- **Unlock** — remote door open (agent must be online).
- **Assign card** — physical card number for a guest.
- **Retry** — re-queue failed sync jobs.

---

## 9. Housekeeping

**Path:** `/owner/housekeeping` · Mobile: `/mobile/housekeeping`

1. Columns: **To do** → **In progress** → **Done**.
2. Checkout creates an unassigned **Clean** task.
3. Clean done → room **Needs inspection** → auto **Inspect** task.
4. Inspect done → room **Available**.
5. Assignees update their tasks; you can **Override**.
6. Create tasks manually (clean / inspect / maintenance / restock).

Technicians can **claim** open tasks from their phone.

---

## 10. Complaints (read-only)

**Path:** `/owner/complaints`

You see the full lifecycle. You do **not** assign technicians or approve invoices/completions in the UI — managers do that. Use this page for oversight.

---

## 11. Billing

**Path:** `/owner/billing` — **owners write payments here**

### Summary

Total revenue, paid / pending / overdue, collection rate.

### On an unpaid invoice

| Action | When |
|--------|------|
| **Record payment** | Full remaining balance |
| **Partial payment** | Some now |
| **Refund** | Reverse a payment |
| **Download PDF** | Receipt / records |

### Other tabs / tools

- **Create manual invoice** — charges not tied to a stay.
- **Payment ledger** — reconciliation of all recorded payments.
- **Online payments** — view guest Pay-now attempts when online payments are enabled.

Invoice numbers use your Settings prefix (e.g. `MOJO-2026-00001`).

---

## 12. Expenses

**Path:** `/owner/expenses` — **owner only**

Record property expenses (category, amount, date, notes). Delete when entered in error. Use for cost tracking alongside revenue.

---

## 13. Inventory

**Path:** `/owner/inventory`

- Add / edit stock items (SKU, reorder level, unit).
- **Receive** stock (deliveries).
- **Issue** stock (usage).
- **Adjust** / **waste**.
- View movement history.
- **Delete** items (owner only).
- **Record expense** from stock purchase (owner only).

---

## 14. GRA tax reports

**Path:** `/owner/gra-reports`

- Period revenue and tax breakdown (NHIL, GETFund, COVID levy, VAT).
- Export **CSV**, **PDF**, or **ZIP**.
- Month shows **Approved** when all issued invoices that month are paid.

**Month-end:** settle Billing → GRA Reports → export → accountant.

---

## 15. Analytics

**Path:** `/owner/analytics`

Charts for revenue, occupancy, bookings, channel mix, and trends. Use with Dashboard KPIs for reviews.

---

## 16. Staff

**Path:** `/owner/staff`

| Role | Invite by | Can do |
|------|-----------|--------|
| Manager | Email | Daily ops (no billing writes / GRA / settings) |
| Receptionist | Email | Front desk |
| Technician | Phone | Maintenance + HK tasks |

Share the invite link. Disable / reactivate staff; revoke pending invites; keep phones up to date.

---

## 17. Settings

**Path:** `/owner/settings`

| Area | What you configure |
|------|--------------------|
| Profile | Your phone |
| Portfolio | Add / switch properties |
| Property | Name, address, logo, city, region |
| Tax / invoices | VAT TIN, invoice prefix, VAT exclusive/inclusive |
| Reservation lifecycle | Holds, no-show, overstay, archive crons (lifecycle v2) |
| Guest portal | Wi‑Fi, welcome, parking, emergency, checkout time, requests, rules, local guide |
| Notifications | SMS / email preferences |
| Activity | Audit log and notification outbox |

---

## 18. Audits

On **Dashboard**:

| Audit | When |
|-------|------|
| **Night audit** | Once per business day after check-outs |
| **Monthly audit** | End of month close |
| **Yearly audit** | End of year close |

Cannot run the same night audit date twice. Optional notes (e.g. “Late checkout Room 4”).

---

## 19. What owners should not do

| Avoid | Do instead |
|-------|------------|
| Cancel a checked-in guest | **Check out** |
| Skip deposit choice on cancel | Forfeit or refund |
| Ignore Outstanding | Collect in Billing |
| Approve complaints here | Ask the manager |
| Expect every guest to pay online | Record cash/MoMo/card in Billing |

---

## 20. Recommended routines

**Daily:** Dashboard (Outstanding, notifications) → departures → Billing overdue → night audit.

**Weekly:** GRA glance; staff phones; inventory reorder levels.

**Month-end:** Invoices settled → GRA export → monthly audit → accountant.

**New property:** Settings → Rooms → Staff → Access (if used) → test reservation.
