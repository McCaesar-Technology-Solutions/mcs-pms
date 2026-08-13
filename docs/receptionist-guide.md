# Receptionist guide — MOJO Apartments

You are the **front desk**. You handle bookings, check-in and check-out, guest messages, room status, inventory issues, access ops, and logging complaints. You do **not** handle billing writes, GRA, analytics, changing room rates, complaint approvals, or the housekeeping board.

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
| Guests | `/receptionist/guests` | Walk-ins, portal links, folio |
| Rooms | `/receptionist/rooms` | View rates (read-only) and update room status |
| Access | `/receptionist/access` | Unlock, cards, retry sync |
| Complaints | `/receptionist/complaints` | Log and track issues |
| Inventory | `/receptionist/inventory` | Issue stock / check levels |

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
4. Rate fills; payment starts **Unpaid**.

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
2. Phone **required**.
3. Stay invoice is created — **collect payment** (pay before enter).
4. Give **portal link** or **QR**.
5. Room should show **Occupied**.
6. Door access queues automatically if Hikvision is on.

### While in house

- **Extend stay** / **Move room**.
- Post **folio** charges from **Guests**.
- **Approve late checkout** when policy allows.

### Check out

Payment for the stay is taken **at check-in**. Checkout is departure + any unpaid extras on the same invoice.

1. Read the Payment box:

   | Line | Meaning |
   |------|---------|
   | Room total | Nights × rate |
   | Folio (unbilled) | Extras not yet on invoice |
   | Estimated total | Stay invoice base (refreshed at checkout) |
   | Paid | Check-in payment / deposits already collected |
   | **Outstanding** | What guest still owes today (usually folio extras) |

2. **Begin checkout** — folio locks.
3. If Outstanding is ₵0 → **Complete checkout**.
4. If balance remains → collect remaining (required). Unpaid complete-checkout is blocked.
5. **Early checkout** if leaving early.
6. Confirm → room **Cleaning**; same stay invoice refreshed (no duplicate).

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

---

## 6. Guests

**Path:** `/receptionist/guests`

### Walk-in

1. **Walk-in check-in**.
2. Name, phone, room, checkout date.
3. Share portal link / QR.

### Guest card

- Edit phone / email.
- **Guest folio** — post description + amount (₵). Cannot post while checkout in progress.
- Copy / regenerate / revoke portal link; WhatsApp share.
- **Export PII** if asked (erase is owner only).
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

When Hikvision sync is enabled:

- Check-in enrolls access; checkout revokes it.
- Portal PIN is used as door PIN when the controller supports it.
- **Assign card** if the guest gets a physical card.
- **Unlock** for remote open (agent must be online).
- **Retry** if credential sync failed.

---

## 9. Complaints

**Path:** `/receptionist/complaints`

1. **Log complaint**.
2. Guest or room, category, priority, description.
3. Manager assigns a technician.

You can track status and message on the issue. You **cannot** assign technicians or approve invoices / completions.

---

## 10. Inventory

**Path:** `/receptionist/inventory`

- Check stock levels.
- **Issue** stock when supplies are used (front desk / housekeeping).
- You **cannot** create new items or edit item details — ask a manager.

---

## 11. What receptionists cannot do

| Cannot | Who can |
|--------|---------|
| Billing payments / GRA / analytics | Owner |
| Change room prices / add-delete rooms | Owner / Manager |
| Approve complaints | Manager |
| Housekeeping kanban | Manager |
| Refund deposits | Owner |
| Invite staff | Owner / Manager |
| Access setup (token / maps) | Owner |
| Night / period audits | Owner / Manager |

---

## 12. Shift checklist

### Start of shift

- [ ] Dashboard → notifications.
- [ ] Reservations → today’s arrivals and checked-in guests.
- [ ] Note **Outstanding** on today’s departures.

### During shift

- [ ] Check-ins: phone + portal link every time.
- [ ] Deposits recorded the day money is received.
- [ ] Folio charges posted when they happen.
- [ ] Room status kept accurate.
- [ ] Complaints logged with clear descriptions.
- [ ] Guest messages answered.

### End of shift

- [ ] Expected check-outs processed.
- [ ] Rooms set to Cleaning / Available / Maintenance correctly.
- [ ] Unpaid check-outs handed to manager or owner.

---

## 13. Quick answers for guests

| Guest asks | You say |
|------------|---------|
| “Can I pay online?” | If Pay now is on their portal invoice, they can try; otherwise pay at desk (cash/MoMo/card). |
| “What’s my balance?” | Open reservation → **Outstanding**. |
| “I paid on Airbnb” | Use **Channel prepaid** if trained, or ask manager. |
| “Cancel my booking” | Explain forfeit / refund; refund needs the owner. |
| “Door won’t open” | Access → Unlock / Retry, or call manager if agent offline. |

Deposit policy summary: [README.md](README.md#deposit-policy-summary).
