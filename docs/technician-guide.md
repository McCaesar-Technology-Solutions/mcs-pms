# Technician guide — MOJO Apartments

You work from your **phone**. Two types of work appear on **My tasks** (`/technician/tasks`):

1. **Maintenance complaints** — guest issues (plumbing, AC, etc.).
2. **Housekeeping tasks** — cleaning and inspection (claim from pool or assigned by manager).

---

## 1. Getting started

### Join the team

1. Manager or owner invites you with your **phone number**.
2. Open link `/accept-invite?token=...` (WhatsApp/SMS).
3. Set name, password, confirm phone.
4. Land on **My tasks**.

### First thing

Add or verify **phone** (header button or amber banner). SMS alerts for new jobs and approved invoices require it.

---

## 2. Screen layout

| Element | Purpose |
|---------|---------|
| Your name + specialty | Your profile |
| **Search (⌘K)** | Find tasks by room or category |
| **Phone** / **Add phone** | Contact for SMS |
| **Call manager** | Tap to call/WhatsApp managers (not owner) |
| **Sign out** | Log out |
| **Bottom bar (mobile)** | Switch between **Tasks** and **Messages** |

Use **Messages** for team chat with managers. Guest-facing chat happens inside each job when you message the guest about a repair.

### Live updates

- Task list refreshes when managers change status.
- Toasts: new assignment, invoice approved, job sent back, job closed, new housekeeping task.

---

## Part A — Maintenance complaints

### Tabs

| Tab | Content |
|-----|---------|
| **My tasks** | Active jobs |
| **Completed (30d)** | Recently resolved |

Sorted urgent → high → medium → low.

### Status labels

| Label | What you do |
|-------|-------------|
| Submit invoice | Send cost estimate to manager |
| Invoice pending approval | Wait |
| Invoice sent back | Fix and resubmit |
| Ready to start | Tap **Start job** |
| In progress | On site working |
| Completion pending approval | Wait for manager |
| Resolved | Done |

### Step-by-step

**1. Assigned** — manager picks you; SMS if phone on file.

**2. Submit invoice** (before physical work):

- Materials: name, qty, unit cost (₵) — optional rows.
- Labour cost (₵).
- Note to manager.
- **Submit invoice to manager**.

You **cannot start** until manager approves.

**3. Rejected?** Read **Manager note**, update invoice, resubmit.

**4. Approved** → **Ready to start** → **Start job** → **In progress**.

**5. On site** — call manager or **guest** (call/WhatsApp on expanded card) for access.

**6. Done** → **Mark job complete** → manager approves → **Resolved**.

If manager sends back: finish work, mark complete again.

### Invoice tips

- Be specific (“½ inch PVC elbow”, not “pipes”).
- Labour-only invoices are OK.
- Submit before large purchases when possible.

---

## Part B — Housekeeping tasks

Below maintenance jobs you may see **Housekeeping tasks**.

### Assigned tasks

Tasks with your name — tap **Start**, then **Complete** when finished.

### Claim pool

**Available to claim** — open tasks nobody owns yet:

1. Tap **Claim & start**.
2. Task is yours; complete it like assigned work.

### Task types

| Type | What “done” means |
|------|-------------------|
| **Clean** | Room cleaned after checkout → system sets **Needs inspection** |
| **Inspect** | Manager QA → room becomes **Available** |
| Maintenance | Repair/clean as described |
| Restock | Amenities restocked |

### Clean → inspect rule

When you finish **Clean**, you do **not** set the room Available yourself. An **Inspect** task is created. You or a colleague completes **Inspect** to release the room for sale.

### Who can update?

- **You** — only tasks assigned to you (or that you claimed).
- **Manager** — can override if stuck.

---

## 3. Workflow diagram (maintenance)

```
Assigned
   ↓ submit invoice
Invoice pending → approved → Ready to start
               → rejected → revise
   ↓ Start job
In progress
   ↓ Mark complete
Completion pending → resolved
                    → rejected → back to in progress
```

---

## 4. What technicians cannot do

| Cannot | Notes |
|--------|--------|
| Start without invoice approval | System blocks |
| See owner phone | Managers only |
| Approve own invoice | Manager only |
| Billing / reservations | Not your role |
| Assign complaints to others | Manager only |

---

## 5. SMS you may receive

| Event | Typical message |
|-------|-----------------|
| New complaint assigned | Job summary + link |
| Invoice approved | You may start work |
| New housekeeping task | Room and type |

Keep phone number current in the app.

---

## 6. Daily habits

- Open **My tasks** at shift start.
- Claim unassigned **Clean** tasks after checkouts.
- Expand card and read full description before quoting.
- Read manager notes immediately when status is “sent back.”
- Do not leave site on **Completion pending** until manager confirms or messages you.

---

## 7. Getting unstuck

| Problem | Action |
|---------|--------|
| Cannot start job | Invoice not approved — wait or call manager |
| Wrong room status | Tell manager — they override on HK board |
| Guest not in room | Use guest call/WhatsApp on card |
| No tasks showing | Refresh; confirm manager assigned or check claim pool |
