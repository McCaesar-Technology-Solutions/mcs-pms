# Technician guide — MOJO Apartments

You work from your **phone**. Everything lives on two screens:

1. **Tasks** — maintenance complaints + housekeeping.
2. **Messages** — team chat with managers.

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
- Toasts: new assignment, invoice approved, job sent back, job closed, new housekeeping task.

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
| Submit invoice | Send cost estimate |
| Invoice pending approval | Wait |
| Invoice sent back | Fix and resubmit |
| Ready to start | Tap **Start job** |
| In progress | Working on site |
| Completion pending approval | Wait for manager |
| Resolved | Done |

### Step-by-step

1. **Assigned** — manager picks you; SMS if phone on file.
2. **Submit invoice** (before physical work):
   - Materials: name, qty, unit cost (₵) — optional rows.
   - Labour cost (₵).
   - Note to manager.
   - **Submit invoice to manager**.
3. You **cannot start** until manager approves.
4. If **rejected** — read manager note, update, resubmit.
5. **Approved** → **Ready to start** → **Start job**.
6. On site — call manager or **guest** (call / WhatsApp on the card) for access.
7. **Message guest** on the job for repair-specific chat.
8. **Mark job complete** → manager approves → **Resolved**.
9. If completion is sent back — finish work and mark complete again.

### Invoice tips

- Be specific (“½ inch PVC elbow”, not “pipes”).
- Labour-only invoices are OK.
- Submit before large purchases when possible.

### Flow

```
Assigned → Submit invoice → Pending
                ↓ approved          ↓ rejected
         Ready to start ←—— revise & resubmit
                ↓ Start job
           In progress
                ↓ Mark complete
      Completion pending → Resolved
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
| Start without invoice approval | System blocks |
| Approve own invoice | Manager only |
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
| Invoice approved | You may start work |
| New housekeeping task | Room and type |

Keep your phone number current in the app.

---

## 8. Daily habits

- Open **My tasks** at shift start.
- Claim unassigned **Clean** tasks after checkouts.
- Read the full description before quoting.
- Read manager notes immediately when status is “sent back.”
- Do not leave site on **Completion pending** until manager confirms or messages you.

---

## 9. Getting unstuck

| Problem | Action |
|---------|--------|
| Cannot start job | Invoice not approved — wait or call manager |
| Wrong room status | Tell manager — they override on HK board |
| Guest not in room | Use guest call / WhatsApp on card |
| No tasks showing | Refresh; check claim pool; ask manager |
| Locked out of login | Ask manager to re-invite you |
