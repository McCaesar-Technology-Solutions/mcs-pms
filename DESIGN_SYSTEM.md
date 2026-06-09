# Design System - MOJO APARTMENTS

## Philosophy

MOJO APARTMENTS uses a professional, modern design system inspired by premium SaaS products (Stripe, Linear, Notion). The design emphasizes clarity, hierarchy, and usability while maintaining cultural appropriateness for Ghana's hospitality market.

## Color Palette

Brand theme: **deep royal purple, luxury gold, and white** — premium hospitality feel with strong contrast on the dark sidebar.

### Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Deep Royal Purple | `#22124C` | Sidebar base, headings, icons on light surfaces |
| Purple Gradient | `#2D215B` | Background variations, hover states, overlays |
| Rich Purple | `#3C216C` | Secondary surfaces, buttons, active nav, charts |
| Luxury Gold | `#D4A62E` | Highlights, accents, dividers, card top bars |
| Dark Gold | `#B88D24` | Gold shadows, darker accent states |
| White | `#FFFFFF` | Cards, main text on dark backgrounds |
| Light Gray | `#FAFDFF` | Panel surfaces, card headers, inputs |
| Soft Gray | `#E9ECEF` | Page background, subtle borders |

### Solid utilities (no gradients)
- `gradient-primary` — solid `#3C216C` (CTAs, avatars, icons)
- `gradient-accent` — solid gold `#D4A62E`
- `gradient-brand` — solid rich purple
- Surfaces use flat `var(--card)`, `var(--secondary)`, `var(--background)`

### Semantic Colors
- **Success (Gold)**: `#D4A62E` — completed tasks, positive KPIs (brand-aligned)
- **Warning (Amber)**: `#F59E0B` — pending actions, cautions
- **Danger (Red)**: `#DC2626` — urgent actions, errors
- **Info (Blue)**: `#3B82F6` — informational content (secondary only)

### Neutral Colors
- **Foreground**: `#22124C` — headings and primary text on light surfaces
- **Muted**: `#5E5872` — secondary text
- **Background**: `#E9ECEF` — page background (soft gray)
- **Secondary surface**: `#FAFDFF` — trays, inset panels, amenities-style panels
- **Card**: `#FFFFFF` — component backgrounds

### Sidebar Colors
- **Sidebar Background**: `#22124C` (deep royal purple)
- **Sidebar Active**: rich purple (`#3C216C`)
- **Sidebar Dividers**: luxury gold at low opacity (`#D4A62E`)
- **Sidebar Text**: `#FFFFFF`
- **Sidebar Muted text**: white at 68% opacity

## Typography

### Font Family
- **Primary Font**: DM Sans
  - Modern, geometric sans-serif
  - Highly legible at all sizes
  - Professional appearance
  - Google Fonts: https://fonts.google.com/specimen/DM+Sans

- **Monospace Font**: JetBrains Mono
  - For code, technical content
  - Clear distinction for system-generated text
  - Used in billing/invoice contexts

### Type Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 36px | 600 | Page titles |
| H1 | 32px | 600 | Major section headers |
| H2 | 24px | 600 | Section headers |
| H3 | 18px | 600 | Subsection headers |
| Body Large | 16px | 400 | Primary body text |
| Body | 14px | 400 | Default body text |
| Body Small | 12px | 400 | Secondary text |
| Label | 12px | 600 | Form labels, badges |
| Caption | 11px | 500 | Captions, hints |

### Line Heights
- Display/Headings: 1.2 (leading-tight)
- Body Text: 1.5 (leading-relaxed)
- Captions: 1.4 (leading-normal)

## Elevation & Depth

### Shadow Levels

```css
/* Elevation 1 - Subtle hover state */
shadow-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.05);

/* Elevation 2 - Standard cards */
shadow-elevation-2: 0 4px 12px rgba(0, 0, 0, 0.08);

/* Elevation 3 - Lifted hover state */
shadow-elevation-3: 0 8px 24px rgba(0, 0, 0, 0.1);

/* Elevation 4 - Modal/dialog level */
shadow-elevation-4: 0 12px 32px rgba(0, 0, 0, 0.12);
```

### Stacking Order (Z-Index)
- Content: 0 (default)
- Tooltips: 30
- Popovers: 35
- Modals: 40
- Navbar: 50
- Alerts: 60

## Spacing System

Based on 4px grid:

| Value | Pixels | Usage |
|-------|--------|-------|
| xs | 4px | Minimal spacing, borders |
| sm | 8px | Compact spacing |
| md | 16px | Standard padding |
| lg | 24px | Section spacing |
| xl | 32px | Large section gaps |
| 2xl | 48px | Page margins |

## Components

### KPI Cards
- **Structure**: Icon (left) + Data (center) + Accent bar (top)
- **Padding**: 24px
- **Border**: 0.5px solid #E5E7EB
- **Shadow**: elevation-2, hover → elevation-3
- **Hover**: Lift 4px (-translate-y-1), subtle gradient overlay
- **Icon Container**: Colored background matching metric (purple, gold, blue, amber)

### Tables
- **Header**: Gradient background (secondary/50 to secondary/25)
- **Rows**: Alternating white and light gray (bg-secondary/30)
- **Borders**: 0.5px #E5E7EB between rows
- **Hover**: bg-primary/5 with smooth transition
- **Padding**: 16px

### Badges/Chips
- **Padding**: 8px 12px
- **Border Radius**: 9999px (fully rounded)
- **Font Size**: 12px
- **Font Weight**: 600
- **Shadow**: elevation-1
- **States**:
  - Success: bg-amber-500 text-[#1A1025] or bg-primary text-white
  - Warning: bg-amber-600 text-white
  - Danger: bg-red-600 text-white
  - Info: bg-blue-600 text-white

### Buttons
- **Padding**: 10px 16px (standard), 8px 12px (small)
- **Border Radius**: 8px
- **Font Weight**: 600
- **Transitions**: 200ms smooth
- **States**:
  - Default: bg-primary text-white
  - Hover: bg-primary/90
  - Active: bg-primary/80
  - Disabled: bg-gray-300 text-gray-500

### Input Fields
- **Padding**: 12px 16px
- **Border**: 0.5px solid #E5E7EB
- **Border Radius**: 8px
- **Focus**: border-primary ring-primary/20
- **Background**: bg-white
- **Font Size**: 14px

### Cards
- **Padding**: 24px
- **Border**: 0.5px solid #E5E7EB / elevation-2 shadow
- **Border Radius**: 12px
- **Background**: white
- **Header Separator**: bottom border 0.5px #E5E7EB/50

## Layout System

### Grid Breakpoints
- **Mobile**: 320px - 640px
- **Tablet**: 641px - 1024px
- **Desktop**: 1025px+

### Column Layouts
- **Mobile**: Single column (full width)
- **Tablet**: 2-3 columns (16px gap)
- **Desktop**: 4+ columns (24px gap)

### Navbar Layout
- **Height**: 64px (4rem)
- **Position**: Fixed top, z-50
- **Padding**: 16px (6 sides)
- **Flex**: items-center justify-between

### Sidebar Layout
- **Width**: 16rem (256px) expanded, 5rem (80px) collapsed
- **Height**: calc(100vh - 4rem)
- **Position**: Fixed left after navbar
- **Overflow**: overflow-y-auto
- **Transition**: 300ms smooth

### Content Area
- **Height**: calc(100vh - 4rem)
- **Overflow**: overflow-y-auto
- **Padding**: 24px (p-6)
- **Gap**: 24px between sections

## Animations & Transitions

### Standard Transitions
- **Duration**: 300ms (300ms for most interactive elements)
- **Timing**: cubic-bezier(0.4, 0, 0.2, 1) (ease-out)
- **Properties**: All (for simplicity), specific properties preferred in production

### Common Animations
- **Hover Lift**: translateY(-4px)
- **Fade In**: opacity 0 → 1
- **Scale**: scale(1) on hover, scale(0.98) on active
- **Color Change**: smooth color transition

## Accessibility

### WCAG 2.1 AA Compliance
- **Color Contrast**: Minimum 4.5:1 for text, 3:1 for graphics
- **Focus States**: Visible outline or highlight on all interactive elements
- **Keyboard Navigation**: All features accessible via keyboard
- **Screen Reader**: Proper semantic HTML and ARIA labels
- **Motion**: Respects prefers-reduced-motion

### Semantic HTML
- Use `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`
- Proper heading hierarchy (h1 → h6)
- Form labels associated with inputs
- Descriptive alt text for images
- ARIA roles where semantic HTML insufficient

## Dark Mode

The system includes a dark mode theme (defined in globals.css) with adjusted colors:
- **Background**: `#1A0E3A` (deep royal purple)
- **Foreground**: `#FFFFFF`
- **Card**: `#2D215B` (purple gradient)
- **Primary**: `#3C216C` (rich purple)
- **Accent**: `#D4A62E` (luxury gold)
- **Sidebar**: `#22124C` (deep royal purple)

## Icons

### Icon Library
- **Name**: Lucide React
- **Size**: 16px, 20px, 24px (use consistent sizing)
- **Stroke Width**: 2px default
- **Color**: Inherit from text color
- **Usage**: Buttons, navigation, status indicators

### Icon Guidelines
- Use 24px for primary actions
- Use 20px for secondary actions
- Use 16px for badges or compact spaces
- Always include fallback text labels
- Never use emoji as icon replacement

## Responsive Design

### Mobile-First Approach
1. Design for 375px width first
2. Add breakpoints for larger screens
3. Use Tailwind responsive prefixes: sm:, md:, lg:, xl:

### Common Patterns
- **Stacked on Mobile**: 1 column → grid-cols-2 → grid-cols-4
- **Hidden on Mobile**: hidden md:block
- **Adjusted Padding**: px-4 md:px-6 lg:px-8
- **Text Sizing**: text-sm md:text-base lg:text-lg

## Usage Examples

### KPI Card
```tsx
<div className="relative overflow-hidden rounded-lg bg-white shadow-elevation-2 transition-all hover:shadow-elevation-3 hover:-translate-y-1 duration-300 group">
  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100"></div>
  <div className="absolute top-0 left-0 h-1 right-0 bg-gradient-to-r from-primary via-primary/70 to-transparent"></div>
  <div className="relative p-6 z-10">
    {/* Content */}
  </div>
</div>
```

### Data Table
```tsx
<div className="bg-white rounded-lg shadow-elevation-2 overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-gradient-to-r from-secondary/50 to-secondary/25 border-b border-border/50">
      {/* Headers */}
    </thead>
    <tbody>
      {data.map((item, idx) => (
        <tr className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gradient-to-r from-secondary/20 to-transparent'} hover:bg-primary/5`}>
          {/* Cells */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

**Design System Version**: 1.0.0
**Last Updated**: June 2026
