# Feature Guide — MOJO APARTMENTS

## Current application (2026)

Production features shipped beyond the original UI prototype.

### Roles and access

| Role | Sign-in | Scope |
|------|---------|-------|
| **Owner** | `/signup` or login | Guided first-run setup; all properties in portfolio; billing, GRA, analytics, settings |
| **Manager** | Staff invite | One property; daily ops, complaints, housekeeping |
| **Receptionist** | Staff invite (email) | One property; front desk — bookings, check-in/out, room status, log complaints. No revenue/billing/prices/approvals |
| **Technician** | Staff invite | Assigned maintenance jobs only |
| **Guest** | Portal token (no password) | Submit/track complaints for current stay |

### Operations

- **Reservations** — create, check-in, check-out, extend, move room, cancel, no-show; GRA invoice on checkout. **Lifecycle v2** (migration `051`): event-sourced status machine (`inquiry` → `provisional` → `confirmed` → `pre_arrival` → `checked_in` → `checkout_in_progress` → `checked_out` → `post_stay` → `archived`), append-only `reservation_events`, provisional holds, cancellation rules engine, and scheduled jobs (hold expiry, pre-arrival, no-show, overstay, auto-checkout prompt, archive). Enable crons per property via **Settings → Reservation lifecycle → Enable lifecycle v2**.
- **Guests** — directory, walk-in check-in (manager), portal link + QR, phone editing.
- **Rooms** — inventory, categories/rates, status grid; owner can delete rooms.
- **Housekeeping** — kanban (desktop + `/mobile/housekeeping`); auto clean task on checkout.
- **Complaints** — guest submit (or staff log on a guest's behalf) → manager assign → technician invoice → manager approve → work → completion approval → resolved. Owners get a **read-only** lifecycle view at `/owner/complaints`; assigned technicians can call/WhatsApp the guest.
- **Staff** — invite managers and receptionists by **email**, technicians by **phone**; phone numbers editable on profiles.
- **Billing / GRA / Analytics** — owner only; invoice numbering, PDF export, tax reports, manual payments (cash/MoMo/card), partial payments and refunds, payment ledger reconciliation, guest folio posting with checkout rollup, night audit. Managers' dashboard hides revenue metrics.
- **Guest privacy** — owner export/erase PII from the staff dashboard.
- **Production ops** — health/ready endpoints, Vercel cron (cleanup, notifications, reservation lifecycle jobs when v2 enabled), notification outbox with retries.

### Notifications and live updates

- **SMS / WhatsApp / Email** — Arkesel or Hubtel SMS; Resend email; fails closed in production when unset.
- **In-app bell** — check-outs, complaints; refreshes on realtime events.
- **Realtime** — Supabase Realtime (migration `015`); pages update without manual refresh; toast alerts for new complaints, pending approvals, assignments.

### What is incomplete

The app is **production-ready as a custom PMS** for a hotel or portfolio operator (single company deployment). See also [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

#### 1. Payments

- **Manual payments** — staff record cash, MoMo, card, partial pay, and refunds from billing (done).
- **Partial payments & refunds** — staff record partial cash/card payments, full pay, and refunds from billing overview (done).
- **Not in this version:** Paystack, Hubtel Pay, or other online checkout.

#### 2. Distribution

- **Manual channel tagging** — managers create reservations and pick source (Airbnb, Booking.com, walk-in, direct, other) for reporting.
- **Not in this version:** OTA iCal sync, Airbnb OAuth, channel manager, automatic calendar import/export.

#### 3. Optional / future

- **OTA calendar sync** — iCal import/export (not built).
- **Online payments** — Paystack or Hubtel Pay (not built).

#### 4. Production hardening (June 2026)

| Area | State |
|------|--------|
| Automated tests | Vitest — 270+ unit/integration tests (`npm test`) |
| Error monitoring | Sentry via `SENTRY_DSN` (optional envelope reporter) |
| Rate limiting | Auth, guest portal, MFA verify — DB-backed, fail-closed in prod |
| Pagination | Default limit 100 on guests, complaints, billing lists |
| Password reset | Done |
| 2FA | SMS OTP — **mandatory** owner + manager in production |
| Guest sessions | HMAC-signed tokens; room + surname entry |
| Privacy / Terms | `/privacy`, `/terms` published |
| Migrations | Through `051` — apply all migrations; see `docs/GO-LIVE.md` |

Realtime updates require an **open browser tab** — not push when the app is closed.

#### 5. Partial features

- **Technician housekeeping** — toast alerts only; no HK screen on `/technician/tasks`.

#### Recommended build order

Operational pilot is feature-complete for a dedicated deployment. Optional next: OTA calendar sync, online payments (Paystack/Hubtel).

---

## Screen reference

The sections below describe dashboard screens and UI patterns. Data is loaded from **Supabase**, not mock files.

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

> **Not implemented in the current version.** Reservations support manual **channel tagging** (Airbnb, Booking.com, walk-in, direct, other) when staff create bookings. There is no channel manager UI, iCal import/export, or OTA API integration. Database schema for future iCal feeds exists (`channel_ical_feeds` in migration `040`) but has no application code yet.

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

**Feature Guide Version**: 1.0.0
**Last Updated**: June 2026
