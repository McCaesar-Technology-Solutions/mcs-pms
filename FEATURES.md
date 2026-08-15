# Feature Guide — MOJO APARTMENTS

Staff how-to: [USER_GUIDE.md](USER_GUIDE.md) and the role guides in `docs/`. The **Help** bubble in the app shows the same topics.

## Current application (August 2026)

Production features shipped beyond the original UI prototype. The screen-by-screen notes further down this file are **illustrative**; if they disagree with a role guide, trust the role guide.

### Roles and access

| Role | Sign-in | Scope |
|------|---------|-------|
| **Owner** | `/signup` or login | Guided first-run setup; all properties; billing, refunds, GRA, analytics, payroll, settings |
| **Manager** | Staff invite | One property; daily ops, discounts, stay/ad-hoc billing (no refunds), complaints close, payroll drafts |
| **Receptionist** | Staff invite (email) | One property; front desk, stay payments (must collect when issuing), guest access. No discounts, unpaid invoices, refunds, or complaint close |
| **Technician** | Staff invite (phone) | Assigned maintenance jobs + housekeeping claim pool |
| **Guest** | Portal token (no password) | Stay chat, requests, invoices, issues + completion sign-off |

### Operations

- **Reservations** — create, check-in, check-out, extend, move room, cancel, no-show; **pay-at-check-in** stay invoice created and collected at check-in; checkout reuses that invoice for extras. **Rate types:** nightly, weekly (÷7), monthly (÷30). **Guest discounts** (percent or fixed, pre-tax) — owner/manager only. **Lifecycle v2** (migration `051`): event-sourced status machine, holds, cancellation rules, scheduled jobs. Enable crons per property via **Settings → Reservation lifecycle**.
- **Guests** — directory, walk-in, **register in-house** (go-live with past arrival), portal link + QR + PIN, optional ID (Ghana Card, passport, or driver’s licence; not invoice Tax ID), folio (discount credits owner/manager), PII export; erase is manager+.
- **Rooms** — inventory, categories, nightly/weekly/monthly rates, status grid; owner can delete rooms.
- **Access control (Hikvision)** — optional on-site agent + ISAPI; check-in provisions unit + shared + gym; checkout revokes; Today / Guests / Staff / Attendance / Setup. See [docs/access-control.md](docs/access-control.md).
- **Housekeeping** — kanban (desktop + `/mobile/housekeeping`); auto Clean then Inspect after checkout. Technicians claim from `/technician/tasks`.
- **Complaints** — log → manager assign → technician **starts immediately** → mark complete → **guest sign-off** (if linked) → manager closes. Technician invoices are optional cost records. Owners log + read-only lifecycle at `/owner/complaints`.
- **Staff** — invite managers and receptionists by **email**, technicians by **phone**; WhatsApp invite share; pay profiles for payroll.
- **Billing / GRA / Analytics** — owner Billing (refunds, payment ledger), GRA reports, analytics, night/period audit. Managers issue unpaid/ad-hoc invoices and record payments. Receptionists record stay payments and WhatsApp bills. Optional **Include Ghana tax**; tourism levy default 1%; per-hotel tax rate overrides; taxed invoices stamp Bill-to Tax ID `GHA-728071939-8`. Managers' dashboard hides revenue.
- **Payroll** — owner (full) / manager (draft): pay profiles, pay runs (draft → approve → paid), housekeeping commission, payslip PDF + MoMo/bank CSV.
- **Inventory / expenses** — owner and manager stock movements; owner expenses. Reception has no inventory screen.
- **Guest privacy** — export/erase PII from the staff dashboard.
- **Production ops** — health/ready endpoints; daily Vercel crons + GitHub Actions; notification outbox with retries.

### Notifications and live updates

- **SMS / WhatsApp / Email** — Arkesel or Hubtel SMS; Twilio WhatsApp; Resend email; fails closed in production when unset.
- **In-app bell** — check-outs, complaints, messages; refreshes on realtime events.
- **Realtime** — Supabase Realtime; pages update without manual refresh.
- **In-app Help** — role-specific assistant (`lib/help/topics/`).

### What is incomplete

The app is **production-ready as a custom PMS** for a hotel or portfolio operator (single company deployment). See also [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

#### 1. Payments

- **Manual payments** — staff record cash, MoMo, card, partial pay; owner refunds (done).
- **Online Pay now** — Paystack path exists behind `PAYMENTS_ENABLED` (off unless enabled per deployment).
- **Not a live door-gate:** payment-gated Hikvision provision is deferred.

#### 2. Distribution

- **Airbnb iCal sync** — owner connects per-room Airbnb export calendars; cron imports bookings/blocks; public export URL blocks PMS dates back on Airbnb.
- **Manual channel tagging** — still available for walk-in / direct / other sources.
- **Not in this version:** Airbnb OAuth API partner program, Booking.com sync, full channel manager (Hostaway/Guesty).

#### 3. Optional / future

- **Other OTA calendars** — Booking.com / VRBO iCal (schema supports providers; UI is Airbnb-first).
- **Payroll Phase 2** — Ghana PAYE brackets + SSNIT on basic vs allowances; timesheets/OT; booking & maintenance commissions; employee self-service payslips; dual-approval policy packs.

#### 4. Production hardening (August 2026)

| Area | State |
|------|--------|
| Automated tests | Vitest + Playwright E2E (`npm test`, `npm run test:e2e`) |
| Error monitoring | Sentry via `SENTRY_DSN` (optional envelope reporter) |
| Rate limiting | Auth, guest portal, MFA verify — DB-backed, fail-closed in prod |
| Pagination | Default limit 100 on guests, complaints, billing lists |
| Password reset | Done (not for technicians — re-invite) |
| 2FA | SMS OTP — **mandatory** owner, manager, and receptionist in production |
| Guest sessions | HMAC-signed tokens; `SameSite=Strict`; room + surname entry |
| Privacy / Terms | `/privacy`, `/terms` published |
| Migrations | Through `075` — apply all migrations; see `docs/GO-LIVE.md` |

Realtime updates require an **open browser tab** — not push when the app is closed.

#### 5. Partial features

- **Technician password reset** — technicians sign in with phone + synthetic email; self-serve forgot-password does not apply — re-invite via owner/manager.

#### Recommended build order

Operational pilot is feature-complete for a dedicated deployment. Optional next: Booking.com iCal, online payments enabled in production.

---

## Screen reference (illustrative)

The sections below describe dashboard screens and UI patterns from an earlier prototype. **Live behaviour is in the role guides** ([USER_GUIDE.md](USER_GUIDE.md)). Data is loaded from **Supabase**, not mock files.

## Dashboard

The main hub for property operations, providing at-a-glance insights into business performance and operational status.

### Key Metrics (KPI Cards)
Four prominent cards displaying the most important metrics:

- **Total Revenue**: Cumulative revenue for the selected period with trend indicator (↑/↓ percentage)
- **Occupancy Rate**: Percentage of rooms occupied, crucial for identifying busy periods
- **Average Nightly Rate**: Average price per night, used to monitor pricing strategy
- **Total Bookings**: Number of active reservations

Each card includes:
- Large, bold number (36-42px) for quick scanning
- Colored icon representing the metric
- Trend information showing performance vs. previous period
- Hover effect that lifts the card with subtle gradient overlay

### Room Availability Strip
A 14-day forecast showing occupancy predictions:

- **Visual Timeline**: Horizontal scrollable calendar showing each day
- **Stacked Bar Chart**: Each day shows a vertical bar divided into:
  - Teal (occupied rooms)
  - Light teal (reserved rooms)
  - Red (maintenance)
  - White (available)
- **Occupancy Percentage**: Number shown below each day
- **Interactive**: Click to drill into specific day details

Use this to identify:
- Bottleneck periods when fully booked
- Gaps in occupancy to fill with promotional bookings
- Maintenance windows

### Upcoming Bookings
Next 5 confirmed reservations appearing soon:

- **Guest Name & Status**: Guest name with status badge (green "Checked In" or teal "Confirmed")
- **Room Number**: Quick reference for front desk
- **Date Range**: Check-in to check-out dates in short format
- **Duration**: Number of nights
- **Amount**: Total booking price

Features:
- Click a booking to open full details in a drawer
- Shows only confirmed and checked-in reservations
- Ordered by check-in date (soonest first)

### Task Summary
Housekeeping task overview in 3 columns:

| Column | Purpose |
|--------|---------|
| To Do | Unstarted tasks (shown in amber) |
| In Progress | Active tasks (shown in orange) |
| Done | Completed tasks (shown in green) |

Each column shows:
- Large number of tasks in that status
- Up to 3 task preview cards
- Quick status at a glance

Click "View All" to go to the Housekeeping screen for detailed management.

### Channel Performance
Revenue breakdown by distribution channel:

- **Website**: Direct bookings from your website
- **Airbnb**: Short-term rental platform bookings
- **Booking.com**: Major OTA bookings
- **Walk-in**: Same-day/cash bookings
- **Other**: Phone bookings, referrals

For each channel shows:
- Revenue amount in Ghana Cedi
- Star rating from guests (if applicable)
- Number of bookings
- Percentage of total revenue (via gradient bar)

Use this to:
- Identify best-performing channels
- Decide marketing focus
- Monitor OTA performance

### GRA Tax Compliance
Ghana Revenue Authority tax filing status:

- **Period**: Current tax filing period
- **Total Revenue**: Amount subject to taxation
- **Tax Amount**: Calculated tax owed
- **Tax Rate**: Percentage rate applied (typically 12%)
- **Invoices Issued**: Total invoices generated
- **Invoices Paid**: Number of collected payments
- **Status**: Filing status (Pending, Submitted, Approved)

Yellow indicator shows:
- "Submitted - Submitted to GRA for processing" when filed
- Helps ensure compliance with tax deadlines

---

## Housekeeping

Dedicated screen for managing room cleaning and maintenance operations.

### Kanban Board
Tasks organized by workflow status:

**Three Columns:**

1. **To Do**
   - Unstarted tasks in amber
   - Tasks ready to be assigned
   - Click a task card to expand and assign

2. **In Progress**
   - Currently active tasks
   - Shows assigned staff member
   - Display time elapsed since started

3. **Done**
   - Completed tasks with checkmark
   - Faded appearance (60% opacity)
   - Historical record of completed work

**Task Card Contents:**
- Room number (e.g., "Suite A")
- Task type badge (Clean, Inspect, Restock, Maintenance)
- Assigned staff name
- Priority color (red border for urgent)
- Manager note/context
- Action buttons (Mark In Progress, Mark Done, etc.)

### Room Status Grid
Visual matrix showing all rooms at a glance:

- **Grid Layout**: Rooms arranged in 4x4+ grid
- **Color Coding**:
  - Green: Clean and available
  - Blue: Currently occupied
  - Yellow: Reserved (arriving soon)
  - Red: Maintenance required
  - Gray: Out of service

Features:
- **Click Room**: View occupancy details, last cleaning, next maintenance
- **Quick Actions**: Mark as clean, schedule maintenance, assign staff
- **Status Icons**: Indicator for last service date

### Staff Availability
Track housekeeping team members:

- **Staff Name**: Team member
- **Status**: Available, Busy, Off-shift
- **Assigned Tasks**: Number of tasks currently assigned
- **Shift Time**: Current shift hours
- **Last Activity**: When last marked active

Use to:
- Check staff capacity before assigning tasks
- Identify staffing gaps
- Plan overtime needs

---

## Reservations

Comprehensive view of all guest bookings with timeline and details.

### Occupancy Gantt Timeline
30-day visual timeline showing which rooms are booked:

- **Horizontal Timeline**: Days across the top (30-day view)
- **Room Rows**: Each room/suite as a row
- **Color-Coded Bars**: Each booking shown as colored bar by source:
  - Teal: Website bookings
  - Blue: Airbnb bookings
  - Purple: Booking.com bookings
  - Orange: Walk-in/cash bookings
- **Gaps**: Empty spaces show available nights for sale

Features:
- Identify double-bookings at a glance
- See occupancy patterns
- Spot availability windows
- Click bar to see booking details

### Reservations Table
Detailed list of all bookings:

| Column | Information |
|--------|-------------|
| Guest | Name with contact option |
| Room | Room number |
| Dates | Check-in → Check-out dates |
| Status | Badge (Confirmed, Checked In, Checked Out, Pending) |
| Source | Where booking originated |
| Amount | Total booking price |
| Action | View details button |

Features:
- **Zebra Striping**: Alternating white/light gray rows for readability
- **Sort**: Click headers to sort (name, dates, amount, etc.)
- **Search**: Search by guest name or room number
- **Filter**: Filter by status or source
- **Click Row**: Opens booking detail drawer

### Booking Details Drawer
Full information about a specific booking:

- **Guest Profile**: Name, email, phone, country
- **Booking Info**: Room, dates, number of nights
- **Pricing**: Nightly rate, subtotal, tax, total amount
- **Status**: Current booking status
- **Channel**: Where booking came from
- **Actions**: Check in, check out, cancel, send reminder
- **Notes**: Special requests or notes from guest
- **History**: Previous stays with this guest

---

## Guests

Complete guest database and relationship management.

### Guest Directory
Searchable list of all guests:

- **Search Bar**: Find guests by name, email, or phone
- **Filter Tabs**: View by guest type:
  - All: Complete guest list
  - VIP: Preferred/high-value guests
  - Returning: Guests with previous stays
  - New: First-time guests
  - Blacklist: Problematic guests (do not rent)

### Guest Table
Detailed guest information:

| Column | Details |
|--------|---------|
| Name | Guest full name |
| Email | Contact email |
| Phone | Mobile number |
| Country | Nationality |
| Stays | Total number of previous visits |
| Status | VIP/Returning/New/Blacklist |
| Last Visit | Date of most recent stay |
| Total Spent | Cumulative spending |

Features:
- **Sort**: Sort by any column
- **Search**: Real-time filtering
- **Click Guest**: Open full profile drawer

### Guest Profile Drawer
Detailed guest information and history:

- **Personal Info**: Name, contact, nationality
- **Stay History**: List of all previous bookings
  - Dates, room, amount, status
  - Average rating if applicable
- **Preferences**: Room type preferences, dietary restrictions, special requests
- **Communication**: Email/SMS preferences
- **Notes**: Notes from previous interactions
- **Actions**: Create new booking, send message, flag issue

---

## Billing & Invoices

Financial management and revenue tracking.

### Billing Overview KPIs
Four key metrics:

- **Total Revenue**: Sum of all invoices
- **Invoiced Amount**: Money owed by guests
- **Collected Amount**: Actual payments received
- **Collection Rate**: Percentage of invoiced amount collected (as progress bar)

### Invoice Management
Track all guest invoices:

| Column | Information |
|--------|-------------|
| Booking Ref | Reference number for booking |
| Guest | Guest name |
| Amount | Invoice total |
| Tax | Tax applied |
| Status | Paid/Pending/Overdue |
| Due Date | Payment deadline |
| Issue Date | When invoice was created |

Features:
- **Status Badges**: Color-coded (green paid, amber pending, red overdue)
- **Filter**: View by status
- **Generate Invoice**: Create new invoice from booking
- **Send**: Email invoice to guest
- **Mark Paid**: Record payment reception
- **View PDF**: Download invoice copy

### Invoice Details
When viewing an invoice:

- **Booking Information**: Guest, room, dates, nights
- **Itemization**: 
  - Room charges (nightly rate × nights)
  - Additional fees (cleaning, damages, etc.)
  - Subtotal
  - Tax calculation
  - Total amount due
- **Payment Terms**: Due date, payment methods accepted
- **Payment Status**: Paid, pending, overdue
- **Actions**: Send reminder, mark paid, refund, cancel

---

## Channels

**Airbnb iCal sync (shipped).** Owners connect calendars under **Settings → Channels**.

| Direction | Behavior |
|-----------|----------|
| Import | Poll Airbnb export ICS (~every 5 min + Sync now). Creates/updates/cancels `confirmed` reservations with `channel=airbnb`, keyed by `ical_uid`. |
| Export | Public token URL `/api/ical/{token}.ics` for Airbnb **Import calendar**. Excludes events already imported from that room’s Airbnb feed (no echo loop). |

Limits: iCal does not include guest phone, ID, or payout amounts. Staff still check guests in; use **Channel prepaid** when Airbnb already paid you. Direct Airbnb API / Booking.com sync are not built.

For reporting, use **Analytics** and filter by channel on the owner dashboard.

---

## Analytics (reference)

Performance metrics and business intelligence.

### Performance Metrics KPIs
Quick summary:

- **Revenue This Month**: Total revenue to date
- **Bookings This Month**: Number of bookings received
- **Average Occupancy**: Current month's average
- **Average Guest Rating**: Guest satisfaction score

### Weekly Bookings Chart
Line chart showing booking volume:

- **X-Axis**: Days of the week or weeks of the month
- **Y-Axis**: Number of bookings
- **Line Graph**: Shows trends and patterns
- **Hover**: See exact numbers for each period

Use to:
- Identify busy vs. slow periods
- Plan staffing
- Predict revenue
- Adjust pricing

### Revenue Breakdown
Pie or donut chart showing revenue sources:

- **Website**: Direct bookings
- **Airbnb**: Platform revenue
- **Booking.com**: Platform revenue
- **Walk-in**: Cash/local bookings
- **Other**: Phone, referrals, etc.

Hover to see percentages and amounts.

### Guest Rating Trends
Average guest rating over time:

- **Overall Score**: Average across all guests
- **By Channel**: Separate ratings for each platform
- **Recent vs. Historical**: Compare current ratings to previous periods
- **Category Ratings**: 
  - Cleanliness
  - Comfort
  - Location
  - Value for money
  - Overall satisfaction

---

## GRA Tax Reports

Ghana Revenue Authority compliance and tax management.

### Tax Compliance Dashboard
Current tax status:

- **Period**: Current tax filing period (e.g., "June 2024")
- **Total Revenue**: Amount subject to taxation
- **Tax Amount**: Amount owed to GRA
- **Tax Rate**: Percentage applied
- **Invoices Issued**: Number of invoices created
- **Invoices Paid**: Number paid by guests
- **Filing Status**: Pending/Submitted/Approved

### Filing Timeline & Deadlines
Important dates for tax compliance:

| Period | Deadline | Status |
|--------|----------|--------|
| January 2024 | Jan 30 | Approved ✓ |
| February 2024 | Feb 28 | Submitted |
| March 2024 | Mar 31 | Pending |
| April 2024 | Apr 30 | Upcoming |

Features:
- **Color Coding**: Red for overdue, yellow for due soon, green for compliant
- **Reminders**: System alerts before deadline
- **Download**: Export reports for manual filing
- **Compliance Status**: Shows overall compliance level

### Tax Reports
Generate and download reports:

- **Monthly Report**: Revenue and tax for each month
- **Quarterly Report**: 3-month consolidated view
- **Annual Summary**: Full year summary
- **Guest Summary**: Breakdown by booking source
- **Payment Status**: Collection rates

Reports include:
- Total revenue
- Tax calculation detail
- Collected vs. outstanding
- Guest breakdown
- Channel breakdown
- Detailed invoice listing

---

## Bookings

Create, manage, and process guest bookings.

### Booking Overview
Summary of all bookings:

- **Upcoming**: Bookings with future check-ins (count)
- **Checked-In**: Currently occupied rooms (count)
- **Checked-Out**: Today's departures (count)
- **Collection Rate**: Percentage of invoice payments received

### Booking List
All bookings with quick actions:

| Column | Information |
|--------|-------------|
| Guest | Guest name |
| Room | Room number |
| Dates | Check-in → Check-out |
| Status | Upcoming/Checked-In/Checked-Out |
| Amount | Total price |
| Actions | Check-in/out buttons |

### Create New Booking
Form to create booking manually:

Fields:
- **Guest**: Select existing guest or create new
- **Room**: Select available room
- **Check-in**: Date picker
- **Check-out**: Date picker
- **Nightly Rate**: Price per night
- **Special Requests**: Notes
- **Booking Source**: Website, Walk-in, Phone, etc.
- **Payment Method**: Cash, Card, Online, etc.
- **Advance Payment**: Amount paid upfront

### Quick Actions
For each booking:

- **Check-in**: Mark guest as arrived
  - Confirm room cleanliness
  - Provide keys/access
  - Note any damage
- **Check-out**: Process departure
  - Inspect room
  - Calculate final amount
  - Collect outstanding balance
- **Send Reminder**: Email reminder before check-in
- **Modify**: Change dates, room, or guest
- **Cancel**: Cancel and handle refund

---

## Settings & Configuration

Configure system, properties, team, and integrations.

### Property Information
Configure core property details:

- **Property Name**: Display name
- **Address**: Full street address for invoices
- **Phone Number**: Main contact number
- **Email**: Admin email
- **Website**: Property website URL
- **Currency**: Ghana Cedi (GHS)
- **Language**: English (default for Ghana)

### Team Management
Manage staff members:

- **Add Staff**: Create new staff accounts
- **Roles**:
  - Admin: Full access
  - Manager: Property management access
  - Staff: Limited operational access
  - Housekeeping: Task and room access only
  
- **View Staff**: List all team members
  - Name, role, email, phone
  - Status (active/inactive)
  - Last login

- **Edit/Remove**: Update or deactivate staff accounts

### Notification Settings
Configure alerts:

- **Email Notifications**: Turn on/off email alerts
- **SMS Notifications**: Configure SMS (requires provider)
- **Alert Types**:
  - Booking received
  - Guest check-in reminder
  - Task assigned
  - Low availability
  - Payment received
  - Overdue invoice
  - System alerts

### API & Integrations
Manage third-party connections:

- **API Keys**: Generate and manage API keys for developers
- **Webhooks**: Configure webhooks for events
- **Connected Services**: List of integrated platforms
  - Airbnb: Connection status, last sync
  - Booking.com: Connection status, credentials
  - Payment Processors: Stripe account status
  - Email Service: Email provider configuration

### Security
Security and access control:

- **Password Policy**: Minimum requirements
- **Two-Factor Authentication**: Enable 2FA for staff
- **Session Timeout**: Auto-logout duration
- **Data Backup**: Backup schedule and status
- **Access Logs**: View login history

---

## Mobile Housekeeping App

Optimized PWA for field staff task management.

### Task List
Tasks assigned to current user:

- **To Do**: Unstarted tasks (sorted by priority/time)
- **In Progress**: Currently working on tasks
- **Done**: Completed tasks (faded out)

**Task Card Shows:**
- Room number (large, easy to read)
- Task type (Clean, Inspect, Restock, Maintenance)
- Priority color indicator
- Manager note with context
- Time allocated

### Task Details
Expand task to see:

- **Room Info**: Room type, last guest, occupancy status
- **Task Details**: Type, priority, description
- **Notes**: Manager-added context
- **Photo Uploads**: Capture before/after photos
- **Voice Notes**: Record audio notes
- **Mark Complete**: Button to mark task done
- **Timestamp**: Automatic time tracking

### Photo & Voice Capture
Capture task completion evidence:

- **Camera**: Take photos showing room status/work completed
- **Voice Note**: Record audio description of work done
- **Gallery**: View previously captured media
- **Auto-Upload**: When online, automatically sync to server

### Status Management
Update task progression:

**Buttons:**
- **Start Task** (To Do → In Progress): Begin work
- **Complete Task** (In Progress → Done): Mark finished
- **Issue/Problem**: Flag task issue for manager
- **Cancel**: Cancel task (if wrong assignment)

**Progress Tracking:**
- Progress bar showing overall work completion
- Time spent on current task
- Tasks completed today (count)

---

**Feature Guide Version**: 1.1.0
**Last Updated**: August 2026
