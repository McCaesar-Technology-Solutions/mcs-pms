# Part 4 — Technician Guide

Technicians see **assigned maintenance jobs** on mobile. Submit invoices, wait for approval, do the work, mark complete.

---

## 1. Getting started

### Join the team

1. Owner or manager sends invite: `/accept-invite?token=...`
2. Enter name, password, phone.
3. Land on **My tasks** (`/technician/tasks`).

### First-time setup

1. Add **phone** (banner, header **Phone** button, or inline editor).
2. Note **Call manager** in header — managers only, not owner.

---

## 2. App layout

### Header

| Element | Purpose |
|---------|---------|
| Your name + specialty | Identity |
| **Phone** / **Add phone** | Edit contact |
| **Sign out** | Log out |
| **Call manager** | Tap-to-call / WhatsApp managers |

### Phone banner

If no phone: amber **“Add your phone number”** at top — required for SMS job alerts.

### Live alerts (toasts)

- New task assigned.
- Job sent back — read manager note.
- New housekeeping task (no housekeeping screen for technicians).

---

## 3. My tasks

**Path:** `/technician/tasks`

### Tabs

| Tab | Shows |
|-----|-------|
| **My tasks** | Active jobs |
| **Completed (30d)** | Resolved in last 30 days |

Sorted: Urgent → High → Medium → Low.

### Task card

- Room number, priority, category, description.
- **Status badge** (see table below).
- Tap to expand for actions.

### Status labels

| Label | Meaning |
|-------|---------|
| Submit invoice | Assigned, need to send invoice |
| Invoice pending approval | Waiting for manager |
| Invoice sent back | Fix and resubmit |
| Ready to start | Invoice approved |
| In progress | Working on site |
| Completion pending approval | Waiting for manager sign-off |
| Resolved | Done |

---

## 4. Full job workflow

### Step 1 — Receive assignment

Manager assigns you → **Assigned**. SMS alert if phone on file.

### Step 2 — Submit invoice (before work)

Expand task → **Submit invoice to manager**.

| Field | Details |
|-------|---------|
| Materials | Rows: name, qty, unit cost (₵). Optional. |
| Labour cost | Your labour (₵). |
| Note to manager | Scope, assumptions. |
| Total | Auto-calculated |

Click **Submit invoice to manager**.

- Status → **Invoice pending approval**.
- **You cannot start until manager approves.**

If rejected: read **Manager note**, **Update & resubmit invoice**.

### Step 3 — Start job

After approval → **Ready to start** → tap **Start job** → **In progress**.

SMS: “Invoice approved — you can now start.”

### Step 4 — Do the work

Complete repairs. Use **Call manager** if needed.

### Step 5 — Mark complete

Tap **Mark job complete** → **Completion pending approval**.

Manager **Approves & resolve** or sends back with note.

If sent back: finish work, **Mark job complete** again.

### Step 6 — Resolved

Moves to **Completed (30d)** tab.

---

## 5. Workflow diagram

```
Assigned
   ↓ submit invoice
Invoice pending → manager approves → Ready to start
                → manager rejects → revise & resubmit
   ↓ Start job
In progress
   ↓ Mark complete
Completion pending → manager resolves → Resolved
                    → manager rejects → back to In progress
```

---

## 6. Invoice form tips

- Currency: **₵** (Ghana Cedis).
- Labour-only invoices are allowed.
- Be specific on materials (“PVC pipe ½ inch”, not “pipes”).
- Submit before large purchases when possible.

---

## 7. Phone number

- Header **Phone** / **Add phone** opens editor.
- Format: `+233 XX XXX XXXX`.
- Used for SMS when assigned and when invoice approved.

---

## 8. What technicians cannot do

| Cannot | Notes |
|--------|-------|
| Start without invoice approval | System enforced |
| See owner phone | Managers only |
| Housekeeping UI | Toasts only |
| Assign jobs | Manager only |
| Approve own invoice | Manager only |
| Billing / GRA / settings | Owner only |

---

## 9. SMS notifications you receive

| Event | Message |
|-------|---------|
| New assignment | Job details + link to tasks |
| Invoice approved | You can start work |

(Managers get alerts when you submit invoice and mark complete.)

---

## 10. Tips

- Read **Manager note** immediately when status is “sent back.”
- Keep phone number current.
- Expand task to see full description before quoting materials.
- After marking complete, wait for manager — don’t leave site if they may send back.
