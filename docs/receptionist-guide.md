# Receptionist guide — MOJO Apartments

You are the **front desk**. You handle bookings, check-in and check-out, stay invoices and payments, guest messages, room status, guest door access, and logging complaints.

You do **not** apply discounts, create ad-hoc (non-stay) bills, leave stay invoices unpaid, refund money, change room rates, approve complaints, run the housekeeping board, or manage inventory.

Tap **Help** (bottom-right) for the same topics on the page you are on.

---

## 1. Getting started

### Join the team

1. Manager or owner sends invite by **email**: `/accept-invite?token=...`
2. Set name, password, phone.
3. Land on **Reception Dashboard** (`/receptionist/dashboard`).

One property only. In production you may need **SMS two-factor authentication**.

---

## 2. Your menu

| Menu | Path | Your job |
|------|------|----------|
| Dashboard | `/receptionist/dashboard` | Today, requests, issues |
| Messages | `/receptionist/messages` | Guest stay chat + team chat |
| Reservations | `/receptionist/reservations` | Bookings, deposits, check-in/out |
| Guests | `/receptionist/guests` | Walk-ins, register in-house, portal, folio |
| Rooms | `/receptionist/rooms` | View rates (read-only) and update room status |
| Access | `/receptionist/access` | Guest unlock, cards, retry sync |
| Billing | `/receptionist/billing` | View invoices, record payments, print / WhatsApp |
| Complaints | `/receptionist/complaints` | Log and track issues |

### Top bar

- **Search / ⌘K** — reservations, guests, rooms, complaints.
- **Notifications** — check-outs, open complaints, guest requests, messages.
- **Profile** — phone, photo, sign out (no Settings page).

**Revenue is hidden.** You still see **Outstanding** so you know who owes money before they leave.

---

## 3. Dashboard

Tabs / sections typically include:

- **Today** — arrivals, departures, occupancy snapshot.
- **Requests** — guest portal requests (housekeeping, late checkout, extension). Approve, deny, or schedule as trained.
- **Issues** — recent complaints to track.
- **Ops calendar** — property events this week.
- 14-day availability strip.
- Notification bell for urgent items.

---

## 4. Messages

**Path:** `/receptionist/messages`

- Answer guest stay questions (towels, checkout time, Wi‑Fi).
- Team chat with managers / other staff.
- For a specific repair, open the complaint and message there — or tell the guest to use **Issues** in the portal.

---

## 5. Reservations — main screen

**Path:** `/receptionist/reservations`

### Create a booking

1. **New reservation**.
2. Guest name, room, check-in / check-out.
3. **Channel** — Walk-in, Direct, Airbnb, Booking.com, Other.
4. **Rate type** — nightly, weekly, or monthly (prices come from the room; you cannot change the rate).
5. Rate fills; payment starts **Unpaid**.

Need a **discount**? Ask a manager or owner — they enter percent or fixed ₵ before tax. You cannot apply discounts.

### Payment filters

Use Unpaid / Deposit paid / Paid / etc. to find balances before departure.

### Stay status badges

| Status | What to do |
|--------|------------|
| **Provisional** | Hold — collect deposit or cancel hold |
| **Confirmed** / **Pre-arrival** | **Check in** |
| **Checked in** | Extend, move room, or **Begin checkout** |
| **Checkout in progress** | **Complete checkout** |
| **Overstay** | Begin checkout urgently; approve late checkout if allowed |
| **Checked out** / **Post stay** | History only |

### Record a deposit

1. Open reservation → **Payment** → **Record deposit**.
2. Amount (≤ balance due) + method (cash, MoMo, card).
3. Airbnb/Booking already paid? Use **Channel prepaid** when trained.

### Check in

1. Open Confirmed / Pre-arrival → **Check in guest**.
2. Phone **required**. Ghana Card optional (guest records).
3. Tick **Include Ghana tax** if the guest needs a GRA tax invoice.
4. Stay invoice is created — **collect payment** in the dialog (pay before enter). You must record payment; you cannot issue an unpaid stay invoice.
5. Give **portal link** or **QR**.
6. Room should show **Occupied**.
7. Door access queues automatically if Hikvision is on.

You can also **Collect payment before check-in** on a confirmed booking.

### While in house

- **Extend stay** / **Move room**.
- Post **folio** charges from **Guests** (no discount credits — ask a manager).
- **Approve late checkout** when policy allows.
- **Generate stay invoice & collect** from the guest card if they somehow have no invoice.

### Check out

Payment for the stay is taken **at check-in**. Checkout is departure + any unpaid extras on the same invoice.

1. Read the Payment box:

   | Line | Meaning |
   |------|---------|
   | Room total | Nights × rate |
   | Discount | Manager/owner stay discount (if any) |
   | Folio (unbilled) | Extras not yet on invoice |
   | Estimated total | Stay invoice base (refreshed at checkout) |
   | Paid | Check-in payment / deposits already collected |
   | **Outstanding** | What guest still owes today (usually folio extras) |

2. **Begin checkout** — folio locks.
3. If Outstanding is ₵0 → **Complete checkout**.
4. If balance remains → collect remaining (required). Unpaid complete-checkout is blocked.
5. **Early checkout** if leaving early.
6. Confirm → room **Cleaning**; same stay invoice refreshed (no duplicate). Print, download, or **WhatsApp** the bill.

**Walkout** — only if the guest already left without paying. Not a “pay later” path.

### Cancel / no-show

- Only **Confirmed** / pre-arrival (never checked-in).
- No deposit → confirm cancel.
- With deposit → **Forfeit** (you can) or **Refund** (call owner).
- Blocked if unpaid folio / invoice remains.

### Never do this

| Wrong | Right |
|-------|--------|
| Cancel a checked-in guest | **Check out** |
| Skip deposit question | Forfeit or ask owner for refund |
| Ignore Outstanding | Collect remaining or record **Walkout** |
| Promise a discount at the desk | Ask a manager to enter it on the booking |

---

## 6. Guests

**Path:** `/receptionist/guests`

### Walk-in

1. **Walk-in check-in**.
2. Name, phone, optional Ghana Card, room, checkout date.
3. Share portal link / QR.

### Register in-house guest (go-live)

For people **already staying**:

1. **Register in-house guest**.
2. Real arrival date (can be in the past) and planned departure.
3. Assign room and rate — a stay invoice is created (Tax ID `GHA-728071939-8` when taxed).
4. Share the portal link or PIN on WhatsApp and **collect payment**.
5. Use **Walk-in check-in** only for guests who are arriving now.

### Guest card

- Edit phone / email / Ghana Card.
- **Guest folio** — post description + amount (₵). Cannot post while checkout in progress. Cannot post discount credits.
- Copy / regenerate / revoke portal link; WhatsApp share.
- **Export PII** if asked (erase is manager/owner only).
- Check out from guest page if easier.

---

## 7. Rooms

**Path:** `/receptionist/rooms`

The **Room rates** table shows nightly, weekly, and monthly prices for every room (read-only — same figures used when you book or check in).

Tap a room → change status:

| Status | When |
|--------|------|
| Available | Ready for next guest |
| Occupied | Guest in room |
| Cleaning | After checkout |
| Needs inspection | Clean finished |
| Maintenance | Broken / repair |

You **cannot** add rooms, delete rooms, or change rates. Ask a manager or owner to update pricing.

---

## 8. Access

**Path:** `/receptionist/access`

Tabs: **Today · Guests** (no Staff, Attendance, or Setup).

When Hikvision sync is enabled:

- Check-in enrolls access; checkout revokes it.
- Portal PIN is used as door PIN when the controller supports it.
- **Assign card** if the guest gets a physical card.
- **Unlock** for remote open (agent must be online).
- **Retry** if credential sync failed.

You cannot see staff badges or attendance.

---

## 9. Billing

**Path:** `/receptionist/billing`

- View stay invoices, record **full or partial payments**, print PDF, send via **WhatsApp**.
- Issue / refresh a stay invoice from the reservation or Billing — you **must mark it paid** when issuing.
- Ask a manager or owner if the guest needs a **discount**, an **unpaid** invoice document, or an **ad-hoc** (non-stay) bill.
- Tax is optional — check **Include Ghana tax** when you need a GRA tax invoice.
- **Refunds stay owner-only.**

---

## 10. Complaints

**Path:** `/receptionist/complaints`

1. **Log complaint**.
2. Guest or room, category, priority, description.
3. Manager assigns a technician. The technician can start immediately.

You can track status and message on the issue. You **cannot** assign technicians or close jobs.

---

## 11. What receptionists cannot do

| Cannot | Who can |
|--------|---------|
| Guest stay discounts / folio discount credits | Owner / Manager |
| Unpaid stay invoices / ad-hoc bills | Owner / Manager |
| Invoice or deposit refunds | Owner |
| GRA / analytics / expenses / payroll | Owner (payroll drafts: manager) |
| Change room prices / add-delete rooms | Owner / Manager |
| Approve / close complaints | Manager |
| Housekeeping kanban | Manager |
| Inventory (stock levels / issue) | Owner / Manager |
| Invite staff | Owner / Manager |
| Access setup, staff badges, attendance | Owner (setup) / Manager (staff + attendance) |
| Night / period audits | Owner / Manager |
| Erase guest personal data | Owner / Manager |

---

## 12. Shift checklist

### Start of shift

- [ ] Dashboard → notifications.
- [ ] Reservations → today’s arrivals and checked-in guests.
- [ ] Note **Outstanding** on today’s departures.

### During shift

- [ ] Check-ins: phone + portal link every time. Collect stay payment before they enter.
- [ ] Deposits recorded the day money is received.
- [ ] Folio charges posted when they happen.
- [ ] Room status kept accurate.
- [ ] Complaints logged with clear descriptions.
- [ ] Guest messages answered.
- [ ] Discount requests passed to a manager.

### End of shift

- [ ] Expected check-outs processed.
- [ ] Rooms set to Cleaning / Available / Maintenance correctly.
- [ ] Unpaid check-outs / walkouts handed to manager or owner.

---

## 13. Quick answers for guests

| Guest asks | You say |
|------------|---------|
| “Can I pay online?” | If Pay now is on their portal invoice, they can try; otherwise pay at desk (cash/MoMo/card). |
| “What’s my balance?” | Open reservation → **Outstanding**. |
| “I paid on Airbnb” | Use **Channel prepaid** if trained, or ask manager. |
| “Can I get a discount?” | A manager or owner must enter it on the booking. |
| “Cancel my booking” | Explain forfeit / refund; refund needs the owner. |
| “Door won’t open” | Access → Unlock / Retry, or call manager if agent offline. |

Deposit policy summary: [README.md](README.md#deposit-policy-summary).
