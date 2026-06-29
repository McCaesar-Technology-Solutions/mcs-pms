# Receptionist guide — MOJO Apartments

You are the **front desk**. You handle bookings, check-in and check-out, guest contact, room status, and logging complaints. You do **not** handle billing, GRA, analytics, pricing, complaint approvals, or housekeeping boards.

---

## 1. Getting started

### Join the team

1. Manager or owner sends invite by **email**: `/accept-invite?token=...`
2. Set name, password, phone.
3. Land on **Reception Dashboard** (`/receptionist/dashboard`).

One property only — no property switcher.

---

## 2. Navigation

| Menu | Path | Your job |
|------|------|----------|
| Dashboard | `/receptionist/dashboard` | Today’s picture, guest requests, arrivals |
| Messages | `/receptionist/messages` | Guest stay chat |
| Reservations | `/receptionist/reservations` | Bookings, payments at desk |
| Guests | `/receptionist/guests` | Walk-ins, portal links, folio |
| Rooms | `/receptionist/rooms` | Update room status |
| Complaints | `/receptionist/complaints` | Log issues for guests |

### Top bar

- **Search / ⌘K** — jump to pages or search reservations, guests, rooms, and complaints.
- **Notifications** — check-outs today, open complaints, guest requests, messages.
- **Profile menu** — phone, profile photo, sign out (no separate settings page).

**Guest requests** from the portal appear on your dashboard under **Guest requests** (also linked from notifications).

**Revenue is hidden** on your dashboard. You still see **Outstanding** balances so you know who owes money before they leave.

---

## 3. Dashboard

- Occupancy and bookings for today.
- 14-day availability strip.
- Recent complaints.
- Use notifications bell for urgent items.

---

## 4. Reservations — your main screen

**Path:** `/receptionist/reservations`

### Create a booking

1. **New reservation**.
2. Guest name, room, check-in and check-out dates.
3. **Channel** — how they found you:
   - Walk-in, Direct, Airbnb, Booking.com, Other.
4. Rate fills from room; total shows automatically.
5. Payment starts as **Unpaid**.

### Payment column and filters

Use **payment filters** (Unpaid, Deposit paid, Paid, etc.) to find guests who still owe money.

### Record a deposit

When guest pays part of the stay **before** arrival or at booking:

1. Open reservation → **Payment** section.
2. **Record deposit**.
3. Enter amount (cannot be more than balance due) and method (cash, MTN MoMo, etc.).
4. **Save deposit**.

If guest paid via Airbnb/Booking and you have confirmation: **Channel prepaid** (only for those channels).

### Check in a guest

1. Open **Confirmed** booking.
2. **Check in guest** — phone **required**.
3. Give guest the **portal link** or **QR** (complaints and contact managers).
4. Room should show **Occupied**.

### While guest is in house

- **Extend stay** if they want more nights.
- **Move room** if you need to reassign.
- Post **folio** charges from **Guests** page (minibar, laundry) — they appear on this reservation before checkout.

### Check out

1. Open **Checked in** reservation.
2. Read **Payment** box carefully:

   | Line | Meaning |
   |------|---------|
   | Room total | Nights × rate |
   | Folio (unbilled) | Extra charges not yet on invoice |
   | Estimated total | What checkout invoice will be based on |
   | Paid | Deposits already collected |
   | **Outstanding** | What guest still owes **today** |

3. Tap **Check out**.
4. Choose payment method.
5. **Early checkout** if leaving before booked date.
6. **Payment received now**:
   - **On** if they pay everything now.
   - **Off** if they will pay later (owner collects in Billing).
7. **Confirm check-out** → room goes to **Cleaning**; invoice goes to owner.

### Cancel a booking

- Only **Confirmed** bookings (not checked in).
- If **no deposit**: confirm cancel.
- If **deposit was collected**: you must choose:
  - **Forfeit deposit** (hotel keeps) — you can do this.
  - **Refund deposit** — **call the owner**; only they can refund in the system.

### Mark no-show

For **Confirmed** guest who did not arrive (check-in date is today or past):

- Same deposit rules as cancel.
- Does not apply to checked-in guests.

### Never do this

| Wrong | Right |
|-------|--------|
| Cancel a checked-in guest | **Check out** |
| Skip deposit question on cancel | Always pick forfeit or ask owner for refund |
| Ignore Outstanding on checkout | Collect or confirm “pay later” with guest |

---

## 5. Guests

**Path:** `/receptionist/guests`

### Walk-in (no prior reservation)

1. **Walk-in check-in**.
2. Name, phone, room, checkout date.
3. Share portal link/QR.

### Guest card

- Edit phone/email.
- **Guest folio** (in-house only):
  - **Post to folio** — description + amount (₵).
  - Charges add to checkout total automatically.
- Copy/regenerate/revoke portal link.
- Check out from guest page if easier than Reservations.

---

## 6. Rooms

**Path:** `/receptionist/rooms`

Tap a room → change status:

| Status | When |
|--------|------|
| Available | Ready for next guest |
| Occupied | Guest in room |
| Cleaning | After checkout |
| Needs inspection | Clean finished |
| Maintenance | Broken / repair |

You **cannot** add rooms, delete rooms, or change nightly rates.

---

## 7. Complaints

**Path:** `/receptionist/complaints`

### Log for a guest

1. **Log complaint**.
2. Guest or room, category, priority, description.
3. Manager gets notified and assigns a technician.

### What you cannot do

- Assign technicians.
- Approve invoices or mark jobs resolved.

You **can** track status and tell the guest what stage it is in.

---

## 8. What receptionists cannot do

| Cannot | Who can |
|--------|---------|
| Billing, GRA, analytics | Owner |
| Change room prices / add-delete rooms | Owner / Manager |
| Approve complaints | Manager |
| Housekeeping kanban | Manager |
| Refund deposits | Owner |
| Invite staff | Owner / Manager |

---

## 9. Shift checklist

### Start of shift

- [ ] Open Dashboard → read notifications.
- [ ] Reservations → filter **Checked in** and today’s **Confirmed** arrivals.
- [ ] Note any **Outstanding** balances on departures today.

### During shift

- [ ] Check-ins: phone + portal link every time.
- [ ] Deposits recorded same day money is received.
- [ ] Folio charges posted when incidentals happen (not at checkout only).
- [ ] Room status updated when you know cleaning state.
- [ ] Complaints logged with clear descriptions.

### End of shift

- [ ] All expected check-outs processed.
- [ ] Rooms set to Cleaning / Available / Maintenance correctly.
- [ ] Hand off unpaid check-outs to manager or owner.

---

## 10. Quick answers for guests

| Guest asks | You say |
|------------|---------|
| “Can I pay online?” | Pay at desk (cash/MoMo/card); receipt from owner. |
| “What’s my balance?” | Open reservation → **Outstanding** line. |
| “I paid on Airbnb” | Manager/owner marks channel prepaid; you can use **Channel prepaid** if trained. |
| “Cancel my booking” | If deposit: explain forfeit/refund policy; get manager/owner if refund needed. |

---

## 11. Need help?

- **Money / invoice / refund** → Owner  
- **Maintenance approval** → Manager  
- **Room pricing / new room** → Manager or Owner  
- **System login** → Whoever invited you

Full MOJO deposit policy: [docs/README.md](README.md#mojo-deposit-policy-summary)
