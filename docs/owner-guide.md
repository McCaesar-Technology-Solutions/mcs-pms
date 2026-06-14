# Part 1 — Property Owner Guide

You own one or more properties. You handle money, tax compliance, portfolio settings, and high-level oversight. Day-to-day operations are usually done by your managers.

---

## 1. Getting started

### Create your account

1. Go to **Sign up** on the login page (`/signup`).
2. Enter your name, email, and password.
3. The system creates your owner account, your first property, default room categories, and numbered rooms.

### Sign in

- After login you land on **Dashboard** (`/owner/dashboard`).
- Only users with the **Owner** role can access `/owner/*` pages.

### First-time setup checklist

1. **Settings** → add your phone number.
2. **Settings** → complete property address, GTA license, VAT TIN, invoice prefix.
3. **Rooms** → review categories and nightly rates.
4. **Staff** → invite at least one manager.
5. Optional: add more properties via **Settings** or the sidebar property switcher.

---

## 2. Navigation and global tools

### Sidebar menu

| Menu | Path | Purpose |
|------|------|---------|
| Dashboard | `/owner/dashboard` | Business overview, occupancy, revenue |
| Rooms | `/owner/rooms` | Room inventory, categories, status |
| Reservations | `/owner/reservations` | Bookings, check-in, check-out |
| Guests | `/owner/guests` | Guest directory and history |
| Complaints | `/owner/complaints` | Read-only complaint lifecycle |
| Staff | `/owner/staff` | Invite managers & technicians |
| Billing | `/owner/billing` | Invoices and payments *(owner only)* |
| GRA Reports | `/owner/gra-reports` | Tax filing exports *(owner only)* |
| Analytics | `/owner/analytics` | Trends and performance *(owner only)* |
| Settings | `/owner/settings` | Property & tax configuration *(owner only)* |

### Property switcher (owners only)

- In the sidebar: switch between apartments in your portfolio.
- **Add property** at the bottom: name, address, city, region, total rooms (1–999).
- New properties get rooms numbered 1 through N automatically.
- All data is scoped to the **active** property.

### Top bar (every owner page)

- **Search** — guests, reservations, rooms, **invoices** (owners only).
- **Notifications** — overdue/pending invoices, check-outs today, open complaints (updates live).
- **Phone** — add or edit your number (SMS alerts).
- **Live updates** — dashboard and lists refresh when managers or staff change data (no manual refresh).
- **User menu** — Edit phone, Settings, Logout.

### Occupancy widget

Sidebar shows today’s occupancy: “X of Y rooms occupied” and a percentage bar.

---

## 3. Dashboard

**Path:** `/owner/dashboard`

### Key metrics

- **Total revenue** — with RevPAR.
- **Occupancy rate** — % of rooms occupied now.
- **Average nightly rate** — in Ghana Cedis (₵).
- **Total bookings** — with guest count.

### Room availability (14-day strip)

- Color-coded bar per day: Occupied, Reserved, Maintenance, Available.
- Tap a day for breakdown.
- **View All** on upcoming bookings → Reservations.

### Operations snapshot

- **Tasks summary** — read-only housekeeping (To Do / In Progress / Done). Manage tasks on the manager Housekeeping board.

### Business intelligence

- **Channel performance** — Direct, Airbnb, Booking.com, Walk-in, Other.
- **GRA tax summary** — current period revenue, tax, invoice counts, compliance status.

---

## 4. Rooms

**Path:** `/owner/rooms` · Search: `?q=` pre-fills room search.

### Room categories

- Name + **default nightly rate**.
- Add, edit, delete (delete only if no rooms use the category).

### Room grid statuses

| Status | Meaning |
|--------|---------|
| Available | Ready for guests |
| Occupied | Guest in house |
| Cleaning | Being cleaned |
| Needs inspection | Post-clean check |
| Maintenance | Out of service |

### Add or edit a room

- Room number, floor, category, nightly rate (₵), status.
- **Delete room** — owners only.

---

## 5. Reservations

**Path:** `/owner/reservations` · `?open={id}` opens a reservation.

### Gantt chart

21-day timeline by room, colored by booking source (read-only).

### Create a reservation

1. **New reservation**.
2. Guest name, room, check-in/out dates, channel, nightly rate.
3. Optional: search returning guest.

### Check in

1. Open confirmed reservation → **Check in guest**.
2. Phone required, name, optional email.
3. Receive **guest portal link** — share with guest.

### While checked in

- **Check out**, **Extend stay**, **Move room**.

### Check out

1. Payment method: Cash, MTN MoMo, Telecel Cash, AirtelTigo, Visa, Mastercard, Bank transfer.
2. **Early checkout** if needed.
3. **Payment received now** to mark paid immediately.
4. GRA tax invoice generated automatically → view in **Billing**.

### Other actions

- **Mark no-show** (confirmed, check-in date passed).
- **Cancel reservation**.

---

## 6. Guests

**Path:** `/owner/guests`

### Directory

- Search: name, email, phone.
- Filters: All, Active, Returning, VIP, New.

### Guest detail

- Edit contact (name, phone, email).
- **Guest portal:** QR, copy link, WhatsApp share, regenerate, revoke.
- **Check out** if in-house (same payment options as reservations).

**Note:** Walk-in check-in wizard is on the **manager** Guests page. Owners use Reservations check-in.

---

## 7. Complaints (read-only)

**Path:** `/owner/complaints`

Owners get full visibility into the complaint lifecycle without operating it — assigning technicians and approving work stays with managers.

- **Filters:** all, open, assigned, in_progress, pending_approval, resolved.
- **Detail panel:** description, guest and technician contacts (tap to call / WhatsApp), the technician’s invoice (materials, labour, total), and the full event timeline.
- **Sidebar badge:** counts complaints awaiting manager approval.
- Updates live as managers and technicians make changes.

---

## 8. Staff

**Path:** `/owner/staff`

### Invite staff

1. **Invite staff** → choose role:
   - **Manager** — enter their **email**.
   - **Receptionist** — enter their **email** (front desk: bookings, check-in/out, room status, complaints).
   - **Technician** — enter their **phone number** (for SMS job alerts).
2. Share invite link (`/accept-invite?token=...`) via WhatsApp, SMS, or in person.

### Manage team

- Edit phone on manageable members.
- **Disable** / **Reactivate** managers and technicians (not other owners, not yourself).
- **Revoke** pending invites.

---

## 9. Billing & invoices

**Path:** `/owner/billing` — owners only

### Summary

Total revenue, paid count, pending count + amount, collection rate %.

### Invoice list

- **New Invoice**, search, filters (All / Paid / Pending / Overdue).
- **Download PDF** per row.

### Tax breakdown (GRA)

Subtotal, NHIL (2.5%), GETFund (2.5%), COVID levy (1%), VAT (15%), **Total**.

### Actions

- **Record payment** on unpaid invoices.
- **Create manual invoice** with live tax preview.

### Invoice numbers

Uses prefix from Settings (e.g. `MOJO-2026-00001`). Sequence resets each January.

---

## 10. GRA tax reports

**Path:** `/owner/gra-reports` — owners only

- Filing deadlines, compliance %, tax YTD.
- **Export CSV**, **PDF**, or **ZIP** (all periods).
- Month **Approved** when all issued invoices in that month are paid.

---

## 11. Analytics

**Path:** `/owner/analytics` — owners only

Bookings, occupancy, avg stay, revenue growth, 7-day charts, repeat guests, peak day.

---

## 12. Settings

**Path:** `/owner/settings` — owners only

- Your phone.
- Portfolio: switch/add properties.
- Property: name, address, city, region.
- GRA: GTA license, expiry, VAT TIN, **invoice prefix**.
- **Manage staff** shortcut.

---

## 13. Owner limitations

| Cannot do in app | Alternative |
|------------------|-------------|
| Assign / approve complaints | Manager account (owner view is read-only) |
| Housekeeping kanban | Manager account |
| Walk-in button on Guests | Reservations check-in |
| Online payment gateway | Record payments manually |

---

## 14. End-to-end workflows

**New property:** Settings → Add property → tax fields → Rooms → Staff.

**Book and bill:** Reservations → Check in → portal link → Check out → Billing → PDF.

**Month-end tax:** Settings complete → Billing payments → GRA Reports → Export.

**Hire manager:** Staff → Invite Manager → share link.
