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
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">Ctrl+K</kbd>) to jump to pages,
          search guests, reservations, rooms, and complaints. Finance tools live under{' '}
          <strong className="font-semibold text-foreground">Finance &amp; admin</strong> in the sidebar.
        </WayfindingTip>
      )
    case 'manager':
      return (
        <WayfindingTip id="nav-basics" role={role} title="Where guest portal settings live">
          Guest requests, feedback, and portal copy are under{' '}
          <strong className="font-semibold text-foreground">Guest portal</strong> in the sidebar — or open the{' '}
          <strong className="font-semibold text-foreground">Guest portal</strong> tab on your dashboard. Use{' '}
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">⌘K</kbd> to search across the
          property.
        </WayfindingTip>
      )
    case 'receptionist':
      return (
        <WayfindingTip id="nav-basics" role={role} title="Front desk shortcuts">
          Today&apos;s arrivals and departures are on your dashboard. Guest requests from the portal appear in{' '}
          <strong className="font-semibold text-foreground">Guest requests</strong> below. Press{' '}
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">⌘K</kbd> to search reservations,
          guests, or rooms.
        </WayfindingTip>
      )
    default:
      return null
  }
}
