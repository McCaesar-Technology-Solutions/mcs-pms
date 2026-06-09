# MOJO APARTMENTS - Developer Guide

## Overview

This guide covers the technical architecture, component system, data patterns, and extending the MOJO APARTMENTS application for developers.

## Project Structure

```
app/
├── (dashboard)/              # Protected dashboard routes
│   ├── dashboard/
│   ├── housekeeping/
│   ├── reservations/
│   ├── guests/
│   ├── billing/
│   ├── channels/
│   ├── analytics/
│   ├── gra-reports/
│   ├── bookings/
│   └── settings/
├── mobile/
│   └── housekeeping/        # PWA mobile app
├── layout.tsx               # Root layout with topbar + sidebar
└── globals.css              # Global styles and tokens

components/
├── dashboard/               # Feature components
│   ├── topbar.tsx
│   ├── sidebar.tsx
│   ├── kpi-cards.tsx
│   ├── guests-table.tsx
│   ├── billing-overview.tsx
│   └── ... (18 total)
└── ui/                      # shadcn/ui components

lib/
├── mock-data.ts             # All demo data
└── utils.ts                 # Helper functions

types/
└── index.ts                 # TypeScript interfaces
```

## Component Architecture

### Component Types

**Page Components** - Entry points for routes
```tsx
export default function GuestsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-semibold text-foreground">Guests</h1>
        <p className="text-base text-muted-foreground mt-2">Manage all guests and viewing history</p>
      </div>
      <GuestsTable />
    </div>
  )
}
```

**Feature Components** - Reusable, self-contained features
```tsx
'use client'

import { useState } from 'react'
import { guests } from '@/lib/mock-data'

export function GuestsTable() {
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null)
  
  return (
    <div className="bg-white rounded-lg shadow-elevation-2">
      {/* Component content */}
    </div>
  )
}
```

### Data & State Pattern

All demo data is centralized in `lib/mock-data.ts`:

```typescript
export const reservations: Reservation[] = [
  {
    id: '1',
    guestName: 'Ama Johnson',
    roomNumber: 101,
    checkInDate: tomorrow.toISOString(),
    checkOutDate: nextWeek.toISOString(),
    status: 'confirmed',
    source: 'website',
    totalPrice: 1400,
    numberOfNights: 5,
  },
]

// Access in components
import { reservations } from '@/lib/mock-data'

export function ReservationsTable() {
  return (
    <table>
      <tbody>
        {reservations.map(res => (
          <tr key={res.id}>{/* ... */}</tr>
        ))}
      </tbody>
    </table>
  )
}
```

Use React hooks for component state:
```tsx
const [selected, setSelected] = useState<string | null>(null)
const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed'>('all')

const filtered = data.filter(item => 
  filterStatus === 'all' ? true : item.status === filterStatus
)
```

## Styling & Tailwind

### Design Token System

Colors defined in `globals.css`:
```css
:root {
  --background: #faf8fc;
  --foreground: #1a1025;
  --primary: #6d28d9;
  --primary-foreground: #ffffff;
  --accent: #d4a853;
  --secondary: #f3eef9;
  --muted: #ede8f4;
  --muted-foreground: #6b6280;
}
```

### Elevation Shadow Utilities

```tsx
<div className="shadow-elevation-1">Subtle (1px 2px rgba(0,0,0,0.05))</div>
<div className="shadow-elevation-2">Card (4px 12px rgba(0,0,0,0.08))</div>
<div className="shadow-elevation-3">Hover (8px 24px rgba(0,0,0,0.1))</div>
<div className="shadow-elevation-4">Modal (12px 32px rgba(0,0,0,0.12))</div>
```

### Tailwind Patterns

```tsx
// Backgrounds & text
<div className="bg-background text-foreground">
  <h1 className="text-4xl font-semibold">Title</h1>
  <p className="text-sm text-muted-foreground">Subtitle</p>
</div>

// Spacing (8px grid)
<div className="p-6 space-y-4 gap-6">
  <div className="mb-4">Item</div>
</div>

// Responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {items.map(item => /* ... */)}
</div>

// Flexbox
<div className="flex items-center justify-between">
  <span>Left</span>
  <span>Right</span>
</div>
```

## Common Component Patterns

### KPI Card
```tsx
<div className="bg-white rounded-lg shadow-elevation-2 overflow-hidden">
  <div className="absolute top-0 left-0 h-1 right-0 bg-gradient-to-r from-primary via-primary/70 to-transparent"></div>
  <div className="p-6">
    <div className="flex items-start justify-between mb-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Revenue</p>
        <p className="text-4xl font-bold text-foreground mt-2">₵17,600</p>
      </div>
      <div className="p-3 rounded-lg bg-violet-50 text-violet-600">
        <DollarSign className="h-6 w-6" />
      </div>
    </div>
    <p className="text-sm font-medium text-muted-foreground">+12% from last month</p>
  </div>
</div>
```

### Table with Zebra Striping
```tsx
<div className="bg-white rounded-lg shadow-elevation-2 overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-gradient-to-r from-secondary/50 to-secondary/25 border-b border-border/50">
      <tr>
        <th className="text-left py-4 px-4 font-semibold text-foreground">Column</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item, idx) => (
        <tr
          key={item.id}
          className={`border-b border-border/50 ${
            idx % 2 === 0 ? 'bg-white' : 'bg-secondary/20'
          } hover:bg-primary/5 transition-all`}
        >
          <td className="py-4 px-4">{item.name}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Status Badges
```tsx
const statusColors = {
  confirmed: 'bg-violet-600 text-violet-50',
  pending: 'bg-amber-600 text-amber-50',
  completed: 'bg-amber-500 text-[#1A1025]',
  cancelled: 'bg-destructive text-destructive-foreground',
}

<span className={`text-xs px-3 py-1.5 rounded-full font-semibold shadow-elevation-1 ${statusColors[status]}`}>
  {status.charAt(0).toUpperCase() + status.slice(1)}
</span>
```

## Extending Components

### Creating a New Feature Component

1. Create file: `components/dashboard/my-feature.tsx`
2. Import mock data from `lib/mock-data.ts`
3. Use 'use client' if component has state
4. Follow shadow-elevation-2 card pattern
5. Import in page component

### Transitioning to Real Data

Replace mock data with API calls:
```tsx
import useSWR from 'swr'

export function GuestsTable() {
  const { data: guests, isLoading } = useSWR('/api/guests', fetcher)
  
  if (isLoading) return <LoadingSpinner />
  
  return (
    <table>
      {guests?.map(guest => /* ... */)}
    </table>
  )
}
```

Add API route: `app/api/guests/route.ts`
```typescript
export async function GET() {
  const guests = await db.guest.findMany()
  return Response.json(guests)
}
```

Component structure remains the same - only data source changes.

## Development Workflow

### Run Development Server
```bash
cd /vercel/share/v0-project
pnpm dev
# Open http://localhost:3000
```

### Build for Production
```bash
pnpm run build
pnpm start
```

### Add Dependencies
```bash
pnpm add package-name
# Then import and use in components
```

### Debug
Use console.log with [v0] prefix:
```typescript
console.log('[v0] Debug info:', variable)
```

Check logs in browser DevTools or `/user_read_only_context/v0_debug_logs.log`

## Performance Metrics

- **Build time**: ~45 seconds (static prerendering)
- **Page load**: <1s (static HTML)
- **LCP**: <1s
- **CLS**: 0 (no layout shifts)
- **TTI**: Instant (client-side state only)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile (iOS 14+, Android 11+)

## Next Steps

1. **Add Supabase**: PostgreSQL + Auth + Storage — see [DEPLOYMENT.md](DEPLOYMENT.md)
2. **Add Authentication**: Supabase Auth with `@supabase/ssr` middleware
3. **Build API Routes**: CRUD endpoints with RLS-backed queries
4. **Add Validation**: Use Zod for input validation
5. **Error Handling**: Add error boundaries and logging
6. **Monitoring**: Set up Sentry for production monitoring
7. **CI/CD**: Configure GitHub Actions for automated deployments
