# Technician guide — MOJO Apartments

You work from your **phone**. Everything lives on two screens:

1. **Tasks** — maintenance complaints + housekeeping.
2. **Messages** — team chat with managers.

Tap **Help** (bottom-right) for the same topics on the screen you are on.

---

## 1. Getting started

### Join the team

1. Manager or owner invites you with your **phone number**.
2. Open `/accept-invite?token=...` (SMS / WhatsApp).
3. Set name, password, confirm phone.
4. Land on **My tasks** (`/technician/tasks`).

### First thing

Add or verify **phone** (header or amber banner). SMS alerts for new jobs need it.

**Password tip:** technicians use phone-based login. Self-serve forgot-password may not work — ask your manager to **re-invite** you if you are locked out.

---

## 2. Screen layout

| Element | Purpose |
|---------|---------|
| Your name + specialty | Profile |
| **Search (⌘K)** | Find tasks by room or category |
| **Phone** / **Add phone** | SMS contact |
| **Call manager** | Call / WhatsApp managers (not owner) |
| **Bottom bar** | **Tasks** ↔ **Messages** |
| **Sign out** | Log out |

### Live updates

- List refreshes when managers change status.
- Toasts: new assignment, job sent back, job closed, new housekeeping task.

---

## 3. Messages

**Path:** `/technician/messages`

- Team chat with managers about staffing and jobs.
- Guest repair chat is **inside each maintenance job**, not in this tab.

---

## 4. Maintenance complaints

### Tabs

| Tab | Content |
|-----|---------|
| **My tasks** | Active jobs |
| **Completed (30d)** | Recently resolved |

Sorted urgent → high → medium → low.

### Status labels

| Label | What you do |
|-------|-------------|
| Ready to start | Tap **Start job** |
| In progress | Working on site |
| Awaiting guest sign-off | Guest must confirm in the portal |
| Completion pending approval | Wait for manager to close |
| Invoice pending (legacy) | Old jobs only — manager must **Release** |
| Sent back for rework | Finish work and mark complete again |
| Resolved | Done |

You can **start as soon as you are assigned**. You do **not** wait for an invoice to be approved.

### Step-by-step

1. **Assigned** — manager picks you; SMS if phone on file.
2. **Start job** when you are on the way or on site.
3. Call manager or **guest** (call / WhatsApp on the card) for access. Honour **Do Not Disturb** if shown.
4. **Message guest** on the job for repair-specific chat.
5. Optional: **schedule a visit** after you agree a time with the guest.
6. Optional: **Submit invoice** (materials + labour) anytime during the job or while waiting for sign-off. This is a cost record — it does not unlock work.
7. **Mark job complete**.
8. If the issue is linked to a guest, they **approve completion** in the portal. Then the manager closes the job → **Resolved**.
9. If completion is sent back — finish work and mark complete again.

### Invoice tips

- Be specific (“½ inch PVC elbow”, not “pipes”).
- Labour-only invoices are OK.
- Submit before large purchases when possible so the manager can see the cost.

### Flow

```
Assigned → Start job → In progress
              ↓ Mark complete
     Guest sign-off (if linked) → Manager closes → Resolved
                         → sent back → In progress
```

---

## 5. Housekeeping tasks

Below maintenance jobs you may see **Housekeeping tasks**.

### Assigned

Tasks with your name — **Start**, then **Complete**.

### Claim pool

**Available to claim** — open tasks nobody owns:

1. **Claim & start**.
2. Complete like assigned work.

### Task types

| Type | Done means |
|------|------------|
| **Clean** | Room cleaned → system sets **Needs inspection** |
| **Inspect** | QA pass → room **Available** |
| Maintenance | Repair/clean as described |
| Restock | Amenities restocked |

### Clean → inspect rule

Finishing **Clean** does **not** make the room Available. An **Inspect** task is created. You or a colleague must complete **Inspect**.

Only you can update tasks assigned to you (or that you claimed). Managers can override if stuck.

---

## 6. What technicians cannot do

| Cannot | Notes |
|--------|--------|
| Approve own completion | Guest (portal) then manager |
| See owner phone | Managers only |
| Reservations / billing / rooms admin | Not your role |
| Assign complaints | Manager only |
| Access control / inventory UI | Not your role |
| Self-serve password reset | Ask for re-invite |

---

## 7. SMS you may receive

| Event | Typical message |
|-------|-----------------|
| New complaint assigned | Job summary + link |
| New housekeeping task | Room and type |

Keep your phone number current in the app.

---

## 8. Daily habits

- Open **My tasks** at shift start.
- Claim unassigned **Clean** tasks after checkouts.
- Read the full description before quoting or starting.
- Read manager notes immediately when status is “sent back.”
- Do not leave site on **Completion pending** until the guest or manager confirms, or messages you.

---

## 9. Getting unstuck

| Problem | Action |
|---------|--------|
| Cannot start job | Should be ready once assigned — refresh or call manager |
| Wrong room status | Tell manager — they override on HK board |
| Guest not in room | Use guest call / WhatsApp on card |
| Waiting on guest sign-off | Ask front desk to remind the guest in the portal |
| No tasks showing | Refresh; check claim pool; ask manager |
| Locked out of login | Ask manager to re-invite you |
