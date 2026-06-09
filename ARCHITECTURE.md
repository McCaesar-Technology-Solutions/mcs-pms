# MOJO APARTMENTS - Architecture & Decisions

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                           │
│              (Desktop, Tablet, Mobile)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                  Vercel CDN & Edge                          │
│          (Global distribution, caching)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Next.js 16 Application                         │
│    ┌─────────────────────────────────────────┐             │
│    │  Static HTML (11 prerendered routes)    │             │
│    │  - Dashboard                            │             │
│    │  - Housekeeping                         │             │
│    │  - Reservations                         │             │
│    │  - Guests, Billing, Channels, etc.     │             │
│    └─────────────────────────────────────────┘             │
│    ┌─────────────────────────────────────────┐             │
│    │  Client-Side React (Interactive)        │             │
│    │  - State management (hooks)             │             │
│    │  - Forms & interactions                 │             │
│    │  - Real-time updates                    │             │
│    └─────────────────────────────────────────┘             │
│    ┌─────────────────────────────────────────┐             │
│    │  API Routes (to be implemented)         │             │
│    │  - /api/guests                          │             │
│    │  - /api/bookings                        │             │
│    │  - /api/billing                         │             │
│    └─────────────────────────────────────────┘             │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Supabase   │  │  Supabase    │  │  External    │
│  PostgreSQL  │  │  Auth +      │  │  Services    │
│  + Storage   │  │  Storage     │  │ (Paystack,   │
│  + RLS       │  │              │  │  OTA, etc.)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Technology Stack

### Frontend Layer

**Framework:** Next.js 16 with React 19
- App Router for file-based routing
- Server Components for data fetching
- Client Components for interactivity
- Automatic code splitting per route

**Styling:** Tailwind CSS v4
- Utility-first CSS framework
- Custom design tokens via CSS variables
- 8px spacing grid system
- 4-level elevation shadow system
- Responsive breakpoints (mobile-first)

**Components:** shadcn/ui + custom
- Accessible UI components
- Lucide React for icons
- Custom design system patterns
- Consistent styling across app

**State Management:** React Hooks
- useState for component state
- useEffect for side effects
- Custom hooks for reusable logic
- Context API for global state (optional)

**Data Fetching:** SWR (to be implemented)
- Client-side data fetching with caching
- Automatic revalidation
- Built-in error handling
- Perfect for real-time updates

### Backend Layer (To Be Implemented)

**Platform:** [Supabase](https://supabase.com)
- PostgreSQL database with SQL migrations (`supabase/migrations/`)
- Supabase Auth — staff, admin, and guest portal users
- Supabase Storage — guest documents, property photos, invoice PDFs
- Row Level Security (RLS) — multi-tenant isolation by `organization_id` / `property_id`

**Client libraries:**
- `@supabase/supabase-js` — database, auth, storage
- `@supabase/ssr` — cookie-based sessions in Next.js App Router

**API Framework:** Next.js Route Handlers
- Server-side Supabase client for privileged operations
- Zod validation on request bodies
- RLS as the primary tenant boundary; API routes enforce role checks for staff actions

### Deployment

**Hosting:** Vercel
- Automatic deployments from GitHub
- Global CDN distribution
- Edge functions support
- Environment variable management
- Performance monitoring

## Key Architectural Decisions

### 1. Static Site Generation

**Decision:** Prerender all 11 dashboard routes at build time

**Rationale:**
- Fast page loads (< 1s) for end users
- Reduced server load
- Better SEO
- Works great for demo/MVP
- Easy to transition to dynamic content

**Implementation:**
```typescript
// Routes are automatically prerendered by Next.js
// No getStaticProps needed - works by default
```

### 2. Mock Data Centralization

**Decision:** All demo data in `lib/mock-data.ts`

**Rationale:**
- Single source of truth
- Easy to update all data at once
- Clear separation from components
- Simple to replace with API calls
- Reduces component complexity

**Implementation:**
```typescript
// lib/mock-data.ts
export const reservations: Reservation[] = [...]
export const guests: Guest[] = [...]
export const tasks: Task[] = [...]

// components/reservations-table.tsx
import { reservations } from '@/lib/mock-data'
```

### 3. Component-First Architecture

**Decision:** Break UI into small, reusable components

**Rationale:**
- Easier to maintain and test
- Reusable across pages
- Clear separation of concerns
- Better code organization
- Scales well as app grows

**Structure:**
```
Page Component (route handler)
  ├─ Feature Component (dashboard/reservations-table.tsx)
  │  ├─ Smaller Components (status badge, action buttons)
  │  └─ State management (useState, custom hooks)
  └─ Another Feature Component
```

### 4. Client-Side State Only

**Decision:** Use React hooks instead of external state management

**Rationale:**
- Simpler setup for MVP
- Faster development
- No Redux/Zustand complexity
- Easy to add Context later if needed
- Works great for component-scoped state

**When to upgrade:**
- Add Context API for global theme/auth
- Add Redux/Zustand if state becomes complex
- Add Jotai for distributed atom-based state

### 5. Design Token System

**Decision:** Use CSS variables for all colors and spacing

**Rationale:**
- Easy to change brand colors globally
- Support for light/dark mode
- No build step needed for theme changes
- Works with Tailwind CSS seamlessly
- Accessible naming conventions

**Variables:**
```css
--primary: #6d28d9
--accent: #d4a62e
--background: #faf8fc
--card: #ffffff
--sidebar: #2e1065
--shadow-elevation-2: 0 4px 12px rgba(26, 11, 46, 0.08)
```

### 6. Responsive Mobile-First

**Decision:** Design mobile first, enhance for desktop

**Rationale:**
- Mobile is primary interface (PWA housekeeping app)
- Progressive enhancement works better
- Better performance on mobile devices
- Desktop views are natural enhancement

**Breakpoints:**
```
Mobile: 375px (iPhone)
Tablet: 768px (iPad)
Desktop: 1024px (wide screens)
4K: 1920px+ (monitors)
```

### 7. Feature Flags in Sidebar

**Decision:** All 11 pages in main sidebar navigation

**Rationale:**
- Easy access to all features
- Clear visual hierarchy
- Scales well to 15-20 pages
- Mobile sidebar collapses to icons

**Future scalability:**
- Implement feature flags for beta features
- User role-based access control
- Customizable sidebar per role

## Data Models

### Core Entities

```typescript
interface Reservation {
  id: string
  guestName: string
  roomNumber: number
  checkInDate: string (ISO 8601)
  checkOutDate: string
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out'
  source: 'website' | 'airbnb' | 'booking' | 'walk_in'
  totalPrice: number
  numberOfNights: number
}

interface Guest {
  id: string
  name: string
  email: string
  phone: string
  address: string
  status: 'active' | 'past' | 'blocked'
  membershipLevel: 'standard' | 'vip' | 'corporate'
  totalStays: number
  totalSpent: number
}

interface Task {
  id: string
  roomNumber: number
  taskType: 'clean' | 'inspect' | 'maintenance' | 'restock'
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  assignedTo: string
  dueDate: string
  notes: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  guestId: string
  amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  issuedDate: string
  dueDate: string
  paidDate?: string
}
```

## Performance Characteristics

### Current (Mock Data)

| Metric | Value |
|--------|-------|
| Build time | ~45s (prerendering) |
| Page load | <1s |
| LCP | <1s |
| CLS | 0 |
| TTI | Instant |
| Bundle size | ~150KB |
| Memory usage | <50MB |

### With Database (Expected)

| Metric | Current | With DB |
|--------|---------|---------|
| Page load | <1s | 1-2s |
| API response | N/A | 50-200ms |
| Database query | N/A | 10-100ms |

### Optimization Strategies

1. **Caching** - Redis for frequent queries
2. **Pagination** - Load large datasets in chunks
3. **Indexing** - Database indexes on key columns
4. **CDN** - Static assets via Vercel
5. **Code splitting** - Automatic per route
6. **Image optimization** - Next.js Image component

## Scalability Path

### Phase 1: MVP (Current)
- Mock data + React state
- All features demo-ready
- Static site generation

### Phase 2: Basic Backend
- Add Supabase (PostgreSQL + Auth + Storage)
- Implement core API routes with RLS
- Deploy to production

### Phase 3: Enhanced Features
- Add 15 more API routes
- Implement real-time sync (webhooks)
- Add rate limiting
- Analytics integration

### Phase 4: Enterprise
- Multi-property support
- Team collaboration features
- Advanced reporting
- API for integrations
- Mobile app (React Native)

## Integration Points

### Future Integrations

**Payment Processing**
- Stripe for credit card payments
- Webhook for payment confirmations
- Invoice generation

**OTA Channels**
- Airbnb API for bookings sync
- Booking.com extranet
- Google Hotels
- Expedia

**Communication**
- SendGrid for email
- Twilio for SMS
- Slack notifications

**Analytics**
- Google Analytics 4
- Mixpanel for events
- Sentry for error tracking

## Security Architecture

**In Transit:**
- HTTPS everywhere (Vercel auto-issued)
- TLS 1.3 minimum

**At Rest:**
- Database and Storage encryption at Supabase
- API key encryption
- Secure session cookies (Supabase Auth)

**Authentication:**
- Supabase Auth with secure password hashing
- Two-factor authentication (optional, via Supabase)
- Session timeout and refresh token rotation

**Authorization:**
- Role-based access control (`profiles.role`)
- Row Level Security policies on all tenant tables
- Storage bucket policies scoped by organization
- API route verification for staff-only actions

## Migration Strategy

### From Mock Data to Real Data

1. **Week 1:** Set up Supabase project, schema, RLS, Storage buckets
2. **Week 2:** Implement 5 core API routes (/api/guests, /bookings, etc.)
3. **Week 3:** Add Supabase Auth + middleware for dashboard routes
4. **Week 4:** Migrate components to use API instead of mock data
5. **Week 5:** Testing and bug fixes
6. **Week 6:** Deploy to production

**Zero downtime:**
- Both mock data and API exist simultaneously
- Feature flags to switch between data sources
- Rollback capability if issues

## Technology Choices Rationale

| Tech | Alternative | Why Chosen |
|------|-------------|-----------|
| Next.js | Remix, Nuxt | Best React ecosystem, Vercel integration |
| Tailwind | CSS Modules, styled-components | Utility-first, rapid development |
| TypeScript | JavaScript | Type safety, better IDE support |
| Supabase | Neon + separate auth/storage | All-in-one Postgres, Auth, Storage, RLS for multi-tenant SaaS |
| @supabase/ssr | NextAuth, Better Auth | Native Next.js App Router session handling |
| Vercel | AWS, Digital Ocean | Developer experience, auto-scaling |

## Future Architecture Improvements

1. **Microservices** - Separate auth, billing, analytics services
2. **Message Queue** - Async job processing (email, reports)
3. **WebSockets** - Real-time updates for team collaboration
4. **GraphQL** - More flexible API queries
5. **Mobile App** - React Native for iOS/Android
