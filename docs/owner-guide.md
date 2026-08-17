# Owner guide — MOJO Apartments

You own the portfolio. You see **money, tax, billing, payroll, and settings**. Managers and receptionists run the front desk; you oversee revenue and compliance.

Tap **Help** (bottom-right) for the same topics on the page you are on.

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
| Property details | **Settings → Property** | Address, VAT TIN, invoice prefix, tax rates |
| Room rates | **Rooms** → categories | Nightly / weekly / monthly prices |
| Invite a manager | **Staff** | Day-to-day ops |
| Guest portal copy | **Settings → Guest portal** | Wi‑Fi, rules, guide |
| Test booking | **Reservations** | End-to-end dry run |

Optional: add more properties in **Settings** or the sidebar **property switcher**.

**Already have guests in rooms?** Use **Guests → Register in-house guest** with real arrival dates. Do not fake a same-day walk-in.

---

## 2. Your menu

Grouped in the sidebar as **Operations** and **Finance & admin**.

| Menu | Path | What you do |
|------|------|-------------|
| Dashboard | `/owner/dashboard` | KPIs, ops calendar, audits, reviews |
| Messages | `/owner/messages` | Guest chat + team chat |
| Reservations | `/owner/reservations` | Full booking lifecycle + payments |
| Guests | `/owner/guests` | Directory, folio, portal, privacy |
| Rooms | `/owner/rooms` | Rooms, categories, rates (can delete) |
| Access | `/owner/access` | Hikvision: Today · Guests · Staff · Attendance · Setup |
| Housekeeping | `/owner/housekeeping` | Full cleaning board |
| Complaints | `/owner/complaints` | Log + **read-only** lifecycle (managers assign/close) |
| Billing | `/owner/billing` | Invoices, pay, refund, ledger, online payments |
| Expenses | `/owner/expenses` | Property expenses |
| Payroll | `/owner/payroll` | Pay runs, commissions, payslips |
| Inventory | `/owner/inventory` | Stock + delete + link to expense |
| GRA Reports | `/owner/gra-reports` | Tax exports |
| Analytics | `/owner/analytics` | Trends and charts |
| Staff | `/owner/staff` | Invite all roles + pay profiles |
| Settings | `/owner/settings` | Property, tax rates, Airbnb, portal, lifecycle, alerts |

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

Check **Outstanding** every morning. The amount is **remaining due** on open invoices (same as Billing). Follow up in **Billing** and **Reservations** (payment filters).

**Needs attention** also lists unpaid invoices (remaining due), plus today’s arrivals and departures.

### Other sections

- **14-day availability** — occupied / reserved / maintenance / available.
- **Upcoming bookings** — next arrivals.
- **Ops calendar** — training, meetings, maintenance, events (important types also post to team chat).
- **Housekeeping summary** — open tasks.
- **Channel performance** — revenue by source.
- **GRA tax summary** — filing snapshot.
- **Guest reviews** — feedback from the portal.
- **Requests** — housekeeping, late checkout, and stay extensions from the guest portal (not Settings).
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

- **Stay status** — **In house** is everyone occupying a room (checked in, overstay, checkout in progress, dispute hold). They also sit at the top of **All**.
- **Payment** — unpaid, deposit paid, partial, paid, overdue, refunded.

### Create a booking

1. **New reservation**.
2. Guest, room, dates, **channel** (Airbnb, Booking.com, direct, walk-in, other).
3. **Rate type** — nightly, weekly (prorated from weekly rate ÷ 7), or monthly (prorated from monthly rate ÷ 30).
4. **Guest discount** (optional) — percent or fixed ₵, applied **before tax**. Add a reason for the audit trail.
5. Rate fills; total calculates.
6. Status starts **Confirmed**, payment **Unpaid**.

Receptionists cannot apply discounts — they will ask you or a manager.

### Record a payment (before invoice exists)

1. Open reservation → **Payment** → **Record payment**.
2. Amount (≤ balance due) + method (cash, MoMo, card).
3. **Channel prepaid** — one-click when Airbnb/Booking.com already paid you.

### Check-in payment minimum

Under **Settings → Reservation lifecycle**, set how much must be collected before a guest enters (default **50%** of the stay). Reception must meet this minimum; owners and managers can waive for prepaid channels or approved exceptions.

### Collect before check-in

Open a confirmed booking → **Collect payment before check-in**. This creates or refreshes the stay invoice. Record full or partial payment — the collect dialog shows **Pay balance**, **Pay minimum**, and **payment history**.

### Check in

1. Open **Confirmed** / **Pre-arrival** → **Check in guest**.
2. Phone required. Optional ID (Ghana Card, passport, or driver’s licence) for guest records — not used as invoice Tax ID.
3. Tick **Include Ghana tax** when you need a GRA tax invoice.
4. Stay invoice is created — collect in the dialog (full or partial; meet the check-in minimum unless waived).
5. Share **portal link** or QR.
6. If Hikvision is on, door access is queued automatically.

### While in-house

- **Extend stay** — updates nights and balance.
- **Move room** — reassign if free.
- **Guest folio** — post extras from **Guests** (minibar, laundry). Shows as **Folio (unbilled)** on the reservation. You can also post a **Discount (credit)**.
- **Approve late checkout** — when overstay needs more time.
- **Dispute hold** — pause checkout while a billing dispute is open (reason required). You can start it from in-house or **checkout in progress**; the folio unlocks so charges can still be posted. The guest still occupies the room; guest requests stay on this stay. **Release hold** (note required) resumes the stay; checkout and walkout also work from the hold.
- **Release no-show hold** — when a no-show is still blocking a room.

### Check out

Stay payment is taken **at check-in**. Checkout refreshes the same invoice for extras, then releases the room.

1. Review Payment box (stay invoice total when issued, paid, **Outstanding**).
2. **Begin checkout** — locks folio.
3. Post any final charges → **Complete checkout**.
4. Collect the **full remaining balance** if Outstanding is above zero (checkout cannot leave a partial balance — use **Walkout** if they left unpaid).
5. **Early checkout** if leaving before booked date.
6. Confirm → same GRA stay invoice refreshed, room → **Cleaning**, clean task created, door access revoked (if enabled).

Print, download PDF, or **WhatsApp** the invoice from the checkout dialog or Billing.

**Walkout** — guest already left without paying. Keeps balance due and releases the room. Do not use if the guest is still at the desk.

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

- Search and open a guest profile (name, phone, email, ID document).
- **Register in-house guest** — go-live for people already staying (real past arrival allowed). Creates a stay invoice; skips automatic welcome SMS.
- **Walk-in check-in** — for guests arriving now.
- **Guest portal** — copy link, QR, WhatsApp, regenerate, revoke.
- **Guest folio** (in-house) — post charges; discount credits allowed for you and managers.
- **Generate stay invoice & collect** if they are in house without an invoice.
- **Extend stay** — pick a later check-out from the guest card (same as Reservations).
- **Check out** from the guest card (same two-step flow). **Dispute hold** stays stay in house — use Reservations to release the hold, begin checkout, or record a walkout.
- **Export PII** — download guest personal data.
- **Erase PII** — permanently remove guest personal data (you and managers). Hard-delete only orphan rows with no history.

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

You can **add, edit, and delete** rooms; manage categories, photos, and floor/grid views. Set **nightly, weekly, and monthly** rates on categories and rooms. Managers cannot delete rooms.

---

## 8. Access control (Hikvision)

**Path:** `/owner/access`  
Full agent setup: [access-control.md](access-control.md)

**Tabs:** Today · Guests · Staff · Attendance · **Setup** (owner only). Setup collapses to **Setup · OK** once the core checklist is healthy.

**Setup**

1. Enable Hikvision sync.
2. Rotate agent token (shown once) for the on-site LAN agent.
3. Map doors (unit / lobby-shared / gym) and optional enrollment + attendance terminals.

**Day-to-day**

- Check-in enrolls guest access (unit + shared + gym); checkout revokes it.
- **Unlock** — remote door open (agent must be online).
- **Assign card** / enroll at station.
- **Staff** — physical access policies; reception never sees staff credentials.
- **Attendance** — pull clock in/out from the attendance terminal.
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

## 10. Complaints (oversight)

**Path:** `/owner/complaints`

You can **log** a complaint. You see the full lifecycle. You do **not** assign technicians or close jobs in the UI — managers do that.

Current flow (no invoice-before-work gate):

```
Logged → Manager assigns → Technician starts → Marks complete
  → Guest signs off (if linked) → Manager closes
```

Technician invoices are optional cost records, not a start-work lock. Legacy “invoice pending approval” jobs can be released by the manager.

---

## 11. Billing

**Path:** `/owner/billing` — **owners write payments and refunds here**

Tabs: **Invoices** · **Payment ledger** · **Online payments**.

### On an unpaid invoice

| Action | When |
|--------|------|
| **Record payment** | Full remaining balance |
| **Partial payment** | Some now — paid so far, this payment, and remaining are shown |
| **Refund** | Reverse a payment (**you only**) |
| **Download PDF / WhatsApp** | Share with guest |

**Outstanding on reservations** uses the stay invoice balance when one exists — same number as Billing.

After upgrading partial payments, run once:

```bash
npm run backfill:payments:dry-run
npm run backfill:payments
```

Verify with `npm run test:payments-rollout`. See [GO-LIVE.md](GO-LIVE.md#partial-payments-rollout-verification) for the manual desk checklist.

### Other tools

- **Create manual invoice** — charges not tied to a stay (you and managers).
- **Payment ledger** — reconciliation of all recorded payments.
- **Online payments** — guest Pay-now attempts when `PAYMENTS_ENABLED` is on for the deployment.

Invoice numbers use your Settings prefix (e.g. `MOJO-2026-00001`).

**Bill to** can be a different name from the guest (checkbox when issuing). The PDF shows BILL TO; the guest name stays as a Guest line when they differ.

Discounts appear as a line before tax. On **new** invoices, VAT (default 15%) is charged on the stay amount, same base as NHIL / GETFund — not stacked on those levies. Tourism levy (default 1%) sits **outside** that base. COVID levy is not charged on new invoices. Older invoices keep their frozen snapshot.

---

## 12. Expenses

**Path:** `/owner/expenses` — **owner only**

Record property expenses (category, amount, date, notes). Delete when entered in error. Use for cost tracking alongside revenue.

---

## 13. Payroll

**Path:** `/owner/payroll`

1. **Staff → Set pay** on each person (base pay, MoMo/bank, TIN/SSNIT, include in payroll).
2. Add a **housekeeping commission** rule if cleaners earn per completed clean.
3. **Run payroll** for the period → review lines → **Approve** → **Mark paid**.
4. Export **payslip PDF**, pay-run summary, or MoMo/bank checklist CSV.

Managers can prepare **draft** runs. Only you set rates, approve, mark paid, and export disbursement files.

---

## 14. Inventory

**Path:** `/owner/inventory`

- Add / edit stock items (SKU, reorder level, unit).
- **Receive** stock (deliveries).
- **Issue** stock (usage).
- **Adjust** / **waste**.
- View movement history.
- **Delete** items (owner only).
- **Record expense** from stock purchase (owner only).

---

## 15. GRA tax reports

**Path:** `/owner/gra-reports`

- Period revenue and tax breakdown (NHIL, GETFund, VAT, e-levy, tourism levy).
- Export **CSV**, **PDF**, or **ZIP**.
- Month shows **Approved** when all issued invoices that month are paid.

**Month-end:** settle Billing → GRA Reports → export → accountant.

Taxed invoices stamp Bill-to Tax ID **GHA-728071939-8**. Hotel VAT registration stays separate on the invoice header.

---

## 16. Analytics

**Path:** `/owner/analytics`

Charts for revenue, occupancy, bookings, channel mix, and trends. Use with Dashboard KPIs for reviews.

---

## 17. Staff

**Path:** `/owner/staff`

| Role | Invite by | Can do |
|------|-----------|--------|
| Manager | Email | Daily ops, payments, discounts, complaint close, payroll drafts |
| Receptionist | Email | Front desk + stay payments (must collect when issuing) |
| Technician | Phone | Maintenance + HK tasks |

Share the invite on **WhatsApp**. Disable / reactivate staff; revoke pending invites; keep phones up to date. Set **pay profiles** here for payroll.

---

## 18. Settings

**Path:** `/owner/settings`

| Tab | What you configure |
|-----|--------------------|
| **Property** | Name, address, logo, city, region, VAT TIN, invoice prefix, VAT exclusive/inclusive, **tax rates (%)**, reservation lifecycle |
| **Channels** | Airbnb calendar sync |
| **Guest portal** | Wi‑Fi, welcome, parking, emergency, checkout time, requests, rules, local guide |
| **Alerts** | SMS / email notification preferences |
| **Activity** | Audit log and notification outbox |

### Tax rates (%)

Defaults if you leave a field blank:

| Levy | Default |
|------|---------|
| NHIL | 2.5% |
| GETFund | 2.5% |
| VAT | 15% |
| E-levy | 0% |
| Tourism levy | 1% |

On new invoices, NHIL, GETFund, and VAT use the **stay amount** as the base. Tourism levy is **not** part of that base. Set tourism to **0** to turn it off. COVID levy is removed. New invoices use the rates you save; older invoices keep their frozen snapshot.

### Airbnb sync

1. Open **Settings → Channels**.
2. In Airbnb: listing → **Availability → Connect calendars → Export calendar** → copy the link.
3. In MOJO: pick the room, paste the Airbnb export URL → **Connect**.
4. Copy the **MOJO export URL** and add it in Airbnb under **Import calendar**.
5. Use **Sync now** after connecting; automatic sync runs about every 5 minutes.

Airbnb iCal does not send guest phone or full payment detail. Front desk still checks the guest in; use **Channel prepaid** when Airbnb already paid you. Full steps: [airbnb-sync.md](airbnb-sync.md).

---

## 19. Audits

On **Dashboard**:

| Audit | When |
|-------|------|
| **Night audit** | Once per business day after check-outs |
| **Monthly audit** | End of month close |
| **Yearly audit** | End of year close |

Cannot run the same night audit date twice. Optional notes (e.g. “Late checkout Room 4”).

---

## 20. What owners should not do

| Avoid | Do instead |
|-------|------------|
| Cancel a checked-in guest | **Check out** |
| Skip deposit choice on cancel | Forfeit or refund |
| Ignore Outstanding | Collect in Billing |
| Assign / close complaints here | Ask the manager |
| Expect every guest to pay online | Record cash/MoMo/card in Billing |

---

## 21. Recommended routines

**Daily:** Dashboard (Outstanding, notifications) → departures → Billing overdue → night audit.

**Weekly:** GRA glance; staff phones; inventory reorder levels; payroll period if weekly staff.

**Month-end:** Invoices settled → GRA export → monthly audit → payroll mark paid → accountant.

**New property:** Settings (tax rates) → Rooms → Staff → Access (if used) → test reservation.
