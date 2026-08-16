import { WayfindingTip } from '@/components/dashboard/wayfinding-tip'
import type { Profile } from '@/types'

interface RoleWayfindingPanelProps {
  role: Profile['role']
}

export function RoleWayfindingPanel({ role }: RoleWayfindingPanelProps) {
  switch (role) {
    case 'owner':
      return (
        <WayfindingTip id="nav-basics" role={role} title="Find anything quickly">
          Press <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">⌘K</kbd> (or{' '}
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">Ctrl+K</kbd>) to search live
          data — guests, rooms, bookings, complaints, and more. Guest requests from the portal are on the dashboard{' '}
          <strong className="font-semibold text-foreground">Requests</strong> tab. Portal Wi‑Fi and rules stay in{' '}
          <strong className="font-semibold text-foreground">Settings → Guest portal</strong>.
        </WayfindingTip>
      )
    case 'manager':
      return (
        <WayfindingTip id="nav-basics" role={role} title="Requests vs portal settings">
          Guest requests (housekeeping, late checkout, extensions) are on the dashboard{' '}
          <strong className="font-semibold text-foreground">Requests</strong> tab. Wi‑Fi, rules, and portal copy
          stay on <strong className="font-semibold text-foreground">Guest portal</strong>. Share QR codes, links,
          and PINs from <strong className="font-semibold text-foreground">Guests</strong> in the sidebar.
        </WayfindingTip>
      )
    case 'receptionist':
      return (
        <WayfindingTip id="nav-basics" role={role} title="Front desk shortcuts">
          Today&apos;s arrivals and departures are on your dashboard. Guest requests from the portal appear in the{' '}
          <strong className="font-semibold text-foreground">Requests</strong> tab. Press{' '}
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">⌘K</kbd> to search reservations,
          guests, or rooms.
        </WayfindingTip>
      )
    default:
      return null
  }
}
