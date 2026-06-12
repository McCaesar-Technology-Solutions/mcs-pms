# Part 3 — Guest Guide

Guests use a **mobile-friendly portal** — no password. Access is via a **link or QR code** from the front desk.

---

## 1. Getting access

### How you get in

1. Staff checks you in (reservation or walk-in).
2. You receive a **link** or **QR code**.
3. Link format: `{website}/guest/enter?token=...`
4. Opening it opens the guest portal (`/guest`).

### No account needed

- No email/password for guests.
- Session tied to your stay’s access token.

### When access ends

- **End of checkout day** (midnight on your checkout date).
- Staff **checks you out** (immediate revoke).
- Staff **revokes** your link.

### If the link fails

| Message | What to do |
|---------|------------|
| Link expired | Ask front desk for a new link |
| Invalid/missing | Use only the link staff gave you |

---

## 2. Guest portal home

**Path:** `/guest`

### Header

- **MOJO APARTMENTS** branding.
- **Room {number}** (if assigned).
- **Hi {your name}**.

### Your phone number

- **Add** or **Edit** contact number (Ghana format, e.g. +233 24 123 4567).
- Helps staff call you back.

### Contact your manager

- **Call** and **WhatsApp** buttons for **managers only**.
- Owner phone numbers are **not shown**.

---

## 3. Submit a complaint

### Step 1 — Category (required)

Tap one:

| Category | Examples |
|----------|----------|
| Plumbing | Leaks, no water |
| Electrical | Power, lights |
| HVAC | AC, heating |
| Furniture | Broken chair, bed |
| Cleaning | Room not clean |
| Noise | Disturbance |
| Other | Anything else |

### Step 2 — Description (required)

- At least **10 characters**.
- Be specific: location, when it started, severity.

### Step 3 — Priority

| Button | Meaning |
|--------|---------|
| **Normal** | Standard request |
| **Urgent** | Needs fast attention (flooding, no power, safety) |

### Submit

- Fixed bottom button: **Submit complaint**.
- Disabled until category + valid description.

### After submit

- **Reference number** (8 characters) — save it.
- “Team notified by SMS/WhatsApp.”
- **Back to portal** returns to main screen.

### Limits

- Max **3 complaints per 15 minutes**.
- Max **10 complaints per stay**.
- Cannot edit or cancel after submit.

---

## 4. Track your complaints

Section: **My complaints**

| What you see | What it means |
|--------------|---------------|
| Being handled | Team is working on it |
| Quote under review | Technician invoice awaiting manager approval |
| Almost done | Work finished, manager sign-off pending |
| Resolved ✓ | Closed |
| Being reviewed again | Sent back for more work |

You do **not** see technician names, costs, or internal notes.

### Live updates

- List refreshes automatically (~every 15 seconds).
- **Reconnect** banner if connection drops.

---

## 5. What guests cannot do

- Log in as staff or see other guests.
- Pay bills in the portal.
- Contact the property owner directly.
- Use portal after checkout or link expiry.
- Choose low/high priority (only Normal/Urgent).

---

## 6. Tips

- Bookmark or save your portal link during your stay.
- Add your phone number early.
- Use **Urgent** only for real emergencies.
- Quote your **reference number** at the desk when following up.

---

## 7. Behind the scenes (what staff does)

You won’t see these steps, but it helps to know the flow:

1. Your complaint → manager notified.
2. Manager assigns a technician.
3. Technician submits a cost invoice → manager approves.
4. Technician does the work.
5. Technician marks complete → manager approves.
6. Your status updates to **Resolved ✓**.

Typical timeline: hours for urgent, same day or next day for normal issues.
